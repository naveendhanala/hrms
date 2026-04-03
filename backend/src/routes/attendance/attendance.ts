import { Router, Response } from 'express';
import db from '../../db';
import { authenticateToken, requireRole, AuthRequest } from '../../middleware/auth';

const router = Router();

// GET /today — current user's attendance for today
router.get('/today', authenticateToken, (req: AuthRequest, res: Response) => {
  const today = new Date().toISOString().split('T')[0];
  const row = db.prepare('SELECT * FROM attendance WHERE user_id = ? AND date = ?').get(req.user!.id, today);
  res.json(row || null);
});

// GET /summary — monthly summary for current user
router.get('/summary', authenticateToken, (req: AuthRequest, res: Response) => {
  const { month, year } = req.query;
  const m = month ? String(month).padStart(2, '0') : String(new Date().getMonth() + 1).padStart(2, '0');
  const y = year || new Date().getFullYear();
  const prefix = `${y}-${m}`;

  const rows = db.prepare(
    `SELECT status, COUNT(*) as count FROM attendance WHERE user_id = ? AND date LIKE ? GROUP BY status`
  ).all(req.user!.id, `${prefix}%`) as any[];

  const summary: Record<string, number> = { present: 0, absent: 0, leave: 0, 'half-day': 0 };
  for (const r of rows) summary[r.status] = r.count;
  res.json(summary);
});

// GET / — attendance list for current user (optional ?month=&year=)
router.get('/', authenticateToken, (req: AuthRequest, res: Response) => {
  const { month, year } = req.query;
  const m = month ? String(month).padStart(2, '0') : String(new Date().getMonth() + 1).padStart(2, '0');
  const y = year || new Date().getFullYear();
  const prefix = `${y}-${m}`;

  const rows = db.prepare(
    `SELECT a.*, u.name as user_name FROM attendance a
     JOIN users u ON a.user_id = u.id
     WHERE a.user_id = ? AND a.date LIKE ?
     ORDER BY a.date DESC`
  ).all(req.user!.id, `${prefix}%`);
  res.json(rows);
});

// GET /report — per-employee monthly summary (admin/hr/moderator)
router.get('/report', authenticateToken, requireRole('admin', 'hr'), (req: AuthRequest, res: Response) => {
  const { month, year } = req.query;
  const m = month ? String(month).padStart(2, '0') : String(new Date().getMonth() + 1).padStart(2, '0');
  const y = year || new Date().getFullYear();
  const prefix = `${y}-${m}`;
  const today = new Date().toISOString().split('T')[0];

  const rows = db.prepare(`
    SELECT
      u.id   AS user_id,
      u.name AS user_name,
      u.role AS user_role,
      COUNT(CASE WHEN a.status = 'present'  THEN 1 END) AS present,
      COUNT(CASE WHEN a.status = 'half-day' THEN 1 END) AS half_day,
      COUNT(CASE WHEN a.status = 'leave'    THEN 1 END) AS leave_days,
      COUNT(CASE WHEN a.status = 'absent'   THEN 1 END) AS absent,
      COUNT(a.id) AS total_days,
      ROUND(AVG(CASE WHEN a.work_hours IS NOT NULL THEN a.work_hours END), 1) AS avg_hours,
      (SELECT status FROM attendance WHERE user_id = u.id AND date = ?) AS today_status
    FROM users u
    LEFT JOIN attendance a ON u.id = a.user_id AND a.date LIKE ?
    WHERE u.role != 'admin'
    GROUP BY u.id, u.name, u.role
    ORDER BY u.name ASC
  `).all(today, `${prefix}%`);

  res.json(rows);
});

// GET /all — admin/hr view all users attendance
router.get('/all', authenticateToken, requireRole('admin', 'hr'), (req: AuthRequest, res: Response) => {
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

  res.json(db.prepare(sql).all(...params));
});

// POST /check-in
router.post('/check-in', authenticateToken, (req: AuthRequest, res: Response) => {
  const today = new Date().toISOString().split('T')[0];
  const now = new Date().toISOString();
  const checkInTime = new Date().toTimeString().slice(0, 5);

  const existing = db.prepare('SELECT * FROM attendance WHERE user_id = ? AND date = ?').get(req.user!.id, today) as any;

  if (existing?.check_in) {
    return res.status(400).json({ error: 'Already checked in today' });
  }

  if (existing) {
    db.prepare(`UPDATE attendance SET check_in = ?, status = 'present', updated_at = ? WHERE user_id = ? AND date = ?`)
      .run(checkInTime, now, req.user!.id, today);
  } else {
    db.prepare(
      `INSERT INTO attendance (user_id, date, check_in, status, created_at, updated_at) VALUES (?, ?, ?, 'present', ?, ?)`
    ).run(req.user!.id, today, checkInTime, now, now);
  }

  res.json(db.prepare('SELECT * FROM attendance WHERE user_id = ? AND date = ?').get(req.user!.id, today));
});

// POST /check-out
router.post('/check-out', authenticateToken, (req: AuthRequest, res: Response) => {
  const today = new Date().toISOString().split('T')[0];
  const now = new Date().toISOString();
  const checkOutTime = new Date().toTimeString().slice(0, 5);

  const existing = db.prepare('SELECT * FROM attendance WHERE user_id = ? AND date = ?').get(req.user!.id, today) as any;

  if (!existing?.check_in) {
    return res.status(400).json({ error: 'Must check in before checking out' });
  }
  if (existing?.check_out) {
    return res.status(400).json({ error: 'Already checked out today' });
  }

  // Calculate work hours
  const [inH, inM] = existing.check_in.split(':').map(Number);
  const [outH, outM] = checkOutTime.split(':').map(Number);
  const workHours = Math.round(((outH * 60 + outM) - (inH * 60 + inM)) / 60 * 10) / 10;
  const status = workHours < 4 ? 'half-day' : 'present';

  db.prepare(
    `UPDATE attendance SET check_out = ?, work_hours = ?, status = ?, updated_at = ? WHERE user_id = ? AND date = ?`
  ).run(checkOutTime, workHours, status, now, req.user!.id, today);

  res.json(db.prepare('SELECT * FROM attendance WHERE user_id = ? AND date = ?').get(req.user!.id, today));
});

// ── Leaves ───────────────────────────────────────────────────────────────────

// GET /leaves — current user's leaves
router.get('/leaves', authenticateToken, (req: AuthRequest, res: Response) => {
  const rows = db.prepare(
    `SELECT l.*, u.name as reviewer_name FROM leaves l
     LEFT JOIN users u ON l.reviewed_by = u.id
     WHERE l.user_id = ? ORDER BY l.created_at DESC`
  ).all(req.user!.id);
  res.json(rows);
});

// GET /leaves/all — admin/hr view all leave requests
router.get('/leaves/all', authenticateToken, requireRole('admin', 'hr'), (req: AuthRequest, res: Response) => {
  const { status } = req.query;
  let sql = `SELECT l.*, u.name as user_name, u.role as user_role, r.name as reviewer_name
             FROM leaves l JOIN users u ON l.user_id = u.id
             LEFT JOIN users r ON l.reviewed_by = r.id`;
  if (status) sql += ' WHERE l.status = ?';
  sql += ' ORDER BY l.created_at DESC';

  res.json(status ? db.prepare(sql).all(String(status)) : db.prepare(sql).all());
});

// POST /leaves — apply for leave
router.post('/leaves', authenticateToken, (req: AuthRequest, res: Response) => {
  const { start_date, end_date, type, reason } = req.body;
  if (!start_date || !end_date || !reason) {
    return res.status(400).json({ error: 'start_date, end_date and reason are required' });
  }

  const now = new Date().toISOString();
  const result = db.prepare(
    `INSERT INTO leaves (user_id, start_date, end_date, type, reason, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)`
  ).run(req.user!.id, start_date, end_date, type || 'casual', reason, now, now);

  res.status(201).json(db.prepare('SELECT * FROM leaves WHERE id = ?').get(result.lastInsertRowid));
});

// PUT /leaves/:id/approve
router.put('/leaves/:id/approve', authenticateToken, requireRole('admin', 'hr'), (req: AuthRequest, res: Response) => {
  const now = new Date().toISOString();
  const result = db.prepare(
    `UPDATE leaves SET status = 'approved', reviewed_by = ?, reviewed_at = ?, updated_at = ? WHERE id = ?`
  ).run(req.user!.id, now, now, req.params.id);

  if (result.changes === 0) return res.status(404).json({ error: 'Leave not found' });

  // Mark attendance as 'leave' for those dates
  const leave = db.prepare('SELECT * FROM leaves WHERE id = ?').get(req.params.id) as any;
  if (leave) {
    const start = new Date(leave.start_date);
    const end = new Date(leave.end_date);
    const ts = now;
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      db.prepare(
        `INSERT INTO attendance (user_id, date, status, notes, created_at, updated_at)
         VALUES (?, ?, 'leave', ?, ?, ?)
         ON CONFLICT(user_id, date) DO UPDATE SET status = 'leave', notes = ?, updated_at = ?`
      ).run(leave.user_id, dateStr, `Leave: ${leave.type}`, ts, ts, `Leave: ${leave.type}`, ts);
    }
  }

  res.json(db.prepare('SELECT * FROM leaves WHERE id = ?').get(req.params.id));
});

// PUT /leaves/:id/reject
router.put('/leaves/:id/reject', authenticateToken, requireRole('admin', 'hr'), (req: AuthRequest, res: Response) => {
  const now = new Date().toISOString();
  const result = db.prepare(
    `UPDATE leaves SET status = 'rejected', reviewed_by = ?, reviewed_at = ?, updated_at = ? WHERE id = ?`
  ).run(req.user!.id, now, now, req.params.id);

  if (result.changes === 0) return res.status(404).json({ error: 'Leave not found' });
  res.json(db.prepare('SELECT * FROM leaves WHERE id = ?').get(req.params.id));
});

export default router;
