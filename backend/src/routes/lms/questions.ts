import { Router, Response } from 'express';
import db from '../../db';
import { authenticateToken, requireRole, AuthRequest } from '../../middleware/auth';

const router = Router();

// GET /:courseId/questions
router.get('/:courseId/questions', authenticateToken, requireRole('admin'), (req: AuthRequest, res: Response) => {
  const questions = db.prepare(
    'SELECT * FROM questions WHERE course_id = ? ORDER BY id'
  ).all(req.params.courseId);

  res.json(questions);
});

// POST /:courseId/questions
router.post('/:courseId/questions', authenticateToken, requireRole('admin'), (req: AuthRequest, res: Response) => {
  const course = db.prepare('SELECT id FROM courses WHERE id = ?').get(req.params.courseId);
  if (!course) {
    return res.status(404).json({ error: 'Course not found' });
  }

  const { question_text, option_a, option_b, option_c, option_d, correct_option } = req.body;

  if (!question_text || !option_a || !option_b || !option_c || !option_d || !correct_option) {
    return res.status(400).json({ error: 'All question fields are required' });
  }

  const result = db.prepare(
    'INSERT INTO questions (course_id, question_text, option_a, option_b, option_c, option_d, correct_option) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(req.params.courseId, question_text, option_a, option_b, option_c, option_d, correct_option);

  const question = db.prepare('SELECT * FROM questions WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(question);
});

// PUT /:courseId/questions/:id
router.put('/:courseId/questions/:id', authenticateToken, requireRole('admin'), (req: AuthRequest, res: Response) => {
  const existing = db.prepare(
    'SELECT * FROM questions WHERE id = ? AND course_id = ?'
  ).get(req.params.id, req.params.courseId);

  if (!existing) {
    return res.status(404).json({ error: 'Question not found' });
  }

  const { question_text, option_a, option_b, option_c, option_d, correct_option } = req.body;

  db.prepare(
    `UPDATE questions SET
      question_text = COALESCE(?, question_text),
      option_a = COALESCE(?, option_a),
      option_b = COALESCE(?, option_b),
      option_c = COALESCE(?, option_c),
      option_d = COALESCE(?, option_d),
      correct_option = COALESCE(?, correct_option)
     WHERE id = ? AND course_id = ?`
  ).run(
    question_text ?? null, option_a ?? null, option_b ?? null,
    option_c ?? null, option_d ?? null, correct_option ?? null,
    req.params.id, req.params.courseId
  );

  const updated = db.prepare('SELECT * FROM questions WHERE id = ?').get(req.params.id);
  res.json(updated);
});

// DELETE /:courseId/questions/:id
router.delete('/:courseId/questions/:id', authenticateToken, requireRole('admin'), (req: AuthRequest, res: Response) => {
  const result = db.prepare(
    'DELETE FROM questions WHERE id = ? AND course_id = ?'
  ).run(req.params.id, req.params.courseId);

  if (result.changes === 0) {
    return res.status(404).json({ error: 'Question not found' });
  }

  res.json({ message: 'Question deleted' });
});

export default router;
