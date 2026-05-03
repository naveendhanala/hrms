import { Router, Response } from 'express';
import db from '../db';
import { authenticateToken, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();

// Employee submits resignation
router.post('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const existing = await db.queryOne(
    "SELECT id FROM exit_requests WHERE employee_id = ? AND status NOT IN ('revoked')",
    [userId],
  );
  if (existing) return res.status(400).json({ error: 'You already have an active resignation request.' });

  const employee = await db.queryOne<{ level: string; reporting_manager_id: number | null }>(
    'SELECT level, reporting_manager_id FROM users WHERE id = ?',
    [userId],
  );
  if (!employee) return res.status(404).json({ error: 'User not found.' });
  if (!employee.reporting_manager_id) return res.status(400).json({ error: 'No reporting manager assigned. Please contact HR.' });

  const noticeDays = employee.level === 'APM Above' ? 90 : 60;
  const lwd = new Date();
  lwd.setDate(lwd.getDate() + noticeDays);
  const lwdStr = lwd.toISOString().split('T')[0];
  const submittedAt = new Date().toISOString();
  const { reason = '' } = req.body;

  const result = await db.run(
    `INSERT INTO exit_requests (employee_id, submitted_at, notice_period_days, last_working_day, reason, status)
     VALUES (?, ?, ?, ?, ?, 'pending_manager')`,
    [userId, submittedAt, noticeDays, lwdStr, reason],
  );
  res.json({ ok: true, id: result.lastInsertRowid, last_working_day: lwdStr, notice_period_days: noticeDays });
});

// Employee views own request
router.get('/my', authenticateToken, async (req: AuthRequest, res: Response) => {
  const request = await db.queryOne(
    `SELECT er.*, u.name AS employee_name, m.name AS manager_name, v.name AS vp_name
     FROM exit_requests er
     JOIN users u ON er.employee_id = u.id
     LEFT JOIN users m ON er.manager_accepted_by = m.id
     LEFT JOIN users v ON er.vp_accepted_by = v.id
     WHERE er.employee_id = ? AND er.status != 'revoked'
     ORDER BY er.submitted_at DESC LIMIT 1`,
    [req.user!.id],
  );
  res.json(request ?? null);
});

// Employee revokes
router.patch('/revoke', authenticateToken, async (req: AuthRequest, res: Response) => {
  const request = await db.queryOne<{ id: number; status: string }>(
    "SELECT id, status FROM exit_requests WHERE employee_id = ? AND status NOT IN ('revoked','approved')",
    [req.user!.id],
  );
  if (!request) return res.status(404).json({ error: 'No revocable resignation found.' });
  await db.run(
    "UPDATE exit_requests SET status = 'revoked', revoked_at = ? WHERE id = ?",
    [new Date().toISOString(), request.id],
  );
  res.json({ ok: true });
});

// Manager views team exit requests
router.get('/team', authenticateToken, async (req: AuthRequest, res: Response) => {
  const requests = await db.query(
    `SELECT er.id, er.status, er.submitted_at, er.notice_period_days, er.last_working_day,
            er.reason, er.manager_accepted_at, er.vp_accepted_at, er.replacement_job_id,
            u.name AS employee_name, u.designation, u.emp_id, u.project, u.department
     FROM exit_requests er
     JOIN users u ON er.employee_id = u.id
     WHERE u.reporting_manager_id = ? AND er.status != 'revoked'
     ORDER BY er.submitted_at DESC`,
    [req.user!.id],
  );
  res.json(requests);
});

// Manager accepts
router.patch('/:id/manager-accept', authenticateToken, async (req: AuthRequest, res: Response) => {
  const managerId = req.user!.id;
  const request = await db.queryOne<{ id: number; status: string }>(
    `SELECT er.id, er.status FROM exit_requests er
     JOIN users u ON er.employee_id = u.id
     WHERE er.id = ? AND u.reporting_manager_id = ?`,
    [req.params.id, managerId],
  );
  if (!request) return res.status(404).json({ error: 'Request not found or you are not the reporting manager.' });
  if (request.status !== 'pending_manager') return res.status(400).json({ error: 'Not pending manager approval.' });
  await db.run(
    "UPDATE exit_requests SET status = 'pending_vp', manager_accepted_at = ?, manager_accepted_by = ? WHERE id = ?",
    [new Date().toISOString(), managerId, req.params.id],
  );
  res.json({ ok: true });
});

// VP/Admin/HR views all exits
router.get('/all', authenticateToken, requireRole('vp_hr', 'admin', 'hr'), async (_req: AuthRequest, res: Response) => {
  const requests = await db.query(
    `SELECT er.*, u.name AS employee_name, u.designation, u.emp_id, u.project,
            rm.name AS reporting_manager_name, m.name AS manager_accepted_name, v.name AS vp_accepted_name
     FROM exit_requests er
     JOIN users u ON er.employee_id = u.id
     LEFT JOIN users rm ON u.reporting_manager_id = rm.id
     LEFT JOIN users m ON er.manager_accepted_by = m.id
     LEFT JOIN users v ON er.vp_accepted_by = v.id
     ORDER BY er.submitted_at DESC`,
  );
  res.json(requests);
});

// Manager sets replacement job id after creating a position
router.patch('/:id/set-replacement', authenticateToken, async (req: AuthRequest, res: Response) => {
  const { job_id } = req.body;
  if (!job_id) return res.status(400).json({ error: 'job_id is required' });
  const request = await db.queryOne<{ id: number }>(
    `SELECT er.id FROM exit_requests er
     JOIN users u ON er.employee_id = u.id
     WHERE er.id = ? AND u.reporting_manager_id = ?`,
    [req.params.id, req.user!.id],
  );
  if (!request) return res.status(404).json({ error: 'Request not found or not your reportee.' });
  await db.run('UPDATE exit_requests SET replacement_job_id = ? WHERE id = ?', [job_id, req.params.id]);
  res.json({ ok: true });
});

// VP/Admin gives final approval
router.patch('/:id/vp-accept', authenticateToken, requireRole('vp_hr', 'admin'), async (req: AuthRequest, res: Response) => {
  const request = await db.queryOne<{ id: number; status: string }>(
    'SELECT id, status FROM exit_requests WHERE id = ?',
    [req.params.id],
  );
  if (!request) return res.status(404).json({ error: 'Request not found.' });
  if (request.status !== 'pending_vp') return res.status(400).json({ error: 'Not pending VP approval.' });
  await db.run(
    "UPDATE exit_requests SET status = 'approved', vp_accepted_at = ?, vp_accepted_by = ? WHERE id = ?",
    [new Date().toISOString(), req.user!.id, req.params.id],
  );
  res.json({ ok: true });
});

export default router;
