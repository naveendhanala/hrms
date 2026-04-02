import { Router, Response } from 'express';
import db from '../../db';
import { authenticateToken, AuthRequest } from '../../middleware/auth';

const router = Router();

// GET /my
router.get('/my', authenticateToken, (req: AuthRequest, res: Response) => {
  const attempts = db.prepare(
    `SELECT a.*, c.title as course_title
     FROM attempts a
     JOIN courses c ON a.course_id = c.id
     WHERE a.user_id = ?
     ORDER BY a.submitted_at DESC`
  ).all(req.user!.id);

  res.json(attempts);
});

// GET /:courseId
router.get('/:courseId', authenticateToken, (req: AuthRequest, res: Response) => {
  const attempt = db.prepare(
    'SELECT * FROM attempts WHERE course_id = ? AND user_id = ?'
  ).get(req.params.courseId, req.user!.id);

  if (!attempt) {
    return res.json(null);
  }
  res.json(attempt);
});

// POST /:courseId/watch
router.post('/:courseId/watch', authenticateToken, (req: AuthRequest, res: Response) => {
  const course = db.prepare('SELECT id FROM courses WHERE id = ?').get(req.params.courseId);
  if (!course) {
    return res.status(404).json({ error: 'Course not found' });
  }

  const existing = db.prepare(
    'SELECT * FROM attempts WHERE course_id = ? AND user_id = ?'
  ).get(req.params.courseId, req.user!.id) as any;

  if (existing) {
    db.prepare(
      'UPDATE attempts SET watched = 1 WHERE course_id = ? AND user_id = ?'
    ).run(req.params.courseId, req.user!.id);
  } else {
    db.prepare(
      'INSERT INTO attempts (user_id, course_id, watched) VALUES (?, ?, 1)'
    ).run(req.user!.id, req.params.courseId);
  }

  const attempt = db.prepare(
    'SELECT * FROM attempts WHERE course_id = ? AND user_id = ?'
  ).get(req.params.courseId, req.user!.id);

  res.json(attempt);
});

// GET /:courseId/quiz
router.get('/:courseId/quiz', authenticateToken, (req: AuthRequest, res: Response) => {
  const course = db.prepare('SELECT id FROM courses WHERE id = ?').get(req.params.courseId);
  if (!course) {
    return res.status(404).json({ error: 'Course not found' });
  }

  const questions = db.prepare(
    'SELECT id, course_id, question_text, option_a, option_b, option_c, option_d, order_index FROM questions WHERE course_id = ? ORDER BY order_index, id'
  ).all(req.params.courseId);

  res.json(questions);
});

// POST /:courseId/submit
router.post('/:courseId/submit', authenticateToken, (req: AuthRequest, res: Response) => {
  const course = db.prepare('SELECT id FROM courses WHERE id = ?').get(req.params.courseId);
  if (!course) {
    return res.status(404).json({ error: 'Course not found' });
  }

  const { answers } = req.body;
  if (!answers || typeof answers !== 'object') {
    return res.status(400).json({ error: 'answers object is required' });
  }

  const questions = db.prepare(
    'SELECT id, correct_option FROM questions WHERE course_id = ?'
  ).all(req.params.courseId) as any[];

  if (questions.length === 0) {
    return res.status(400).json({ error: 'No questions found for this course' });
  }

  let correct = 0;
  for (const q of questions) {
    if (answers[String(q.id)] === q.correct_option) {
      correct++;
    }
  }

  const now = new Date().toISOString();

  const existing = db.prepare(
    'SELECT * FROM attempts WHERE course_id = ? AND user_id = ?'
  ).get(req.params.courseId, req.user!.id);

  if (existing) {
    db.prepare(
      'UPDATE attempts SET score = ?, total = ?, answers = ?, submitted_at = ? WHERE course_id = ? AND user_id = ?'
    ).run(correct, questions.length, JSON.stringify(answers), now, req.params.courseId, req.user!.id);
  } else {
    db.prepare(
      'INSERT INTO attempts (user_id, course_id, watched, score, total, answers, submitted_at) VALUES (?, ?, 0, ?, ?, ?, ?)'
    ).run(req.user!.id, req.params.courseId, correct, questions.length, JSON.stringify(answers), now);
  }

  const attempt = db.prepare(
    'SELECT * FROM attempts WHERE course_id = ? AND user_id = ?'
  ).get(req.params.courseId, req.user!.id);

  res.json({
    score: correct,
    total: questions.length,
    correct,
    attempt,
  });
});

export default router;
