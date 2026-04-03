import { Router, Response } from 'express';
import db from '../db';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();

// GET /api/announcements — all authenticated users
router.get('/', authenticateToken, (_req: AuthRequest, res: Response) => {
  const rows = db.prepare(`
    SELECT a.id, a.content, a.created_at, u.name AS author_name, u.role AS author_role
    FROM announcements a
    JOIN users u ON a.user_id = u.id
    ORDER BY a.created_at DESC
    LIMIT 50
  `).all();
  res.json(rows);
});

// POST /api/announcements — any authenticated user
router.post('/', authenticateToken, (req: AuthRequest, res: Response) => {
  const { content } = req.body;
  if (!content || !String(content).trim()) {
    return res.status(400).json({ error: 'Content is required' });
  }
  const result = db.prepare(
    'INSERT INTO announcements (user_id, content) VALUES (?, ?)'
  ).run(req.user!.id, String(content).trim());

  const row = db.prepare(`
    SELECT a.id, a.content, a.created_at, u.name AS author_name, u.role AS author_role
    FROM announcements a
    JOIN users u ON a.user_id = u.id
    WHERE a.id = ?
  `).get(result.lastInsertRowid);

  res.status(201).json(row);
});

// DELETE /api/announcements/:id — own post, or admin/hr
router.delete('/:id', authenticateToken, (req: AuthRequest, res: Response) => {
  const ann = db.prepare('SELECT user_id FROM announcements WHERE id = ?').get(req.params.id) as { user_id: number } | undefined;
  if (!ann) return res.status(404).json({ error: 'Not found' });

  const isOwner = ann.user_id === req.user!.id;
  const isPrivileged = req.user!.role === 'admin' || req.user!.role === 'hr';
  if (!isOwner && !isPrivileged) return res.status(403).json({ error: 'Forbidden' });

  db.prepare('DELETE FROM announcements WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

export default router;
