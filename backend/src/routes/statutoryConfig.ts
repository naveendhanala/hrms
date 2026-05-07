import { Router, Response } from 'express';
import db from '../db';
import { authenticateToken, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();

// ── Employee statutory config ─────────────────────────────────────────────────

router.get('/statutory-config', authenticateToken, requireRole('admin', 'hr', 'vp_hr'), async (_req: AuthRequest, res: Response) => {
  const rows = await db.query(`
    SELECT u.id AS employee_id, u.emp_id, u.name AS employee_name,
           COALESCE(sc.uan_number,  '') AS uan_number,
           COALESCE(sc.esic_number, '') AS esic_number,
           COALESCE(sc.pan_number,  '') AS pan_number,
           COALESCE(sc.epf_exempt,  false) AS epf_exempt,
           COALESCE(sc.esic_exempt, false) AS esic_exempt,
           COALESCE(sc.lwf_exempt,  false) AS lwf_exempt
    FROM users u
    LEFT JOIN employee_statutory_config sc ON sc.employee_id = u.id
    WHERE u.role != 'admin' AND u.status = 'active'
    ORDER BY u.name ASC
  `);
  res.json(rows);
});

router.put('/statutory-config/:userId', authenticateToken, requireRole('admin', 'hr', 'vp_hr'), async (req: AuthRequest, res: Response) => {
  const { uan_number, esic_number, pan_number, epf_exempt, esic_exempt, lwf_exempt } = req.body;
  const now = new Date().toISOString();

  const user = await db.queryOne("SELECT id FROM users WHERE id = ? AND role != 'admin'", [req.params.userId]);
  if (!user) return res.status(404).json({ error: 'Employee not found' });

  await db.run(`
    INSERT INTO employee_statutory_config (employee_id, uan_number, esic_number, pan_number, epf_exempt, esic_exempt, lwf_exempt, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (employee_id) DO UPDATE SET
      uan_number  = excluded.uan_number,
      esic_number = excluded.esic_number,
      pan_number  = excluded.pan_number,
      epf_exempt  = excluded.epf_exempt,
      esic_exempt = excluded.esic_exempt,
      lwf_exempt  = excluded.lwf_exempt,
      updated_at  = excluded.updated_at
  `, [
    Number(req.params.userId),
    uan_number  ?? '', esic_number ?? '', pan_number ?? '',
    epf_exempt  ?? false, esic_exempt ?? false, lwf_exempt ?? false,
    now,
  ]);

  res.json({ ok: true });
});

// ── LWF by state ──────────────────────────────────────────────────────────────

router.get('/lwf-states', authenticateToken, requireRole('admin', 'hr', 'vp_hr'), async (_req: AuthRequest, res: Response) => {
  const states = await db.query<{ state: string }>(
    "SELECT DISTINCT state FROM users WHERE state IS NOT NULL AND state != '' AND role != 'admin' ORDER BY state ASC",
  );
  const lwfRows = await db.query<any>('SELECT state, employee_amount, employer_amount, frequency FROM lwf_by_state');
  const lwfMap = Object.fromEntries(lwfRows.map((r: any) => [r.state, r]));
  res.json(states.map(s => ({
    state:           s.state,
    employee_amount: lwfMap[s.state]?.employee_amount ?? 0,
    employer_amount: lwfMap[s.state]?.employer_amount ?? 0,
    frequency:       lwfMap[s.state]?.frequency ?? 'monthly',
  })));
});

router.put('/lwf-states', authenticateToken, requireRole('admin', 'hr', 'vp_hr'), async (req: AuthRequest, res: Response) => {
  const { state, employee_amount, employer_amount, frequency } = req.body;
  if (!state) return res.status(400).json({ error: 'state is required' });
  const validFrequencies = ['monthly', 'half_yearly', 'annually'];
  if (frequency && !validFrequencies.includes(frequency))
    return res.status(400).json({ error: 'frequency must be monthly, half_yearly, or annually' });
  await db.run(`
    INSERT INTO lwf_by_state (state, employee_amount, employer_amount, frequency)
    VALUES (?, ?, ?, ?)
    ON CONFLICT (state) DO UPDATE SET
      employee_amount = excluded.employee_amount,
      employer_amount = excluded.employer_amount,
      frequency       = excluded.frequency
  `, [state, employee_amount ?? 0, employer_amount ?? 0, frequency ?? 'monthly']);
  res.json({ ok: true });
});

// ── Company info (stored in payroll_config key-value) ─────────────────────────

const COMPANY_KEYS = ['company_name', 'company_address', 'pf_registration_number', 'esic_registration_number', 'hr_email'];

router.get('/company-info', authenticateToken, requireRole('admin', 'hr', 'vp_hr'), async (_req: AuthRequest, res: Response) => {
  const rows = await db.query<{ key: string; value: string }>(
    `SELECT key, value FROM payroll_config WHERE key = ANY($1::text[])`,
    [COMPANY_KEYS],
  );
  const map = Object.fromEntries(rows.map(r => [r.key, r.value]));
  res.json({
    company_name:             map.company_name             ?? '',
    company_address:          map.company_address          ?? '',
    pf_registration_number:   map.pf_registration_number   ?? '',
    esic_registration_number: map.esic_registration_number ?? '',
    hr_email:                 map.hr_email                 ?? '',
  });
});

router.put('/company-info', authenticateToken, requireRole('admin', 'hr', 'vp_hr'), async (req: AuthRequest, res: Response) => {
  const now = new Date().toISOString();
  const upsert = `INSERT INTO payroll_config (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`;
  const entries = Object.entries(req.body).filter(([k]) => COMPANY_KEYS.includes(k));
  await Promise.all(entries.map(([k, v]) => db.run(upsert, [k, String(v), now])));
  res.json({ ok: true });
});

export default router;
