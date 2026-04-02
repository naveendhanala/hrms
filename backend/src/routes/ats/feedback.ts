import { Router, Request, Response } from 'express';
import db from '../../db';

const router = Router();

// GET /lookup
router.get('/lookup', (req: Request, res: Response) => {
  const { mobile } = req.query;

  if (!mobile) {
    return res.status(400).json({ error: 'mobile query parameter is required' });
  }

  const candidate = db.prepare(
    `SELECT c.id, c.name, c.job_id, c.stage, p.role, p.project, p.department
     FROM candidates c
     LEFT JOIN positions p ON c.job_id = p.job_id
     WHERE c.mobile = ?`
  ).get(String(mobile));

  if (!candidate) {
    return res.status(404).json({ error: 'Candidate not found' });
  }

  res.json(candidate);
});

// POST /
router.post('/', (req: Request, res: Response) => {
  const { mobile, interviewer, result, reject_reason, remarks } = req.body;

  if (!mobile || !interviewer || !result) {
    return res.status(400).json({ error: 'mobile, interviewer, and result are required' });
  }

  if (!['accepted', 'rejected'].includes(result)) {
    return res.status(400).json({ error: 'result must be "accepted" or "rejected"' });
  }

  const candidate = db.prepare('SELECT * FROM candidates WHERE mobile = ?').get(mobile) as any;
  if (!candidate) {
    return res.status(404).json({ error: 'Candidate not found' });
  }

  let feedbackText = `Interviewer: ${interviewer} | Result: ${result}`;
  if (reject_reason) {
    feedbackText += ` | Reason: ${reject_reason}`;
  }
  if (remarks) {
    feedbackText += ` | Remarks: ${remarks}`;
  }

  const newStage = result === 'accepted' ? 'Offer Negotiation' : 'Rejected';
  const today = new Date().toISOString().split('T')[0];
  const now = new Date().toISOString();

  db.prepare(
    `UPDATE candidates SET feedback = ?, stage = ?, interviewer = ?, interview_done_date = ?, updated_at = ? WHERE mobile = ?`
  ).run(feedbackText, newStage, interviewer, today, now, mobile);

  const updated = db.prepare('SELECT * FROM candidates WHERE mobile = ?').get(mobile);
  res.json(updated);
});

export default router;
