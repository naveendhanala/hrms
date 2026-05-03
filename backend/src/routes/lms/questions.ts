import { Router, Response } from 'express';
import db from '../../db';
import { authenticateToken, requireRole, AuthRequest } from '../../middleware/auth';

const router = Router();

router.get('/:courseId/questions', authenticateToken, requireRole('admin', 'hr', 'vp_hr'), async (req: AuthRequest, res: Response) => {
  const questions = await db.query(
    'SELECT * FROM questions WHERE course_id = ? ORDER BY id',
    [req.params.courseId],
  );
  res.json(questions);
});

router.post('/:courseId/questions', authenticateToken, requireRole('admin', 'hr', 'vp_hr'), async (req: AuthRequest, res: Response) => {
  const course = await db.queryOne('SELECT id FROM courses WHERE id = ?', [req.params.courseId]);
  if (!course) return res.status(404).json({ error: 'Course not found' });

  const { question_text, option_a, option_b, option_c, option_d, correct_option } = req.body;
  if (!question_text || !option_a || !option_b || !option_c || !option_d || !correct_option) {
    return res.status(400).json({ error: 'All question fields are required' });
  }

  const result = await db.run(
    'INSERT INTO questions (course_id, question_text, option_a, option_b, option_c, option_d, correct_option) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id',
    [req.params.courseId, question_text, option_a, option_b, option_c, option_d, correct_option],
  );

  res.status(201).json(await db.queryOne('SELECT * FROM questions WHERE id = ?', [result.lastInsertRowid]));
});

router.put('/:courseId/questions/:id', authenticateToken, requireRole('admin', 'hr', 'vp_hr'), async (req: AuthRequest, res: Response) => {
  const existing = await db.queryOne(
    'SELECT * FROM questions WHERE id = ? AND course_id = ?',
    [req.params.id, req.params.courseId],
  );
  if (!existing) return res.status(404).json({ error: 'Question not found' });

  const { question_text, option_a, option_b, option_c, option_d, correct_option } = req.body;

  await db.run(
    `UPDATE questions SET
      question_text = COALESCE(?, question_text),
      option_a = COALESCE(?, option_a),
      option_b = COALESCE(?, option_b),
      option_c = COALESCE(?, option_c),
      option_d = COALESCE(?, option_d),
      correct_option = COALESCE(?, correct_option)
     WHERE id = ? AND course_id = ?`,
    [question_text ?? null, option_a ?? null, option_b ?? null,
     option_c ?? null, option_d ?? null, correct_option ?? null,
     req.params.id, req.params.courseId],
  );

  res.json(await db.queryOne('SELECT * FROM questions WHERE id = ?', [req.params.id]));
});

router.delete('/:courseId/questions/:id', authenticateToken, requireRole('admin', 'hr', 'vp_hr'), async (req: AuthRequest, res: Response) => {
  const result = await db.run(
    'DELETE FROM questions WHERE id = ? AND course_id = ?',
    [req.params.id, req.params.courseId],
  );
  if (result.rowsAffected === 0) return res.status(404).json({ error: 'Question not found' });
  res.json({ message: 'Question deleted' });
});

export default router;
