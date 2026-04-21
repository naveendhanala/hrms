import { db } from '../db';

export async function runMarkAbsent(): Promise<number> {
  const today = new Date().toISOString().split('T')[0];
  const now   = new Date().toISOString();

  const result = await db.run(`
    INSERT INTO attendance (user_id, date, status, notes, created_at, updated_at)
    SELECT u.id, ?, 'absent', 'Auto-marked absent by system', ?, ?
    FROM users u
    WHERE u.role != 'admin'
      AND NOT EXISTS (
        SELECT 1 FROM attendance a
        WHERE a.user_id = u.id
          AND a.date = ?
          AND a.status IN ('present', 'leave')
      )
    ON CONFLICT(user_id, date) DO UPDATE
      SET status     = 'absent',
          notes      = 'Auto-marked absent by system',
          updated_at = ?
      WHERE attendance.status NOT IN ('present', 'leave')
  `, [today, now, now, today, now]);

  console.log(`[markAbsent] ${today} — marked ${result.rowsAffected} employee(s) as absent`);
  return result.rowsAffected;
}
