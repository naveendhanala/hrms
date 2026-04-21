import { Router, Request, Response } from 'express';
import db from '../../db';

const router = Router();

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

router.post('/', async (req: Request, res: Response) => {
  const { mobile, interviewer, result, reject_reason, remarks } = req.body;

  if (!mobile || !interviewer || !result) {
    return res.status(400).json({ error: 'mobile, interviewer, and result are required' });
  }
  if (!['accepted', 'rejected'].includes(result)) {
    return res.status(400).json({ error: 'result must be "accepted" or "rejected"' });
  }

  const candidate = await db.queryOne<any>('SELECT * FROM candidates WHERE mobile = ?', [mobile]);
  if (!candidate) return res.status(404).json({ error: 'Candidate not found' });

  let feedbackText = `Interviewer: ${interviewer} | Result: ${result}`;
  if (reject_reason) feedbackText += ` | Reason: ${reject_reason}`;
  if (remarks)       feedbackText += ` | Remarks: ${remarks}`;

  const newStage = result === 'accepted' ? 'Offer Negotiation' : 'Rejected';
  const today = new Date().toISOString().split('T')[0];
  const now   = new Date().toISOString();

  await db.run(
    'UPDATE candidates SET feedback = ?, stage = ?, interviewer = ?, interview_done_date = ?, updated_at = ? WHERE mobile = ?',
    [feedbackText, newStage, interviewer, today, now, mobile],
  );

  res.json(await db.queryOne('SELECT * FROM candidates WHERE mobile = ?', [mobile]));
});

export default router;
