import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../db';
import { JWT_SECRET, authenticateToken, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();

// POST /login
router.post('/login', (req: AuthRequest, res: Response) => {
  const { username, email, password } = req.body;

  if (!password || (!username && !email)) {
    return res.status(400).json({ error: 'Username/email and password are required' });
  }

  let user: any;
  if (username) {
    user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  } else {
    user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  }

  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const valid = bcrypt.compareSync(password, user.password_hash);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const tokenPayload = {
    id: user.id,
    username: user.username,
    email: user.email,
    name: user.name,
    role: user.role,
  };

  const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '24h' });

  res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      name: user.name,
      role: user.role,
    },
  });
});

// GET /me
router.get('/me', authenticateToken, (req: AuthRequest, res: Response) => {
  res.json({ user: req.user });
});

// POST /create-employee
router.post('/create-employee', authenticateToken, requireRole('admin'), (req: AuthRequest, res: Response) => {
  const { username, email, password, name, role, reporting_manager_id } = req.body;

  if (!username || !email || !password || !name) {
    return res.status(400).json({ error: 'username, email, password, and name are required' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE username = ? OR email = ?').get(username, email);
  if (existing) {
    return res.status(409).json({ error: 'User with this username or email already exists' });
  }

  const hashedPassword = bcrypt.hashSync(password, 10);
  const userRole = role || 'employee';

  const result = db.prepare(
    'INSERT INTO users (username, email, password_hash, name, role, reporting_manager_id) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(username, email, hashedPassword, name, userRole, reporting_manager_id ?? null);

  res.status(201).json({
    id: result.lastInsertRowid,
    username,
    email,
    name,
    role: userRole,
  });
});

export default router;
