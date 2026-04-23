import { Router, Response } from 'express';
import db from '../db';
import { authenticateToken, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();

function getDaysInMonth(month: number, year: number): number {
  return new Date(year, month, 0).getDate();
}

router.get('/salary-master', authenticateToken, requireRole('admin', 'hr'), async (_req: AuthRequest, res: Response) => {
  const rows = await db.query(`
    SELECT u.id AS employee_id, u.emp_id, u.name AS employee_name, u.role AS employee_role, u.designation AS employee_designation,
           COALESCE(s.basic_salary,       0) AS basic_salary,
           COALESCE(s.hra,                0) AS hra,
           COALESCE(s.meal_allowance,     0) AS meal_allowance,
           COALESCE(s.fuel_allowance,     0) AS fuel_allowance,
           COALESCE(s.driver_allowance,   0) AS driver_allowance,
           COALESCE(s.special_allowance,  0) AS special_allowance,
           COALESCE(s.deductions,         0) AS deductions,
           s.updated_at
    FROM users u
    LEFT JOIN salary_master s ON s.employee_id = u.id
    WHERE u.role != 'admin' AND u.status = 'active'
    ORDER BY u.name ASC
  `);
  res.json(rows);
});

router.put('/salary-master/:userId', authenticateToken, requireRole('admin', 'hr'), async (req: AuthRequest, res: Response) => {
  const { basic_salary, hra, meal_allowance, fuel_allowance, driver_allowance, special_allowance, deductions } = req.body;
  const now = new Date().toISOString();

  const user = await db.queryOne("SELECT id FROM users WHERE id = ? AND role != 'admin'", [req.params.userId]);
  if (!user) return res.status(404).json({ error: 'Employee not found' });

  await db.run(`
    INSERT INTO salary_master (employee_id, basic_salary, hra, meal_allowance, fuel_allowance, driver_allowance, special_allowance, deductions, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(employee_id) DO UPDATE SET
      basic_salary      = excluded.basic_salary,
      hra               = excluded.hra,
      meal_allowance    = excluded.meal_allowance,
      fuel_allowance    = excluded.fuel_allowance,
      driver_allowance  = excluded.driver_allowance,
      special_allowance = excluded.special_allowance,
      deductions        = excluded.deductions,
      updated_at        = excluded.updated_at
  `, [
    Number(req.params.userId),
    basic_salary      ?? 0,
    hra               ?? 0,
    meal_allowance    ?? 0,
    fuel_allowance    ?? 0,
    driver_allowance  ?? 0,
    special_allowance ?? 0,
    deductions        ?? 0,
    now,
  ]);

  res.json({ ok: true });
});

router.get('/', authenticateToken, requireRole('admin', 'hr'), async (req: AuthRequest, res: Response) => {
  const now = new Date();
  const month = req.query.month ? Number(req.query.month) : now.getMonth() + 1;
  const year  = req.query.year  ? Number(req.query.year)  : now.getFullYear();

  const run = await db.queryOne<any>(
    'SELECT pr.*, u.name as created_by_name FROM payroll_runs pr JOIN users u ON pr.created_by = u.id WHERE pr.month = ? AND pr.year = ?',
    [month, year],
  );

  if (!run) return res.json(null);

  const records = await db.query(`
    SELECT r.*, u.emp_id, u.name as employee_name, u.role as employee_role,
           u.designation as employee_designation, u.state as employee_state,
           m.name as manager_name,
           (r.basic_salary + r.allowances) as gross_salary
    FROM payroll_records r
    JOIN users u ON r.employee_id = u.id
    LEFT JOIN users m ON u.reporting_manager_id = m.id
    WHERE r.run_id = ?
    ORDER BY u.name ASC
  `, [run.id]);

  res.json({ ...run, records });
});

router.get('/history', authenticateToken, requireRole('admin', 'hr'), async (_req: AuthRequest, res: Response) => {
  const runs = await db.query(`
    SELECT pr.*, u.name as created_by_name,
           COUNT(r.id) as employee_count,
           SUM(r.basic_salary + r.allowances - r.lop_deduction - r.prof_tax - r.deductions) as total_net
    FROM payroll_runs pr
    JOIN users u ON pr.created_by = u.id
    LEFT JOIN payroll_records r ON r.run_id = pr.id
    GROUP BY pr.id
    ORDER BY pr.year DESC, pr.month DESC
  `);
  res.json(runs);
});

async function buildPayrollRecords(runId: number, month: number, year: number, now: string) {
  const totalDays   = getDaysInMonth(month, year);
  const monthPrefix = `${year}-${String(month).padStart(2, '0')}`;

  const employees = await db.query<any>(`
    SELECT u.id, u.state,
           COALESCE(s.basic_salary,      0) AS basic_salary,
           COALESCE(s.hra,               0) AS hra,
           COALESCE(s.meal_allowance,    0) AS meal_allowance,
           COALESCE(s.fuel_allowance,    0) AS fuel_allowance,
           COALESCE(s.driver_allowance,  0) AS driver_allowance,
           COALESCE(s.special_allowance, 0) AS special_allowance,
           COALESCE(s.deductions,        0) AS deductions
    FROM users u
    LEFT JOIN salary_master s ON s.employee_id = u.id
    WHERE u.role != 'admin' AND u.status = 'active'
  `);

  const stateTaxRows = await db.query<{ state: string; amount: number }>('SELECT state, amount FROM prof_tax_by_state');
  const stateTaxMap = new Map(stateTaxRows.map(r => [r.state.trim().toLowerCase(), r.amount]));

  const insertSql = `
    INSERT INTO payroll_records
      (run_id, employee_id, basic_salary, allowances, meal_allowance, fuel_allowance, driver_allowance, deductions,
       working_days, present_days, leave_days, absent_days, lop_days, lop_deduction, prof_tax, advance_deduction,
       created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  for (const emp of employees) {
    const att = await db.queryOne<any>(`
      SELECT
        COUNT(CASE WHEN status = 'present' THEN 1 END) AS present_days,
        COUNT(CASE WHEN status = 'leave'   THEN 1 END) AS leave_days,
        COUNT(CASE WHEN status = 'absent'  THEN 1 END) AS absent_days
      FROM attendance
      WHERE user_id = ? AND date LIKE ?
    `, [emp.id, `${monthPrefix}%`]);

    const presentDays = att?.present_days ?? 0;
    const leaveDays   = att?.leave_days   ?? 0;
    const absentDays  = att?.absent_days  ?? 0;

    const lopRow = await db.queryOne<any>(`
      SELECT COUNT(*) AS lop_count
      FROM attendance
      WHERE user_id = ? AND date LIKE ? AND lop = true
    `, [emp.id, `${monthPrefix}%`]);

    const lopDays = Number(lopRow?.lop_count ?? 0);
    const totalAllowances = emp.hra + emp.meal_allowance + emp.fuel_allowance + emp.driver_allowance + emp.special_allowance;
    const grossSalary     = emp.basic_salary + totalAllowances;
    const lopDeduction    = totalDays > 0 ? Math.round((lopDays * grossSalary) / totalDays * 100) / 100 : 0;

    const empState = (emp.state || '').trim().toLowerCase();
    const profTax  = empState && stateTaxMap.has(empState) ? stateTaxMap.get(empState)! : 0;

    const advRow = await db.queryOne<{ total: number }>(
      `SELECT COALESCE(SUM(monthly_amt), 0) AS total FROM employee_advances WHERE employee_id = ? AND status = 'active'`,
      [emp.id],
    );
    const advanceDeduction = advRow?.total ?? 0;

    await db.run(insertSql, [
      runId, emp.id, emp.basic_salary, totalAllowances,
      emp.meal_allowance, emp.fuel_allowance, emp.driver_allowance,
      emp.deductions,
      totalDays, presentDays, leaveDays, absentDays, lopDays, lopDeduction, profTax, advanceDeduction,
      now, now,
    ]);
  }
}

router.post('/', authenticateToken, requireRole('admin', 'hr'), async (req: AuthRequest, res: Response) => {
  const { month, year } = req.body;
  if (!month || !year) return res.status(400).json({ error: 'month and year are required' });

  const existing = await db.queryOne('SELECT id FROM payroll_runs WHERE month = ? AND year = ?', [month, year]);
  if (existing) return res.status(409).json({ error: 'Payroll run already exists for this month' });

  const now = new Date().toISOString();
  const run = await db.run(
    'INSERT INTO payroll_runs (month, year, status, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?) RETURNING id',
    [month, year, 'draft', req.user!.id, now, now],
  );

  await buildPayrollRecords(run.lastInsertRowid, month, year, now);

  res.status(201).json({ id: run.lastInsertRowid, month, year, status: 'draft' });
});

router.post('/:runId/regenerate', authenticateToken, requireRole('admin', 'hr'), async (req: AuthRequest, res: Response) => {
  const run = await db.queryOne<any>('SELECT * FROM payroll_runs WHERE id = ?', [req.params.runId]);
  if (!run) return res.status(404).json({ error: 'Payroll run not found' });
  if (run.status !== 'draft') return res.status(400).json({ error: 'Only draft runs can be regenerated' });

  const now = new Date().toISOString();
  await db.run('DELETE FROM payroll_records WHERE run_id = ?', [run.id]);
  await db.run('UPDATE payroll_runs SET updated_at = ? WHERE id = ?', [now, run.id]);
  await buildPayrollRecords(run.id, run.month, run.year, now);

  res.json({ ok: true });
});

router.put('/records/:recordId', authenticateToken, requireRole('admin', 'hr'), async (req: AuthRequest, res: Response) => {
  const { basic_salary, allowances, deductions } = req.body;
  const now = new Date().toISOString();

  const record = await db.queryOne<any>(
    'SELECT r.*, pr.status FROM payroll_records r JOIN payroll_runs pr ON r.run_id = pr.id WHERE r.id = ?',
    [req.params.recordId],
  );

  if (!record) return res.status(404).json({ error: 'Record not found' });
  if (record.status !== 'draft') return res.status(400).json({ error: 'Cannot edit a processed payroll run' });

  await db.run(
    'UPDATE payroll_records SET basic_salary = ?, allowances = ?, deductions = ?, updated_at = ? WHERE id = ?',
    [basic_salary ?? record.basic_salary, allowances ?? record.allowances, deductions ?? record.deductions, now, req.params.recordId],
  );

  res.json({ ok: true });
});

router.patch('/:runId/status', authenticateToken, requireRole('admin', 'hr'), async (req: AuthRequest, res: Response) => {
  const { status } = req.body;
  const allowed = ['draft', 'processed', 'paid'];
  if (!allowed.includes(status)) return res.status(400).json({ error: 'Invalid status' });

  const now = new Date().toISOString();

  const run = await db.queryOne<any>('SELECT status FROM payroll_runs WHERE id = ?', [req.params.runId]);
  if (!run) return res.status(404).json({ error: 'Run not found' });

  const result = await db.run(
    'UPDATE payroll_runs SET status = ?, updated_at = ? WHERE id = ?',
    [status, now, req.params.runId],
  );
  if (result.rowsAffected === 0) return res.status(404).json({ error: 'Run not found' });

  // Apply advance recovery when transitioning draft → processed
  if (status === 'processed' && run.status === 'draft') {
    const records = await db.query<any>('SELECT employee_id, advance_deduction FROM payroll_records WHERE run_id = ?', [req.params.runId]);
    for (const record of records) {
      if (Number(record.advance_deduction) <= 0) continue;
      const advances = await db.query<any>(
        `SELECT * FROM employee_advances WHERE employee_id = ? AND status = 'active'`,
        [record.employee_id],
      );
      for (const adv of advances) {
        const newRecovered = Math.min(Number(adv.recovered) + Number(adv.monthly_amt), Number(adv.amount));
        const newStatus = newRecovered >= Number(adv.amount) ? 'closed' : 'active';
        await db.run(
          'UPDATE employee_advances SET recovered = ?, status = ?, updated_at = ? WHERE id = ?',
          [newRecovered, newStatus, now, adv.id],
        );
      }
    }
  }

  res.json({ ok: true });
});

router.get('/config', authenticateToken, requireRole('admin', 'hr'), async (_req: AuthRequest, res: Response) => {
  const rows = await db.query<{ key: string; value: string }>('SELECT key, value FROM payroll_config');
  const map = Object.fromEntries(rows.map(r => [r.key, r.value]));
  res.json({
    prof_tax_amount: Number(map.prof_tax_amount ?? 200),
    tds_percentage:  Number(map.tds_percentage  ?? 0),
  });
});

router.put('/config', authenticateToken, requireRole('admin', 'hr'), async (req: AuthRequest, res: Response) => {
  const { prof_tax_amount, tds_percentage } = req.body;
  const now = new Date().toISOString();
  const upsert = `
    INSERT INTO payroll_config (key, value, updated_at) VALUES (?, ?, ?)
    ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `;
  if (prof_tax_amount !== undefined) await db.run(upsert, ['prof_tax_amount', String(prof_tax_amount), now]);
  if (tds_percentage  !== undefined) await db.run(upsert, ['tds_percentage',  String(tds_percentage),  now]);
  res.json({ ok: true });
});

// ── TDS Slabs ─────────────────────────────────────────────────────────────────
const DEFAULT_TDS_SLABS = {
  old: [
    { id: 'o1', range: 'Up to ₹2,50,000',              rate: 'Nil' },
    { id: 'o2', range: '₹2,50,001 – ₹5,00,000',        rate: '5%'  },
    { id: 'o3', range: '₹5,00,001 – ₹10,00,000',       rate: '20%' },
    { id: 'o4', range: 'Above ₹10,00,000',              rate: '30%' },
  ],
  new: [
    { id: 'n1', range: 'Up to ₹4,00,000',              rate: 'Nil' },
    { id: 'n2', range: '₹4,00,001 – ₹8,00,000',        rate: '5%'  },
    { id: 'n3', range: '₹8,00,001 – ₹12,00,000',       rate: '10%' },
    { id: 'n4', range: '₹12,00,001 – ₹16,00,000',      rate: '15%' },
    { id: 'n5', range: '₹16,00,001 – ₹20,00,000',      rate: '20%' },
    { id: 'n6', range: '₹20,00,001 – ₹24,00,000',      rate: '25%' },
    { id: 'n7', range: 'Above ₹24,00,000',              rate: '30%' },
  ],
};

router.get('/tds-slabs', authenticateToken, requireRole('admin', 'hr'), async (_req: AuthRequest, res: Response) => {
  const rows = await db.query<{ key: string; value: string }>(
    "SELECT key, value FROM payroll_config WHERE key IN ('tds_slabs_old', 'tds_slabs_new')",
  );
  const map = Object.fromEntries(rows.map(r => [r.key, r.value]));
  res.json({
    old: map.tds_slabs_old ? JSON.parse(map.tds_slabs_old) : DEFAULT_TDS_SLABS.old,
    new: map.tds_slabs_new ? JSON.parse(map.tds_slabs_new) : DEFAULT_TDS_SLABS.new,
  });
});

router.put('/tds-slabs', authenticateToken, requireRole('admin', 'hr'), async (req: AuthRequest, res: Response) => {
  const { regime, slabs } = req.body;
  if (!['old', 'new'].includes(regime) || !Array.isArray(slabs))
    return res.status(400).json({ error: 'regime ("old"|"new") and slabs array are required' });
  const key = regime === 'old' ? 'tds_slabs_old' : 'tds_slabs_new';
  const now = new Date().toISOString();
  await db.run(
    'INSERT INTO payroll_config (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at',
    [key, JSON.stringify(slabs), now],
  );
  res.json({ ok: true });
});

// Returns all unique states from employees with their configured prof tax amounts
router.get('/prof-tax-states', authenticateToken, requireRole('admin', 'hr'), async (_req: AuthRequest, res: Response) => {
  const states = await db.query<{ state: string }>(
    "SELECT DISTINCT state FROM users WHERE state IS NOT NULL AND state != '' AND role != 'admin' ORDER BY state ASC",
  );
  const taxRows = await db.query<{ state: string; amount: number }>('SELECT state, amount FROM prof_tax_by_state');
  const taxMap = Object.fromEntries(taxRows.map(r => [r.state, r.amount]));
  res.json(states.map(s => ({ state: s.state, amount: taxMap[s.state] ?? 0 })));
});

// Upsert prof tax amount for a specific state
router.put('/prof-tax-states', authenticateToken, requireRole('admin', 'hr'), async (req: AuthRequest, res: Response) => {
  const { state, amount } = req.body;
  if (!state || amount === undefined) return res.status(400).json({ error: 'state and amount are required' });
  const now = new Date().toISOString();
  await db.run(
    'INSERT INTO prof_tax_by_state (state, amount, updated_at) VALUES (?, ?, ?) ON CONFLICT (state) DO UPDATE SET amount = excluded.amount, updated_at = excluded.updated_at',
    [state, Number(amount), now],
  );
  res.json({ ok: true });
});

export default router;
