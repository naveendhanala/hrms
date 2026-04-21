import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../../db';
import { authenticateToken, AuthRequest } from '../../middleware/auth';

const router = Router();

router.get('/pipeline', authenticateToken, async (req: AuthRequest, res: Response) => {
  const stages = [
    'Profile shared with interviewer',
    'Offer Negotiation',
    'Offer Released',
    'Joined',
    'Offer Dropped',
    'Rejected',
  ];

  const positions = await db.query<any>(
    "SELECT * FROM positions WHERE status = 'active' AND (approval_status IS NULL OR approval_status = '' OR approval_status = 'approved')",
  );

  const result = await Promise.all(positions.map(async (pos: any) => {
    const stageCounts: Record<string, number> = {};
    let total = 0;

    for (const stage of stages) {
      const row = await db.queryOne<any>(
        'SELECT COUNT(*) as count FROM candidates WHERE job_id = ? AND stage = ?',
        [pos.job_id, stage],
      );
      const count = row?.count || 0;
      stageCounts[stage] = count;
      total += count;
    }

    return {
      job_id: pos.job_id,
      project: pos.project,
      department: pos.department,
      role: pos.role,
      total_req: pos.total_req,
      required_by_date: pos.required_by_date,
      hr_spoc: pos.hr_spoc,
      total,
      stage_counts: stageCounts,
    };
  }));

  res.json(result);
});

router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  const { status, approval_status } = req.query;

  let where = 'WHERE 1=1';
  const params: any[] = [];

  if (approval_status === 'pending') {
    where += ` AND p.approval_status = 'pending'`;
  } else if (approval_status === 'reviewed') {
    where += ` AND (p.approval_status = 'approved' OR p.approval_status = 'rejected')`;
  } else if (approval_status === 'requests') {
    where += ` AND p.approval_status IS NOT NULL AND p.approval_status != ''`;
  } else {
    where += ` AND (p.approval_status IS NULL OR p.approval_status = '' OR p.approval_status = 'approved')`;
  }

  if (status) {
    where += ` AND p.status = ?`;
    params.push(status);
  }

  const rows = await db.query(
    `SELECT p.*, (SELECT COUNT(*) FROM candidates c WHERE c.job_id = p.job_id) as candidate_count
     FROM positions p ${where} ORDER BY p.created_at DESC`,
    params,
  );

  res.json(rows);
});

router.get('/:jobId', authenticateToken, async (req: AuthRequest, res: Response) => {
  const position = await db.queryOne('SELECT * FROM positions WHERE job_id = ?', [req.params.jobId]);
  if (!position) return res.status(404).json({ error: 'Position not found' });
  res.json(position);
});

router.post('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  const { job_id, project, department, role, total_req, hr_spoc, required_by_date, status, approval_status } = req.body;

  if (!job_id || !project || !department || !role || !total_req || !hr_spoc) {
    return res.status(400).json({ error: 'job_id, project, department, role, total_req, and hr_spoc are required' });
  }

  const id = uuidv4();
  const now = new Date().toISOString();

  await db.run(
    `INSERT INTO positions (id, job_id, project, department, role, total_req, hr_spoc, required_by_date, status, approval_status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, job_id, project, department, role, total_req, hr_spoc, required_by_date || null, status || 'active', approval_status || '', now, now],
  );

  res.status(201).json(await db.queryOne('SELECT * FROM positions WHERE id = ?', [id]));
});

router.put('/:jobId', authenticateToken, async (req: AuthRequest, res: Response) => {
  const existing = await db.queryOne('SELECT * FROM positions WHERE job_id = ?', [req.params.jobId]);
  if (!existing) return res.status(404).json({ error: 'Position not found' });

  const { project, department, role, total_req, hr_spoc, required_by_date, status, approval_status } = req.body;
  const now = new Date().toISOString();

  await db.run(
    `UPDATE positions SET
      project = COALESCE(?, project),
      department = COALESCE(?, department),
      role = COALESCE(?, role),
      total_req = COALESCE(?, total_req),
      hr_spoc = COALESCE(?, hr_spoc),
      required_by_date = COALESCE(?, required_by_date),
      status = COALESCE(?, status),
      approval_status = COALESCE(?, approval_status),
      updated_at = ?
     WHERE job_id = ?`,
    [project ?? null, department ?? null, role ?? null, total_req ?? null,
     hr_spoc ?? null, required_by_date ?? null, status ?? null, approval_status ?? null,
     now, req.params.jobId],
  );

  res.json(await db.queryOne('SELECT * FROM positions WHERE job_id = ?', [req.params.jobId]));
});

router.delete('/:jobId', authenticateToken, async (req: AuthRequest, res: Response) => {
  const candidateCount = await db.queryOne<any>(
    'SELECT COUNT(*) as count FROM candidates WHERE job_id = ?',
    [req.params.jobId],
  );
  if (candidateCount?.count > 0) {
    return res.status(400).json({ error: 'Cannot delete position with existing candidates' });
  }

  const result = await db.run('DELETE FROM positions WHERE job_id = ?', [req.params.jobId]);
  if (result.rowsAffected === 0) return res.status(404).json({ error: 'Position not found' });
  res.json({ message: 'Position deleted' });
});

router.post('/:jobId/approve', authenticateToken, async (req: AuthRequest, res: Response) => {
  const result = await db.run(
    "UPDATE positions SET approval_status = 'approved', updated_at = ? WHERE job_id = ?",
    [new Date().toISOString(), req.params.jobId],
  );
  if (result.rowsAffected === 0) return res.status(404).json({ error: 'Position not found' });
  res.json(await db.queryOne('SELECT * FROM positions WHERE job_id = ?', [req.params.jobId]));
});

router.post('/:jobId/reject', authenticateToken, async (req: AuthRequest, res: Response) => {
  const result = await db.run(
    "UPDATE positions SET approval_status = 'rejected', updated_at = ? WHERE job_id = ?",
    [new Date().toISOString(), req.params.jobId],
  );
  if (result.rowsAffected === 0) return res.status(404).json({ error: 'Position not found' });
  res.json(await db.queryOne('SELECT * FROM positions WHERE job_id = ?', [req.params.jobId]));
});

export default router;
