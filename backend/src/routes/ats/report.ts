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

  if (positions.length === 0) return res.json([]);

  // Single bulk query: all candidate stage counts for the matched positions
  const jobIds = positions.map((p: any) => p.job_id);
  const candidateCounts = await db.query<{ job_id: string; stage: string; count: number }>(
    `SELECT job_id, stage, COUNT(*) AS count FROM candidates WHERE job_id IN (${jobIds.map(() => '?').join(', ')}) GROUP BY job_id, stage`,
    jobIds,
  );

  // Build nested map: job_id -> stage -> count
  const countMap = new Map<string, Map<string, number>>();
  for (const row of candidateCounts) {
    if (!countMap.has(row.job_id)) countMap.set(row.job_id, new Map());
    countMap.get(row.job_id)!.set(row.stage, Number(row.count));
  }

  const result = positions.map((pos: any) => {
    const stageMap = countMap.get(pos.job_id) || new Map<string, number>();
    const stageCounts: Record<string, number> = {};
    let totalFilled = 0;

    for (const stage of stages) {
      const actualStages = stageMapping[stage] || [stage];
      const count = actualStages.reduce((sum, s) => sum + (stageMap.get(s) || 0), 0);
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
  });

  res.json(result);
});

export default router;
