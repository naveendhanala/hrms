# Payroll Indian Statutory Compliance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add EPF, ESIC, LWF, Gratuity calculations to payroll; restructure the payroll table as a CTC view; add payslip PDF download and compliance exports (ECR, ESI challan, LWF statement); add a Gratuity module page; extend Configurations with LWF by state, employee statutory config, and company info.

**Architecture:** Pure calculation functions live in `backend/src/payroll/calculations.ts` and are called inside the existing `buildPayrollRecords` function in `backend/src/routes/payroll.ts`. New API routes for gratuity and statutory config are split into separate route files and mounted in `app.ts`. The frontend payroll table is extracted into `PayrollCTCTable.tsx` with grouped column headers.

**Tech Stack:** Node.js/Express/TypeScript/PostgreSQL (existing), pdfkit (new — for payslip PDF), vitest (new — for testing calculation functions), React/TypeScript (frontend).

---

## File Map

**Create:**
- `backend/src/payroll/calculations.ts` — pure statutory calc functions (EPF, ESIC, LWF, Gratuity)
- `backend/src/payroll/payslipPdf.ts` — pdfkit payslip generator
- `backend/src/payroll/exports.ts` — ECR text, ESI CSV, LWF CSV generators
- `backend/src/routes/statutoryConfig.ts` — GET/PUT statutory-config, lwf-states, company-info
- `backend/src/routes/gratuity.ts` — GET accruals, GET/POST disbursements
- `backend/vitest.config.ts` — test config
- `backend/src/payroll/calculations.test.ts` — unit tests for calc functions
- `frontend/src/api/gratuity.ts` — gratuity API client
- `frontend/src/api/statutoryConfig.ts` — statutory config + LWF API client
- `frontend/src/components/payroll/PayrollCTCTable.tsx` — CTC grouped table component
- `frontend/src/pages/GratuityPage.tsx` — Accruals / Eligibility / Disbursements tabs

**Modify:**
- `backend/src/db.ts` — add migrations for new columns + tables
- `backend/src/routes/payroll.ts` — extend buildPayrollRecords, add payslip/export endpoints
- `backend/src/app.ts` — mount statutoryConfig and gratuity routers
- `backend/package.json` — add pdfkit, vitest
- `frontend/src/api/payroll.ts` — add new types + export API functions
- `frontend/src/pages/PayrollPage.tsx` — use PayrollCTCTable, add exports dropdown + payslip download
- `frontend/src/pages/ConfigurationsPage.tsx` — add LWF by State, Employee Statutory Config, Company Info tabs
- `frontend/src/App.tsx` — add /payroll/gratuity route
- `frontend/src/components/shared/AppLayout.tsx` — add Gratuity nav item

---

## Task 1: Database Migrations

**Files:**
- Modify: `backend/src/db.ts` (inside `_runMigrations`, add to the `Promise.all` array)

- [ ] **Step 1: Add new column migrations to `_runMigrations` in `backend/src/db.ts`**

Find the closing `]);` of the `await Promise.all([...])` block (around line 149) and add these entries before the closing bracket:

```typescript
    pool.query(`ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS epf_employee       REAL NOT NULL DEFAULT 0`),
    pool.query(`ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS epf_employer       REAL NOT NULL DEFAULT 0`),
    pool.query(`ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS eps_employer       REAL NOT NULL DEFAULT 0`),
    pool.query(`ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS esic_employee      REAL NOT NULL DEFAULT 0`),
    pool.query(`ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS esic_employer      REAL NOT NULL DEFAULT 0`),
    pool.query(`ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS lwf_employee       REAL NOT NULL DEFAULT 0`),
    pool.query(`ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS lwf_employer       REAL NOT NULL DEFAULT 0`),
    pool.query(`ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS gratuity_provision REAL NOT NULL DEFAULT 0`),
    pool.query(`CREATE TABLE IF NOT EXISTS lwf_by_state (
      id              SERIAL PRIMARY KEY,
      state           TEXT UNIQUE NOT NULL,
      employee_amount REAL NOT NULL DEFAULT 0,
      employer_amount REAL NOT NULL DEFAULT 0,
      frequency       TEXT NOT NULL DEFAULT 'monthly'
    )`),
    pool.query(`CREATE TABLE IF NOT EXISTS employee_statutory_config (
      id          SERIAL PRIMARY KEY,
      employee_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      uan_number  TEXT NOT NULL DEFAULT '',
      esic_number TEXT NOT NULL DEFAULT '',
      pan_number  TEXT NOT NULL DEFAULT '',
      epf_exempt  BOOLEAN NOT NULL DEFAULT false,
      esic_exempt BOOLEAN NOT NULL DEFAULT false,
      lwf_exempt  BOOLEAN NOT NULL DEFAULT false,
      updated_at  TEXT NOT NULL DEFAULT ''
    )`),
    pool.query(`CREATE TABLE IF NOT EXISTS gratuity_accruals (
      id               SERIAL PRIMARY KEY,
      run_id           INTEGER REFERENCES payroll_runs(id) ON DELETE CASCADE,
      employee_id      INTEGER REFERENCES users(id) ON DELETE CASCADE,
      month            INTEGER NOT NULL,
      year             INTEGER NOT NULL,
      basic_salary     REAL NOT NULL DEFAULT 0,
      provision_amount REAL NOT NULL DEFAULT 0,
      cumulative_amount REAL NOT NULL DEFAULT 0,
      created_at       TEXT NOT NULL DEFAULT '',
      UNIQUE(run_id, employee_id)
    )`),
    pool.query(`CREATE TABLE IF NOT EXISTS gratuity_disbursements (
      id               SERIAL PRIMARY KEY,
      employee_id      INTEGER REFERENCES users(id) ON DELETE CASCADE,
      exit_date        TEXT NOT NULL DEFAULT '',
      years_of_service REAL NOT NULL DEFAULT 0,
      accrued_amount   REAL NOT NULL DEFAULT 0,
      paid_amount      REAL NOT NULL DEFAULT 0,
      payment_date     TEXT NOT NULL DEFAULT '',
      recorded_by      INTEGER REFERENCES users(id),
      notes            TEXT NOT NULL DEFAULT '',
      created_at       TEXT NOT NULL DEFAULT ''
    )`),
```

- [ ] **Step 2: Restart backend dev server to apply migrations**

```bash
cd backend && npm run dev
```

Check console — should say "HRMS server running" with no migration errors.

- [ ] **Step 3: Commit**

```bash
git add backend/src/db.ts
git commit -m "feat: add DB migrations for statutory compliance columns and tables"
```

---

## Task 2: Statutory Calculation Engine + Tests

**Files:**
- Create: `backend/src/payroll/calculations.ts`
- Create: `backend/src/payroll/calculations.test.ts`
- Create: `backend/vitest.config.ts`
- Modify: `backend/package.json`

- [ ] **Step 1: Install vitest**

```bash
cd backend && npm install --save-dev vitest
```

- [ ] **Step 2: Add test script to `backend/package.json`**

Add to the `"scripts"` section:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 3: Create `backend/vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: { globals: true },
});
```

- [ ] **Step 4: Write failing tests in `backend/src/payroll/calculations.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { calcEpf, calcEsic, calcLwf, isLwfApplicableMonth, calcGratuityProvision } from './calculations';

describe('calcEpf', () => {
  it('returns zeros when exempt', () => {
    expect(calcEpf(30000, true)).toEqual({ employee: 0, epfEmployer: 0, epsEmployer: 0 });
  });
  it('caps at basic salary of 15000', () => {
    const r = calcEpf(30000, false);
    expect(r.employee).toBe(1800);       // 12% of 15000
    expect(r.epfEmployer).toBe(550.5);   // 3.67% of 15000
    expect(r.epsEmployer).toBe(1249.5);  // 8.33% of 15000
  });
  it('uses actual basic when below ceiling', () => {
    const r = calcEpf(10000, false);
    expect(r.employee).toBe(1200);       // 12% of 10000
    expect(r.epfEmployer).toBe(367);     // 3.67% of 10000
    expect(r.epsEmployer).toBe(833);     // 8.33% of 10000
  });
});

describe('calcEsic', () => {
  it('returns zeros and not applicable when gross > 21000', () => {
    const r = calcEsic(25000, false);
    expect(r.employee).toBe(0);
    expect(r.applicable).toBe(false);
  });
  it('calculates correctly when gross <= 21000', () => {
    const r = calcEsic(18000, false);
    expect(r.employee).toBe(135);    // 0.75% of 18000
    expect(r.employer).toBe(585);    // 3.25% of 18000
    expect(r.applicable).toBe(true);
  });
  it('returns zeros when exempt regardless of salary', () => {
    const r = calcEsic(10000, true);
    expect(r.employee).toBe(0);
    expect(r.applicable).toBe(false);
  });
});

describe('isLwfApplicableMonth', () => {
  it('monthly is always applicable', () => {
    expect(isLwfApplicableMonth('monthly', 3)).toBe(true);
  });
  it('half_yearly applies only in June and December', () => {
    expect(isLwfApplicableMonth('half_yearly', 6)).toBe(true);
    expect(isLwfApplicableMonth('half_yearly', 12)).toBe(true);
    expect(isLwfApplicableMonth('half_yearly', 5)).toBe(false);
  });
  it('annually applies only in December', () => {
    expect(isLwfApplicableMonth('annually', 12)).toBe(true);
    expect(isLwfApplicableMonth('annually', 6)).toBe(false);
  });
});

describe('calcLwf', () => {
  it('returns zeros when exempt', () => {
    expect(calcLwf(25, 50, 'monthly', 3, true)).toEqual({ employee: 0, employer: 0 });
  });
  it('returns zeros when not an applicable month', () => {
    expect(calcLwf(25, 50, 'half_yearly', 3, false)).toEqual({ employee: 0, employer: 0 });
  });
  it('returns configured amounts in applicable month', () => {
    expect(calcLwf(25, 50, 'monthly', 3, false)).toEqual({ employee: 25, employer: 50 });
  });
});

describe('calcGratuityProvision', () => {
  it('calculates monthly provision correctly', () => {
    // (30000 * 15) / 26 / 12 = 1442.31
    expect(calcGratuityProvision(30000)).toBeCloseTo(1442.31, 1);
  });
});
```

- [ ] **Step 5: Run tests — expect all to fail**

```bash
cd backend && npm test
```

Expected: FAIL — `Cannot find module './calculations'`

- [ ] **Step 6: Create `backend/src/payroll/calculations.ts`**

```typescript
export function calcEpf(
  basicSalary: number,
  exempt: boolean,
): { employee: number; epfEmployer: number; epsEmployer: number } {
  if (exempt) return { employee: 0, epfEmployer: 0, epsEmployer: 0 };
  const capped = Math.min(basicSalary, 15000);
  return {
    employee:    Math.round(capped * 0.12   * 100) / 100,
    epfEmployer: Math.round(capped * 0.0367 * 100) / 100,
    epsEmployer: Math.round(capped * 0.0833 * 100) / 100,
  };
}

export function calcEsic(
  grossSalary: number,
  exempt: boolean,
): { employee: number; employer: number; applicable: boolean } {
  if (exempt || grossSalary > 21000) return { employee: 0, employer: 0, applicable: false };
  return {
    employee:   Math.round(grossSalary * 0.0075 * 100) / 100,
    employer:   Math.round(grossSalary * 0.0325 * 100) / 100,
    applicable: true,
  };
}

export function isLwfApplicableMonth(frequency: string, month: number): boolean {
  if (frequency === 'monthly')    return true;
  if (frequency === 'half_yearly') return month === 6 || month === 12;
  if (frequency === 'annually')   return month === 12;
  return false;
}

export function calcLwf(
  employeeAmount: number,
  employerAmount: number,
  frequency: string,
  month: number,
  exempt: boolean,
): { employee: number; employer: number } {
  if (exempt || !isLwfApplicableMonth(frequency, month)) return { employee: 0, employer: 0 };
  return { employee: employeeAmount, employer: employerAmount };
}

export function calcGratuityProvision(basicSalary: number): number {
  return Math.round((basicSalary * 15) / 26 / 12 * 100) / 100;
}
```

- [ ] **Step 7: Run tests — expect all to pass**

```bash
cd backend && npm test
```

Expected: All tests PASS.

- [ ] **Step 8: Commit**

```bash
git add backend/src/payroll/calculations.ts backend/src/payroll/calculations.test.ts backend/vitest.config.ts backend/package.json
git commit -m "feat: add statutory calculation engine with vitest tests"
```

---

## Task 3: Extend Payroll Generation with Statutory Calculations

**Files:**
- Modify: `backend/src/routes/payroll.ts`

- [ ] **Step 1: Add import at top of `backend/src/routes/payroll.ts`**

After the existing imports, add:
```typescript
import { calcEpf, calcEsic, calcLwf, calcGratuityProvision } from '../payroll/calculations';
```

- [ ] **Step 2: Replace `buildPayrollRecords` function**

Replace the entire `buildPayrollRecords` function (lines 104–218) with:

```typescript
async function buildPayrollRecords(runId: number, month: number, year: number, now: string) {
  const totalDays   = getDaysInMonth(month, year);
  const monthPrefix = `${year}-${String(month).padStart(2, '0')}`;
  const { fyStartYear, fyEndYear } = getFY(month, year);

  const [employees, stateTaxRows, lwfRows, statutoryRows, allAtt, allAdv, allTds, historicalGratuity] = await Promise.all([
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
  ]);

  const stateTaxMap  = new Map(stateTaxRows.map(r => [r.state.trim().toLowerCase(), r.amount]));
  const lwfMap       = new Map(lwfRows.map((r: any) => [r.state.trim().toLowerCase(), r]));
  const statutoryMap = new Map(statutoryRows.map((r: any) => [r.employee_id, r]));
  const attMap       = new Map(allAtt.map((r: any) => [r.user_id, r]));
  const advMap       = new Map(allAdv.map((r: any) => [r.employee_id, Number(r.total)]));
  const tdsMap       = new Map(allTds.map((r: any) => [r.employee_id, r]));
  const gratMap      = new Map(historicalGratuity.map((r: any) => [r.employee_id, Number(r.historical_total)]));

  const rowValues: unknown[] = [];
  const gratValues: unknown[] = [];

  for (const emp of employees) {
    const att         = attMap.get(emp.id);
    const presentDays = Number(att?.present_days ?? 0);
    const leaveDays   = Number(att?.leave_days   ?? 0);
    const absentDays  = Number(att?.absent_days  ?? 0);
    const lopDays     = Number(att?.lop_days     ?? 0);

    const totalAllowances = emp.hra + emp.meal_allowance + emp.conveyance_allowance + emp.special_allowance;
    const grossSalary     = emp.basic_salary + totalAllowances;
    const lopDeduction    = totalDays > 0 ? Math.round((lopDays * grossSalary) / totalDays * 100) / 100 : 0;

    const empState = (emp.state || '').trim().toLowerCase();
    const profTax  = empState && stateTaxMap.has(empState) ? stateTaxMap.get(empState)! : 0;

    const advanceDeduction = advMap.get(emp.id) ?? 0;

    const tdsRow              = tdsMap.get(emp.id);
    const processedMonthsInFY = Number(tdsRow?.processed_count ?? 0);
    const tdsAlreadyDeducted  = Number(tdsRow?.tds_total       ?? 0);
    const regime              = (emp.tax_regime || 'new') as 'old' | 'new';
    const { monthlyTds }      = computeAnnualTax(grossSalary, regime, month, year, emp.date_of_joining, tdsAlreadyDeducted, processedMonthsInFY);

    const statutory   = statutoryMap.get(emp.id) ?? { epf_exempt: false, esic_exempt: false, lwf_exempt: false };
    const epf         = calcEpf(emp.basic_salary, !!statutory.epf_exempt);
    const esic        = calcEsic(grossSalary, !!statutory.esic_exempt);
    const lwfConfig   = lwfMap.get(empState);
    const lwf         = lwfConfig
      ? calcLwf(lwfConfig.employee_amount, lwfConfig.employer_amount, lwfConfig.frequency, month, !!statutory.lwf_exempt)
      : { employee: 0, employer: 0 };
    const gratProvision = calcGratuityProvision(emp.basic_salary);
    const historicalGrat = gratMap.get(emp.id) ?? 0;
    const cumulativeGrat = Math.round((historicalGrat + gratProvision) * 100) / 100;

    rowValues.push(
      runId, emp.id, emp.basic_salary, totalAllowances,
      emp.meal_allowance, emp.conveyance_allowance, emp.deductions,
      totalDays, presentDays, leaveDays, absentDays, lopDays, lopDeduction, profTax, advanceDeduction, monthlyTds,
      epf.employee, epf.epfEmployer, epf.epsEmployer,
      esic.employee, esic.employer,
      lwf.employee, lwf.employer,
      gratProvision,
      now, now,
    );

    gratValues.push(runId, emp.id, month, year, emp.basic_salary, gratProvision, cumulativeGrat, now);
  }

  if (employees.length > 0) {
    const cols = 26;
    const placeholders = employees.map(() => `(${Array.from({ length: cols }, () => '?').join(', ')})`).join(', ');
    await db.run(
      `INSERT INTO payroll_records
        (run_id, employee_id, basic_salary, allowances, meal_allowance, conveyance_allowance, deductions,
         working_days, present_days, leave_days, absent_days, lop_days, lop_deduction, prof_tax, advance_deduction, tds_deduction,
         epf_employee, epf_employer, eps_employer,
         esic_employee, esic_employer,
         lwf_employee, lwf_employer,
         gratuity_provision,
         created_at, updated_at)
       VALUES ${placeholders}`,
      rowValues,
    );

    const gCols = 8;
    const gPlaceholders = employees.map(() => `(${Array.from({ length: gCols }, () => '?').join(', ')})`).join(', ');
    await db.run(
      `INSERT INTO gratuity_accruals (run_id, employee_id, month, year, basic_salary, provision_amount, cumulative_amount, created_at)
       VALUES ${gPlaceholders}
       ON CONFLICT (run_id, employee_id) DO UPDATE SET
         provision_amount  = excluded.provision_amount,
         cumulative_amount = excluded.cumulative_amount`,
      gratValues,
    );
  }
}
```

- [ ] **Step 3: Also delete gratuity_accruals in the regenerate endpoint**

In the `router.post('/:runId/regenerate', ...)` handler, find the `db.run('DELETE FROM payroll_records WHERE run_id = ?', ...)` line and add directly after it:

```typescript
await db.run('DELETE FROM gratuity_accruals WHERE run_id = ?', [run.id]);
```

- [ ] **Step 4: Update the GET `/` records query to include new columns**

In `router.get('/', ...)`, the `records` query SELECT currently ends with `COALESCE(r.tds_deduction, 0) as tds_deduction`. Extend it to:

```typescript
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
           sc.epf_exempt, sc.esic_exempt
    FROM payroll_records r
    JOIN users u ON r.employee_id = u.id
    LEFT JOIN users m ON u.reporting_manager_id = m.id
    LEFT JOIN employee_statutory_config sc ON sc.employee_id = r.employee_id
    WHERE r.run_id = ?
    ORDER BY u.name ASC
  `, [run.id]);
```

- [ ] **Step 5: Test — generate a payroll run via API**

```bash
curl -X POST http://localhost:4000/api/payroll \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"month":5,"year":2026}'
```

Expected: `{"id":...,"month":5,"year":2026,"status":"draft"}`

Then fetch it:
```bash
curl http://localhost:4000/api/payroll?month=5&year=2026 \
  -H "Authorization: Bearer <token>"
```

Expected: Records contain `epf_employee`, `epf_employer`, `eps_employer`, `esic_employee`, `esic_employer`, `lwf_employee`, `lwf_employer`, `gratuity_provision` fields.

- [ ] **Step 6: Commit**

```bash
git add backend/src/routes/payroll.ts
git commit -m "feat: extend payroll generation with EPF, ESIC, LWF, and gratuity calculations"
```

---

## Task 4: Statutory Config + LWF + Company Info API

**Files:**
- Create: `backend/src/routes/statutoryConfig.ts`
- Modify: `backend/src/app.ts`

- [ ] **Step 1: Create `backend/src/routes/statutoryConfig.ts`**

```typescript
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
```

- [ ] **Step 2: Mount the router in `backend/src/app.ts`**

Add the import after the existing payroll import:
```typescript
import statutoryConfigRoutes from './routes/statutoryConfig';
```

Add the mount after `app.use('/api/payroll', payrollRoutes);`:
```typescript
app.use('/api/payroll', statutoryConfigRoutes);
```

- [ ] **Step 3: Test endpoints**

```bash
# Get LWF states
curl http://localhost:4000/api/payroll/lwf-states -H "Authorization: Bearer <token>"
# Expected: array of states with employee_amount, employer_amount, frequency

# Get company info
curl http://localhost:4000/api/payroll/company-info -H "Authorization: Bearer <token>"
# Expected: { company_name: '', company_address: '', ... }

# Update company info
curl -X PUT http://localhost:4000/api/payroll/company-info \
  -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
  -d '{"company_name":"ACME Pvt Ltd","hr_email":"hr@acme.com"}'
# Expected: { ok: true }
```

- [ ] **Step 4: Commit**

```bash
git add backend/src/routes/statutoryConfig.ts backend/src/app.ts
git commit -m "feat: add statutory config, LWF by state, and company info API endpoints"
```

---

## Task 5: Gratuity API

**Files:**
- Create: `backend/src/routes/gratuity.ts`
- Modify: `backend/src/app.ts`

- [ ] **Step 1: Create `backend/src/routes/gratuity.ts`**

```typescript
import { Router, Response } from 'express';
import db from '../db';
import { authenticateToken, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();

router.get('/accruals', authenticateToken, requireRole('admin', 'hr', 'vp_hr'), async (_req: AuthRequest, res: Response) => {
  const rows = await db.query(`
    SELECT u.id AS employee_id, u.emp_id, u.name AS employee_name,
           u.date_of_joining,
           COALESCE(SUM(ga.provision_amount), 0) AS total_accrued,
           MAX(ga.cumulative_amount) AS cumulative_amount,
           MAX(ga.provision_amount)  AS last_monthly_provision
    FROM users u
    LEFT JOIN gratuity_accruals ga ON ga.employee_id = u.id
    WHERE u.role != 'admin' AND u.status = 'active'
    GROUP BY u.id, u.emp_id, u.name, u.date_of_joining
    ORDER BY u.name ASC
  `);
  res.json(rows);
});

router.get('/disbursements', authenticateToken, requireRole('admin', 'hr', 'vp_hr'), async (_req: AuthRequest, res: Response) => {
  const rows = await db.query(`
    SELECT gd.*, u.name AS employee_name, u.emp_id, r.name AS recorded_by_name
    FROM gratuity_disbursements gd
    JOIN users u ON gd.employee_id = u.id
    LEFT JOIN users r ON gd.recorded_by = r.id
    ORDER BY gd.created_at DESC
  `);
  res.json(rows);
});

router.post('/disbursements', authenticateToken, requireRole('admin', 'hr', 'vp_hr'), async (req: AuthRequest, res: Response) => {
  const { employee_id, exit_date, years_of_service, accrued_amount, paid_amount, payment_date, notes } = req.body;
  if (!employee_id || !exit_date || !payment_date)
    return res.status(400).json({ error: 'employee_id, exit_date, and payment_date are required' });

  const now = new Date().toISOString();
  const result = await db.run(`
    INSERT INTO gratuity_disbursements
      (employee_id, exit_date, years_of_service, accrued_amount, paid_amount, payment_date, recorded_by, notes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    RETURNING id
  `, [employee_id, exit_date, years_of_service ?? 0, accrued_amount ?? 0, paid_amount ?? 0, payment_date, req.user!.id, notes ?? '', now]);

  res.status(201).json({ id: result.lastInsertRowid });
});

export default router;
```

- [ ] **Step 2: Mount in `backend/src/app.ts`**

Add import:
```typescript
import gratuityRoutes from './routes/gratuity';
```

Add mount after the statutoryConfig line:
```typescript
app.use('/api/gratuity', gratuityRoutes);
```

- [ ] **Step 3: Test**

```bash
curl http://localhost:4000/api/gratuity/accruals -H "Authorization: Bearer <token>"
# Expected: array of employees with total_accrued and cumulative_amount fields
```

- [ ] **Step 4: Commit**

```bash
git add backend/src/routes/gratuity.ts backend/src/app.ts
git commit -m "feat: add gratuity accruals and disbursements API"
```

---

## Task 6: Payslip PDF Endpoint

**Files:**
- Create: `backend/src/payroll/payslipPdf.ts`
- Modify: `backend/src/routes/payroll.ts`
- Modify: `backend/package.json`

- [ ] **Step 1: Install pdfkit**

```bash
cd backend && npm install pdfkit && npm install --save-dev @types/pdfkit
```

- [ ] **Step 2: Create `backend/src/payroll/payslipPdf.ts`**

```typescript
import PDFDocument from 'pdfkit';
import { Response } from 'express';

export interface PayslipData {
  companyName: string;
  companyAddress: string;
  pfRegNumber: string;
  esicRegNumber: string;
  hrEmail: string;
  empId: string;
  employeeName: string;
  designation: string;
  department: string;
  uanNumber: string;
  panNumber: string;
  taxRegime: string;
  month: number;
  year: number;
  workingDays: number;
  presentDays: number;
  leaveDays: number;
  absentDays: number;
  lopDays: number;
  basicSalary: number;
  hra: number;
  mealAllowance: number;
  conveyanceAllowance: number;
  specialAllowance: number;
  grossSalary: number;
  lopDeduction: number;
  earnedSalary: number;
  epfEmployee: number;
  esicEmployee: number;
  esicApplicable: boolean;
  lwfEmployee: number;
  profTax: number;
  tdsDeduction: number;
  advanceDeduction: number;
  netSalary: number;
  epfEmployer: number;
  epsEmployer: number;
  esicEmployer: number;
  lwfEmployer: number;
  gratuityProvision: number;
  totalEmployerCost: number;
  totalCtc: number;
}

const MONTH_NAMES = ['', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

function fmt(n: number) {
  return '₹' + Math.round(n).toLocaleString('en-IN');
}

export function streamPayslipPdf(data: PayslipData, res: Response): void {
  const doc = new PDFDocument({ margin: 40, size: 'A4' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="payslip-${data.empId}-${data.month}-${data.year}.pdf"`);
  doc.pipe(res);

  const period = `${MONTH_NAMES[data.month]} ${data.year}`;
  const W = 515;

  // Company header
  doc.fontSize(16).font('Helvetica-Bold').fillColor('#1a3a6b').text(data.companyName, 40, 40, { align: 'center', width: W });
  doc.fontSize(9).font('Helvetica').fillColor('#555').text(data.companyAddress, 40, 62, { align: 'center', width: W });
  if (data.pfRegNumber || data.esicRegNumber) {
    doc.fontSize(8).text(`PF Reg: ${data.pfRegNumber || 'N/A'}   |   ESIC Reg: ${data.esicRegNumber || 'N/A'}`, 40, 74, { align: 'center', width: W });
  }

  // Title bar
  doc.rect(40, 88, W, 22).fill('#1a3a6b');
  doc.fontSize(11).font('Helvetica-Bold').fillColor('#fff').text(`PAYSLIP — ${period}`, 40, 93, { align: 'center', width: W });

  // Employee info grid
  let y = 120;
  doc.rect(40, y, W, 14).fill('#f5f7fc');
  doc.fontSize(8).font('Helvetica-Bold').fillColor('#555').text('EMPLOYEE DETAILS', 44, y + 3);
  y += 14;

  const infoItems = [
    ['Employee Name', data.employeeName],   ['Employee ID', data.empId],
    ['Designation',   data.designation],     ['UAN Number',  data.uanNumber || 'N/A'],
    ['PAN Number',    data.panNumber || 'N/A'], ['Tax Regime', data.taxRegime === 'new' ? 'New Regime' : 'Old Regime'],
  ];
  doc.font('Helvetica').fillColor('#111');
  for (let i = 0; i < infoItems.length; i += 2) {
    const row = Math.floor(i / 2);
    const rowY = y + row * 18;
    doc.fontSize(8).fillColor('#888').text(infoItems[i][0], 44, rowY + 2);
    doc.fontSize(9).fillColor('#111').text(infoItems[i][1], 44, rowY + 10);
    if (infoItems[i + 1]) {
      doc.fontSize(8).fillColor('#888').text(infoItems[i + 1][0], 44 + W / 2, rowY + 2);
      doc.fontSize(9).fillColor('#111').text(infoItems[i + 1][1], 44 + W / 2, rowY + 10);
    }
  }
  y += 54;

  // Attendance strip
  doc.rect(40, y, W, 14).fill('#f5f7fc');
  doc.fontSize(8).font('Helvetica-Bold').fillColor('#555').text('ATTENDANCE', 44, y + 3);
  y += 14;
  const attCols = ['Working Days', 'Present', 'Leave', 'Absent', 'LOP Days'];
  const attVals = [data.workingDays, data.presentDays, data.leaveDays, data.absentDays, data.lopDays];
  const colW    = W / 5;
  attCols.forEach((label, i) => {
    doc.fontSize(7).font('Helvetica').fillColor('#888').text(label, 40 + i * colW, y + 2, { width: colW, align: 'center' });
    doc.fontSize(14).font('Helvetica-Bold').fillColor('#111').text(String(attVals[i]), 40 + i * colW, y + 10, { width: colW, align: 'center' });
  });
  y += 30;

  // Earnings & Deductions side by side
  const halfW = W / 2 - 5;

  // Earnings header
  doc.rect(40, y, halfW, 14).fill('#1a3a6b');
  doc.fontSize(8).font('Helvetica-Bold').fillColor('#fff').text('EARNINGS', 44, y + 3);
  doc.rect(40 + halfW + 10, y, halfW, 14).fill('#7f1d1d');
  doc.fontSize(8).font('Helvetica-Bold').fillColor('#fff').text('EMPLOYEE DEDUCTIONS', 44 + halfW + 10, y + 3);
  y += 14;

  const earningsRows = [
    ['Basic Salary',         data.basicSalary],
    ['HRA',                  data.hra],
    ['Conveyance Allowance', data.conveyanceAllowance],
    ['Meal Allowance',       data.mealAllowance],
    ['Special Allowance',    data.specialAllowance],
    ['Gross Earnings',       data.grossSalary],
    ['LOP Deduction',        -data.lopDeduction],
    ['Earned Salary',        data.earnedSalary],
  ];
  const deductRows = [
    ['EPF (12% of Basic)',   data.epfEmployee],
    ['ESIC (0.75%)',         data.esicApplicable ? data.esicEmployee : null],
    ['Labour Welfare Fund',  data.lwfEmployee],
    ['Professional Tax',     data.profTax],
    ['TDS (Income Tax)',     data.tdsDeduction],
    ['Advance Recovery',     data.advanceDeduction],
    ['Total Deductions',     data.epfEmployee + (data.esicApplicable ? data.esicEmployee : 0) + data.lwfEmployee + data.profTax + data.tdsDeduction + data.advanceDeduction],
  ];

  doc.font('Helvetica').fontSize(8).fillColor('#111');
  const rowH = 14;
  const maxRows = Math.max(earningsRows.length, deductRows.length);
  for (let i = 0; i < maxRows; i++) {
    const rowY = y + i * rowH;
    if (i % 2 === 0) {
      doc.rect(40, rowY, halfW, rowH).fill('#f9fafb');
      doc.rect(40 + halfW + 10, rowY, halfW, rowH).fill('#f9fafb');
    }
    if (earningsRows[i]) {
      const [label, val] = earningsRows[i];
      const isSpecial = label === 'Gross Earnings' || label === 'Earned Salary';
      doc.font(isSpecial ? 'Helvetica-Bold' : 'Helvetica').fillColor('#111').text(String(label), 44, rowY + 3);
      const valStr = (val as number) < 0 ? `- ${fmt(Math.abs(val as number))}` : fmt(val as number);
      doc.fillColor((val as number) < 0 ? '#dc2626' : '#111').text(valStr, 40, rowY + 3, { width: halfW, align: 'right' });
    }
    if (deductRows[i]) {
      const [label, val] = deductRows[i];
      const isNull = val === null;
      const isTotal = label === 'Total Deductions';
      doc.font(isTotal ? 'Helvetica-Bold' : 'Helvetica').fillColor(isNull ? '#9ca3af' : '#111')
        .text(String(label), 44 + halfW + 10, rowY + 3);
      doc.fillColor(isNull ? '#9ca3af' : '#dc2626')
        .text(isNull ? 'N/A' : fmt(val as number), 40 + halfW + 10, rowY + 3, { width: halfW, align: 'right' });
    }
  }
  y += maxRows * rowH + 6;

  // Net pay bar
  doc.rect(40, y, W, 24).fill('#1a3a6b');
  doc.fontSize(11).font('Helvetica-Bold').fillColor('#fff').text('NET TAKE-HOME SALARY', 44, y + 6);
  doc.fontSize(13).text(fmt(data.netSalary), 40, y + 6, { width: W - 4, align: 'right' });
  y += 30;

  // Employer contributions
  doc.rect(40, y, W, 14).fill('#78350f');
  doc.fontSize(8).font('Helvetica-Bold').fillColor('#fff').text('EMPLOYER CONTRIBUTIONS (CTC COMPONENTS)', 44, y + 3);
  y += 14;
  const empRows = [
    ['EPF Employer (3.67%)',    data.epfEmployer],
    ['EPS Employer (8.33%)',    data.epsEmployer],
    ['ESIC Employer (3.25%)',   data.esicApplicable ? data.esicEmployer : null],
    ['Labour Welfare Fund',     data.lwfEmployer],
    ['Gratuity Provision',      data.gratuityProvision],
    ['Total Employer Cost',     data.totalEmployerCost],
  ];
  doc.font('Helvetica').fontSize(8);
  empRows.forEach((row, i) => {
    const rowY = y + i * rowH;
    if (i % 2 === 0) doc.rect(40, rowY, W, rowH).fill('#fdf6ee');
    const [label, val] = row;
    const isNull  = val === null;
    const isTotal = label === 'Total Employer Cost';
    doc.font(isTotal ? 'Helvetica-Bold' : 'Helvetica').fillColor(isNull ? '#9ca3af' : '#111').text(String(label), 44, rowY + 3);
    doc.fillColor(isNull ? '#9ca3af' : '#92400e')
      .text(isNull ? 'N/A' : fmt(val as number), 40, rowY + 3, { width: W, align: 'right' });
  });
  y += empRows.length * rowH + 6;

  // CTC summary
  const cardW = W / 3 - 4;
  const cards = [
    { label: 'NET SALARY',    value: fmt(data.netSalary),         fill: '#f0fdf4', border: '#86efac', textColor: '#15803d' },
    { label: 'EMPLOYER COST', value: fmt(data.totalEmployerCost), fill: '#fff7ed', border: '#fed7aa', textColor: '#c2410c' },
    { label: 'TOTAL CTC',     value: fmt(data.totalCtc),          fill: '#eef2ff', border: '#a5b4fc', textColor: '#3730a3' },
  ];
  cards.forEach((card, i) => {
    const cx = 40 + i * (cardW + 6);
    doc.rect(cx, y, cardW, 36).fill(card.fill).stroke(card.border);
    doc.fontSize(7).font('Helvetica-Bold').fillColor(card.textColor).text(card.label, cx, y + 5, { width: cardW, align: 'center' });
    doc.fontSize(13).text(card.value, cx, y + 15, { width: cardW, align: 'center' });
  });
  y += 42;

  // Footer
  doc.moveTo(40, y).lineTo(40 + W, y).stroke('#e5e7eb');
  doc.fontSize(7).font('Helvetica').fillColor('#9ca3af')
    .text(`Computer-generated payslip. No signature required.  |  Queries: ${data.hrEmail}`, 40, y + 4, { align: 'center', width: W });

  doc.end();
}
```

- [ ] **Step 3: Add payslip endpoint to `backend/src/routes/payroll.ts`**

Add this import at the top:
```typescript
import { streamPayslipPdf, type PayslipData } from '../payroll/payslipPdf';
```

Add this endpoint before `export default router;`:

```typescript
router.get('/:runId/payslip/:employeeId', authenticateToken, requireRole('admin', 'hr', 'vp_hr'), async (req: AuthRequest, res: Response) => {
  const { runId, employeeId } = req.params;

  const [run, record, emp, statutory, companyRows] = await Promise.all([
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
    db.queryOne<any>('SELECT * FROM users WHERE id = ?', [employeeId]),
    db.queryOne<any>('SELECT * FROM employee_statutory_config WHERE employee_id = ?', [employeeId]),
    db.query<{ key: string; value: string }>(`SELECT key, value FROM payroll_config WHERE key = ANY($1::text[])`, [['company_name','company_address','pf_registration_number','esic_registration_number','hr_email']]),
  ]);

  if (!run) return res.status(404).json({ error: 'Run not found' });
  if (!record) return res.status(404).json({ error: 'Record not found' });

  const cfg = Object.fromEntries(companyRows.map(r => [r.key, r.value]));
  const gross = record.basic_salary + record.allowances;
  const earned = gross - record.lop_deduction;
  const totalEmpDeductions = record.epf_employee + record.esic_employee + record.lwf_employee + record.prof_tax + record.tds_deduction + record.advance_deduction;
  const netSalary = earned - totalEmpDeductions;
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
    department:              emp?.department ?? '',
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
    esicApplicable:          gross <= 21000 && !statutory?.esic_exempt,
    lwfEmployee:             record.lwf_employee,
    profTax:                 record.prof_tax,
    tdsDeduction:            record.tds_deduction,
    advanceDeduction:        record.advance_deduction,
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
```

- [ ] **Step 4: Test**

```bash
curl "http://localhost:4000/api/payroll/1/payslip/2" \
  -H "Authorization: Bearer <token>" \
  --output payslip-test.pdf
```

Open `payslip-test.pdf` — should render a complete payslip PDF.

- [ ] **Step 5: Commit**

```bash
git add backend/src/payroll/payslipPdf.ts backend/src/routes/payroll.ts backend/package.json backend/package-lock.json
git commit -m "feat: add payslip PDF generation endpoint using pdfkit"
```

---

## Task 7: Compliance Exports (ECR, ESI, LWF)

**Files:**
- Create: `backend/src/payroll/exports.ts`
- Modify: `backend/src/routes/payroll.ts`

- [ ] **Step 1: Create `backend/src/payroll/exports.ts`**

```typescript
export function buildEcrText(records: any[]): string {
  const header = '#~#UAN~#~#MemberName~#~#GrossWages~#~#EPFWages~#~#EPSWages~#~#EDLIWages~#~#EPFContrib~#~#EPSContrib~#~#EPFEmployer~#~#NCPDays~#~#RefundOfAdvances';
  const lines = records.map(r => {
    const capped   = Math.min(Number(r.basic_salary), 15000);
    const epfWages = capped;
    return [
      r.uan_number || '',
      r.employee_name,
      Math.round(r.basic_salary + r.allowances),
      Math.round(epfWages),
      Math.round(epfWages),
      Math.round(epfWages),
      Math.round(r.epf_employee),
      Math.round(r.eps_employer),
      Math.round(r.epf_employer),
      r.lop_days || 0,
      0,
    ].join('~#~');
  });
  return [header, ...lines].join('\n');
}

export function buildEsiCsv(records: any[]): string {
  const header = 'ESIC Number,Employee Name,Gross Wages,Employee Contribution,Employer Contribution,Total';
  const lines  = records
    .filter(r => r.esic_employee > 0 || r.esic_employer > 0)
    .map(r => [
      r.esic_number || '',
      `"${r.employee_name}"`,
      Math.round(r.basic_salary + r.allowances),
      r.esic_employee.toFixed(2),
      r.esic_employer.toFixed(2),
      (r.esic_employee + r.esic_employer).toFixed(2),
    ].join(','));
  return [header, ...lines].join('\n');
}

export function buildLwfCsv(records: any[]): string {
  const header = 'Employee ID,Employee Name,State,Employee LWF,Employer LWF,Total';
  const lines  = records
    .filter(r => r.lwf_employee > 0 || r.lwf_employer > 0)
    .map(r => [
      r.emp_id || r.employee_id,
      `"${r.employee_name}"`,
      r.employee_state || '',
      r.lwf_employee.toFixed(2),
      r.lwf_employer.toFixed(2),
      (r.lwf_employee + r.lwf_employer).toFixed(2),
    ].join(','));
  return [header, ...lines].join('\n');
}
```

- [ ] **Step 2: Add export endpoints to `backend/src/routes/payroll.ts`**

Add import at top:
```typescript
import { buildEcrText, buildEsiCsv, buildLwfCsv } from '../payroll/exports';
```

Add before `export default router;`:

```typescript
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
```

- [ ] **Step 3: Test**

```bash
curl "http://localhost:4000/api/payroll/1/export/ecr" \
  -H "Authorization: Bearer <token>" --output ecr.txt
cat ecr.txt  # Should show tab-delimited ECR lines
```

- [ ] **Step 4: Commit**

```bash
git add backend/src/payroll/exports.ts backend/src/routes/payroll.ts
git commit -m "feat: add ECR, ESI challan, and LWF compliance export endpoints"
```

---

## Task 8: Frontend API Layer

**Files:**
- Modify: `frontend/src/api/payroll.ts`
- Create: `frontend/src/api/gratuity.ts`
- Create: `frontend/src/api/statutoryConfig.ts`

- [ ] **Step 1: Add new types and functions to `frontend/src/api/payroll.ts`**

Add to the `PayrollRecord` interface (after `tds_deduction: number;`):
```typescript
  epf_employee: number;
  epf_employer: number;
  eps_employer: number;
  esic_employee: number;
  esic_employer: number;
  lwf_employee: number;
  lwf_employer: number;
  gratuity_provision: number;
  epf_exempt: boolean | null;
  esic_exempt: boolean | null;
```

Add at the end of the file:
```typescript
export interface CompanyInfo {
  company_name: string;
  company_address: string;
  pf_registration_number: string;
  esic_registration_number: string;
  hr_email: string;
}

export const getCompanyInfo = () =>
  apiFetch<CompanyInfo>(`${BASE}/company-info`);

export const updateCompanyInfo = (data: Partial<CompanyInfo>) =>
  apiFetch<{ ok: boolean }>(`${BASE}/company-info`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });

export const downloadPayslip = (runId: number, employeeId: number): void => {
  const token = localStorage.getItem('hrms_token');
  const url = `${BASE}/${runId}/payslip/${employeeId}`;
  const a = document.createElement('a');
  a.href = url;
  a.setAttribute('download', '');
  // Attach token via query param since we can't set headers on anchor download
  fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    .then(r => r.blob())
    .then(blob => {
      const blobUrl = URL.createObjectURL(blob);
      a.href = blobUrl;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    });
};

export const downloadExport = (runId: number, type: 'ecr' | 'esic' | 'lwf'): void => {
  const token = localStorage.getItem('hrms_token');
  const url = `${BASE}/${runId}/export/${type}`;
  fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    .then(r => r.blob())
    .then(blob => {
      const ext  = type === 'ecr' ? 'txt' : 'csv';
      const name = `${type.toUpperCase()}-export.${ext}`;
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl; a.download = name;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    });
};
```

- [ ] **Step 2: Create `frontend/src/api/gratuity.ts`**

```typescript
import { apiFetch } from './client';

export interface GratuityAccrual {
  employee_id: number;
  emp_id: string | null;
  employee_name: string;
  date_of_joining: string | null;
  total_accrued: number;
  cumulative_amount: number;
  last_monthly_provision: number;
}

export interface GratuityDisbursement {
  id: number;
  employee_id: number;
  employee_name: string;
  emp_id: string | null;
  exit_date: string;
  years_of_service: number;
  accrued_amount: number;
  paid_amount: number;
  payment_date: string;
  recorded_by_name: string | null;
  notes: string;
  created_at: string;
}

const BASE = '/api/gratuity';

export const getGratuityAccruals = () =>
  apiFetch<GratuityAccrual[]>(`${BASE}/accruals`);

export const getGratuityDisbursements = () =>
  apiFetch<GratuityDisbursement[]>(`${BASE}/disbursements`);

export const recordGratuityDisbursement = (data: {
  employee_id: number;
  exit_date: string;
  years_of_service: number;
  accrued_amount: number;
  paid_amount: number;
  payment_date: string;
  notes?: string;
}) =>
  apiFetch<{ id: number }>(`${BASE}/disbursements`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
```

- [ ] **Step 3: Create `frontend/src/api/statutoryConfig.ts`**

```typescript
import { apiFetch } from './client';

export interface EmployeeStatutoryConfig {
  employee_id: number;
  emp_id: string | null;
  employee_name: string;
  uan_number: string;
  esic_number: string;
  pan_number: string;
  epf_exempt: boolean;
  esic_exempt: boolean;
  lwf_exempt: boolean;
}

export interface LwfState {
  state: string;
  employee_amount: number;
  employer_amount: number;
  frequency: 'monthly' | 'half_yearly' | 'annually';
}

const BASE = '/api/payroll';

export const getStatutoryConfig = () =>
  apiFetch<EmployeeStatutoryConfig[]>(`${BASE}/statutory-config`);

export const updateStatutoryConfig = (userId: number, data: Partial<EmployeeStatutoryConfig>) =>
  apiFetch<{ ok: boolean }>(`${BASE}/statutory-config/${userId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });

export const getLwfStates = () =>
  apiFetch<LwfState[]>(`${BASE}/lwf-states`);

export const updateLwfState = (data: LwfState) =>
  apiFetch<{ ok: boolean }>(`${BASE}/lwf-states`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/api/payroll.ts frontend/src/api/gratuity.ts frontend/src/api/statutoryConfig.ts
git commit -m "feat: add frontend API types and client functions for statutory, gratuity, exports"
```

---

## Task 9: PayrollCTCTable Component

**Files:**
- Create: `frontend/src/components/payroll/PayrollCTCTable.tsx`

- [ ] **Step 1: Create `frontend/src/components/payroll/PayrollCTCTable.tsx`**

```tsx
import type { PayrollRecord } from '../../api/payroll';
import { downloadPayslip } from '../../api/payroll';

interface Props {
  records: PayrollRecord[];
  runId: number;
}

function fmt(n: number) {
  return '₹' + Math.round(n).toLocaleString('en-IN');
}

function na(n: number, applicable: boolean) {
  return applicable ? fmt(n) : <span style={{ color: '#9ca3af' }}>N/A</span>;
}

const GH: React.CSSProperties = {
  padding: '6px 10px', textAlign: 'center', fontSize: 10, fontWeight: 700,
  textTransform: 'uppercase', letterSpacing: '0.05em', color: '#fff',
};
const TH: React.CSSProperties = {
  padding: '5px 10px', fontSize: 10, fontWeight: 600, color: '#9ca3af',
  textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap',
  background: '#1e2330', borderBottom: '1px solid #2e3548',
};
const TD: React.CSSProperties = {
  padding: '7px 10px', fontSize: 12, borderBottom: '1px solid #2e3548', whiteSpace: 'nowrap',
};

export default function PayrollCTCTable({ records, runId }: Props) {
  const totals = records.reduce((acc, r) => {
    const gross = r.basic_salary + r.allowances;
    const esicApplicable = gross <= 21000 && !r.esic_exempt;
    const earned = gross - r.lop_deduction;
    const empDed = r.epf_employee + (esicApplicable ? r.esic_employee : 0) + r.lwf_employee + r.prof_tax + r.tds_deduction + r.advance_deduction;
    const net = earned - empDed;
    const empCost = r.epf_employer + r.eps_employer + (esicApplicable ? r.esic_employer : 0) + r.lwf_employer + r.gratuity_provision;
    return {
      gross:       acc.gross + gross,
      net:         acc.net + net,
      empCost:     acc.empCost + empCost,
      ctc:         acc.ctc + net + empCost,
      epfEmp:      acc.epfEmp + r.epf_employee,
      esicEmp:     acc.esicEmp + (esicApplicable ? r.esic_employee : 0),
      lwfEmp:      acc.lwfEmp + r.lwf_employee,
      profTax:     acc.profTax + r.prof_tax,
      tds:         acc.tds + r.tds_deduction,
      advance:     acc.advance + r.advance_deduction,
      epfEr:       acc.epfEr + r.epf_employer,
      epsEr:       acc.epsEr + r.eps_employer,
      esicEr:      acc.esicEr + (esicApplicable ? r.esic_employer : 0),
      lwfEr:       acc.lwfEr + r.lwf_employer,
      grat:        acc.grat + r.gratuity_provision,
    };
  }, { gross:0,net:0,empCost:0,ctc:0,epfEmp:0,esicEmp:0,lwfEmp:0,profTax:0,tds:0,advance:0,epfEr:0,epsEr:0,esicEr:0,lwfEr:0,grat:0 });

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ borderCollapse: 'collapse', fontSize: 12, minWidth: 1600, width: '100%' }}>
        <thead>
          <tr>
            <th colSpan={4} style={{ ...GH, background: '#3b4a6b' }}>Employee Info</th>
            <th colSpan={5} style={{ ...GH, background: '#2d6a4f' }}>Attendance</th>
            <th colSpan={3} style={{ ...GH, background: '#1a6b8a' }}>Earnings</th>
            <th colSpan={7} style={{ ...GH, background: '#7f1d1d' }}>Employee Deductions</th>
            <th colSpan={5} style={{ ...GH, background: '#78350f' }}>Employer Contributions</th>
            <th colSpan={3} style={{ ...GH, background: '#3730a3' }}>Net Pay & CTC</th>
            <th style={{ ...GH, background: '#374151' }}></th>
          </tr>
          <tr style={{ background: '#1e2330' }}>
            {['Emp ID','Name','Designation','State',
              'Working Days','Present','Leave','Absent','LOP Days',
              'Basic','Allowances','Gross',
              'LOP Ded.','EPF (12%)','ESIC (0.75%)','LWF','Prof Tax','TDS','Advance',
              'EPF Er (3.67%)','EPS (8.33%)','ESIC Er (3.25%)','LWF Er','Gratuity',
              'Net Salary','Employer Cost','Total CTC',
              'Payslip',
            ].map(h => <th key={h} style={TH}>{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {records.map((r, idx) => {
            const gross         = r.basic_salary + r.allowances;
            const esicApplicable = gross <= 21000 && !r.esic_exempt;
            const earned        = gross - r.lop_deduction;
            const empDed        = r.epf_employee + (esicApplicable ? r.esic_employee : 0) + r.lwf_employee + r.prof_tax + r.tds_deduction + r.advance_deduction;
            const net           = earned - empDed;
            const empCost       = r.epf_employer + r.eps_employer + (esicApplicable ? r.esic_employer : 0) + r.lwf_employer + r.gratuity_provision;
            const bg            = idx % 2 === 0 ? '#1a1f2e' : '#161b27';
            const c = (n: string | React.ReactNode) => <td style={{ ...TD, background: bg }}>{n}</td>;
            const red = (n: number) => <td style={{ ...TD, background: bg, color: '#f87171', textAlign: 'right' }}>{fmt(n)}</td>;
            const ora = (n: number) => <td style={{ ...TD, background: bg, color: '#fb923c', textAlign: 'right' }}>{fmt(n)}</td>;
            const rna = (n: number, applicable: boolean) => <td style={{ ...TD, background: bg, color: applicable ? '#f87171' : '#9ca3af', textAlign: 'right' }}>{applicable ? fmt(n) : 'N/A'}</td>;
            const ora2 = (n: number, applicable: boolean) => <td style={{ ...TD, background: bg, color: applicable ? '#fb923c' : '#9ca3af', textAlign: 'right' }}>{applicable ? fmt(n) : 'N/A'}</td>;
            return (
              <tr key={r.id}>
                {c(r.emp_id || '—')}
                {c(r.employee_name)}
                {c(r.employee_designation)}
                {c(r.employee_state)}
                {c(<span style={{ textAlign: 'center', display: 'block' }}>{r.working_days}</span>)}
                {c(<span style={{ textAlign: 'center', display: 'block' }}>{r.present_days}</span>)}
                {c(<span style={{ textAlign: 'center', display: 'block' }}>{r.leave_days}</span>)}
                {c(<span style={{ textAlign: 'center', display: 'block' }}>{r.absent_days}</span>)}
                {c(<span style={{ textAlign: 'center', display: 'block' }}>{r.lop_days}</span>)}
                <td style={{ ...TD, background: bg, textAlign: 'right' }}>{fmt(r.basic_salary)}</td>
                <td style={{ ...TD, background: bg, textAlign: 'right' }}>{fmt(r.allowances)}</td>
                <td style={{ ...TD, background: bg, textAlign: 'right', fontWeight: 600 }}>{fmt(gross)}</td>
                {red(r.lop_deduction)}
                {red(r.epf_employee)}
                {rna(r.esic_employee, esicApplicable)}
                {red(r.lwf_employee)}
                {red(r.prof_tax)}
                {red(r.tds_deduction)}
                {red(r.advance_deduction)}
                {ora(r.epf_employer)}
                {ora(r.eps_employer)}
                {ora2(r.esic_employer, esicApplicable)}
                {ora(r.lwf_employer)}
                {ora(r.gratuity_provision)}
                <td style={{ ...TD, background: bg, textAlign: 'right', fontWeight: 700, color: '#4ade80' }}>{fmt(net)}</td>
                <td style={{ ...TD, background: bg, textAlign: 'right', color: '#818cf8' }}>{fmt(empCost)}</td>
                <td style={{ ...TD, background: bg, textAlign: 'right', fontWeight: 700, color: '#818cf8' }}>{fmt(net + empCost)}</td>
                <td style={{ ...TD, background: bg, textAlign: 'center' }}>
                  <button
                    onClick={() => downloadPayslip(runId, r.employee_id)}
                    title="Download Payslip"
                    style={{ background: 'none', border: '1px solid #4b5563', borderRadius: 4, padding: '2px 8px', color: '#9ca3af', cursor: 'pointer', fontSize: 11 }}
                  >
                    PDF
                  </button>
                </td>
              </tr>
            );
          })}
          {/* Totals row */}
          <tr style={{ background: '#0f1320', fontWeight: 700, borderTop: '2px solid #4a5568' }}>
            <td colSpan={4} style={{ ...TD, color: '#94a3b8' }}>TOTALS</td>
            <td colSpan={5} style={{ ...TD }}></td>
            <td style={{ ...TD, textAlign: 'right' }}></td>
            <td style={{ ...TD, textAlign: 'right' }}></td>
            <td style={{ ...TD, textAlign: 'right' }}>{fmt(totals.gross)}</td>
            <td style={{ ...TD, textAlign: 'right', color: '#f87171' }}></td>
            <td style={{ ...TD, textAlign: 'right', color: '#f87171' }}>{fmt(totals.epfEmp)}</td>
            <td style={{ ...TD, textAlign: 'right', color: '#f87171' }}>{fmt(totals.esicEmp)}</td>
            <td style={{ ...TD, textAlign: 'right', color: '#f87171' }}>{fmt(totals.lwfEmp)}</td>
            <td style={{ ...TD, textAlign: 'right', color: '#f87171' }}>{fmt(totals.profTax)}</td>
            <td style={{ ...TD, textAlign: 'right', color: '#f87171' }}>{fmt(totals.tds)}</td>
            <td style={{ ...TD, textAlign: 'right', color: '#f87171' }}>{fmt(totals.advance)}</td>
            <td style={{ ...TD, textAlign: 'right', color: '#fb923c' }}>{fmt(totals.epfEr)}</td>
            <td style={{ ...TD, textAlign: 'right', color: '#fb923c' }}>{fmt(totals.epsEr)}</td>
            <td style={{ ...TD, textAlign: 'right', color: '#fb923c' }}>{fmt(totals.esicEr)}</td>
            <td style={{ ...TD, textAlign: 'right', color: '#fb923c' }}>{fmt(totals.lwfEr)}</td>
            <td style={{ ...TD, textAlign: 'right', color: '#fb923c' }}>{fmt(totals.grat)}</td>
            <td style={{ ...TD, textAlign: 'right', fontWeight: 700, color: '#4ade80' }}>{fmt(totals.net)}</td>
            <td style={{ ...TD, textAlign: 'right', color: '#818cf8' }}>{fmt(totals.empCost)}</td>
            <td style={{ ...TD, textAlign: 'right', fontWeight: 700, color: '#818cf8' }}>{fmt(totals.ctc)}</td>
            <td style={{ ...TD }}></td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/payroll/PayrollCTCTable.tsx
git commit -m "feat: add PayrollCTCTable component with CTC grouped columns"
```

---

## Task 10: PayrollPage — Add Exports Dropdown + Use PayrollCTCTable

**Files:**
- Modify: `frontend/src/pages/PayrollPage.tsx`

- [ ] **Step 1: Add imports to `PayrollPage.tsx`**

At the top, add:
```tsx
import PayrollCTCTable from '../components/payroll/PayrollCTCTable';
import { downloadExport } from '../api/payroll';
```

- [ ] **Step 2: Replace the existing payroll records table**

Find the section that renders the payroll records table (the `<table>` inside the "Process Payroll" tab) and replace it with:
```tsx
{run && run.records.length > 0 && (
  <PayrollCTCTable records={run.records} runId={run.id} />
)}
```

- [ ] **Step 3: Add exports dropdown button to the action bar**

Find the area where "Mark as Processed" / "Mark as Paid" buttons are rendered. Add an exports dropdown after those buttons (visible only when status is 'processed' or 'paid'):

```tsx
{run && (run.status === 'processed' || run.status === 'paid') && (
  <div style={{ position: 'relative', display: 'inline-block' }}>
    <ExportsDropdown runId={run.id} />
  </div>
)}
```

Then add this component inline in the file (above the page component):

```tsx
function ExportsDropdown({ runId }: { runId: number }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ padding: '7px 14px', background: '#1e293b', border: '1px solid #334155', borderRadius: 6, color: '#cbd5e1', cursor: 'pointer', fontSize: 13 }}
      >
        Exports ▾
      </button>
      {open && (
        <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 4, background: '#1e293b', border: '1px solid #334155', borderRadius: 6, zIndex: 10, minWidth: 180 }}>
          {(['ecr', 'esic', 'lwf'] as const).map(type => (
            <button
              key={type}
              onClick={() => { downloadExport(runId, type); setOpen(false); }}
              style={{ display: 'block', width: '100%', padding: '9px 16px', background: 'none', border: 'none', color: '#cbd5e1', cursor: 'pointer', textAlign: 'left', fontSize: 13 }}
            >
              {type === 'ecr'  ? 'ECR File (PF)'      : ''}
              {type === 'esic' ? 'ESI Challan (CSV)'  : ''}
              {type === 'lwf'  ? 'LWF Statement (CSV)': ''}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Start frontend dev server and verify**

```bash
cd frontend && npm run dev
```

Open `/payroll`, generate or load a payroll run. Verify:
- CTC grouped table shows with colored group headers
- "PDF" button per row downloads a payslip
- "Exports ▾" dropdown appears when run is processed/paid

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/PayrollPage.tsx
git commit -m "feat: use CTC table in PayrollPage, add exports dropdown and per-row payslip download"
```

---

## Task 11: GratuityPage

**Files:**
- Create: `frontend/src/pages/GratuityPage.tsx`

- [ ] **Step 1: Create `frontend/src/pages/GratuityPage.tsx`**

```tsx
import { useState, useEffect } from 'react';
import AppLayout from '../components/shared/AppLayout';
import {
  getGratuityAccruals, getGratuityDisbursements, recordGratuityDisbursement,
  type GratuityAccrual, type GratuityDisbursement,
} from '../api/gratuity';

function fmt(n: number) {
  return '₹' + Math.round(n).toLocaleString('en-IN');
}

function yearsOfService(doj: string | null): number {
  if (!doj) return 0;
  const ms = Date.now() - new Date(doj).getTime();
  return ms / (1000 * 60 * 60 * 24 * 365.25);
}

const TH: React.CSSProperties = {
  padding: '10px 14px', fontSize: 11, fontWeight: 600, color: '#9ca3af',
  textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap',
  background: '#f9fafb', borderBottom: '1px solid #f3f4f6',
};
const TD: React.CSSProperties = {
  padding: '10px 14px', fontSize: 13, borderBottom: '1px solid #f3f4f6',
};

type Tab = 'accruals' | 'eligibility' | 'disbursements';

export default function GratuityPage() {
  const [tab, setTab] = useState<Tab>('accruals');
  const [accruals, setAccruals] = useState<GratuityAccrual[]>([]);
  const [disbursements, setDisbursements] = useState<GratuityDisbursement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [modalEmp, setModalEmp] = useState<GratuityAccrual | null>(null);
  const [form, setForm] = useState({ exit_date: '', paid_amount: '', payment_date: '', notes: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([getGratuityAccruals(), getGratuityDisbursements()])
      .then(([a, d]) => { setAccruals(a); setDisbursements(d); })
      .finally(() => setLoading(false));
  }, []);

  const eligible = accruals.filter(a => yearsOfService(a.date_of_joining) >= 5);

  async function handleDisbursementSave() {
    if (!modalEmp) return;
    setSaving(true);
    try {
      await recordGratuityDisbursement({
        employee_id:     modalEmp.employee_id,
        exit_date:       form.exit_date,
        years_of_service: yearsOfService(modalEmp.date_of_joining),
        accrued_amount:  modalEmp.cumulative_amount,
        paid_amount:     Number(form.paid_amount),
        payment_date:    form.payment_date,
        notes:           form.notes,
      });
      const [a, d] = await Promise.all([getGratuityAccruals(), getGratuityDisbursements()]);
      setAccruals(a); setDisbursements(d);
      setShowModal(false);
    } finally {
      setSaving(false);
    }
  }

  const TABS: { key: Tab; label: string }[] = [
    { key: 'accruals',      label: 'Accruals'      },
    { key: 'eligibility',   label: 'Eligibility'   },
    { key: 'disbursements', label: 'Disbursements'  },
  ];

  return (
    <AppLayout>
      <div style={{ padding: '32px 24px', maxWidth: 1200, margin: '0 auto' }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Gratuity</h1>
        <p style={{ color: '#6b7280', marginBottom: 24, fontSize: 14 }}>
          Monthly provisions, eligibility tracking, and disbursement records.
        </p>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid #e5e7eb' }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              padding: '8px 18px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14,
              fontWeight: tab === t.key ? 700 : 400,
              color: tab === t.key ? '#2563eb' : '#6b7280',
              borderBottom: tab === t.key ? '2px solid #2563eb' : '2px solid transparent',
              marginBottom: -1,
            }}>{t.label}{t.key === 'eligibility' ? ` (${eligible.length})` : ''}</button>
          ))}
        </div>

        {loading ? (
          <div style={{ color: '#9ca3af', padding: 32 }}>Loading…</div>
        ) : (
          <>
            {/* Accruals tab */}
            {tab === 'accruals' && (
              <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr>
                    {['Employee','Emp ID','Date of Joining','Years of Service','Monthly Provision','Cumulative Accrued','Status'].map(h =>
                      <th key={h} style={TH}>{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {accruals.map(a => {
                      const yrs     = yearsOfService(a.date_of_joining);
                      const eligible = yrs >= 5;
                      return (
                        <tr key={a.employee_id}>
                          <td style={TD}>{a.employee_name}</td>
                          <td style={TD}>{a.emp_id || '—'}</td>
                          <td style={TD}>{a.date_of_joining ? new Date(a.date_of_joining).toLocaleDateString('en-IN') : '—'}</td>
                          <td style={TD}>{yrs.toFixed(1)} yrs</td>
                          <td style={TD}>{fmt(a.last_monthly_provision || 0)}</td>
                          <td style={{ ...TD, fontWeight: 600 }}>{fmt(a.cumulative_amount || 0)}</td>
                          <td style={TD}>
                            <span style={{
                              display: 'inline-block', padding: '2px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600,
                              background: eligible ? '#dcfce7' : '#f3f4f6',
                              color: eligible ? '#16a34a' : '#6b7280',
                            }}>{eligible ? 'Eligible' : 'Accruing'}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Eligibility tab */}
            {tab === 'eligibility' && (
              <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
                {eligible.length === 0 ? (
                  <div style={{ padding: 32, color: '#9ca3af', textAlign: 'center' }}>No employees with ≥ 5 years of service yet.</div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead><tr>
                      {['Employee','Emp ID','Date of Joining','Years of Service','Accrued Amount','Action'].map(h =>
                        <th key={h} style={TH}>{h}</th>)}
                    </tr></thead>
                    <tbody>
                      {eligible.map(a => (
                        <tr key={a.employee_id}>
                          <td style={TD}>{a.employee_name}</td>
                          <td style={TD}>{a.emp_id || '—'}</td>
                          <td style={TD}>{a.date_of_joining ? new Date(a.date_of_joining).toLocaleDateString('en-IN') : '—'}</td>
                          <td style={TD}>{yearsOfService(a.date_of_joining).toFixed(1)} yrs</td>
                          <td style={{ ...TD, fontWeight: 600 }}>{fmt(a.cumulative_amount || 0)}</td>
                          <td style={TD}>
                            <button onClick={() => { setModalEmp(a); setForm({ exit_date: '', paid_amount: String(Math.round(a.cumulative_amount || 0)), payment_date: '', notes: '' }); setShowModal(true); }}
                              style={{ padding: '5px 12px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 5, cursor: 'pointer', fontSize: 12 }}>
                              Record Disbursement
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* Disbursements tab */}
            {tab === 'disbursements' && (
              <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr>
                    {['Employee','Exit Date','Years of Service','Accrued','Paid','Payment Date','Recorded By'].map(h =>
                      <th key={h} style={TH}>{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {disbursements.length === 0 ? (
                      <tr><td colSpan={7} style={{ ...TD, textAlign: 'center', color: '#9ca3af' }}>No disbursements recorded yet.</td></tr>
                    ) : disbursements.map(d => (
                      <tr key={d.id}>
                        <td style={TD}>{d.employee_name}</td>
                        <td style={TD}>{new Date(d.exit_date).toLocaleDateString('en-IN')}</td>
                        <td style={TD}>{d.years_of_service.toFixed(1)} yrs</td>
                        <td style={TD}>{fmt(d.accrued_amount)}</td>
                        <td style={{ ...TD, fontWeight: 600 }}>{fmt(d.paid_amount)}</td>
                        <td style={TD}>{new Date(d.payment_date).toLocaleDateString('en-IN')}</td>
                        <td style={TD}>{d.recorded_by_name || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      {/* Disbursement Modal */}
      {showModal && modalEmp && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: '#fff', borderRadius: 10, padding: 28, width: 420, maxWidth: '95vw' }}>
            <h3 style={{ marginBottom: 16 }}>Record Gratuity Disbursement</h3>
            <p style={{ color: '#6b7280', fontSize: 13, marginBottom: 16 }}>Employee: <strong>{modalEmp.employee_name}</strong></p>
            {[
              { label: 'Exit Date', key: 'exit_date', type: 'date' },
              { label: 'Amount Paid (₹)', key: 'paid_amount', type: 'number' },
              { label: 'Payment Date', key: 'payment_date', type: 'date' },
              { label: 'Notes', key: 'notes', type: 'text' },
            ].map(({ label, key, type }) => (
              <div key={key} style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 12, color: '#374151', marginBottom: 4 }}>{label}</label>
                <input
                  type={type}
                  value={(form as any)[key]}
                  onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  style={{ width: '100%', padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: 5, fontSize: 13, boxSizing: 'border-box' }}
                />
              </div>
            ))}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
              <button onClick={() => setShowModal(false)} style={{ padding: '7px 16px', border: '1px solid #d1d5db', background: '#fff', borderRadius: 5, cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleDisbursementSave} disabled={saving} style={{ padding: '7px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 5, cursor: 'pointer' }}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/GratuityPage.tsx
git commit -m "feat: add GratuityPage with accruals, eligibility, and disbursements tabs"
```

---

## Task 12: ConfigurationsPage — LWF, Statutory Config, Company Info

**Files:**
- Modify: `frontend/src/pages/ConfigurationsPage.tsx`

- [ ] **Step 1: Add imports at top of `ConfigurationsPage.tsx`**

```tsx
import {
  getStatutoryConfig, updateStatutoryConfig, getLwfStates, updateLwfState,
  type EmployeeStatutoryConfig, type LwfState,
} from '../api/statutoryConfig';
import { getCompanyInfo, updateCompanyInfo, type CompanyInfo } from '../api/payroll';
```

- [ ] **Step 2: Add state variables inside the page component**

```tsx
const [lwfStates, setLwfStates] = useState<LwfState[]>([]);
const [lwfEdits, setLwfEdits] = useState<Record<string, LwfState>>({});
const [statutory, setStatutory] = useState<EmployeeStatutoryConfig[]>([]);
const [statutoryEdits, setStatutoryEdits] = useState<Record<number, Partial<EmployeeStatutoryConfig>>>({});
const [companyInfo, setCompanyInfo] = useState<CompanyInfo>({ company_name:'', company_address:'', pf_registration_number:'', esic_registration_number:'', hr_email:'' });
const [companySaving, setCompanySaving] = useState(false);
```

- [ ] **Step 3: Load data in existing `useEffect`**

In the existing `useEffect` where data is loaded, add:
```tsx
getLwfStates().then(setLwfStates),
getStatutoryConfig().then(setStatutory),
getCompanyInfo().then(setCompanyInfo),
```

- [ ] **Step 4: Add new tab buttons**

In the tab navigation (wherever "Prof Tax by State" and "TDS Slabs" tabs are rendered), add:
```tsx
{['Prof Tax', 'TDS Slabs', 'LWF by State', 'Statutory Config', 'Company Info'].map(t => (
  <button key={t} onClick={() => setTab(t)} style={{
    padding: '8px 16px', background: 'none', border: 'none', cursor: 'pointer',
    fontWeight: activeTab === t ? 700 : 400,
    color: activeTab === t ? '#2563eb' : '#6b7280',
    borderBottom: activeTab === t ? '2px solid #2563eb' : '2px solid transparent',
    fontSize: 14, marginBottom: -1,
  }}>{t}</button>
))}
```

(Adjust `activeTab` state and its setter to match the existing tab state variable name in the file.)

- [ ] **Step 5: Add LWF by State tab content**

Add this block in the tab content area (after TDS Slabs content):

```tsx
{activeTab === 'LWF by State' && (
  <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead><tr>
        {['State','Employee Amount (₹)','Employer Amount (₹)','Frequency',''].map(h =>
          <th key={h} style={TH}>{h}</th>)}
      </tr></thead>
      <tbody>
        {lwfStates.map(row => {
          const edit = lwfEdits[row.state] ?? row;
          return (
            <tr key={row.state}>
              <td style={TD}>{row.state}</td>
              <td style={TD}>
                <input type="number" value={edit.employee_amount} onChange={e => setLwfEdits(p => ({ ...p, [row.state]: { ...edit, employee_amount: Number(e.target.value) } }))}
                  style={{ width: 90, padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: 4 }} />
              </td>
              <td style={TD}>
                <input type="number" value={edit.employer_amount} onChange={e => setLwfEdits(p => ({ ...p, [row.state]: { ...edit, employer_amount: Number(e.target.value) } }))}
                  style={{ width: 90, padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: 4 }} />
              </td>
              <td style={TD}>
                <select value={edit.frequency} onChange={e => setLwfEdits(p => ({ ...p, [row.state]: { ...edit, frequency: e.target.value as any } }))}
                  style={{ padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: 4 }}>
                  <option value="monthly">Monthly</option>
                  <option value="half_yearly">Half-Yearly</option>
                  <option value="annually">Annually</option>
                </select>
              </td>
              <td style={TD}>
                <button onClick={async () => {
                  await updateLwfState(edit);
                  setLwfStates(await getLwfStates());
                  setLwfEdits(p => { const n = { ...p }; delete n[row.state]; return n; });
                }} style={{ padding: '4px 12px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}>
                  Save
                </button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  </div>
)}
```

- [ ] **Step 6: Add Statutory Config tab content**

```tsx
{activeTab === 'Statutory Config' && (
  <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'auto' }}>
    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
      <thead><tr>
        {['Employee','UAN Number','ESIC Number','PAN Number','EPF Exempt','ESIC Exempt','LWF Exempt',''].map(h =>
          <th key={h} style={TH}>{h}</th>)}
      </tr></thead>
      <tbody>
        {statutory.map(emp => {
          const edit = { ...emp, ...statutoryEdits[emp.employee_id] };
          const cell = (field: keyof EmployeeStatutoryConfig, type: 'text' | 'toggle') => {
            if (type === 'toggle') {
              return (
                <td style={TD}>
                  <input type="checkbox" checked={!!edit[field]}
                    onChange={e => setStatutoryEdits(p => ({ ...p, [emp.employee_id]: { ...(p[emp.employee_id] ?? {}), [field]: e.target.checked } }))} />
                </td>
              );
            }
            return (
              <td style={TD}>
                <input type="text" value={String(edit[field] ?? '')}
                  onChange={e => setStatutoryEdits(p => ({ ...p, [emp.employee_id]: { ...(p[emp.employee_id] ?? {}), [field]: e.target.value } }))}
                  style={{ width: 120, padding: '3px 6px', border: '1px solid #d1d5db', borderRadius: 4, fontSize: 12 }} />
              </td>
            );
          };
          return (
            <tr key={emp.employee_id}>
              <td style={TD}>{emp.employee_name}</td>
              {cell('uan_number', 'text')}
              {cell('esic_number', 'text')}
              {cell('pan_number', 'text')}
              {cell('epf_exempt', 'toggle')}
              {cell('esic_exempt', 'toggle')}
              {cell('lwf_exempt', 'toggle')}
              <td style={TD}>
                <button onClick={async () => {
                  await updateStatutoryConfig(emp.employee_id, statutoryEdits[emp.employee_id] ?? {});
                  setStatutory(await getStatutoryConfig());
                  setStatutoryEdits(p => { const n = { ...p }; delete n[emp.employee_id]; return n; });
                }} style={{ padding: '4px 12px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}>
                  Save
                </button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  </div>
)}
```

- [ ] **Step 7: Add Company Info tab content**

```tsx
{activeTab === 'Company Info' && (
  <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 24, maxWidth: 500 }}>
    {([
      { label: 'Company Name',           field: 'company_name'             },
      { label: 'Company Address',        field: 'company_address'          },
      { label: 'PF Registration Number', field: 'pf_registration_number'   },
      { label: 'ESIC Reg. Number',       field: 'esic_registration_number' },
      { label: 'HR Email',               field: 'hr_email'                 },
    ] as { label: string; field: keyof CompanyInfo }[]).map(({ label, field }) => (
      <div key={field} style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', fontSize: 12, color: '#374151', marginBottom: 4 }}>{label}</label>
        <input
          value={companyInfo[field]}
          onChange={e => setCompanyInfo(c => ({ ...c, [field]: e.target.value }))}
          style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 5, fontSize: 13, boxSizing: 'border-box' }}
        />
      </div>
    ))}
    <button
      onClick={async () => { setCompanySaving(true); try { await updateCompanyInfo(companyInfo); } finally { setCompanySaving(false); } }}
      disabled={companySaving}
      style={{ padding: '8px 20px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 5, cursor: 'pointer' }}
    >
      {companySaving ? 'Saving…' : 'Save Company Info'}
    </button>
  </div>
)}
```

- [ ] **Step 8: Test in browser**

Open `/payroll/configurations`. Verify new tabs appear: LWF by State, Statutory Config, Company Info. Save a LWF amount for one state, verify it persists on reload.

- [ ] **Step 9: Commit**

```bash
git add frontend/src/pages/ConfigurationsPage.tsx
git commit -m "feat: add LWF by State, Statutory Config, and Company Info tabs to ConfigurationsPage"
```

---

## Task 13: Routing + Navigation

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/shared/AppLayout.tsx`

- [ ] **Step 1: Add GratuityPage route to `frontend/src/App.tsx`**

Add lazy import with the others:
```tsx
const GratuityPage = lazy(() => import('./pages/GratuityPage'));
```

Add route inside `<Routes>` after the `/payroll/configurations` route:
```tsx
<Route path="/payroll/gratuity" element={<ProtectedRoute allowedRoles={['admin', 'hr', 'vp_hr']}><GratuityPage /></ProtectedRoute>} />
```

- [ ] **Step 2: Add Gratuity to Payroll sub-menu in `frontend/src/components/shared/AppLayout.tsx`**

Find where the Payroll sub-menu items are defined (Salary Master, Advances, Tax Computation, Configurations). Add Gratuity to that list:

```tsx
{ label: 'Gratuity', path: '/payroll/gratuity' },
```

Place it after "Advances" and before "Tax Computation" in the sub-menu array.

- [ ] **Step 3: Test navigation**

Open the app, click PAYROLL in the nav — verify "Gratuity" appears in the sub-menu. Click it — verify GratuityPage loads with the three tabs.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/App.tsx frontend/src/components/shared/AppLayout.tsx
git commit -m "feat: add Gratuity route and nav item to Payroll module"
```

---

## Self-Review Checklist

**Spec coverage:**
- [x] EPF (employee + employer + EPS) — Task 2 (calculations) + Task 3 (generation)
- [x] ESIC (employee + employer, gross ≤ ₹21,000 check) — Task 2 + Task 3
- [x] LWF (state-based, configurable frequency, exemptions) — Task 2 + Task 3 + Task 4
- [x] Gratuity provision (monthly, employer only) — Task 2 + Task 3
- [x] Full Gratuity module (accruals, eligibility, disbursements) — Task 5 + Task 11
- [x] CTC grouped payroll table — Task 9 + Task 10
- [x] Per-row payslip PDF download — Task 6 + Task 10
- [x] ECR, ESI, LWF compliance exports — Task 7 + Task 10
- [x] LWF by State config — Task 4 + Task 12
- [x] Employee statutory config (UAN, ESIC no., PAN, exemptions) — Task 4 + Task 12
- [x] Company info config (for payslip header) — Task 4 + Task 12
- [x] Navigation + routing for GratuityPage — Task 13

**No placeholders found.** All code steps contain complete implementations.

**Type consistency:** `PayrollRecord` fields added in Task 8 match column names returned by the backend query extended in Task 3. `PayslipData` fields in Task 6 match what the endpoint constructs.
