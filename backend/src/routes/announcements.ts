import { Router, Response } from 'express';
import db from '../db';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();

router.get('/', authenticateToken, async (_req: AuthRequest, res: Response) => {
  const rows = await db.query(`
    SELECT a.id, a.content, a.created_at, u.name AS author_name, u.role AS author_role
    FROM announcements a
    JOIN users u ON a.user_id = u.id
    ORDER BY a.created_at DESC
    LIMIT 50
  `);
  res.json(rows);
});

router.post('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  const { content } = req.body;
  if (!content || !String(content).trim()) {
    return res.status(400).json({ error: 'Content is required' });
  }

  const result = await db.run(
    'INSERT INTO announcements (user_id, content, created_at) VALUES (?, ?, ?) RETURNING id',
    [req.user!.id, String(content).trim(), new Date().toISOString()],
  );

  const row = await db.queryOne(`
    SELECT a.id, a.content, a.created_at, u.name AS author_name, u.role AS author_role
    FROM announcements a
    JOIN users u ON a.user_id = u.id
    WHERE a.id = ?
  `, [result.lastInsertRowid]);

  res.status(201).json(row);
});

router.delete('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  const ann = await db.queryOne<{ user_id: number }>('SELECT user_id FROM announcements WHERE id = ?', [req.params.id]);
  if (!ann) return res.status(404).json({ error: 'Not found' });

  const isOwner = ann.user_id === req.user!.id;
  const isPrivileged = req.user!.role === 'admin' || req.user!.role === 'hr';
  if (!isOwner && !isPrivileged) return res.status(403).json({ error: 'Forbidden' });

  await db.run('DELETE FROM announcements WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
});

export default router;
