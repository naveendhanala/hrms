import { Router, Response } from 'express';
import db from '../db';
import { authenticateToken, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();

router.get('/', authenticateToken, requireRole('admin', 'hr'), async (_req: AuthRequest, res: Response) => {
  const users = await db.query(`
    SELECT u.id, u.emp_id, u.username, u.email, u.name, u.role,
           u.dob, u.date_of_joining, u.project, u.location, u.state, u.site_office, u.designation, u.status,
           u.created_at, u.reporting_manager_id, m.name AS reporting_manager_name
    FROM users u
    LEFT JOIN users m ON u.reporting_manager_id = m.id
    WHERE u.role != 'admin'
    ORDER BY u.created_at DESC
  `);
  res.json(users);
});

router.get('/birthdays', authenticateToken, async (_req: AuthRequest, res: Response) => {
  const rows = await db.query(
    "SELECT id, name, role, designation, location, dob FROM users WHERE dob IS NOT NULL AND dob != '' AND role != 'admin' ORDER BY name ASC",
  );
  res.json(rows);
});

router.get('/managers', authenticateToken, requireRole('admin', 'hr'), async (_req: AuthRequest, res: Response) => {
  const managers = await db.query(
    "SELECT id, name, role FROM users WHERE role IN ('admin','hr','director','projectlead','businesshead') ORDER BY name ASC",
  );
  res.json(managers);
});

router.put('/:id', authenticateToken, requireRole('admin', 'hr'), async (req: AuthRequest, res: Response) => {
  const { name, email, role, emp_id, dob, date_of_joining, project, location, state, site_office, designation, status, reporting_manager_id } = req.body;

  const existing = await db.queryOne('SELECT id FROM users WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'User not found' });

  await db.run(
    `UPDATE users
     SET name = ?, email = ?, role = ?, emp_id = ?, dob = ?, date_of_joining = ?, project = ?, location = ?, state = ?,
         site_office = ?, designation = ?, status = ?, reporting_manager_id = ?
     WHERE id = ?`,
    [name, email, role ?? 'employee', emp_id ?? null, dob ?? null, date_of_joining ?? null, project ?? '', location ?? '', state ?? '',
     site_office ?? '', designation ?? '', status ?? 'active', reporting_manager_id ?? null, req.params.id],
  );

  res.json({ ok: true });
});

router.patch('/:id/manager', authenticateToken, requireRole('admin', 'hr'), async (req: AuthRequest, res: Response) => {
  const { reporting_manager_id } = req.body;
  await db.run('UPDATE users SET reporting_manager_id = ? WHERE id = ?', [reporting_manager_id ?? null, req.params.id]);
  res.json({ ok: true });
});

export default router;
