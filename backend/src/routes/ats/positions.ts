import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../../db';
import { authenticateToken, AuthRequest } from '../../middleware/auth';

const router = Router();

// GET /pipeline
router.get('/pipeline', authenticateToken, (req: AuthRequest, res: Response) => {
  const stages = [
    'Profile shared with interviewer',
    'Offer Negotiation',
    'Offer Released',
    'Joined',
    'Offer Dropped',
    'Rejected',
  ];

  const positions = db.prepare(
    `SELECT * FROM positions WHERE status = 'active' AND (approval_status IS NULL OR approval_status = '' OR approval_status = 'approved')`
  ).all() as any[];

  const result = positions.map((pos) => {
    const stageCounts: Record<string, number> = {};
    let total = 0;

    for (const stage of stages) {
      const row = db.prepare(
        'SELECT COUNT(*) as count FROM candidates WHERE job_id = ? AND stage = ?'
      ).get(pos.job_id, stage) as any;
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
  });

  res.json(result);
});

// GET /
router.get('/', authenticateToken, (req: AuthRequest, res: Response) => {
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

  const rows = db.prepare(
    `SELECT p.*, (SELECT COUNT(*) FROM candidates c WHERE c.job_id = p.job_id) as candidate_count
     FROM positions p ${where} ORDER BY p.created_at DESC`
  ).all(...params);

  res.json(rows);
});

// GET /:jobId
router.get('/:jobId', authenticateToken, (req: AuthRequest, res: Response) => {
  const position = db.prepare('SELECT * FROM positions WHERE job_id = ?').get(req.params.jobId);
  if (!position) {
    return res.status(404).json({ error: 'Position not found' });
  }
  res.json(position);
});

// POST /
router.post('/', authenticateToken, (req: AuthRequest, res: Response) => {
  const { job_id, project, department, role, total_req, hr_spoc, required_by_date, status, approval_status } = req.body;

  if (!job_id || !project || !department || !role || !total_req || !hr_spoc) {
    return res.status(400).json({ error: 'job_id, project, department, role, total_req, and hr_spoc are required' });
  }

  const id = uuidv4();
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO positions (id, job_id, project, department, role, total_req, hr_spoc, required_by_date, status, approval_status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, job_id, project, department, role, total_req, hr_spoc, required_by_date || null, status || 'active', approval_status || '', now, now);

  const position = db.prepare('SELECT * FROM positions WHERE id = ?').get(id);
  res.status(201).json(position);
});

// PUT /:jobId
router.put('/:jobId', authenticateToken, (req: AuthRequest, res: Response) => {
  const existing = db.prepare('SELECT * FROM positions WHERE job_id = ?').get(req.params.jobId) as any;
  if (!existing) {
    return res.status(404).json({ error: 'Position not found' });
  }

  const { project, department, role, total_req, hr_spoc, required_by_date, status, approval_status } = req.body;
  const now = new Date().toISOString();

  db.prepare(
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
     WHERE job_id = ?`
  ).run(
    project ?? null, department ?? null, role ?? null, total_req ?? null,
    hr_spoc ?? null, required_by_date ?? null, status ?? null, approval_status ?? null,
    now, req.params.jobId
  );

  const updated = db.prepare('SELECT * FROM positions WHERE job_id = ?').get(req.params.jobId);
  res.json(updated);
});

// DELETE /:jobId
router.delete('/:jobId', authenticateToken, (req: AuthRequest, res: Response) => {
  const candidateCount = db.prepare('SELECT COUNT(*) as count FROM candidates WHERE job_id = ?').get(req.params.jobId) as any;
  if (candidateCount?.count > 0) {
    return res.status(400).json({ error: 'Cannot delete position with existing candidates' });
  }

  const result = db.prepare('DELETE FROM positions WHERE job_id = ?').run(req.params.jobId);
  if (result.changes === 0) {
    return res.status(404).json({ error: 'Position not found' });
  }
  res.json({ message: 'Position deleted' });
});

// POST /:jobId/approve
router.post('/:jobId/approve', authenticateToken, (req: AuthRequest, res: Response) => {
  const result = db.prepare(
    `UPDATE positions SET approval_status = 'approved', updated_at = ? WHERE job_id = ?`
  ).run(new Date().toISOString(), req.params.jobId);

  if (result.changes === 0) {
    return res.status(404).json({ error: 'Position not found' });
  }

  const updated = db.prepare('SELECT * FROM positions WHERE job_id = ?').get(req.params.jobId);
  res.json(updated);
});

// POST /:jobId/reject
router.post('/:jobId/reject', authenticateToken, (req: AuthRequest, res: Response) => {
  const result = db.prepare(
    `UPDATE positions SET approval_status = 'rejected', updated_at = ? WHERE job_id = ?`
  ).run(new Date().toISOString(), req.params.jobId);

  if (result.changes === 0) {
    return res.status(404).json({ error: 'Position not found' });
  }

  const updated = db.prepare('SELECT * FROM positions WHERE job_id = ?').get(req.params.jobId);
  res.json(updated);
});

export default router;
