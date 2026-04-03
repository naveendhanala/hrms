import { Router, Response } from 'express';
import db from '../db';
import { authenticateToken, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();

// GET /api/payroll/salary-master — all employees with their saved salary
router.get('/salary-master', authenticateToken, requireRole('admin', 'hr'), (_req: AuthRequest, res: Response) => {
  const rows = db.prepare(`
    SELECT u.id AS employee_id, u.name AS employee_name, u.role AS employee_role,
           COALESCE(s.basic_salary, 0) AS basic_salary,
           COALESCE(s.allowances,   0) AS allowances,
           COALESCE(s.deductions,   0) AS deductions,
           s.updated_at
    FROM users u
    LEFT JOIN salary_master s ON s.employee_id = u.id
    WHERE u.role != 'admin'
    ORDER BY u.name ASC
  `).all();
  res.json(rows);
});

// PUT /api/payroll/salary-master/:userId — upsert salary for one employee
router.put('/salary-master/:userId', authenticateToken, requireRole('admin', 'hr'), (req: AuthRequest, res: Response) => {
  const { basic_salary, allowances, deductions } = req.body;
  const now = new Date().toISOString();

  const user = db.prepare("SELECT id FROM users WHERE id = ? AND role != 'admin'").get(req.params.userId);
  if (!user) return res.status(404).json({ error: 'Employee not found' });

  db.prepare(`
    INSERT INTO salary_master (employee_id, basic_salary, allowances, deductions, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(employee_id) DO UPDATE SET
      basic_salary = excluded.basic_salary,
      allowances   = excluded.allowances,
      deductions   = excluded.deductions,
      updated_at   = excluded.updated_at
  `).run(
    Number(req.params.userId),
    basic_salary ?? 0,
    allowances   ?? 0,
    deductions   ?? 0,
    now
  );

  res.json({ ok: true });
});

// GET /api/payroll?month=&year= — get run + records for a month
router.get('/', authenticateToken, requireRole('admin', 'hr'), (req: AuthRequest, res: Response) => {
  const now = new Date();
  const month = req.query.month ? Number(req.query.month) : now.getMonth() + 1;
  const year  = req.query.year  ? Number(req.query.year)  : now.getFullYear();

  const run = db.prepare(
    'SELECT pr.*, u.name as created_by_name FROM payroll_runs pr JOIN users u ON pr.created_by = u.id WHERE pr.month = ? AND pr.year = ?'
  ).get(month, year) as any;

  if (!run) return res.json(null);

  const records = db.prepare(`
    SELECT r.*, u.name as employee_name, u.role as employee_role,
           m.name as manager_name,
           (r.basic_salary + r.allowances) as gross_salary,
           (r.basic_salary + r.allowances - r.deductions) as net_salary
    FROM payroll_records r
    JOIN users u ON r.employee_id = u.id
    LEFT JOIN users m ON u.reporting_manager_id = m.id
    WHERE r.run_id = ?
    ORDER BY u.name ASC
  `).all(run.id);

  res.json({ ...run, records });
});

// GET /api/payroll/history — list all past runs
router.get('/history', authenticateToken, requireRole('admin', 'hr'), (_req: AuthRequest, res: Response) => {
  const runs = db.prepare(`
    SELECT pr.*, u.name as created_by_name,
           COUNT(r.id) as employee_count,
           SUM(r.basic_salary + r.allowances - r.deductions) as total_net
    FROM payroll_runs pr
    JOIN users u ON pr.created_by = u.id
    LEFT JOIN payroll_records r ON r.run_id = pr.id
    GROUP BY pr.id
    ORDER BY pr.year DESC, pr.month DESC
  `).all();
  res.json(runs);
});

// POST /api/payroll — generate a new payroll run for a month
router.post('/', authenticateToken, requireRole('admin', 'hr'), (req: AuthRequest, res: Response) => {
  const { month, year } = req.body;
  if (!month || !year) return res.status(400).json({ error: 'month and year are required' });

  const existing = db.prepare('SELECT id FROM payroll_runs WHERE month = ? AND year = ?').get(month, year);
  if (existing) return res.status(409).json({ error: 'Payroll run already exists for this month' });

  const now = new Date().toISOString();
  const run = db.prepare(
    'INSERT INTO payroll_runs (month, year, status, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(month, year, 'draft', req.user!.id, now, now);

  const runId = run.lastInsertRowid;

  // Create a record for every non-admin employee, pre-filling from salary master
  const employees = db.prepare(`
    SELECT u.id,
           COALESCE(s.basic_salary, 0) AS basic_salary,
           COALESCE(s.allowances,   0) AS allowances,
           COALESCE(s.deductions,   0) AS deductions
    FROM users u
    LEFT JOIN salary_master s ON s.employee_id = u.id
    WHERE u.role != 'admin'
  `).all() as any[];

  const stmt = db.prepare(
    'INSERT INTO payroll_records (run_id, employee_id, basic_salary, allowances, deductions, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );
  for (const emp of employees) stmt.run(runId, emp.id, emp.basic_salary, emp.allowances, emp.deductions, now, now);

  res.status(201).json({ id: runId, month, year, status: 'draft' });
});

// PUT /api/payroll/records/:recordId — update salary components
router.put('/records/:recordId', authenticateToken, requireRole('admin', 'hr'), (req: AuthRequest, res: Response) => {
  const { basic_salary, allowances, deductions } = req.body;
  const now = new Date().toISOString();

  // Only allow edits on draft runs
  const record = db.prepare(
    'SELECT r.*, pr.status FROM payroll_records r JOIN payroll_runs pr ON r.run_id = pr.id WHERE r.id = ?'
  ).get(req.params.recordId) as any;

  if (!record) return res.status(404).json({ error: 'Record not found' });
  if (record.status !== 'draft') return res.status(400).json({ error: 'Cannot edit a processed payroll run' });

  db.prepare(
    'UPDATE payroll_records SET basic_salary = ?, allowances = ?, deductions = ?, updated_at = ? WHERE id = ?'
  ).run(
    basic_salary ?? record.basic_salary,
    allowances   ?? record.allowances,
    deductions   ?? record.deductions,
    now,
    req.params.recordId
  );

  res.json({ ok: true });
});

// PATCH /api/payroll/:runId/status — advance status
router.patch('/:runId/status', authenticateToken, requireRole('admin', 'hr'), (req: AuthRequest, res: Response) => {
  const { status } = req.body;
  const allowed = ['draft', 'processed', 'paid'];
  if (!allowed.includes(status)) return res.status(400).json({ error: 'Invalid status' });

  const now = new Date().toISOString();
  const result = db.prepare(
    'UPDATE payroll_runs SET status = ?, updated_at = ? WHERE id = ?'
  ).run(status, now, req.params.runId);

  if (result.changes === 0) return res.status(404).json({ error: 'Run not found' });
  res.json({ ok: true });
});

export default router;
