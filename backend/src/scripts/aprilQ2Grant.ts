/**
 * One-time script: April 2026 Q2 leave grant + LOP conversion.
 *
 * 1. Grant quarterly leaves  (Site +9, Office +5).
 * 2. For every April 2026 absent-LOP record, convert to leave if the
 *    employee still has balance after the grant (FIFO by date).
 *
 * Run from /backend:
 *   DATABASE_URL=<url> npx ts-node src/scripts/aprilQ2Grant.ts
 */

import { Pool, types } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

// Parse .env manually so we don't need dotenv installed
function loadEnv(envPath: string) {
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnv(path.resolve(__dirname, '../../../.env'));
loadEnv(path.resolve(__dirname, '../../.env'));

types.setTypeParser(20, (val: string) => parseInt(val, 10));

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL is not set.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: DATABASE_URL.includes('supabase') ? { rejectUnauthorized: false } : false,
  max: 2,
});

async function main() {
  const client = await pool.connect();
  try {
    const ts = new Date().toISOString();

    // ── Step 1: Grant Q2 leaves ──────────────────────────────────────────────
    console.log('Step 1: Granting Q2 quarterly leaves…');

    const siteRes = await client.query(`
      INSERT INTO leave_balances (user_id, balance, updated_at)
        SELECT u.id, 9, $1
        FROM   users u
        WHERE  u.role != 'admin' AND u.status = 'active' AND u.site_office = 'Site'
      ON CONFLICT (user_id) DO UPDATE
        SET balance    = leave_balances.balance + 9,
            updated_at = $2
    `, [ts, ts]);

    const officeRes = await client.query(`
      INSERT INTO leave_balances (user_id, balance, updated_at)
        SELECT u.id, 5, $1
        FROM   users u
        WHERE  u.role != 'admin' AND u.status = 'active' AND u.site_office = 'Office'
      ON CONFLICT (user_id) DO UPDATE
        SET balance    = leave_balances.balance + 5,
            updated_at = $2
    `, [ts, ts]);

    console.log(`  Site employees credited   : ${siteRes.rowCount ?? 0} (+9 each)`);
    console.log(`  Office employees credited : ${officeRes.rowCount ?? 0} (+5 each)`);

    // ── Step 2: Convert April LOP absences → leave where balance allows ──────
    console.log('\nStep 2: Processing April 2026 absent-LOP records…');

    const lopRows = await client.query<{ id: number; user_id: number; date: string }>(`
      SELECT a.id, a.user_id, a.date
      FROM   attendance a
      WHERE  a.date  LIKE '2026-04-%'
        AND  a.lop    = true
        AND  a.status = 'absent'
      ORDER  BY a.user_id, a.date
    `);

    console.log(`  April absent-LOP records found: ${lopRows.rows.length}`);

    let converted = 0;
    let keptAsLop  = 0;

    for (const rec of lopRows.rows) {
      const balRow = await client.query<{ balance: number }>(
        'SELECT balance FROM leave_balances WHERE user_id = $1',
        [rec.user_id],
      );
      const balance: number = balRow.rows[0]?.balance ?? 0;

      if (balance > 0) {
        await client.query(
          `UPDATE leave_balances
              SET balance    = balance - 1,
                  updated_at = $1
            WHERE user_id = $2`,
          [ts, rec.user_id],
        );
        await client.query(
          `UPDATE attendance
              SET status     = 'leave',
                  lop        = false,
                  notes      = 'Leave balance applied for April absent day',
                  updated_at = $1
            WHERE id = $2`,
          [ts, rec.id],
        );
        converted++;
      } else {
        keptAsLop++;
      }
    }

    console.log(`  Converted to leave (balance deducted) : ${converted}`);
    console.log(`  Kept as LOP (balance exhausted)       : ${keptAsLop}`);

    // ── Summary ──────────────────────────────────────────────────────────────
    const balances = await client.query<{ name: string; site_office: string; balance: number }>(`
      SELECT u.name, u.site_office, COALESCE(lb.balance, 0) AS balance
      FROM   users u
      LEFT   JOIN leave_balances lb ON lb.user_id = u.id
      WHERE  u.role != 'admin' AND u.status = 'active'
      ORDER  BY u.name
    `);

    console.log('\n── Final leave balances ───────────────────────────────────');
    for (const row of balances.rows) {
      console.log(`  ${row.name.padEnd(30)} ${(row.site_office ?? '').padEnd(8)} ${row.balance}`);
    }
    console.log('──────────────────────────────────────────────────────────\n');
    console.log('Done.');
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
