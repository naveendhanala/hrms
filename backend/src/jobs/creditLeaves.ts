import { db } from '../db';

const QUARTER_MONTHS = new Set([1, 4, 7, 10]);

/**
 * Grants quarterly leave credits based on site_office:
 *   Site   → +9 leaves
 *   Office → +5 leaves
 * Runs on 1 Jan, 1 Apr, 1 Jul, 1 Oct.
 */
export async function grantQuarterlyLeaves(): Promise<{ site: number; office: number }> {
  const ts = new Date().toISOString();

  const siteResult = await db.run(`
    INSERT INTO leave_balances (user_id, balance, updated_at)
    SELECT u.id, 9, ? FROM users u
    WHERE u.role != 'admin' AND u.status = 'active' AND u.site_office = 'Site'
    ON CONFLICT(user_id) DO UPDATE SET balance = leave_balances.balance + 9, updated_at = ?
  `, [ts, ts]);

  const officeResult = await db.run(`
    INSERT INTO leave_balances (user_id, balance, updated_at)
    SELECT u.id, 5, ? FROM users u
    WHERE u.role != 'admin' AND u.status = 'active' AND u.site_office = 'Office'
    ON CONFLICT(user_id) DO UPDATE SET balance = leave_balances.balance + 5, updated_at = ?
  `, [ts, ts]);

  return { site: siteResult.rowsAffected, office: officeResult.rowsAffected };
}

/** Called by the Vercel cron on 1st of every quarter month. */
export async function runCreditLeaves(): Promise<void> {
  const month = new Date().getMonth() + 1;
  if (!QUARTER_MONTHS.has(month)) {
    console.log(`[creditLeaves] Not a quarter month (${month}), skipping.`);
    return;
  }
  const result = await grantQuarterlyLeaves();
  console.log(`[creditLeaves] Q${Math.ceil(month / 3)} granted — Site: ${result.site}, Office: ${result.office}`);
}

/** Called by the Vercel cron on 31 Mar — unused leaves lapse. */
export async function runResetLeaves(): Promise<void> {
  const ts = new Date().toISOString();
  await db.run('UPDATE leave_balances SET balance = 0, updated_at = ?', [ts]);
  console.log('[resetLeaves] 31 Mar — all leave balances lapsed to 0');
}
