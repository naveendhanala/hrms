import { Router, Response } from 'express';
import db from '../../db';
import { authenticateToken, AuthRequest } from '../../middleware/auth';

const router = Router();

router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  const { project, department } = req.query;

  let where = 'WHERE 1=1';
  const params: any[] = [];

  if (project)    { where += ' AND p.project = ?';    params.push(project); }
  if (department) { where += ' AND p.department = ?'; params.push(department); }

  const rows = await db.query<any>(`
    WITH per_job AS (
      SELECT
        p.project,
        p.level,
        p.department,
        p.role,
        p.total_req,
        COUNT(c.id) FILTER (WHERE c.stage = 'Joined')::int          AS joined,
        COUNT(c.id) FILTER (WHERE c.stage = 'Offer Released')::int  AS offer_released,
        GREATEST(0,
          p.total_req
          - COUNT(c.id) FILTER (WHERE c.stage = 'Joined')
          - COUNT(c.id) FILTER (WHERE c.stage = 'Offer Released')
        )::int AS open
      FROM positions p
      LEFT JOIN candidates c ON c.job_id = p.job_id
      ${where}
      GROUP BY p.job_id, p.project, p.level, p.department, p.role, p.total_req
    )
    SELECT
      project,
      level,
      department,
      role,
      SUM(total_req)::int       AS total_req,
      SUM(joined)::int          AS total_joined,
      SUM(offer_released)::int  AS total_offer_released,
      SUM(open)::int            AS open
    FROM per_job
    GROUP BY project, level, department, role
    ORDER BY project, level, department, role
  `, params);

  res.json(rows);
});

export default router;
