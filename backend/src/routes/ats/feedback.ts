import { Router, Request, Response } from 'express';
import db from '../../db';
import { authenticateToken, AuthRequest } from '../../middleware/auth';

const router = Router();

// Legacy unauthenticated lookup (kept for backwards compat)
router.get('/lookup', async (req: Request, res: Response) => {
  const { mobile } = req.query;
  if (!mobile) return res.status(400).json({ error: 'mobile query parameter is required' });

  const candidate = await db.queryOne(
    `SELECT c.id, c.name, c.job_id, c.stage, p.role, p.project, p.department
     FROM candidates c
     LEFT JOIN positions p ON c.job_id = p.job_id
     WHERE c.mobile = ?`,
    [String(mobile)],
  );

  if (!candidate) return res.status(404).json({ error: 'Candidate not found' });
  res.json(candidate);
});

// Candidates assigned to the logged-in interviewer
router.get('/my-candidates', authenticateToken, async (req: AuthRequest, res: Response) => {
  const name = req.user!.name;
  const cols = `c.id, c.name, c.mobile, c.job_id, c.stage, c.interviewer, c.feedback,
                c.sourcing_date, c.interview_done_date,
                p.role, p.project, p.department`;

  const [pending, completed] = await Promise.all([
    db.query(
      `SELECT ${cols} FROM candidates c
       LEFT JOIN positions p ON c.job_id = p.job_id
       WHERE c.interviewer ILIKE ? AND c.stage = 'Interview'
       ORDER BY c.created_at DESC`,
      [`%${name}%`],
    ),
    db.query(
      `SELECT ${cols} FROM candidates c
       LEFT JOIN positions p ON c.job_id = p.job_id
       WHERE c.interviewer ILIKE ? AND c.stage != 'Interview'
       ORDER BY c.interview_done_date DESC LIMIT 20`,
      [`%${name}%`],
    ),
  ]);

  res.json([...pending, ...completed]);
});

router.post('/by-candidate/:id/incomplete', authenticateToken, async (req: AuthRequest, res: Response) => {
  const { reason } = req.body;

  const stageMap: Record<string, string> = {
    not_responding:  'Candidate Not Responding',
    resume_mismatch: 'Screen Reject',
  };

  const newStage = stageMap[reason];
  if (!newStage) {
    return res.status(400).json({ error: 'reason must be "not_responding" or "resume_mismatch"' });
  }

  const now = new Date().toISOString();
  const result = await db.run(
    'UPDATE candidates SET stage = ?, updated_at = ? WHERE id = ?',
    [newStage, now, req.params.id],
  );
  if (result.rowsAffected === 0) return res.status(404).json({ error: 'Candidate not found' });

  res.json(await db.queryOne('SELECT * FROM candidates WHERE id = ?', [req.params.id]));
});

// Submit feedback for a specific candidate (authenticated)
router.post('/by-candidate/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  const { result, reject_reason, remarks, functional_competencies, behavioral_competencies } = req.body;

  if (!result || !['accepted', 'rejected'].includes(result)) {
    return res.status(400).json({ error: 'result must be "accepted" or "rejected"' });
  }
  if (!remarks || !String(remarks).trim()) {
    return res.status(400).json({ error: 'remarks is required' });
  }

  const FUNCTIONAL_KEYS = ['Job Knowledge', 'Hands on exposure', 'Knowledge on industry trends'];
  const BEHAVIORAL_KEYS = ['Analytical skills', 'Communication skills', 'Leadership skills'];
  const VALID_RATINGS   = ['Poor', 'Average', 'Good', 'Excellent'];

  if (!functional_competencies || typeof functional_competencies !== 'object') {
    return res.status(400).json({ error: 'functional_competencies is required' });
  }
  if (!behavioral_competencies || typeof behavioral_competencies !== 'object') {
    return res.status(400).json({ error: 'behavioral_competencies is required' });
  }
  for (const k of FUNCTIONAL_KEYS) {
    if (!VALID_RATINGS.includes(functional_competencies[k])) {
      return res.status(400).json({ error: `Rating for "${k}" is required` });
    }
  }
  for (const k of BEHAVIORAL_KEYS) {
    if (!VALID_RATINGS.includes(behavioral_competencies[k])) {
      return res.status(400).json({ error: `Rating for "${k}" is required` });
    }
  }

  const candidate = await db.queryOne<any>('SELECT * FROM candidates WHERE id = ?', [req.params.id]);
  if (!candidate) return res.status(404).json({ error: 'Candidate not found' });

  let feedbackText = `Result: ${result}`;
  if (reject_reason) feedbackText += ` | Reason: ${reject_reason}`;
  feedbackText += ` | Remarks: ${remarks}`;

  const competencyJson = JSON.stringify({ functional: functional_competencies, behavioral: behavioral_competencies });
  const newStage = result === 'accepted' ? 'Offer Negotiation' : 'Rejected';
  const today = new Date().toISOString().split('T')[0];
  const now   = new Date().toISOString();

  await db.run(
    `UPDATE candidates SET feedback = ?, competency_feedback = ?, stage = ?, interview_done_date = ?, updated_at = ? WHERE id = ?`,
    [feedbackText, competencyJson, newStage, today, now, req.params.id],
  );

  res.json(await db.queryOne('SELECT * FROM candidates WHERE id = ?', [req.params.id]));
});

router.post('/incomplete', async (req: Request, res: Response) => {
  const { mobile, reason } = req.body;
  if (!mobile || !reason) {
    return res.status(400).json({ error: 'mobile and reason are required' });
  }

  const stageMap: Record<string, string> = {
    not_responding:   'Candidate Not Responding',
    resume_mismatch:  'Screen Reject',
  };

  const newStage = stageMap[reason];
  if (!newStage) {
    return res.status(400).json({ error: 'reason must be "not_responding" or "resume_mismatch"' });
  }

  const candidate = await db.queryOne<any>('SELECT * FROM candidates WHERE mobile = ?', [mobile]);
  if (!candidate) return res.status(404).json({ error: 'Candidate not found' });

  const now = new Date().toISOString();
  await db.run('UPDATE candidates SET stage = ?, updated_at = ? WHERE mobile = ?', [newStage, now, mobile]);

  res.json(await db.queryOne('SELECT * FROM candidates WHERE mobile = ?', [mobile]));
});

router.post('/', async (req: Request, res: Response) => {
  const { mobile, result, reject_reason, remarks, functional_competencies, behavioral_competencies } = req.body;

  if (!mobile || !result) {
    return res.status(400).json({ error: 'mobile and result are required' });
  }
  if (!['accepted', 'rejected'].includes(result)) {
    return res.status(400).json({ error: 'result must be "accepted" or "rejected"' });
  }
  if (!remarks || !String(remarks).trim()) {
    return res.status(400).json({ error: 'remarks is required' });
  }

  const FUNCTIONAL_KEYS = ['Job Knowledge', 'Hands on exposure', 'Knowledge on industry trends'];
  const BEHAVIORAL_KEYS = ['Analytical skills', 'Communication skills', 'Leadership skills'];
  const VALID_RATINGS   = ['Poor', 'Average', 'Good', 'Excellent'];

  if (!functional_competencies || typeof functional_competencies !== 'object') {
    return res.status(400).json({ error: 'functional_competencies is required' });
  }
  if (!behavioral_competencies || typeof behavioral_competencies !== 'object') {
    return res.status(400).json({ error: 'behavioral_competencies is required' });
  }
  for (const k of FUNCTIONAL_KEYS) {
    if (!VALID_RATINGS.includes(functional_competencies[k])) {
      return res.status(400).json({ error: `Rating for "${k}" is required` });
    }
  }
  for (const k of BEHAVIORAL_KEYS) {
    if (!VALID_RATINGS.includes(behavioral_competencies[k])) {
      return res.status(400).json({ error: `Rating for "${k}" is required` });
    }
  }

  const candidate = await db.queryOne<any>('SELECT * FROM candidates WHERE mobile = ?', [mobile]);
  if (!candidate) return res.status(404).json({ error: 'Candidate not found' });

  let feedbackText = `Result: ${result}`;
  if (reject_reason) feedbackText += ` | Reason: ${reject_reason}`;
  feedbackText += ` | Remarks: ${remarks}`;

  const competencyJson = JSON.stringify({ functional: functional_competencies, behavioral: behavioral_competencies });
  const newStage = result === 'accepted' ? 'Offer Negotiation' : 'Rejected';
  const today = new Date().toISOString().split('T')[0];
  const now   = new Date().toISOString();

  await db.run(
    'UPDATE candidates SET feedback = ?, competency_feedback = ?, stage = ?, interview_done_date = ?, updated_at = ? WHERE mobile = ?',
    [feedbackText, competencyJson, newStage, today, now, mobile],
  );

  res.json(await db.queryOne('SELECT * FROM candidates WHERE mobile = ?', [mobile]));
});

export default router;
