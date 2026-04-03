import { Router, Response } from 'express';
import db from '../../db';
import { authenticateToken, requireRole, AuthRequest } from '../../middleware/auth';

const router = Router();

// GET /
router.get('/', authenticateToken, (req: AuthRequest, res: Response) => {
  const courses = db.prepare('SELECT * FROM courses ORDER BY created_at DESC').all() as any[];

  if (req.user?.role !== 'admin') {
    const result = courses.map((course) => {
      const attempt = db.prepare(
        'SELECT * FROM attempts WHERE course_id = ? AND user_id = ?'
      ).get(course.id, req.user!.id);
      return { ...course, attempt: attempt || null };
    });
    return res.json(result);
  }

  res.json(courses);
});

// GET /:id
router.get('/:id', authenticateToken, (req: AuthRequest, res: Response) => {
  const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(req.params.id);
  if (!course) {
    return res.status(404).json({ error: 'Course not found' });
  }

  let questions;
  if (req.user?.role === 'admin') {
    questions = db.prepare('SELECT * FROM questions WHERE course_id = ? ORDER BY order_index, id').all(req.params.id);
  } else {
    questions = db.prepare(
      'SELECT id, course_id, question_text, option_a, option_b, option_c, option_d, order_index FROM questions WHERE course_id = ? ORDER BY order_index, id'
    ).all(req.params.id);
  }

  const attempt = db.prepare(
    'SELECT * FROM attempts WHERE course_id = ? AND user_id = ?'
  ).get(req.params.id, req.user!.id);

  res.json({ ...course as any, questions, attempt: attempt || null });
});

// POST /
router.post('/', authenticateToken, requireRole('admin', 'hr'), (req: AuthRequest, res: Response) => {
  const { title, description, youtube_url } = req.body;

  if (!title || !youtube_url) {
    return res.status(400).json({ error: 'title and youtube_url are required' });
  }

  const result = db.prepare(
    'INSERT INTO courses (title, description, youtube_url, created_by) VALUES (?, ?, ?, ?)'
  ).run(title, description || '', youtube_url, req.user!.id);

  const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(course);
});

// PUT /:id
router.put('/:id', authenticateToken, requireRole('admin', 'hr'), (req: AuthRequest, res: Response) => {
  const existing = db.prepare('SELECT * FROM courses WHERE id = ?').get(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'Course not found' });
  }

  const { title, description, youtube_url } = req.body;
  const now = new Date().toISOString();

  db.prepare(
    `UPDATE courses SET
      title = COALESCE(?, title),
      description = COALESCE(?, description),
      youtube_url = COALESCE(?, youtube_url),
      updated_at = ?
     WHERE id = ?`
  ).run(title ?? null, description ?? null, youtube_url ?? null, now, req.params.id);

  const updated = db.prepare('SELECT * FROM courses WHERE id = ?').get(req.params.id);
  res.json(updated);
});

// DELETE /:id
router.delete('/:id', authenticateToken, requireRole('admin', 'hr'), (req: AuthRequest, res: Response) => {
  const existing = db.prepare('SELECT * FROM courses WHERE id = ?').get(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'Course not found' });
  }

  db.prepare('DELETE FROM attempts WHERE course_id = ?').run(req.params.id);
  db.prepare('DELETE FROM questions WHERE course_id = ?').run(req.params.id);
  db.prepare('DELETE FROM courses WHERE id = ?').run(req.params.id);

  res.json({ message: 'Course deleted' });
});

export default router;
