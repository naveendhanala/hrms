import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../../db';
import { authenticateToken, AuthRequest } from '../../middleware/auth';

const router = Router();

// GET /
router.get('/', authenticateToken, (req: AuthRequest, res: Response) => {
  const { job_id, stage, search } = req.query;

  let where = 'WHERE 1=1';
  const params: any[] = [];

  if (job_id) {
    where += ' AND c.job_id = ?';
    params.push(job_id);
  }
  if (stage) {
    where += ' AND c.stage = ?';
    params.push(stage);
  }
  if (search) {
    where += ' AND (c.name LIKE ? OR c.mobile LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }

  const rows = db.prepare(
    `SELECT c.*, p.project, p.department, p.role, p.required_by_date, p.total_req
     FROM candidates c
     LEFT JOIN positions p ON c.job_id = p.job_id
     ${where}
     ORDER BY c.created_at DESC`
  ).all(...params);

  res.json(rows);
});

// GET /:id
router.get('/:id', authenticateToken, (req: AuthRequest, res: Response) => {
  const candidate = db.prepare(
    `SELECT c.*, p.project, p.department, p.role, p.required_by_date, p.total_req
     FROM candidates c
     LEFT JOIN positions p ON c.job_id = p.job_id
     WHERE c.id = ?`
  ).get(req.params.id);

  if (!candidate) {
    return res.status(404).json({ error: 'Candidate not found' });
  }
  res.json(candidate);
});

// POST /
router.post('/', authenticateToken, (req: AuthRequest, res: Response) => {
  const { name, mobile, job_id, interviewer, hr_spoc, email, current_company, experience, current_ctc, expected_ctc, notice_period, remarks } = req.body;

  if (!name || !mobile || !job_id || !interviewer || !hr_spoc) {
    return res.status(400).json({ error: 'name, mobile, job_id, interviewer, and hr_spoc are required' });
  }

  // Check job_id exists
  const position = db.prepare('SELECT id FROM positions WHERE job_id = ?').get(job_id);
  if (!position) {
    return res.status(400).json({ error: 'Invalid job_id: position not found' });
  }

  // Check mobile unique
  const existing = db.prepare('SELECT id FROM candidates WHERE mobile = ?').get(mobile);
  if (existing) {
    return res.status(409).json({ error: 'Candidate with this mobile number already exists' });
  }

  const id = uuidv4();
  const now = new Date().toISOString();
  const today = new Date().toISOString().split('T')[0];

  db.prepare(
    `INSERT INTO candidates (id, name, mobile, email, job_id, interviewer, hr_spoc, current_company, experience, current_ctc, expected_ctc, notice_period, remarks, stage, sourcing_date, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id, name, mobile, email || null, job_id, interviewer, hr_spoc,
    current_company || null, experience || null, current_ctc || null,
    expected_ctc || null, notice_period || null, remarks || null,
    'Profile shared with interviewer', today, now, now
  );

  const candidate = db.prepare('SELECT * FROM candidates WHERE id = ?').get(id);
  res.status(201).json(candidate);
});

// PUT /:id
router.put('/:id', authenticateToken, (req: AuthRequest, res: Response) => {
  const existing = db.prepare('SELECT * FROM candidates WHERE id = ?').get(req.params.id) as any;
  if (!existing) {
    return res.status(404).json({ error: 'Candidate not found' });
  }

  const now = new Date().toISOString();
  const today = new Date().toISOString().split('T')[0];
  const updates = { ...req.body };

  // Auto-set interview_done_date when feedback first provided
  if (updates.feedback && !existing.interview_done_date) {
    updates.interview_done_date = today;
  }

  // Auto-set offer_release_date when stage moves to 'Offer Released'
  if (updates.stage === 'Offer Released' && existing.stage !== 'Offer Released') {
    updates.offer_release_date = today;
  }

  // Auto-set joined_date when stage moves to 'Joined'
  if (updates.stage === 'Joined' && existing.stage !== 'Joined') {
    updates.joined_date = today;
  }

  const fields = [
    'name', 'mobile', 'email', 'job_id', 'interviewer', 'hr_spoc',
    'current_company', 'experience', 'current_ctc', 'expected_ctc',
    'notice_period', 'remarks', 'stage', 'feedback', 'sourcing_date',
    'interview_done_date', 'offer_release_date', 'joined_date',
    'offer_approval_status',
  ];

  const setClauses: string[] = [];
  const params: any[] = [];

  for (const field of fields) {
    if (updates[field] !== undefined) {
      setClauses.push(`${field} = ?`);
      params.push(updates[field]);
    }
  }

  if (setClauses.length === 0) {
    return res.json(existing);
  }

  setClauses.push('updated_at = ?');
  params.push(now);
  params.push(req.params.id);

  db.prepare(
    `UPDATE candidates SET ${setClauses.join(', ')} WHERE id = ?`
  ).run(...params);

  const updated = db.prepare(
    `SELECT c.*, p.project, p.department, p.role, p.required_by_date, p.total_req
     FROM candidates c
     LEFT JOIN positions p ON c.job_id = p.job_id
     WHERE c.id = ?`
  ).get(req.params.id);

  res.json(updated);
});

// DELETE /:id
router.delete('/:id', authenticateToken, (req: AuthRequest, res: Response) => {
  const result = db.prepare('DELETE FROM candidates WHERE id = ?').run(req.params.id);
  if (result.changes === 0) {
    return res.status(404).json({ error: 'Candidate not found' });
  }
  res.json({ message: 'Candidate deleted' });
});

// POST /:id/request-offer
router.post('/:id/request-offer', authenticateToken, (req: AuthRequest, res: Response) => {
  const candidate = db.prepare('SELECT * FROM candidates WHERE id = ?').get(req.params.id) as any;
  if (!candidate) {
    return res.status(404).json({ error: 'Candidate not found' });
  }
  if (candidate.stage !== 'Offer Negotiation') {
    return res.status(400).json({ error: 'Candidate must be in Offer Negotiation stage' });
  }

  db.prepare(
    `UPDATE candidates SET offer_approval_status = 'pending', updated_at = ? WHERE id = ?`
  ).run(new Date().toISOString(), req.params.id);

  const updated = db.prepare('SELECT * FROM candidates WHERE id = ?').get(req.params.id);
  res.json(updated);
});

// POST /:id/approve-offer
router.post('/:id/approve-offer', authenticateToken, (req: AuthRequest, res: Response) => {
  const today = new Date().toISOString().split('T')[0];

  const result = db.prepare(
    `UPDATE candidates SET stage = 'Offer Released', offer_approval_status = 'approved', offer_release_date = ?, updated_at = ? WHERE id = ?`
  ).run(today, new Date().toISOString(), req.params.id);

  if (result.changes === 0) {
    return res.status(404).json({ error: 'Candidate not found' });
  }

  const updated = db.prepare('SELECT * FROM candidates WHERE id = ?').get(req.params.id);
  res.json(updated);
});

// POST /:id/reject-offer
router.post('/:id/reject-offer', authenticateToken, (req: AuthRequest, res: Response) => {
  const result = db.prepare(
    `UPDATE candidates SET offer_approval_status = 'rejected', updated_at = ? WHERE id = ?`
  ).run(new Date().toISOString(), req.params.id);

  if (result.changes === 0) {
    return res.status(404).json({ error: 'Candidate not found' });
  }

  const updated = db.prepare('SELECT * FROM candidates WHERE id = ?').get(req.params.id);
  res.json(updated);
});

export default router;
