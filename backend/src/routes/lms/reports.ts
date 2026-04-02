import { Router, Response } from 'express';
import db from '../../db';
import { authenticateToken, requireRole, AuthRequest } from '../../middleware/auth';

const router = Router();

// GET /completions
router.get('/completions', authenticateToken, requireRole('admin'), (req: AuthRequest, res: Response) => {
  const { course_id, user_id } = req.query;

  let where = "WHERE u.role = 'employee'";
  const params: any[] = [];

  if (course_id) {
    where += ' AND c.id = ?';
    params.push(course_id);
  }
  if (user_id) {
    where += ' AND u.id = ?';
    params.push(user_id);
  }

  const rows = db.prepare(
    `SELECT u.id as user_id, u.name as user_name, u.email as user_email,
            c.id as course_id, c.title as course_title,
            a.watched, a.score, a.total, a.submitted_at, a.started_at
     FROM users u
     CROSS JOIN courses c
     LEFT JOIN attempts a ON a.user_id = u.id AND a.course_id = c.id
     ${where}
     ORDER BY u.name, c.title`
  ).all(...params);

  res.json(rows);
});

// GET /employees
router.get('/employees', authenticateToken, requireRole('admin'), (req: AuthRequest, res: Response) => {
  const employees = db.prepare(
    "SELECT id, username, email, name, role FROM users WHERE role = 'employee' ORDER BY name"
  ).all();

  res.json(employees);
});

export default router;
