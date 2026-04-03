import { Router, Response } from 'express';
import db from '../db';
import { authenticateToken, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();

// GET /api/users — admin/hr only, list all users except admin
router.get('/', authenticateToken, requireRole('admin', 'hr'), (_req: AuthRequest, res: Response) => {
  const users = db.prepare(`
    SELECT u.id, u.emp_id, u.username, u.email, u.name, u.role,
           u.dob, u.project, u.location, u.status,
           u.created_at, u.reporting_manager_id, m.name AS reporting_manager_name
    FROM users u
    LEFT JOIN users m ON u.reporting_manager_id = m.id
    WHERE u.role != 'admin'
    ORDER BY u.created_at DESC
  `).all();
  res.json(users);
});

// GET /api/users/birthdays — upcoming birthdays (all authenticated users)
router.get('/birthdays', authenticateToken, (_req: AuthRequest, res: Response) => {
  const rows = db.prepare(
    "SELECT id, name, role, dob FROM users WHERE dob IS NOT NULL AND dob != '' AND role != 'admin' ORDER BY name ASC"
  ).all();
  res.json(rows);
});

// GET /api/users/managers — users eligible to be reporting managers
router.get('/managers', authenticateToken, requireRole('admin', 'hr'), (_req: AuthRequest, res: Response) => {
  const managers = db.prepare(
    "SELECT id, name, role FROM users WHERE role IN ('admin','hr','director','projectlead','businesshead') ORDER BY name ASC"
  ).all();
  res.json(managers);
});

// PUT /api/users/:id — update employee details
router.put('/:id', authenticateToken, requireRole('admin', 'hr'), (req: AuthRequest, res: Response) => {
  const { name, email, emp_id, dob, project, location, status, reporting_manager_id } = req.body;
  const now = new Date().toISOString();

  const existing = db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'User not found' });

  db.prepare(`
    UPDATE users
    SET name = ?, email = ?, emp_id = ?, dob = ?, project = ?, location = ?,
        status = ?, reporting_manager_id = ?
    WHERE id = ?
  `).run(
    name, email, emp_id ?? null, dob ?? null,
    project ?? '', location ?? '', status ?? 'active',
    reporting_manager_id ?? null, req.params.id
  );

  res.json({ ok: true });
});

// PATCH /api/users/:id/manager — set or clear reporting manager
router.patch('/:id/manager', authenticateToken, requireRole('admin', 'hr'), (req: AuthRequest, res: Response) => {
  const { reporting_manager_id } = req.body;
  db.prepare('UPDATE users SET reporting_manager_id = ? WHERE id = ?')
    .run(reporting_manager_id ?? null, req.params.id);
  res.json({ ok: true });
});

export default router;
