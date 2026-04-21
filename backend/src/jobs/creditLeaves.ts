import { db } from '../db';

export async function runCreditLeaves(): Promise<void> {
  const now = new Date();
  const ts  = now.toISOString();
  const isApril = now.getMonth() === 3; // 0-indexed; 3 = April

  if (isApril) {
    await db.run(`
      INSERT INTO leave_balances (user_id, balance, updated_at)
      SELECT id, 2, ? FROM users WHERE role != 'admin'
      ON CONFLICT(user_id) DO UPDATE SET balance = 2, updated_at = ?
    `, [ts, ts]);
    console.log('[creditLeaves] April 1 — financial year reset, balances set to 2');
  } else {
    await db.run(`
      INSERT INTO leave_balances (user_id, balance, updated_at)
      SELECT id, 2, ? FROM users WHERE role != 'admin'
      ON CONFLICT(user_id) DO UPDATE SET balance = balance + 2, updated_at = ?
    `, [ts, ts]);
    console.log(`[creditLeaves] Credited 2 leaves — ${now.toDateString()}`);
  }
}

export async function runResetLeaves(): Promise<void> {
  const ts = new Date().toISOString();
  await db.run('UPDATE leave_balances SET balance = 0, updated_at = ?', [ts]);
  console.log('[creditLeaves] March 31 — all leave balances reset to 0');
}
