import { Router, Response } from 'express';
import db from '../db';
import { authenticateToken, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();

router.get('/accruals', authenticateToken, requireRole('admin', 'hr', 'vp_hr'), async (_req: AuthRequest, res: Response) => {
  const rows = await db.query(`
    SELECT u.id AS employee_id, u.emp_id, u.name AS employee_name,
           u.date_of_joining,
           COALESCE(SUM(ga.provision_amount), 0) AS total_accrued,
           MAX(ga.cumulative_amount) AS cumulative_amount,
           (SELECT ga2.provision_amount FROM gratuity_accruals ga2
            WHERE ga2.employee_id = u.id
            ORDER BY ga2.year DESC, ga2.month DESC LIMIT 1) AS last_monthly_provision
    FROM users u
    LEFT JOIN gratuity_accruals ga ON ga.employee_id = u.id
    WHERE u.role != 'admin' AND u.status = 'active'
    GROUP BY u.id, u.emp_id, u.name, u.date_of_joining
    ORDER BY u.name ASC
  `);
  res.json(rows);
});

router.get('/disbursements', authenticateToken, requireRole('admin', 'hr', 'vp_hr'), async (_req: AuthRequest, res: Response) => {
  const rows = await db.query(`
    SELECT gd.*, u.name AS employee_name, u.emp_id, r.name AS recorded_by_name
    FROM gratuity_disbursements gd
    JOIN users u ON gd.employee_id = u.id
    LEFT JOIN users r ON gd.recorded_by = r.id
    ORDER BY gd.created_at DESC
  `);
  res.json(rows);
});

router.post('/disbursements', authenticateToken, requireRole('admin', 'hr', 'vp_hr'), async (req: AuthRequest, res: Response) => {
  const { employee_id, exit_date, years_of_service, accrued_amount, paid_amount, payment_date, notes } = req.body;
  if (!employee_id || !exit_date || !payment_date)
    return res.status(400).json({ error: 'employee_id, exit_date, and payment_date are required' });

  const now = new Date().toISOString();
  const result = await db.run(`
    INSERT INTO gratuity_disbursements
      (employee_id, exit_date, years_of_service, accrued_amount, paid_amount, payment_date, recorded_by, notes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    RETURNING id
  `, [employee_id, exit_date, years_of_service ?? 0, accrued_amount ?? 0, paid_amount ?? 0, payment_date, req.user!.id, notes ?? '', now]);

  res.status(201).json({ id: result.lastInsertRowid });
});

export default router;
