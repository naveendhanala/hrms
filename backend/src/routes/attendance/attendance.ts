import { Router, Response } from 'express';
import db from '../../db';
import { authenticateToken, requireRole, AuthRequest } from '../../middleware/auth';

const router = Router();

router.get('/today', authenticateToken, async (req: AuthRequest, res: Response) => {
  const today = new Date().toISOString().split('T')[0];
  const row = await db.queryOne('SELECT * FROM attendance WHERE user_id = ? AND date = ?', [req.user!.id, today]);
  res.json(row || null);
});

router.get('/summary', authenticateToken, async (req: AuthRequest, res: Response) => {
  const { month, year } = req.query;
  const m = month ? String(month).padStart(2, '0') : String(new Date().getMonth() + 1).padStart(2, '0');
  const y = year || new Date().getFullYear();
  const prefix = `${y}-${m}`;

  const rows = await db.query<any>(
    'SELECT status, COUNT(*) as count FROM attendance WHERE user_id = ? AND date LIKE ? GROUP BY status',
    [req.user!.id, `${prefix}%`],
  );

  const summary: Record<string, number> = { present: 0, absent: 0, leave: 0 };
  for (const r of rows) summary[r.status] = r.count;
  res.json(summary);
});

router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  const { month, year } = req.query;
  const m = month ? String(month).padStart(2, '0') : String(new Date().getMonth() + 1).padStart(2, '0');
  const y = year || new Date().getFullYear();
  const prefix = `${y}-${m}`;

  const rows = await db.query(
    `SELECT a.*, u.name as user_name FROM attendance a
     JOIN users u ON a.user_id = u.id
     WHERE a.user_id = ? AND a.date LIKE ?
     ORDER BY a.date DESC`,
    [req.user!.id, `${prefix}%`],
  );
  res.json(rows);
});

router.get('/report', authenticateToken, requireRole('admin', 'hr'), async (req: AuthRequest, res: Response) => {
  const { month, year } = req.query;
  const m = month ? String(month).padStart(2, '0') : String(new Date().getMonth() + 1).padStart(2, '0');
  const y = year || new Date().getFullYear();
  const prefix = `${y}-${m}`;
  const today = new Date().toISOString().split('T')[0];

  const rows = await db.query(`
    SELECT
      u.id   AS user_id,
      u.name AS user_name,
      u.role AS user_role,
      COUNT(CASE WHEN a.status = 'present' THEN 1 END) AS present,
      COUNT(CASE WHEN a.status = 'leave'   THEN 1 END) AS leave_days,
      COUNT(CASE WHEN a.status = 'absent'  THEN 1 END) AS absent,
      COUNT(a.id) AS total_days,
      ROUND(AVG(CASE WHEN a.work_hours IS NOT NULL THEN a.work_hours END), 1) AS avg_hours,
      (SELECT status FROM attendance WHERE user_id = u.id AND date = ?) AS today_status
    FROM users u
    LEFT JOIN attendance a ON u.id = a.user_id AND a.date LIKE ?
    WHERE u.role != 'admin'
    GROUP BY u.id, u.name, u.role
    ORDER BY u.name ASC
  `, [today, `${prefix}%`]);

  res.json(rows);
});

router.get('/all', authenticateToken, requireRole('admin', 'hr'), async (req: AuthRequest, res: Response) => {
  const { month, year, user_id } = req.query;
  const m = month ? String(month).padStart(2, '0') : String(new Date().getMonth() + 1).padStart(2, '0');
  const y = year || new Date().getFullYear();
  const prefix = `${y}-${m}`;

  let sql = `SELECT a.*, u.name as user_name, u.role as user_role
             FROM attendance a JOIN users u ON a.user_id = u.id
             WHERE a.date LIKE ?`;
  const params: any[] = [`${prefix}%`];

  if (user_id) {
    sql += ' AND a.user_id = ?';
    params.push(user_id);
  }
  sql += ' ORDER BY a.date DESC, u.name ASC';

  res.json(await db.query(sql, params));
});

router.post('/check-in', authenticateToken, async (req: AuthRequest, res: Response) => {
  const today = new Date().toISOString().split('T')[0];
  const now = new Date().toISOString();
  const checkInTime = new Date().toTimeString().slice(0, 5);

  const existing = await db.queryOne<any>('SELECT * FROM attendance WHERE user_id = ? AND date = ?', [req.user!.id, today]);

  if (existing?.check_in) {
    return res.status(400).json({ error: 'Already checked in today' });
  }

  if (existing) {
    await db.run(
      "UPDATE attendance SET check_in = ?, status = 'present', updated_at = ? WHERE user_id = ? AND date = ?",
      [checkInTime, now, req.user!.id, today],
    );
  } else {
    await db.run(
      "INSERT INTO attendance (user_id, date, check_in, status, created_at, updated_at) VALUES (?, ?, ?, 'present', ?, ?)",
      [req.user!.id, today, checkInTime, now, now],
    );
  }

  res.json(await db.queryOne('SELECT * FROM attendance WHERE user_id = ? AND date = ?', [req.user!.id, today]));
});

router.post('/check-out', authenticateToken, async (req: AuthRequest, res: Response) => {
  const today = new Date().toISOString().split('T')[0];
  const now = new Date().toISOString();
  const checkOutTime = new Date().toTimeString().slice(0, 5);

  const existing = await db.queryOne<any>('SELECT * FROM attendance WHERE user_id = ? AND date = ?', [req.user!.id, today]);

  if (!existing?.check_in) return res.status(400).json({ error: 'Must check in before checking out' });
  if (existing?.check_out) return res.status(400).json({ error: 'Already checked out today' });

  const [inH, inM] = existing.check_in.split(':').map(Number);
  const [outH, outM] = checkOutTime.split(':').map(Number);
  const workHours = Math.round(((outH * 60 + outM) - (inH * 60 + inM)) / 60 * 10) / 10;

  await db.run(
    "UPDATE attendance SET check_out = ?, work_hours = ?, status = 'present', updated_at = ? WHERE user_id = ? AND date = ?",
    [checkOutTime, workHours, now, req.user!.id, today],
  );

  res.json(await db.queryOne('SELECT * FROM attendance WHERE user_id = ? AND date = ?', [req.user!.id, today]));
});

router.get('/leave-balance', authenticateToken, async (req: AuthRequest, res: Response) => {
  const row = await db.queryOne<any>('SELECT balance FROM leave_balances WHERE user_id = ?', [req.user!.id]);
  res.json({ balance: row?.balance ?? 0 });
});

router.get('/leaves', authenticateToken, async (req: AuthRequest, res: Response) => {
  const rows = await db.query(
    `SELECT l.*, u.name as reviewer_name FROM leaves l
     LEFT JOIN users u ON l.reviewed_by = u.id
     WHERE l.user_id = ? ORDER BY l.created_at DESC`,
    [req.user!.id],
  );
  res.json(rows);
});

router.get('/leaves/all', authenticateToken, requireRole('admin', 'hr'), async (req: AuthRequest, res: Response) => {
  const { status } = req.query;
  let sql = `SELECT l.*, u.name as user_name, u.role as user_role, r.name as reviewer_name
             FROM leaves l JOIN users u ON l.user_id = u.id
             LEFT JOIN users r ON l.reviewed_by = r.id`;
  if (status) sql += ' WHERE l.status = ?';
  sql += ' ORDER BY l.created_at DESC';

  res.json(await db.query(sql, status ? [String(status)] : []));
});

router.post('/leaves', authenticateToken, async (req: AuthRequest, res: Response) => {
  const { start_date, end_date, type, reason } = req.body;
  if (!start_date || !end_date || !reason) {
    return res.status(400).json({ error: 'start_date, end_date and reason are required' });
  }

  const now = new Date().toISOString();
  const result = await db.run(
    "INSERT INTO leaves (user_id, start_date, end_date, type, reason, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'pending', ?, ?) RETURNING id",
    [req.user!.id, start_date, end_date, type || 'casual', reason, now, now],
  );

  res.status(201).json(await db.queryOne('SELECT * FROM leaves WHERE id = ?', [result.lastInsertRowid]));
});

router.put('/leaves/:id/approve', authenticateToken, requireRole('admin', 'hr'), async (req: AuthRequest, res: Response) => {
  const now = new Date().toISOString();
  const result = await db.run(
    "UPDATE leaves SET status = 'approved', reviewed_by = ?, reviewed_at = ?, updated_at = ? WHERE id = ?",
    [req.user!.id, now, now, req.params.id],
  );

  if (result.rowsAffected === 0) return res.status(404).json({ error: 'Leave not found' });

  const leave = await db.queryOne<any>('SELECT * FROM leaves WHERE id = ?', [req.params.id]);
  if (leave) {
    const start = new Date(leave.start_date);
    const end   = new Date(leave.end_date);
    const msPerDay = 24 * 60 * 60 * 1000;
    const duration = Math.round((end.getTime() - start.getTime()) / msPerDay) + 1;

    const balRow = await db.queryOne<any>('SELECT balance FROM leave_balances WHERE user_id = ?', [leave.user_id]);
    const currentBalance = balRow?.balance ?? 0;
    const lopDays        = Math.max(0, duration - currentBalance);
    const newBalance     = Math.max(0, currentBalance - duration);

    await db.run(
      'INSERT INTO leave_balances (user_id, balance, updated_at) VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET balance = ?, updated_at = ?',
      [leave.user_id, newBalance, now, newBalance, now],
    );

    await db.run('UPDATE leaves SET lop_days = ? WHERE id = ?', [lopDays, req.params.id]);

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      await db.run(
        `INSERT INTO attendance (user_id, date, status, notes, created_at, updated_at)
         VALUES (?, ?, 'leave', ?, ?, ?)
         ON CONFLICT(user_id, date) DO UPDATE SET status = 'leave', notes = ?, updated_at = ?`,
        [leave.user_id, dateStr, `Leave: ${leave.type}`, now, now, `Leave: ${leave.type}`, now],
      );
    }
  }

  res.json(await db.queryOne('SELECT * FROM leaves WHERE id = ?', [req.params.id]));
});

router.put('/leaves/:id/reject', authenticateToken, requireRole('admin', 'hr'), async (req: AuthRequest, res: Response) => {
  const now = new Date().toISOString();
  const result = await db.run(
    "UPDATE leaves SET status = 'rejected', reviewed_by = ?, reviewed_at = ?, updated_at = ? WHERE id = ?",
    [req.user!.id, now, now, req.params.id],
  );

  if (result.rowsAffected === 0) return res.status(404).json({ error: 'Leave not found' });
  res.json(await db.queryOne('SELECT * FROM leaves WHERE id = ?', [req.params.id]));
});

router.put('/manual', authenticateToken, requireRole('admin', 'hr'), async (req: AuthRequest, res: Response) => {
  const { user_id, date, status } = req.body;
  if (!user_id || !date || !status) return res.status(400).json({ error: 'user_id, date and status required' });
  if (!['present', 'absent', 'leave'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
  const now = new Date().toISOString();
  await db.run(
    `INSERT INTO attendance (user_id, date, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(user_id, date) DO UPDATE SET status = ?, updated_at = ?`,
    [user_id, date, status, now, now, status, now],
  );
  res.json({ ok: true });
});

export default router;
