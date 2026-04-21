import { Router, Response } from 'express';
import db from '../../db';
import { authenticateToken, requireRole, AuthRequest } from '../../middleware/auth';

const router = Router();

router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  const { search, category } = req.query as { search?: string; category?: string };

  let sql = `
    SELECT a.*, u.name AS author_name
    FROM kb_articles a
    JOIN users u ON u.id = a.created_by
  `;
  const params: any[] = [];
  const conditions: string[] = [];

  if (search) {
    conditions.push('(a.title LIKE ? OR a.content LIKE ? OR a.tags LIKE ?)');
    const like = `%${search}%`;
    params.push(like, like, like);
  }
  if (category && category !== 'All') {
    conditions.push('a.category = ?');
    params.push(category);
  }

  if (conditions.length) sql += ` WHERE ${conditions.join(' AND ')}`;
  sql += ' ORDER BY a.updated_at DESC';

  res.json(await db.query(sql, params));
});

router.get('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  const article = await db.queryOne(`
    SELECT a.*, u.name AS author_name
    FROM kb_articles a
    JOIN users u ON u.id = a.created_by
    WHERE a.id = ?
  `, [req.params.id]);
  if (!article) return res.status(404).json({ error: 'Article not found' });
  res.json(article);
});

router.post('/', authenticateToken, requireRole('admin', 'hr'), async (req: AuthRequest, res: Response) => {
  const { title, content, category, tags } = req.body;
  if (!title) return res.status(400).json({ error: 'title is required' });

  const result = await db.run(
    'INSERT INTO kb_articles (title, content, category, tags, created_by) VALUES (?, ?, ?, ?, ?) RETURNING id',
    [title, content ?? '', category ?? 'General', tags ?? '', req.user!.id],
  );

  res.status(201).json(await db.queryOne(`
    SELECT a.*, u.name AS author_name
    FROM kb_articles a
    JOIN users u ON u.id = a.created_by
    WHERE a.id = ?
  `, [result.lastInsertRowid]));
});

router.put('/:id', authenticateToken, requireRole('admin', 'hr'), async (req: AuthRequest, res: Response) => {
  const existing = await db.queryOne('SELECT id FROM kb_articles WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Article not found' });

  const { title, content, category, tags } = req.body;
  const now = new Date().toISOString();

  await db.run(`
    UPDATE kb_articles SET
      title    = COALESCE(?, title),
      content  = COALESCE(?, content),
      category = COALESCE(?, category),
      tags     = COALESCE(?, tags),
      updated_at = ?
    WHERE id = ?
  `, [title ?? null, content ?? null, category ?? null, tags ?? null, now, req.params.id]);

  res.json(await db.queryOne(`
    SELECT a.*, u.name AS author_name
    FROM kb_articles a
    JOIN users u ON u.id = a.created_by
    WHERE a.id = ?
  `, [req.params.id]));
});

router.delete('/:id', authenticateToken, requireRole('admin', 'hr'), async (req: AuthRequest, res: Response) => {
  const existing = await db.queryOne('SELECT id FROM kb_articles WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Article not found' });

  await db.run('DELETE FROM kb_articles WHERE id = ?', [req.params.id]);
  res.json({ message: 'Article deleted' });
});

export default router;
