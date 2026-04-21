import { Router, Response } from 'express';
import db from '../../db';
import { authenticateToken, AuthRequest } from '../../middleware/auth';

const router = Router();

const stages = ['Screening', 'Technical Round 1', 'Technical Round 2', 'HR Round', 'Offer', 'Joined', 'Rejected'];

const stageMapping: Record<string, string[]> = {
  'Screening':         ['Profile shared with interviewer'],
  'Technical Round 1': ['Technical Round 1'],
  'Technical Round 2': ['Technical Round 2'],
  'HR Round':          ['HR Round'],
  'Offer':             ['Offer Negotiation', 'Offer Released', 'Offer Dropped'],
  'Joined':            ['Joined'],
  'Rejected':          ['Rejected'],
};

router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  const { status, required_by_date, hr_spoc, department } = req.query;

  let where = 'WHERE 1=1';
  const params: any[] = [];

  if (status)           { where += ' AND p.status = ?';            params.push(status); }
  if (required_by_date) { where += ' AND p.required_by_date = ?';  params.push(required_by_date); }
  if (hr_spoc)          { where += ' AND p.hr_spoc = ?';           params.push(hr_spoc); }
  if (department)       { where += ' AND p.department = ?';        params.push(department); }

  const positions = await db.query<any>(`SELECT * FROM positions p ${where} ORDER BY p.created_at DESC`, params);

  const result = await Promise.all(positions.map(async (pos: any) => {
    const stageCounts: Record<string, number> = {};
    let totalFilled = 0;

    for (const stage of stages) {
      const actualStages = stageMapping[stage] || [stage];
      const placeholders = actualStages.map(() => '?').join(', ');
      const row = await db.queryOne<any>(
        `SELECT COUNT(*) as count FROM candidates WHERE job_id = ? AND stage IN (${placeholders})`,
        [pos.job_id, ...actualStages],
      );
      const count = row?.count || 0;
      stageCounts[stage] = count;
      if (stage === 'Joined') totalFilled = count;
    }

    return {
      job_id: pos.job_id,
      project: pos.project,
      department: pos.department,
      role: pos.role,
      total_req: pos.total_req,
      required_by_date: pos.required_by_date,
      hr_spoc: pos.hr_spoc,
      stage_counts: stageCounts,
      open: Math.max(0, (pos.total_req || 0) - totalFilled),
    };
  }));

  res.json(result);
});

export default router;
