import { Router, Response } from 'express';
import db from '../../db';
import { authenticateToken, requireRole, AuthRequest } from '../../middleware/auth';

const router = Router();

router.get('/completions', authenticateToken, requireRole('admin', 'hr', 'vp_hr'), async (req: AuthRequest, res: Response) => {
  const { course_id, user_id } = req.query;

  // When filtering by a specific user or course, skip the CROSS JOIN and query
  // attempts directly — result is bounded to O(courses) or O(employees) respectively.
  // Only use CROSS JOIN for the full matrix (all employees × all courses) which is
  // needed to show "Not Started" rows.
  if (user_id || course_id) {
    let where = 'WHERE 1=1';
    const params: any[] = [];
    if (user_id)   { where += ' AND a.user_id = ?';   params.push(user_id); }
    if (course_id) { where += ' AND a.course_id = ?'; params.push(course_id); }

    const rows = await db.query(
      `SELECT u.id as user_id, u.name as user_name, u.email as user_email,
              c.id as course_id, c.title as course_title,
              a.watched, a.score, a.total, a.submitted_at, a.started_at
       FROM attempts a
       JOIN users u ON u.id = a.user_id
       JOIN courses c ON c.id = a.course_id
       ${where}
       ORDER BY u.name, c.title`,
      params,
    );
    return res.json(rows);
  }

  // No filters: full matrix with CROSS JOIN so "Not Started" rows are included
  const rows = await db.query(
    `SELECT u.id as user_id, u.name as user_name, u.email as user_email,
            c.id as course_id, c.title as course_title,
            a.watched, a.score, a.total, a.submitted_at, a.started_at
     FROM users u
     CROSS JOIN courses c
     LEFT JOIN attempts a ON a.user_id = u.id AND a.course_id = c.id
     WHERE u.role = 'employee'
     ORDER BY u.name, c.title`,
  );
  res.json(rows);
});

router.get('/employees', authenticateToken, requireRole('admin', 'hr', 'vp_hr'), async (_req: AuthRequest, res: Response) => {
  const employees = await db.query(
    "SELECT id, username, email, name, role FROM users WHERE role = 'employee' ORDER BY name",
  );
  res.json(employees);
});

export default router;
