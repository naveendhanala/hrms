import { Router, Response } from 'express';
import db from '../db';
import { authenticateToken, requireRole, AuthRequest } from '../middleware/auth';
import { computeAnnualTax, getFY } from './taxComputation';
import { calcEpf, calcEsic, calcLwf, calcGratuityProvision } from '../payroll/calculations';
import { streamPayslipPdf, type PayslipData } from '../payroll/payslipPdf';
import { buildEcrText, buildEsiCsv, buildLwfCsv } from '../payroll/exports';

const router = Router();

function getDaysInMonth(month: number, year: number): number {
  return new Date(year, month, 0).getDate();
}

router.get('/salary-master', authenticateToken, requireRole('admin', 'hr', 'vp_hr'), async (_req: AuthRequest, res: Response) => {
  const rows = await db.query(`
    SELECT u.id AS employee_id, u.emp_id, u.name AS employee_name, u.role AS employee_role, u.designation AS employee_designation,
           COALESCE(s.basic_salary,       0) AS basic_salary,
           COALESCE(s.hra,                0) AS hra,
           COALESCE(s.meal_allowance,     0) AS meal_allowance,
           COALESCE(s.conveyance_allowance, 0) AS conveyance_allowance,
           COALESCE(s.special_allowance,   0) AS special_allowance,
           COALESCE(s.deductions,         0) AS deductions,
           s.updated_at
    FROM users u
    LEFT JOIN salary_master s ON s.employee_id = u.id
    WHERE u.role != 'admin' AND u.status = 'active'
    ORDER BY u.name ASC
  `);
  res.json(rows);
});

router.put('/salary-master/:userId', authenticateToken, requireRole('admin', 'hr', 'vp_hr'), async (req: AuthRequest, res: Response) => {
  const { basic_salary, hra, meal_allowance, conveyance_allowance, special_allowance, deductions } = req.body;
  const now = new Date().toISOString();

  const user = await db.queryOne("SELECT id FROM users WHERE id = ? AND role != 'admin'", [req.params.userId]);
  if (!user) return res.status(404).json({ error: 'Employee not found' });

  await db.run(`
    INSERT INTO salary_master (employee_id, basic_salary, hra, meal_allowance, conveyance_allowance, special_allowance, deductions, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(employee_id) DO UPDATE SET
      basic_salary         = excluded.basic_salary,
      hra                  = excluded.hra,
      meal_allowance       = excluded.meal_allowance,
      conveyance_allowance = excluded.conveyance_allowance,
      special_allowance    = excluded.special_allowance,
      deductions           = excluded.deductions,
      updated_at           = excluded.updated_at
  `, [
    Number(req.params.userId),
    basic_salary         ?? 0,
    hra                  ?? 0,
    meal_allowance       ?? 0,
    conveyance_allowance ?? 0,
    special_allowance    ?? 0,
    deductions           ?? 0,
    now,
  ]);

  res.json({ ok: true });
});

router.post('/salary-master/:userId/revise', authenticateToken, requireRole('admin', 'hr', 'vp_hr'), async (req: AuthRequest, res: Response) => {
  const { effective_date, basic_salary, hra, meal_allowance, conveyance_allowance, special_allowance, deductions } = req.body;

  if (!effective_date || !/^\d{4}-\d{2}-\d{2}$/.test(effective_date)) {
    return res.status(400).json({ error: 'effective_date must be a valid date (YYYY-MM-DD)' });
  }

  const user = await db.queryOne("SELECT id FROM users WHERE id = ? AND role != 'admin'", [req.params.userId]);
  if (!user) return res.status(404).json({ error: 'Employee not found' });

  // Check for same-calendar-month conflict
  const [effYear, effMonth] = effective_date.split('-').map(Number);
  const monthStart = `${effYear}-${String(effMonth).padStart(2, '0')}-01`;
  const monthEnd   = `${effYear}-${String(effMonth).padStart(2, '0')}-${String(getDaysInMonth(effMonth, effYear)).padStart(2, '0')}`;

  const existing = await db.queryOne(
    `SELECT id FROM salary_master_history WHERE employee_id = ? AND effective_date >= ? AND effective_date <= ?`,
    [Number(req.params.userId), monthStart, monthEnd],
  );
  if (existing) {
    const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return res.status(409).json({ error: `A salary revision already exists for this employee in ${MONTHS[effMonth - 1]} ${effYear}` });
  }

  const now = new Date().toISOString();
  const today = now.slice(0, 10); // YYYY-MM-DD

  // Capture current salary_master values as the "previous" snapshot
  const prevSalary = await db.queryOne<{
    basic_salary: number;
    hra: number;
    meal_allowance: number;
    conveyance_allowance: number;
    special_allowance: number;
  } | null>(
    'SELECT basic_salary, hra, meal_allowance, conveyance_allowance, special_allowance FROM salary_master WHERE employee_id = ?',
    [Number(req.params.userId)],
  );

  await db.transaction(async (tx) => {
    await tx.run(
      `INSERT INTO salary_master_history
         (employee_id, effective_date, basic_salary, hra, meal_allowance, conveyance_allowance, special_allowance, deductions,
          prev_basic_salary, prev_hra, prev_meal_allowance, prev_conveyance_allowance, prev_special_allowance,
          created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        Number(req.params.userId),
        effective_date,
        basic_salary         ?? 0,
        hra                  ?? 0,
        meal_allowance       ?? 0,
        conveyance_allowance ?? 0,
        special_allowance    ?? 0,
        deductions           ?? 0,
        prevSalary?.basic_salary         ?? null,
        prevSalary?.hra                  ?? null,
        prevSalary?.meal_allowance       ?? null,
        prevSalary?.conveyance_allowance ?? null,
        prevSalary?.special_allowance    ?? null,
        req.user!.id,
        now,
      ],
    );

    // If effective date is today or past, sync to salary_master
    if (effective_date <= today) {
      await tx.run(
        `INSERT INTO salary_master (employee_id, basic_salary, hra, meal_allowance, conveyance_allowance, special_allowance, deductions, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(employee_id) DO UPDATE SET
           basic_salary         = excluded.basic_salary,
           hra                  = excluded.hra,
           meal_allowance       = excluded.meal_allowance,
           conveyance_allowance = excluded.conveyance_allowance,
           special_allowance    = excluded.special_allowance,
           deductions           = excluded.deductions,
           updated_at           = excluded.updated_at`,
        [
          Number(req.params.userId),
          basic_salary         ?? 0,
          hra                  ?? 0,
          meal_allowance       ?? 0,
          conveyance_allowance ?? 0,
          special_allowance    ?? 0,
          deductions           ?? 0,
          now,
        ],
      );
    }
  });

  res.status(201).json({ ok: true, effective_date });
});

router.get('/salary-master/:userId/history', authenticateToken, requireRole('admin', 'hr', 'vp_hr'), async (req: AuthRequest, res: Response) => {
  const userId = parseInt(req.params.userId, 10);
  if (isNaN(userId)) return res.status(400).json({ error: 'Invalid employee ID' });

  const user = await db.queryOne("SELECT id FROM users WHERE id = ? AND role != 'admin'", [userId]);
  if (!user) return res.status(404).json({ error: 'Employee not found' });

  const rows = await db.query(`
    SELECT
      h.id,
      h.effective_date::text AS effective_date,
      h.basic_salary,
      h.hra,
      h.meal_allowance,
      h.conveyance_allowance,
      h.special_allowance,
      h.deductions,
      h.arrears_processed,
      h.created_at,
      u.name AS created_by_name
    FROM salary_master_history h
    LEFT JOIN users u ON u.id = h.created_by
    WHERE h.employee_id = ?
    ORDER BY h.effective_date DESC
  `, [userId]);

  res.json(rows);
});

router.get('/', authenticateToken, requireRole('admin', 'hr', 'vp_hr'), async (req: AuthRequest, res: Response) => {
  const now = new Date();
  const month = req.query.month ? Number(req.query.month) : now.getMonth() + 1;
  const year  = req.query.year  ? Number(req.query.year)  : now.getFullYear();

  const run = await db.queryOne<any>(
    'SELECT pr.*, u.name as created_by_name FROM payroll_runs pr JOIN users u ON pr.created_by = u.id WHERE pr.month = ? AND pr.year = ?',
    [month, year],
  );

  if (!run) return res.json(null);

  const records = await db.query(`
    SELECT r.*, u.emp_id, u.name as employee_name, u.role as employee_role,
           u.designation as employee_designation, u.state as employee_state,
           m.name as manager_name,
           (r.basic_salary + r.allowances) as gross_salary,
           COALESCE(r.tds_deduction,       0) as tds_deduction,
           COALESCE(r.epf_employee,        0) as epf_employee,
           COALESCE(r.epf_employer,        0) as epf_employer,
           COALESCE(r.eps_employer,        0) as eps_employer,
           COALESCE(r.esic_employee,       0) as esic_employee,
           COALESCE(r.esic_employer,       0) as esic_employer,
           COALESCE(r.lwf_employee,        0) as lwf_employee,
           COALESCE(r.lwf_employer,        0) as lwf_employer,
           COALESCE(r.gratuity_provision,  0) as gratuity_provision,
           COALESCE(sc.epf_exempt, false) as epf_exempt, COALESCE(sc.esic_exempt, false) as esic_exempt
    FROM payroll_records r
    JOIN users u ON r.employee_id = u.id
    LEFT JOIN users m ON u.reporting_manager_id = m.id
    LEFT JOIN employee_statutory_config sc ON sc.employee_id = r.employee_id
    WHERE r.run_id = ?
    ORDER BY u.name ASC
  `, [run.id]);

  res.json({ ...run, records });
});

router.get('/history', authenticateToken, requireRole('admin', 'hr', 'vp_hr'), async (_req: AuthRequest, res: Response) => {
  const runs = await db.query(`
    SELECT pr.*, u.name as created_by_name,
           COUNT(r.id) as employee_count,
           SUM(r.basic_salary + r.allowances - r.lop_deduction - r.prof_tax - r.deductions - r.tds_deduction - COALESCE(r.epf_employee,0) - COALESCE(r.esic_employee,0) - COALESCE(r.lwf_employee,0)) as total_net
    FROM payroll_runs pr
    JOIN users u ON pr.created_by = u.id
    LEFT JOIN payroll_records r ON r.run_id = pr.id
    GROUP BY pr.id
    ORDER BY pr.year DESC, pr.month DESC
  `);
  res.json(runs);
});

async function buildPayrollRecords(runId: number, month: number, year: number, now: string) {
  const totalDays   = getDaysInMonth(month, year);
  const monthPrefix = `${year}-${String(month).padStart(2, '0')}`;
  const { fyStartYear, fyEndYear } = getFY(month, year);

  const firstOfMonth = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastOfMonth  = `${year}-${String(month).padStart(2, '0')}-${String(getDaysInMonth(month, year)).padStart(2, '0')}`;

  const [employees, stateTaxRows, lwfRows, statutoryRows, allAtt, allAdv, allTds, historicalGratuity, allSalaryHistory] = await Promise.all([
    db.query<any>(`
      SELECT u.id, u.state, u.date_of_joining,
             COALESCE(s.basic_salary,           0) AS basic_salary,
             COALESCE(s.hra,                    0) AS hra,
             COALESCE(s.meal_allowance,         0) AS meal_allowance,
             COALESCE(s.conveyance_allowance,   0) AS conveyance_allowance,
             COALESCE(s.special_allowance,      0) AS special_allowance,
             COALESCE(s.deductions,             0) AS deductions,
             COALESCE(t.tax_regime,         'new') AS tax_regime
      FROM users u
      LEFT JOIN salary_master s ON s.employee_id = u.id
      LEFT JOIN employee_tax_config t ON t.employee_id = u.id
      WHERE u.role != 'admin' AND u.status = 'active'
    `),
    db.query<{ state: string; amount: number }>('SELECT state, amount FROM prof_tax_by_state'),
    db.query<any>('SELECT state, employee_amount, employer_amount, frequency FROM lwf_by_state'),
    db.query<any>('SELECT employee_id, epf_exempt, esic_exempt, lwf_exempt FROM employee_statutory_config'),
    db.query<any>(`
      SELECT user_id,
             COUNT(*) FILTER (WHERE status = 'present') AS present_days,
             COUNT(*) FILTER (WHERE status = 'leave')   AS leave_days,
             COUNT(*) FILTER (WHERE status = 'absent')  AS absent_days,
             COUNT(*) FILTER (WHERE lop = true)         AS lop_days
      FROM attendance WHERE date LIKE ? GROUP BY user_id
    `, [`${monthPrefix}%`]),
    db.query<any>(`
      SELECT employee_id, COALESCE(SUM(monthly_amt), 0) AS total
      FROM employee_advances WHERE status = 'active' GROUP BY employee_id
    `),
    db.query<any>(`
      SELECT pr.employee_id,
             COUNT(*)                            AS processed_count,
             COALESCE(SUM(pr.tds_deduction), 0) AS tds_total
      FROM payroll_records pr
      JOIN payroll_runs run ON pr.run_id = run.id
      WHERE run.status IN ('processed', 'paid')
        AND ((run.year = ? AND run.month >= 4) OR (run.year = ? AND run.month <= 3))
      GROUP BY pr.employee_id
    `, [fyStartYear, fyEndYear]),
    db.query<any>(`
      SELECT ga.employee_id, COALESCE(SUM(ga.provision_amount), 0) AS historical_total
      FROM gratuity_accruals ga
      JOIN payroll_runs pr ON ga.run_id = pr.id
      WHERE (pr.year < ? OR (pr.year = ? AND pr.month < ?))
      GROUP BY ga.employee_id
    `, [year, year, month]),
    db.query<any>(`
      SELECT
        h.id,
        h.employee_id,
        h.effective_date::text AS effective_date,
        h.basic_salary,
        h.hra,
        h.meal_allowance,
        h.conveyance_allowance,
        h.special_allowance,
        h.arrears_processed,
        h.prev_basic_salary         AS prev_basic,
        h.prev_hra                  AS prev_hra,
        h.prev_meal_allowance       AS prev_meal,
        h.prev_conveyance_allowance AS prev_conv,
        h.prev_special_allowance    AS prev_special
      FROM salary_master_history h
      WHERE (h.effective_date >= ? AND h.effective_date <= ?)
         OR (h.effective_date < ?  AND h.arrears_processed = FALSE)
    `, [firstOfMonth, lastOfMonth, firstOfMonth]),
  ]);

  const stateTaxMap  = new Map(stateTaxRows.map(r => [r.state.trim().toLowerCase(), r.amount]));
  const lwfMap       = new Map(lwfRows.map((r: any) => [r.state.trim().toLowerCase(), r]));
  const statutoryMap = new Map(statutoryRows.map((r: any) => [r.employee_id, r]));
  const attMap       = new Map(allAtt.map((r: any) => [r.user_id, r]));
  const advMap       = new Map(allAdv.map((r: any) => [r.employee_id, Number(r.total)]));
  const tdsMap       = new Map(allTds.map((r: any) => [r.employee_id, r]));
  const gratMap      = new Map(historicalGratuity.map((r: any) => [r.employee_id, Number(r.historical_total)]));

  interface EmpHistEntry {
    midMonth: any | null;
    arrearRevisions: any[];
  }
  const historyMap = new Map<number, EmpHistEntry>();
  for (const h of allSalaryHistory) {
    if (!historyMap.has(h.employee_id)) {
      historyMap.set(h.employee_id, { midMonth: null, arrearRevisions: [] });
    }
    const entry = historyMap.get(h.employee_id)!;
    if (h.effective_date >= firstOfMonth && h.effective_date <= lastOfMonth) {
      entry.midMonth = h;
    } else {
      entry.arrearRevisions.push(h);
    }
  }
  const allProcessedHistoryIds: number[] = [];

  const rowValues: unknown[] = [];
  const gratValues: unknown[] = [];

  for (const emp of employees) {
    const att         = attMap.get(emp.id);
    const presentDays = Number(att?.present_days ?? 0);
    const leaveDays   = Number(att?.leave_days   ?? 0);
    const absentDays  = Number(att?.absent_days  ?? 0);
    const lopDays     = Number(att?.lop_days     ?? 0);

    const empHist = historyMap.get(emp.id) ?? { midMonth: null, arrearRevisions: [] };

    // Determine salary components (prorate if mid-month revision exists)
    let basicSalary      = emp.basic_salary;
    let totalAllowances  = emp.hra + emp.meal_allowance + emp.conveyance_allowance + emp.special_allowance;
    let grossSalary      = basicSalary + totalAllowances;
    let epfBasic         = emp.basic_salary; // EPF uses month-end basic

    if (empHist.midMonth) {
      const rev        = empHist.midMonth;
      const effDay     = parseInt(rev.effective_date.slice(8, 10), 10);
      const daysBefore = effDay - 1;
      const daysFrom   = totalDays - daysBefore;

      const oldBasic      = Number(rev.prev_basic   ?? emp.basic_salary);
      const oldHra        = Number(rev.prev_hra      ?? emp.hra);
      const oldMeal       = Number(rev.prev_meal     ?? emp.meal_allowance);
      const oldConv       = Number(rev.prev_conv     ?? emp.conveyance_allowance);
      const oldSpec       = Number(rev.prev_special  ?? emp.special_allowance);
      const oldAllowances = oldHra + oldMeal + oldConv + oldSpec;
      const oldGross      = oldBasic + oldAllowances;

      const newBasic      = Number(rev.basic_salary);
      const newAllowances = Number(rev.hra) + Number(rev.meal_allowance) + Number(rev.conveyance_allowance) + Number(rev.special_allowance);
      const newGross      = newBasic + newAllowances;

      basicSalary     = Math.round((oldBasic / totalDays * daysBefore + newBasic / totalDays * daysFrom) * 100) / 100;
      totalAllowances = Math.round((oldAllowances / totalDays * daysBefore + newAllowances / totalDays * daysFrom) * 100) / 100;
      grossSalary     = Math.round((oldGross / totalDays * daysBefore + newGross / totalDays * daysFrom) * 100) / 100;
      epfBasic        = newBasic; // EPF/gratuity uses month-end (new) basic
    }

    const lopDeduction = totalDays > 0 ? Math.round((lopDays * grossSalary) / totalDays * 100) / 100 : 0;

    const empState = (emp.state || '').trim().toLowerCase();
    const profTax  = empState && stateTaxMap.has(empState) ? stateTaxMap.get(empState)! : 0;

    const advanceDeduction = advMap.get(emp.id) ?? 0;

    const tdsRow              = tdsMap.get(emp.id);
    const processedMonthsInFY = Number(tdsRow?.processed_count ?? 0);
    const tdsAlreadyDeducted  = Number(tdsRow?.tds_total       ?? 0);
    const regime              = (emp.tax_regime || 'new') as 'old' | 'new';
    const { monthlyTds }      = computeAnnualTax(grossSalary, regime, month, year, emp.date_of_joining, tdsAlreadyDeducted, processedMonthsInFY);

    const statutory  = statutoryMap.get(emp.id) ?? { epf_exempt: false, esic_exempt: false, lwf_exempt: false };
    const epf        = calcEpf(epfBasic, !!statutory.epf_exempt);
    const esic       = calcEsic(grossSalary, !!statutory.esic_exempt);
    const lwfConfig  = lwfMap.get(empState);
    const lwf        = lwfConfig
      ? calcLwf(lwfConfig.employee_amount, lwfConfig.employer_amount, lwfConfig.frequency, month, !!statutory.lwf_exempt)
      : { employee: 0, employer: 0 };
    const gratProvision  = calcGratuityProvision(epfBasic);
    const historicalGrat = gratMap.get(emp.id) ?? 0;
    const cumulativeGrat = Math.round((historicalGrat + gratProvision) * 100) / 100;

    // Compute arrears for unprocessed retroactive revisions
    const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    let arrears      = 0;
    let arrearsLabel = '';

    for (const rev of empHist.arrearRevisions) {
      const effDate       = new Date(rev.effective_date);
      const pastMonth     = effDate.getMonth() + 1;
      const pastYear      = effDate.getFullYear();
      const pastTotalDays = getDaysInMonth(pastMonth, pastYear);
      const effDay        = effDate.getDate();
      const daysUnderNew  = pastTotalDays - effDay + 1;

      const oldBasic = Number(rev.prev_basic   ?? emp.basic_salary);
      const oldHra   = Number(rev.prev_hra     ?? emp.hra);
      const oldMeal  = Number(rev.prev_meal    ?? emp.meal_allowance);
      const oldConv  = Number(rev.prev_conv    ?? emp.conveyance_allowance);
      const oldSpec  = Number(rev.prev_special ?? emp.special_allowance);
      const oldGross = oldBasic + oldHra + oldMeal + oldConv + oldSpec;

      const newGross = Number(rev.basic_salary) + Number(rev.hra) + Number(rev.meal_allowance) + Number(rev.conveyance_allowance) + Number(rev.special_allowance);

      arrears += (newGross - oldGross) / pastTotalDays * daysUnderNew;
      allProcessedHistoryIds.push(rev.id);

      arrearsLabel = empHist.arrearRevisions.length === 1
        ? `${MONTHS_SHORT[effDate.getMonth()]} ${pastYear}`
        : 'Prior Months';
    }
    arrears = Math.round(arrears * 100) / 100;

    rowValues.push(
      runId, emp.id, basicSalary, totalAllowances,
      emp.meal_allowance, emp.conveyance_allowance, emp.deductions,
      totalDays, presentDays, leaveDays, absentDays, lopDays, lopDeduction, profTax, advanceDeduction, monthlyTds,
      epf.employee, epf.epfEmployer, epf.epsEmployer,
      esic.employee, esic.employer,
      lwf.employee, lwf.employer,
      gratProvision,
      arrears, arrearsLabel,
      now, now,
    );

    gratValues.push(runId, emp.id, month, year, epfBasic, gratProvision, cumulativeGrat, now);
  }

  if (employees.length > 0) {
    const cols = 28;
    const placeholders = employees.map(() => `(${Array.from({ length: cols }, () => '?').join(', ')})`).join(', ');
    const gCols = 8;
    const gPlaceholders = employees.map(() => `(${Array.from({ length: gCols }, () => '?').join(', ')})`).join(', ');

    await db.transaction(async (tx) => {
      await tx.run(
        `INSERT INTO payroll_records
          (run_id, employee_id, basic_salary, allowances, meal_allowance, conveyance_allowance, deductions,
           working_days, present_days, leave_days, absent_days, lop_days, lop_deduction, prof_tax, advance_deduction, tds_deduction,
           epf_employee, epf_employer, eps_employer,
           esic_employee, esic_employer,
           lwf_employee, lwf_employer,
           gratuity_provision,
           arrears, arrears_label,
           created_at, updated_at)
         VALUES ${placeholders}`,
        rowValues,
      );
      await tx.run(
        `INSERT INTO gratuity_accruals (run_id, employee_id, month, year, basic_salary, provision_amount, cumulative_amount, created_at)
         VALUES ${gPlaceholders}
         ON CONFLICT (run_id, employee_id) DO UPDATE SET
           provision_amount  = excluded.provision_amount,
           cumulative_amount = excluded.cumulative_amount`,
        gratValues,
      );
      if (allProcessedHistoryIds.length > 0) {
        const idPlaceholders = allProcessedHistoryIds.map(() => '?').join(', ');
        await tx.run(
          `UPDATE salary_master_history SET arrears_processed = TRUE WHERE id IN (${idPlaceholders})`,
          allProcessedHistoryIds,
        );
      }
    });
  }
}

router.post('/', authenticateToken, requireRole('admin', 'hr', 'vp_hr'), async (req: AuthRequest, res: Response) => {
  const { month, year } = req.body;
  if (!month || !year) return res.status(400).json({ error: 'month and year are required' });

  const existing = await db.queryOne('SELECT id FROM payroll_runs WHERE month = ? AND year = ?', [month, year]);
  if (existing) return res.status(409).json({ error: 'Payroll run already exists for this month' });

  const now = new Date().toISOString();
  const run = await db.run(
    'INSERT INTO payroll_runs (month, year, status, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?) RETURNING id',
    [month, year, 'draft', req.user!.id, now, now],
  );

  await buildPayrollRecords(run.lastInsertRowid, month, year, now);

  res.status(201).json({ id: run.lastInsertRowid, month, year, status: 'draft' });
});

router.post('/:runId/regenerate', authenticateToken, requireRole('admin', 'hr', 'vp_hr'), async (req: AuthRequest, res: Response) => {
  const run = await db.queryOne<any>('SELECT * FROM payroll_runs WHERE id = ?', [req.params.runId]);
  if (!run) return res.status(404).json({ error: 'Payroll run not found' });
  if (run.status !== 'draft') return res.status(400).json({ error: 'Only draft runs can be regenerated' });

  const now = new Date().toISOString();
  await db.run('DELETE FROM payroll_records WHERE run_id = ?', [run.id]);
  await db.run('DELETE FROM gratuity_accruals WHERE run_id = ?', [run.id]);
  await db.run('UPDATE payroll_runs SET updated_at = ? WHERE id = ?', [now, run.id]);
  await buildPayrollRecords(run.id, run.month, run.year, now);

  res.json({ ok: true });
});

router.put('/records/:recordId', authenticateToken, requireRole('admin', 'hr', 'vp_hr'), async (req: AuthRequest, res: Response) => {
  const { basic_salary, allowances, deductions } = req.body;
  const now = new Date().toISOString();

  const record = await db.queryOne<any>(
    'SELECT r.*, pr.status FROM payroll_records r JOIN payroll_runs pr ON r.run_id = pr.id WHERE r.id = ?',
    [req.params.recordId],
  );

  if (!record) return res.status(404).json({ error: 'Record not found' });
  if (record.status !== 'draft') return res.status(400).json({ error: 'Cannot edit a processed payroll run' });

  await db.run(
    'UPDATE payroll_records SET basic_salary = ?, allowances = ?, deductions = ?, updated_at = ? WHERE id = ?',
    [basic_salary ?? record.basic_salary, allowances ?? record.allowances, deductions ?? record.deductions, now, req.params.recordId],
  );

  res.json({ ok: true });
});

router.patch('/:runId/status', authenticateToken, requireRole('admin', 'hr', 'vp_hr'), async (req: AuthRequest, res: Response) => {
  const { status } = req.body;
  const allowed = ['draft', 'processed', 'paid'];
  if (!allowed.includes(status)) return res.status(400).json({ error: 'Invalid status' });

  const now = new Date().toISOString();

  const run = await db.queryOne<any>('SELECT status FROM payroll_runs WHERE id = ?', [req.params.runId]);
  if (!run) return res.status(404).json({ error: 'Run not found' });

  const result = await db.run(
    'UPDATE payroll_runs SET status = ?, updated_at = ? WHERE id = ?',
    [status, now, req.params.runId],
  );
  if (result.rowsAffected === 0) return res.status(404).json({ error: 'Run not found' });

  // Apply advance recovery when transitioning draft → processed
  if (status === 'processed' && run.status === 'draft') {
    const records = await db.query<any>(
      'SELECT employee_id, advance_deduction FROM payroll_records WHERE run_id = ? AND advance_deduction > 0',
      [req.params.runId],
    );

    if (records.length > 0) {
      const empIds = records.map((r: any) => r.employee_id);
      // Single query for all active advances across all affected employees
      const advances = await db.query<any>(
        `SELECT * FROM employee_advances WHERE employee_id = ANY($1::int[]) AND status = 'active'`,
        [empIds],
      );

      // Run all updates in parallel
      await Promise.all(advances.map((adv: any) => {
        const newRecovered = Math.min(Number(adv.recovered) + Number(adv.monthly_amt), Number(adv.amount));
        const newStatus = newRecovered >= Number(adv.amount) ? 'closed' : 'active';
        return db.run(
          'UPDATE employee_advances SET recovered = ?, status = ?, updated_at = ? WHERE id = ?',
          [newRecovered, newStatus, now, adv.id],
        );
      }));
    }
  }

  res.json({ ok: true });
});

router.get('/config', authenticateToken, requireRole('admin', 'hr', 'vp_hr'), async (_req: AuthRequest, res: Response) => {
  const rows = await db.query<{ key: string; value: string }>('SELECT key, value FROM payroll_config');
  const map = Object.fromEntries(rows.map(r => [r.key, r.value]));
  res.json({
    prof_tax_amount: Number(map.prof_tax_amount ?? 200),
    tds_percentage:  Number(map.tds_percentage  ?? 0),
  });
});

router.put('/config', authenticateToken, requireRole('admin', 'hr', 'vp_hr'), async (req: AuthRequest, res: Response) => {
  const { prof_tax_amount, tds_percentage } = req.body;
  const now = new Date().toISOString();
  const upsert = `
    INSERT INTO payroll_config (key, value, updated_at) VALUES (?, ?, ?)
    ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `;
  if (prof_tax_amount !== undefined) await db.run(upsert, ['prof_tax_amount', String(prof_tax_amount), now]);
  if (tds_percentage  !== undefined) await db.run(upsert, ['tds_percentage',  String(tds_percentage),  now]);
  res.json({ ok: true });
});

// ── TDS Slabs ─────────────────────────────────────────────────────────────────
const DEFAULT_TDS_SLABS = {
  old: [
    { id: 'o1', range: 'Up to ₹2,50,000',              rate: 'Nil' },
    { id: 'o2', range: '₹2,50,001 – ₹5,00,000',        rate: '5%'  },
    { id: 'o3', range: '₹5,00,001 – ₹10,00,000',       rate: '20%' },
    { id: 'o4', range: 'Above ₹10,00,000',              rate: '30%' },
  ],
  new: [
    { id: 'n1', range: 'Up to ₹4,00,000',              rate: 'Nil' },
    { id: 'n2', range: '₹4,00,001 – ₹8,00,000',        rate: '5%'  },
    { id: 'n3', range: '₹8,00,001 – ₹12,00,000',       rate: '10%' },
    { id: 'n4', range: '₹12,00,001 – ₹16,00,000',      rate: '15%' },
    { id: 'n5', range: '₹16,00,001 – ₹20,00,000',      rate: '20%' },
    { id: 'n6', range: '₹20,00,001 – ₹24,00,000',      rate: '25%' },
    { id: 'n7', range: 'Above ₹24,00,000',              rate: '30%' },
  ],
};

router.get('/tds-slabs', authenticateToken, requireRole('admin', 'hr', 'vp_hr'), async (_req: AuthRequest, res: Response) => {
  const rows = await db.query<{ key: string; value: string }>(
    "SELECT key, value FROM payroll_config WHERE key IN ('tds_slabs_old', 'tds_slabs_new')",
  );
  const map = Object.fromEntries(rows.map(r => [r.key, r.value]));
  res.json({
    old: map.tds_slabs_old ? JSON.parse(map.tds_slabs_old) : DEFAULT_TDS_SLABS.old,
    new: map.tds_slabs_new ? JSON.parse(map.tds_slabs_new) : DEFAULT_TDS_SLABS.new,
  });
});

router.put('/tds-slabs', authenticateToken, requireRole('admin', 'hr', 'vp_hr'), async (req: AuthRequest, res: Response) => {
  const { regime, slabs } = req.body;
  if (!['old', 'new'].includes(regime) || !Array.isArray(slabs))
    return res.status(400).json({ error: 'regime ("old"|"new") and slabs array are required' });
  const key = regime === 'old' ? 'tds_slabs_old' : 'tds_slabs_new';
  const now = new Date().toISOString();
  await db.run(
    'INSERT INTO payroll_config (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at',
    [key, JSON.stringify(slabs), now],
  );
  res.json({ ok: true });
});

// Returns all unique states from employees with their configured prof tax amounts
router.get('/prof-tax-states', authenticateToken, requireRole('admin', 'hr', 'vp_hr'), async (_req: AuthRequest, res: Response) => {
  const states = await db.query<{ state: string }>(
    "SELECT DISTINCT state FROM users WHERE state IS NOT NULL AND state != '' AND role != 'admin' ORDER BY state ASC",
  );
  const taxRows = await db.query<{ state: string; amount: number }>('SELECT state, amount FROM prof_tax_by_state');
  const taxMap = Object.fromEntries(taxRows.map(r => [r.state, r.amount]));
  res.json(states.map(s => ({ state: s.state, amount: taxMap[s.state] ?? 0 })));
});

// Upsert prof tax amount for a specific state
router.put('/prof-tax-states', authenticateToken, requireRole('admin', 'hr', 'vp_hr'), async (req: AuthRequest, res: Response) => {
  const { state, amount } = req.body;
  if (!state || amount === undefined) return res.status(400).json({ error: 'state and amount are required' });
  const now = new Date().toISOString();
  await db.run(
    'INSERT INTO prof_tax_by_state (state, amount, updated_at) VALUES (?, ?, ?) ON CONFLICT (state) DO UPDATE SET amount = excluded.amount, updated_at = excluded.updated_at',
    [state, Number(amount), now],
  );
  res.json({ ok: true });
});

async function getRunRecordsForExport(runId: string) {
  return db.query(`
    SELECT r.*, u.emp_id, u.name AS employee_name, u.state AS employee_state,
           COALESCE(sc.uan_number,  '') AS uan_number,
           COALESCE(sc.esic_number, '') AS esic_number
    FROM payroll_records r
    JOIN users u ON r.employee_id = u.id
    LEFT JOIN employee_statutory_config sc ON sc.employee_id = r.employee_id
    WHERE r.run_id = ?
    ORDER BY u.name ASC
  `, [runId]);
}

router.get('/:runId/export/ecr', authenticateToken, requireRole('admin', 'hr', 'vp_hr'), async (req: AuthRequest, res: Response) => {
  const run = await db.queryOne<any>('SELECT * FROM payroll_runs WHERE id = ?', [req.params.runId]);
  if (!run) return res.status(404).json({ error: 'Run not found' });
  const records = await getRunRecordsForExport(req.params.runId);
  const content = buildEcrText(records);
  res.setHeader('Content-Type', 'text/plain');
  res.setHeader('Content-Disposition', `attachment; filename="ECR-${run.month}-${run.year}.txt"`);
  res.send(content);
});

router.get('/:runId/export/esic', authenticateToken, requireRole('admin', 'hr', 'vp_hr'), async (req: AuthRequest, res: Response) => {
  const run = await db.queryOne<any>('SELECT * FROM payroll_runs WHERE id = ?', [req.params.runId]);
  if (!run) return res.status(404).json({ error: 'Run not found' });
  const records = await getRunRecordsForExport(req.params.runId);
  const content = buildEsiCsv(records);
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="ESI-Challan-${run.month}-${run.year}.csv"`);
  res.send(content);
});

router.get('/:runId/export/lwf', authenticateToken, requireRole('admin', 'hr', 'vp_hr'), async (req: AuthRequest, res: Response) => {
  const run = await db.queryOne<any>('SELECT * FROM payroll_runs WHERE id = ?', [req.params.runId]);
  if (!run) return res.status(404).json({ error: 'Run not found' });
  const records = await getRunRecordsForExport(req.params.runId);
  const content = buildLwfCsv(records);
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="LWF-${run.month}-${run.year}.csv"`);
  res.send(content);
});

router.get('/:runId/payslip/:employeeId', authenticateToken, requireRole('admin', 'hr', 'vp_hr'), async (req: AuthRequest, res: Response) => {
  const { runId, employeeId } = req.params;

  const [run, record, statutory, companyRows] = await Promise.all([
    db.queryOne<any>('SELECT * FROM payroll_runs WHERE id = ?', [runId]),
    db.queryOne<any>(`
      SELECT r.*, u.emp_id, u.name AS employee_name, u.designation, u.department,
             COALESCE(s.hra, 0) AS hra,
             COALESCE(s.meal_allowance, 0) AS meal_allowance,
             COALESCE(s.conveyance_allowance, 0) AS conveyance_allowance,
             COALESCE(s.special_allowance, 0) AS special_allowance,
             COALESCE(t.tax_regime, 'new') AS tax_regime
      FROM payroll_records r
      JOIN users u ON r.employee_id = u.id
      LEFT JOIN salary_master s ON s.employee_id = r.employee_id
      LEFT JOIN employee_tax_config t ON t.employee_id = r.employee_id
      WHERE r.run_id = ? AND r.employee_id = ?
    `, [runId, employeeId]),
    db.queryOne<any>('SELECT * FROM employee_statutory_config WHERE employee_id = ?', [employeeId]),
    db.query<{ key: string; value: string }>(`SELECT key, value FROM payroll_config WHERE key = ANY($1::text[])`, [['company_name','company_address','pf_registration_number','esic_registration_number','hr_email']]),
  ]);

  if (!run) return res.status(404).json({ error: 'Run not found' });
  if (!record) return res.status(404).json({ error: 'Record not found' });

  const cfg = Object.fromEntries(companyRows.map(r => [r.key, r.value]));
  const gross = record.basic_salary + record.allowances;
  const earned = gross - record.lop_deduction;
  const totalEmpDeductions = record.epf_employee + record.esic_employee + record.lwf_employee + record.prof_tax + record.tds_deduction + record.advance_deduction + (record.deductions ?? 0);
  const arrears = record.arrears ?? 0;
  const netSalary = earned + arrears - totalEmpDeductions;
  const totalEmployerCost = record.epf_employer + record.eps_employer + record.esic_employer + record.lwf_employer + record.gratuity_provision;

  const data: PayslipData = {
    companyName:             cfg.company_name             ?? '',
    companyAddress:          cfg.company_address          ?? '',
    pfRegNumber:             cfg.pf_registration_number   ?? '',
    esicRegNumber:           cfg.esic_registration_number ?? '',
    hrEmail:                 cfg.hr_email                 ?? '',
    empId:                   record.emp_id ?? String(employeeId),
    employeeName:            record.employee_name,
    designation:             record.designation ?? '',
    department:              record.department ?? '',
    uanNumber:               statutory?.uan_number ?? '',
    panNumber:               statutory?.pan_number ?? '',
    taxRegime:               record.tax_regime ?? 'new',
    month:                   run.month,
    year:                    run.year,
    workingDays:             record.working_days,
    presentDays:             record.present_days,
    leaveDays:               record.leave_days,
    absentDays:              record.absent_days,
    lopDays:                 record.lop_days,
    basicSalary:             record.basic_salary,
    hra:                     record.hra ?? 0,
    mealAllowance:           record.meal_allowance ?? 0,
    conveyanceAllowance:     record.conveyance_allowance ?? 0,
    specialAllowance:        record.special_allowance ?? 0,
    grossSalary:             gross,
    lopDeduction:            record.lop_deduction,
    earnedSalary:            earned,
    epfEmployee:             record.epf_employee,
    esicEmployee:            record.esic_employee,
    esicApplicable:          record.esic_employee > 0,
    lwfEmployee:             record.lwf_employee,
    profTax:                 record.prof_tax,
    tdsDeduction:            record.tds_deduction,
    advanceDeduction:        record.advance_deduction,
    arrears:                 arrears,
    arrearsLabel:            record.arrears_label ?? '',
    netSalary,
    epfEmployer:             record.epf_employer,
    epsEmployer:             record.eps_employer,
    esicEmployer:            record.esic_employer,
    lwfEmployer:             record.lwf_employer,
    gratuityProvision:       record.gratuity_provision,
    totalEmployerCost,
    totalCtc:                netSalary + totalEmployerCost,
  };

  streamPayslipPdf(data, res);
});

export default router;
