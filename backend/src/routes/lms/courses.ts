import { Router, Response } from 'express';
import db from '../../db';
import { authenticateToken, requireRole, AuthRequest } from '../../middleware/auth';

const router = Router();

router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  if (req.user?.role === 'admin') {
    return res.json(await db.query<any>('SELECT * FROM courses ORDER BY created_at DESC'));
  }

  // Single JOIN — eliminates N+1 per-course attempt lookup
  const rows = await db.query<any>(
    `SELECT c.*,
            a.id AS _att_id, a.watched, a.score, a.total, a.answers, a.submitted_at, a.started_at
     FROM courses c
     LEFT JOIN attempts a ON a.course_id = c.id AND a.user_id = ?
     ORDER BY c.created_at DESC`,
    [req.user!.id],
  );

  const result = rows.map((row: any) => {
    const { _att_id, watched, score, total, answers, submitted_at, started_at, ...course } = row;
    return {
      ...course,
      attempt: _att_id
        ? { id: _att_id, user_id: req.user!.id, course_id: course.id, watched, score, total, answers, submitted_at, started_at }
        : null,
    };
  });

  res.json(result);
});

router.get('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  const course = await db.queryOne('SELECT * FROM courses WHERE id = ?', [req.params.id]);
  if (!course) return res.status(404).json({ error: 'Course not found' });

  // Questions and attempt are independent — fetch in parallel
  const [questions, attempt] = await Promise.all([
    req.user?.role === 'admin'
      ? db.query('SELECT * FROM questions WHERE course_id = ? ORDER BY order_index, id', [req.params.id])
      : db.query(
          'SELECT id, course_id, question_text, option_a, option_b, option_c, option_d, order_index FROM questions WHERE course_id = ? ORDER BY order_index, id',
          [req.params.id],
        ),
    db.queryOne('SELECT * FROM attempts WHERE course_id = ? AND user_id = ?', [req.params.id, req.user!.id]),
  ]);

  res.json({ ...(course as any), questions, attempt: attempt || null });
});

router.post('/', authenticateToken, requireRole('admin', 'hr'), async (req: AuthRequest, res: Response) => {
  const { title, description, youtube_url } = req.body;
  if (!title || !youtube_url) return res.status(400).json({ error: 'title and youtube_url are required' });

  const result = await db.run(
    'INSERT INTO courses (title, description, youtube_url, created_by) VALUES (?, ?, ?, ?) RETURNING id',
    [title, description || '', youtube_url, req.user!.id],
  );

  res.status(201).json(await db.queryOne('SELECT * FROM courses WHERE id = ?', [result.lastInsertRowid]));
});

router.put('/:id', authenticateToken, requireRole('admin', 'hr'), async (req: AuthRequest, res: Response) => {
  const existing = await db.queryOne('SELECT * FROM courses WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Course not found' });

  const { title, description, youtube_url } = req.body;
  const now = new Date().toISOString();

  await db.run(
    `UPDATE courses SET
      title = COALESCE(?, title),
      description = COALESCE(?, description),
      youtube_url = COALESCE(?, youtube_url),
      updated_at = ?
     WHERE id = ?`,
    [title ?? null, description ?? null, youtube_url ?? null, now, req.params.id],
  );

  res.json(await db.queryOne('SELECT * FROM courses WHERE id = ?', [req.params.id]));
});

router.delete('/:id', authenticateToken, requireRole('admin', 'hr'), async (req: AuthRequest, res: Response) => {
  const existing = await db.queryOne('SELECT * FROM courses WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Course not found' });

  await db.run('DELETE FROM attempts WHERE course_id = ?', [req.params.id]);
  await db.run('DELETE FROM questions WHERE course_id = ?', [req.params.id]);
  await db.run('DELETE FROM courses WHERE id = ?', [req.params.id]);

  res.json({ message: 'Course deleted' });
});

export default router;
