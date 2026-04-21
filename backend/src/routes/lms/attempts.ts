import { Router, Response } from 'express';
import db from '../../db';
import { authenticateToken, AuthRequest } from '../../middleware/auth';

const router = Router();

router.get('/my', authenticateToken, async (req: AuthRequest, res: Response) => {
  const attempts = await db.query(
    `SELECT a.*, c.title as course_title
     FROM attempts a
     JOIN courses c ON a.course_id = c.id
     WHERE a.user_id = ?
     ORDER BY a.submitted_at DESC`,
    [req.user!.id],
  );
  res.json(attempts);
});

router.get('/:courseId', authenticateToken, async (req: AuthRequest, res: Response) => {
  const attempt = await db.queryOne(
    'SELECT * FROM attempts WHERE course_id = ? AND user_id = ?',
    [req.params.courseId, req.user!.id],
  );
  res.json(attempt || null);
});

router.post('/:courseId/watch', authenticateToken, async (req: AuthRequest, res: Response) => {
  const course = await db.queryOne('SELECT id FROM courses WHERE id = ?', [req.params.courseId]);
  if (!course) return res.status(404).json({ error: 'Course not found' });

  const existing = await db.queryOne(
    'SELECT * FROM attempts WHERE course_id = ? AND user_id = ?',
    [req.params.courseId, req.user!.id],
  );

  if (existing) {
    await db.run(
      'UPDATE attempts SET watched = 1 WHERE course_id = ? AND user_id = ?',
      [req.params.courseId, req.user!.id],
    );
  } else {
    await db.run(
      'INSERT INTO attempts (user_id, course_id, watched) VALUES (?, ?, 1)',
      [req.user!.id, req.params.courseId],
    );
  }

  res.json(await db.queryOne(
    'SELECT * FROM attempts WHERE course_id = ? AND user_id = ?',
    [req.params.courseId, req.user!.id],
  ));
});

router.get('/:courseId/quiz', authenticateToken, async (req: AuthRequest, res: Response) => {
  const course = await db.queryOne('SELECT id FROM courses WHERE id = ?', [req.params.courseId]);
  if (!course) return res.status(404).json({ error: 'Course not found' });

  const questions = await db.query(
    'SELECT id, course_id, question_text, option_a, option_b, option_c, option_d, order_index FROM questions WHERE course_id = ? ORDER BY order_index, id',
    [req.params.courseId],
  );
  res.json(questions);
});

router.post('/:courseId/submit', authenticateToken, async (req: AuthRequest, res: Response) => {
  const course = await db.queryOne('SELECT id FROM courses WHERE id = ?', [req.params.courseId]);
  if (!course) return res.status(404).json({ error: 'Course not found' });

  const { answers } = req.body;
  if (!answers || typeof answers !== 'object') {
    return res.status(400).json({ error: 'answers object is required' });
  }

  const questions = await db.query<any>(
    'SELECT id, correct_option FROM questions WHERE course_id = ?',
    [req.params.courseId],
  );
  if (questions.length === 0) return res.status(400).json({ error: 'No questions found for this course' });

  let correct = 0;
  for (const q of questions) {
    if (answers[String(q.id)] === q.correct_option) correct++;
  }

  const now = new Date().toISOString();
  const existing = await db.queryOne(
    'SELECT * FROM attempts WHERE course_id = ? AND user_id = ?',
    [req.params.courseId, req.user!.id],
  );

  if (existing) {
    await db.run(
      'UPDATE attempts SET score = ?, total = ?, answers = ?, submitted_at = ? WHERE course_id = ? AND user_id = ?',
      [correct, questions.length, JSON.stringify(answers), now, req.params.courseId, req.user!.id],
    );
  } else {
    await db.run(
      'INSERT INTO attempts (user_id, course_id, watched, score, total, answers, submitted_at) VALUES (?, ?, 0, ?, ?, ?, ?)',
      [req.user!.id, req.params.courseId, correct, questions.length, JSON.stringify(answers), now],
    );
  }

  const attempt = await db.queryOne(
    'SELECT * FROM attempts WHERE course_id = ? AND user_id = ?',
    [req.params.courseId, req.user!.id],
  );

  res.json({ score: correct, total: questions.length, correct, attempt });
});

export default router;
