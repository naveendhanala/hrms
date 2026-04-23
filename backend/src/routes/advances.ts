import { Router, Response } from 'express';
import db from '../db';
import { authenticateToken, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();

router.get('/', authenticateToken, requireRole('admin', 'hr'), async (_req: AuthRequest, res: Response) => {
  const rows = await db.query(`
    SELECT a.*, u.name AS employee_name, u.emp_id
    FROM employee_advances a
    JOIN users u ON a.employee_id = u.id
    ORDER BY a.created_at DESC
  `);
  res.json(rows);
});

router.post('/', authenticateToken, requireRole('admin', 'hr'), async (req: AuthRequest, res: Response) => {
  const { employee_id, amount, months } = req.body;
  if (!employee_id || !amount || !months)
    return res.status(400).json({ error: 'employee_id, amount, and months are required' });

  const monthly_amt = Math.round((Number(amount) / Number(months)) * 100) / 100;
  const now = new Date().toISOString();

  const result = await db.run(
    `INSERT INTO employee_advances (employee_id, amount, months, monthly_amt, recovered, status, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, 0, 'active', ?, ?, ?) RETURNING id`,
    [Number(employee_id), Number(amount), Number(months), monthly_amt, req.user!.id, now, now],
  );

  res.status(201).json({ id: result.lastInsertRowid });
});

router.delete('/:id', authenticateToken, requireRole('admin', 'hr'), async (req: AuthRequest, res: Response) => {
  const advance = await db.queryOne<any>('SELECT * FROM employee_advances WHERE id = ?', [req.params.id]);
  if (!advance) return res.status(404).json({ error: 'Advance not found' });
  if (Number(advance.recovered) > 0)
    return res.status(400).json({ error: 'Cannot delete an advance with recovery already in progress' });

  await db.run('DELETE FROM employee_advances WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
});

export default router;
