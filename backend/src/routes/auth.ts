import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../db';
import { JWT_SECRET, authenticateToken, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();

router.post('/login', async (req: AuthRequest, res: Response) => {
  const { username, email, password } = req.body;

  if (!password || (!username && !email)) {
    return res.status(400).json({ error: 'Username/email and password are required' });
  }

  const user = username
    ? await db.queryOne<any>('SELECT * FROM users WHERE username = ?', [username])
    : await db.queryOne<any>('SELECT * FROM users WHERE email = ?', [email]);

  if (!user) return res.status(401).json({ error: 'Invalid credentials' });

  const valid = bcrypt.compareSync(password, user.password_hash);
  if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

  const token = jwt.sign(
    { id: user.id, username: user.username, email: user.email, name: user.name, role: user.role, designation: user.designation ?? '', site_office: user.site_office ?? null },
    JWT_SECRET,
    { expiresIn: '24h' },
  );

  res.json({
    token,
    user: { id: user.id, username: user.username, email: user.email, name: user.name, role: user.role, designation: user.designation ?? '', site_office: user.site_office ?? null },
  });
});

router.get('/me', authenticateToken, async (req: AuthRequest, res: Response) => {
  const user = await db.queryOne<any>('SELECT id, username, email, name, role, designation, site_office, project FROM users WHERE id = ?', [req.user!.id]);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

router.post('/create-employee', authenticateToken, requireRole('admin', 'hr'), async (req: AuthRequest, res: Response) => {
  const {
    username, email, password, name, role, reporting_manager_id,
    emp_id, dob, date_of_joining, project, location, state, site_office, designation, status,
  } = req.body;

  if (!username || !email || !password || !name) {
    return res.status(400).json({ error: 'username, email, password, and name are required' });
  }

  const existing = await db.queryOne('SELECT id FROM users WHERE username = ? OR email = ?', [username, email]);
  if (existing) return res.status(409).json({ error: 'User with this username or email already exists' });

  const hashedPassword = bcrypt.hashSync(password, 10);
  const userRole = role || 'employee';

  const result = await db.run(
    `INSERT INTO users (username, email, password_hash, name, role, reporting_manager_id,
       emp_id, dob, date_of_joining, project, location, state, site_office, designation, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
    [
      username, email, hashedPassword, name, userRole, reporting_manager_id ?? null,
      emp_id ?? null, dob ?? null, date_of_joining ?? null,
      project ?? '', location ?? '', state ?? '', site_office ?? '', designation ?? '', status ?? 'active',
    ],
  );

  res.status(201).json({ id: result.lastInsertRowid, username, email, name, role: userRole });
});

export default router;
