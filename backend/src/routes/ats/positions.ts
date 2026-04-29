import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../../db';
import { authenticateToken, AuthRequest } from '../../middleware/auth';

const router = Router();

router.get('/pipeline', authenticateToken, async (req: AuthRequest, res: Response) => {
  const showAll = req.query.showAll === 'true';
  const statusClause = showAll ? '' : `AND p.status = 'Active'`;

  const rows = await db.query<any>(`
    SELECT p.job_id, p.project, p.department, p.role, p.total_req, p.required_by_date, p.hr_spoc,
           p.status, p.created_at,
           COUNT(c.id) FILTER (WHERE c.stage = 'Interview') AS s0,
           COUNT(c.id) FILTER (WHERE c.stage = 'Offer Negotiation')               AS s1,
           COUNT(c.id) FILTER (WHERE c.stage = 'Offer Approval Pending')          AS s6,
           COUNT(c.id) FILTER (WHERE c.stage = 'Offer Released')                  AS s2,
           COUNT(c.id) FILTER (WHERE c.stage = 'Joined')                          AS s3,
           COUNT(c.id) FILTER (WHERE c.stage = 'Offer Dropped')                   AS s4,
           COUNT(c.id) FILTER (WHERE c.stage = 'Rejected')                        AS s5,
           COUNT(c.id) FILTER (WHERE c.stage = 'Candidate Not Responding')        AS s7,
           COUNT(c.id) FILTER (WHERE c.stage = 'Screen Reject')                   AS s8,
           COUNT(c.id)                                                              AS total
    FROM positions p
    LEFT JOIN candidates c ON c.job_id = p.job_id
    WHERE COALESCE(p.approval_status, '') NOT IN ('pending', 'rejected')
      ${statusClause}
    GROUP BY p.job_id, p.project, p.department, p.role, p.total_req,
             p.required_by_date, p.hr_spoc, p.status, p.created_at
    ORDER BY p.created_at DESC
  `);

  const result = rows.map((row: any) => ({
    job_id: row.job_id,
    project: row.project,
    department: row.department,
    role: row.role,
    total_req: row.total_req,
    required_by_date: row.required_by_date,
    hr_spoc: row.hr_spoc,
    status: row.status,
    total: Number(row.total),
    stage_counts: {
      'Interview': Number(row.s0),
      'Offer Negotiation':               Number(row.s1),
      'Offer Approval Pending':          Number(row.s6),
      'Offer Released':                  Number(row.s2),
      'Joined':                          Number(row.s3),
      'Offer Dropped':                   Number(row.s4),
      'Rejected':                        Number(row.s5),
      'Candidate Not Responding':        Number(row.s7),
      'Screen Reject':                   Number(row.s8),
    },
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
    `SELECT p.*, COALESCE(cc.cnt, 0) AS candidate_count
     FROM positions p
     LEFT JOIN (SELECT job_id, COUNT(*) AS cnt FROM candidates GROUP BY job_id) cc ON cc.job_id = p.job_id
     ${where} ORDER BY p.created_at DESC`,
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
  const { job_id: providedJobId, project, department, role, total_req, hr_spoc, required_by_date, status, approval_status, job_description, nature_of_work, interview_panel, level } = req.body;

  if (!project || !department || !role || !total_req || !hr_spoc) {
    return res.status(400).json({ error: 'project, department, role, total_req, and hr_spoc are required' });
  }

  let job_id = providedJobId;
  if (!job_id) {
    const prefix = project.trim().toUpperCase().replace(/\s+/g, '');
    const existing = await db.query<{ job_id: string }>(
      `SELECT job_id FROM positions WHERE job_id ILIKE ?`,
      [`${prefix}-%`],
    );
    const nums = existing
      .map((r) => parseInt(r.job_id.slice(prefix.length + 1), 10))
      .filter((n) => !isNaN(n));
    const next = nums.length > 0 ? Math.max(...nums) + 1 : 1;
    job_id = `${prefix}-${String(next).padStart(2, '0')}`;
  }

  const id = uuidv4();
  const now = new Date().toISOString();
  const resolvedApprovalStatus = approval_status || '';
  const indentDate = resolvedApprovalStatus === 'approved' ? now.slice(0, 10) : '';

  await db.run(
    `INSERT INTO positions (id, job_id, project, nature_of_work, department, role, level, total_req, hr_spoc, required_by_date, interview_panel, job_description, indent_date, status, approval_status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, job_id, project, nature_of_work || '', department, role, level || '', total_req, hr_spoc, required_by_date || null, interview_panel || '', job_description || '', indentDate, status || 'active', resolvedApprovalStatus, now, now],
  );

  res.status(201).json(await db.queryOne('SELECT * FROM positions WHERE id = ?', [id]));
});

router.put('/:jobId', authenticateToken, async (req: AuthRequest, res: Response) => {
  const existing = await db.queryOne('SELECT * FROM positions WHERE job_id = ?', [req.params.jobId]);
  if (!existing) return res.status(404).json({ error: 'Position not found' });

  const { project, department, role, total_req, hr_spoc, required_by_date, status, approval_status, job_description, nature_of_work, interview_panel, level } = req.body;
  const now = new Date().toISOString();
  const indentDate = approval_status === 'approved' ? now.slice(0, 10) : null;

  await db.run(
    `UPDATE positions SET
      project           = COALESCE(?::TEXT,    project),
      nature_of_work    = COALESCE(?::TEXT,    nature_of_work),
      department        = COALESCE(?::TEXT,    department),
      role              = COALESCE(?::TEXT,    role),
      level             = COALESCE(?::TEXT,    level),
      total_req         = COALESCE(?::INTEGER, total_req),
      hr_spoc           = COALESCE(?::TEXT,    hr_spoc),
      required_by_date  = COALESCE(?::TEXT,    required_by_date),
      interview_panel   = COALESCE(?::TEXT,    interview_panel),
      job_description   = COALESCE(?::TEXT,    job_description),
      status            = COALESCE(?::TEXT,    status),
      approval_status   = COALESCE(?::TEXT,    approval_status),
      indent_date       = COALESCE(?::TEXT,    indent_date),
      updated_at        = ?
     WHERE job_id = ?`,
    [project ?? null, nature_of_work ?? null, department ?? null, role ?? null, level ?? null,
     total_req ?? null, hr_spoc ?? null, required_by_date ?? null, interview_panel ?? null,
     job_description ?? null, status ?? null, approval_status ?? null,
     indentDate, now, req.params.jobId],
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
  const now = new Date().toISOString();
  const result = await db.run(
    "UPDATE positions SET approval_status = 'approved', indent_date = ?, updated_at = ? WHERE job_id = ?",
    [now.slice(0, 10), now, req.params.jobId],
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
