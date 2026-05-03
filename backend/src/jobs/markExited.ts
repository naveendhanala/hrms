import { db } from '../db';

export async function runMarkExited(): Promise<number> {
  const today = new Date().toISOString().split('T')[0];
  const result = await db.run(
    `UPDATE users SET status = 'inactive'
     WHERE id IN (
       SELECT employee_id FROM exit_requests
       WHERE status = 'approved' AND last_working_day < ?
     )
     AND status = 'active'`,
    [today],
  );
  console.log(`[markExited] ${today} — marked ${result.rowsAffected} employee(s) as inactive`);
  return result.rowsAffected;
}
