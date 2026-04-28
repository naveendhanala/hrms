import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../../db';
import { authenticateToken, AuthRequest } from '../../middleware/auth';

const router = Router();

router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  const { job_id, stage, search, project, page, limit } = req.query;

  let where = 'WHERE 1=1';
  const params: any[] = [];

  if (job_id)  { where += ' AND c.job_id = ?';  params.push(job_id); }
  if (stage)   { where += ' AND c.stage = ?';   params.push(stage); }
  if (project) { where += ' AND p.project = ?'; params.push(project); }
  if (search) {
    where += ' AND (c.name ILIKE ? OR c.mobile ILIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }

  const baseSql = `FROM candidates c LEFT JOIN positions p ON c.job_id = p.job_id ${where}`;

  // Paginated mode — used by Profile Tracker
  if (page !== undefined) {
    const pageNum  = Math.max(1, parseInt(page as string) || 1);
    const limitNum = Math.min(100, Math.max(10, parseInt(limit as string) || 50));
    const offset   = (pageNum - 1) * limitNum;

    const [rows, countRow] = await Promise.all([
      db.query(
        `SELECT c.*, p.project, p.department, p.role, p.required_by_date, p.total_req
         ${baseSql} ORDER BY c.created_at DESC LIMIT ? OFFSET ?`,
        [...params, limitNum, offset],
      ),
      db.queryOne<{ total: number }>(`SELECT COUNT(*) AS total ${baseSql}`, params),
    ]);

    return res.json({ data: rows, total: Number(countRow?.total ?? 0), page: pageNum, limit: limitNum });
  }

  // Legacy non-paginated mode — used by pipeline drill-down, Yet to Join, Admin list
  const rows = await db.query(
    `SELECT c.*, p.project, p.department, p.role, p.required_by_date, p.total_req
     ${baseSql} ORDER BY c.created_at DESC`,
    params,
  );
  res.json(rows);
});

router.get('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  const candidate = await db.queryOne(
    `SELECT c.*, p.project, p.department, p.role, p.required_by_date, p.total_req
     FROM candidates c
     LEFT JOIN positions p ON c.job_id = p.job_id
     WHERE c.id = ?`,
    [req.params.id],
  );
  if (!candidate) return res.status(404).json({ error: 'Candidate not found' });
  res.json(candidate);
});

router.post('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  const { name, mobile, alternate_mobile, job_id, interviewer, hr_spoc, email, candidate_current_role, current_company, experience, current_ctc, expected_ctc, notice_period, remarks } = req.body;

  if (!name || !mobile || !job_id || !interviewer || !hr_spoc) {
    return res.status(400).json({ error: 'name, mobile, job_id, interviewer, and hr_spoc are required' });
  }

  const position = await db.queryOne('SELECT id FROM positions WHERE job_id = ?', [job_id]);
  if (!position) return res.status(400).json({ error: 'Invalid job_id: position not found' });

  const existing = await db.queryOne('SELECT id FROM candidates WHERE mobile = ?', [mobile]);
  if (existing) return res.status(409).json({ error: 'Candidate with this mobile number already exists' });

  const id = uuidv4();
  const now = new Date().toISOString();
  const today = new Date().toISOString().split('T')[0];

  await db.run(
    `INSERT INTO candidates (id, name, mobile, alternate_mobile, email, job_id, interviewer, hr_spoc, candidate_current_role, current_company, experience, current_ctc, expected_ctc, notice_period, remarks, stage, sourcing_date, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, name, mobile, alternate_mobile || null, email || null, job_id, interviewer, hr_spoc,
     candidate_current_role || null, current_company || null, experience || null, current_ctc || null,
     expected_ctc || null, notice_period || null, remarks || null,
     'Interview', today, now, now],
  );

  res.status(201).json(await db.queryOne('SELECT * FROM candidates WHERE id = ?', [id]));
});

router.put('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  const existing = await db.queryOne<any>('SELECT * FROM candidates WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Candidate not found' });

  const now = new Date().toISOString();
  const today = new Date().toISOString().split('T')[0];
  const updates = { ...req.body };

  if (updates.feedback && !existing.interview_done_date) updates.interview_done_date = today;
  if (updates.stage === 'Offer Released' && existing.stage !== 'Offer Released') updates.offer_release_date = today;
  if (updates.stage === 'Joined' && existing.stage !== 'Joined') updates.joined_date = today;

  const fields = [
    'name', 'mobile', 'email', 'job_id', 'interviewer', 'hr_spoc',
    'candidate_current_role', 'current_company', 'experience', 'current_ctc', 'expected_ctc',
    'notice_period', 'remarks', 'stage', 'feedback', 'sourcing_date',
    'interview_done_date', 'offer_release_date', 'expected_joining_date', 'joined_date',
    'offered_ctc', 'offer_notes',
  ];

  const setClauses: string[] = [];
  const params: any[] = [];

  for (const field of fields) {
    if (updates[field] !== undefined) {
      setClauses.push(`${field} = ?`);
      params.push(updates[field]);
    }
  }

  if (setClauses.length === 0) return res.json(existing);

  setClauses.push('updated_at = ?');
  params.push(now, req.params.id);

  await db.run(`UPDATE candidates SET ${setClauses.join(', ')} WHERE id = ?`, params);

  res.json(await db.queryOne(
    `SELECT c.*, p.project, p.department, p.role, p.required_by_date, p.total_req
     FROM candidates c
     LEFT JOIN positions p ON c.job_id = p.job_id
     WHERE c.id = ?`,
    [req.params.id],
  ));
});

router.delete('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  const result = await db.run('DELETE FROM candidates WHERE id = ?', [req.params.id]);
  if (result.rowsAffected === 0) return res.status(404).json({ error: 'Candidate not found' });
  res.json({ message: 'Candidate deleted' });
});

router.post('/:id/request-approval', authenticateToken, async (req: AuthRequest, res: Response) => {
  const candidate = await db.queryOne<any>('SELECT * FROM candidates WHERE id = ?', [req.params.id]);
  if (!candidate) return res.status(404).json({ error: 'Candidate not found' });
  if (candidate.stage !== 'Offer Negotiation') {
    return res.status(400).json({ error: 'Candidate must be in Offer Negotiation stage' });
  }

  await db.run(
    "UPDATE candidates SET stage = 'Offer Approval Pending', updated_at = ? WHERE id = ?",
    [new Date().toISOString(), req.params.id],
  );
  res.json(await db.queryOne('SELECT * FROM candidates WHERE id = ?', [req.params.id]));
});

router.post('/:id/approve-offer', authenticateToken, async (req: AuthRequest, res: Response) => {
  if (req.user!.role !== 'director') {
    return res.status(403).json({ error: 'Only directors can approve offers' });
  }
  const today = new Date().toISOString().split('T')[0];
  const result = await db.run(
    "UPDATE candidates SET stage = 'Offer Released', offer_release_date = ?, updated_at = ? WHERE id = ?",
    [today, new Date().toISOString(), req.params.id],
  );
  if (result.rowsAffected === 0) return res.status(404).json({ error: 'Candidate not found' });
  res.json(await db.queryOne('SELECT * FROM candidates WHERE id = ?', [req.params.id]));
});

router.post('/:id/reject-offer', authenticateToken, async (req: AuthRequest, res: Response) => {
  if (req.user!.role !== 'director') {
    return res.status(403).json({ error: 'Only directors can reject offers' });
  }
  const result = await db.run(
    "UPDATE candidates SET stage = 'Offer Negotiation', updated_at = ? WHERE id = ?",
    [new Date().toISOString(), req.params.id],
  );
  if (result.rowsAffected === 0) return res.status(404).json({ error: 'Candidate not found' });
  res.json(await db.queryOne('SELECT * FROM candidates WHERE id = ?', [req.params.id]));
});

export default router;
