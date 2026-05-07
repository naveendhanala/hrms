# Salary Effective Date Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add salary revision history with effective dates, enabling mid-month proration and retroactive arrears computation in payroll generation.

**Architecture:** New `salary_master_history` append-only table stores each salary revision. `salary_master` remains as current-snapshot for backward compatibility. `buildPayrollRecords` is extended to detect mid-month revisions (prorate gross) and unprocessed past revisions (compute arrears, mark as processed). Two new columns (`arrears`, `arrears_label`) land on `payroll_records`. Payslip PDF and CTC table gain an arrears line item.

**Tech Stack:** PostgreSQL, Express/TypeScript, React/TypeScript, pdfkit.

---

## File Map

| File | Change |
|------|--------|
| `backend/src/db.ts` | Add migration for `salary_master_history` + `payroll_records.arrears` + `payroll_records.arrears_label` |
| `backend/src/routes/payroll.ts` | Add `POST /salary-master/:userId/revise`, `GET /salary-master/:userId/history`; update `buildPayrollRecords` and payslip endpoint |
| `backend/src/payroll/payslipPdf.ts` | Add `arrears` + `arrearsLabel` to `PayslipData`; add arrears row in earnings section |
| `frontend/src/api/payroll.ts` | Add `SalaryHistoryEntry`, `reviseSalary()`, `getSalaryHistory()`; add `arrears` to `PayrollRecord` |
| `frontend/src/utils/payroll.ts` | Add `+ r.arrears` to `calcNetPay` |
| `frontend/src/pages/SalaryMasterPage.tsx` | Replace Edit with Revise + History panels |
| `frontend/src/components/payroll/PayrollCTCTable.tsx` | Add Arrears column after Earned Gross |

---

## Task 1: DB Migration

**Files:**
- Modify: `backend/src/db.ts` (inside `_runMigrations`, in the `Promise.all([...])` block around line 70)

- [ ] **Step 1: Add three migrations to the Promise.all block in `_runMigrations`**

In `backend/src/db.ts`, add these three lines inside the existing `Promise.all([...])` call (alongside the other `pool.query(...)` entries):

```typescript
pool.query(`CREATE TABLE IF NOT EXISTS salary_master_history (
  id                   SERIAL PRIMARY KEY,
  employee_id          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  effective_date       DATE NOT NULL,
  basic_salary         REAL NOT NULL DEFAULT 0,
  hra                  REAL NOT NULL DEFAULT 0,
  meal_allowance       REAL NOT NULL DEFAULT 0,
  conveyance_allowance REAL NOT NULL DEFAULT 0,
  special_allowance    REAL NOT NULL DEFAULT 0,
  deductions           REAL NOT NULL DEFAULT 0,
  arrears_processed    BOOLEAN NOT NULL DEFAULT FALSE,
  created_by           INTEGER REFERENCES users(id),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (employee_id, effective_date)
)`),
pool.query(`CREATE INDEX IF NOT EXISTS idx_smh_employee  ON salary_master_history(employee_id)`),
pool.query(`CREATE INDEX IF NOT EXISTS idx_smh_effective ON salary_master_history(employee_id, effective_date)`),
pool.query(`ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS arrears       REAL NOT NULL DEFAULT 0`),
pool.query(`ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS arrears_label TEXT NOT NULL DEFAULT ''`),
```

- [ ] **Step 2: Restart the backend and verify migrations ran**

Run: `cd backend && npm run dev`

Expected: Server starts without errors. Connect to the DB and check:
```sql
SELECT column_name FROM information_schema.columns WHERE table_name = 'salary_master_history';
SELECT column_name FROM information_schema.columns WHERE table_name = 'payroll_records' AND column_name IN ('arrears','arrears_label');
```
Both queries should return the expected columns.

- [ ] **Step 3: Commit**

```bash
git add backend/src/db.ts
git commit -m "feat: add salary_master_history table and arrears columns to payroll_records"
```

---

## Task 2: Backend — POST /salary-master/:userId/revise

**Files:**
- Modify: `backend/src/routes/payroll.ts` (after the existing `PUT /salary-master/:userId` handler, around line 63)

- [ ] **Step 1: Add the revise endpoint**

Insert this route after the existing `router.put('/salary-master/:userId', ...)` handler:

```typescript
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

  await db.transaction(async (tx) => {
    await tx.run(
      `INSERT INTO salary_master_history
         (employee_id, effective_date, basic_salary, hra, meal_allowance, conveyance_allowance, special_allowance, deductions, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        Number(req.params.userId),
        effective_date,
        basic_salary         ?? 0,
        hra                  ?? 0,
        meal_allowance       ?? 0,
        conveyance_allowance ?? 0,
        special_allowance    ?? 0,
        deductions           ?? 0,
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
```

- [ ] **Step 2: Verify manually**

With the backend running, test:
```bash
curl -X POST http://localhost:3001/api/payroll/salary-master/2/revise \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"effective_date":"2026-06-01","basic_salary":30000,"hra":12000,"meal_allowance":2000,"conveyance_allowance":1600,"special_allowance":5000,"deductions":0}'
```
Expected: `{"ok":true,"effective_date":"2026-06-01"}` with HTTP 201.

Call again with same month → Expected: HTTP 409 with conflict message.

- [ ] **Step 3: Commit**

```bash
git add backend/src/routes/payroll.ts
git commit -m "feat: add POST /salary-master/:userId/revise endpoint with same-month conflict guard"
```

---

## Task 3: Backend — GET /salary-master/:userId/history

**Files:**
- Modify: `backend/src/routes/payroll.ts` (after the revise endpoint added in Task 2)

- [ ] **Step 1: Add the history endpoint**

```typescript
router.get('/salary-master/:userId/history', authenticateToken, requireRole('admin', 'hr', 'vp_hr'), async (req: AuthRequest, res: Response) => {
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
  `, [Number(req.params.userId)]);

  res.json(rows);
});
```

- [ ] **Step 2: Verify manually**

```bash
curl http://localhost:3001/api/payroll/salary-master/2/history \
  -H "Authorization: Bearer <token>"
```
Expected: JSON array of history rows (with `effective_date`, `basic_salary`, `created_by_name` etc.).

- [ ] **Step 3: Commit**

```bash
git add backend/src/routes/payroll.ts
git commit -m "feat: add GET /salary-master/:userId/history endpoint"
```

---

## Task 4: Backend — Update buildPayrollRecords (proration + arrears)

**Files:**
- Modify: `backend/src/routes/payroll.ts` — the `buildPayrollRecords` function (lines 117–258)

This is the most significant backend change. Read the function carefully before editing.

- [ ] **Step 1: Add date helpers at the top of `buildPayrollRecords`**

After the line `const { fyStartYear, fyEndYear } = getFY(month, year);` (line ~120), add:

```typescript
const firstOfMonth = `${year}-${String(month).padStart(2, '0')}-01`;
const lastOfMonth  = `${year}-${String(month).padStart(2, '0')}-${String(getDaysInMonth(month, year)).padStart(2, '0')}`;
```

- [ ] **Step 2: Add salary_master_history fetch to the Promise.all**

In the `Promise.all([...])` block (line ~122), add one more query as the last element:

```typescript
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
    prev.basic_salary         AS prev_basic,
    prev.hra                  AS prev_hra,
    prev.meal_allowance       AS prev_meal,
    prev.conveyance_allowance AS prev_conv,
    prev.special_allowance    AS prev_special,
    sm.basic_salary           AS sm_basic,
    sm.hra                    AS sm_hra,
    sm.meal_allowance         AS sm_meal,
    sm.conveyance_allowance   AS sm_conv,
    sm.special_allowance      AS sm_special
  FROM salary_master_history h
  LEFT JOIN salary_master sm ON sm.employee_id = h.employee_id
  LEFT JOIN LATERAL (
    SELECT basic_salary, hra, meal_allowance, conveyance_allowance, special_allowance
    FROM salary_master_history h2
    WHERE h2.employee_id = h.employee_id AND h2.effective_date < h.effective_date
    ORDER BY h2.effective_date DESC LIMIT 1
  ) prev ON TRUE
  WHERE (h.effective_date >= ? AND h.effective_date <= ?)
     OR (h.effective_date < ?  AND h.arrears_processed = FALSE)
`, [firstOfMonth, lastOfMonth, firstOfMonth]),
```

- [ ] **Step 3: Destructure the new query result**

Change the destructuring line from:
```typescript
const [employees, stateTaxRows, lwfRows, statutoryRows, allAtt, allAdv, allTds, historicalGratuity] = await Promise.all([
```
To:
```typescript
const [employees, stateTaxRows, lwfRows, statutoryRows, allAtt, allAdv, allTds, historicalGratuity, allSalaryHistory] = await Promise.all([
```

- [ ] **Step 4: Build historyMap after the Promise.all**

After the existing `Map` constructions (around line 171–177), add:

```typescript
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
```

- [ ] **Step 5: Replace the per-employee computation block**

Replace the current employee loop body (from `const att = attMap.get(emp.id)` through `rowValues.push(...)` and `gratValues.push(...)`) with:

```typescript
  const att         = attMap.get(emp.id);
  const presentDays = Number(att?.present_days ?? 0);
  const leaveDays   = Number(att?.leave_days   ?? 0);
  const absentDays  = Number(att?.absent_days  ?? 0);
  const lopDays     = Number(att?.lop_days     ?? 0);

  const empHist = historyMap.get(emp.id) ?? { midMonth: null, arrearRevisions: [] };

  // --- Determine salary (prorate if mid-month revision) ---
  let basicSalary      = emp.basic_salary;
  let totalAllowances  = emp.hra + emp.meal_allowance + emp.conveyance_allowance + emp.special_allowance;
  let grossSalary      = basicSalary + totalAllowances;
  // epfBasic: the basic used for EPF cap — always month-end basic
  let epfBasic         = emp.basic_salary;

  if (empHist.midMonth) {
    const rev     = empHist.midMonth;
    const effDay  = parseInt(rev.effective_date.slice(8, 10), 10);
    const daysBefore = effDay - 1;
    const daysFrom   = totalDays - daysBefore;

    const oldBasic      = Number(rev.prev_basic  ?? emp.basic_salary);
    const oldHra        = Number(rev.prev_hra    ?? emp.hra);
    const oldMeal       = Number(rev.prev_meal   ?? emp.meal_allowance);
    const oldConv       = Number(rev.prev_conv   ?? emp.conveyance_allowance);
    const oldSpec       = Number(rev.prev_special ?? emp.special_allowance);
    const oldAllowances = oldHra + oldMeal + oldConv + oldSpec;
    const oldGross      = oldBasic + oldAllowances;

    const newBasic      = Number(rev.basic_salary);
    const newHra        = Number(rev.hra);
    const newMeal       = Number(rev.meal_allowance);
    const newConv       = Number(rev.conveyance_allowance);
    const newSpec       = Number(rev.special_allowance);
    const newAllowances = newHra + newMeal + newConv + newSpec;
    const newGross      = newBasic + newAllowances;

    basicSalary     = Math.round((oldBasic / totalDays * daysBefore + newBasic / totalDays * daysFrom) * 100) / 100;
    totalAllowances = Math.round((oldAllowances / totalDays * daysBefore + newAllowances / totalDays * daysFrom) * 100) / 100;
    grossSalary     = Math.round((oldGross / totalDays * daysBefore + newGross / totalDays * daysFrom) * 100) / 100;
    epfBasic        = newBasic; // EPF uses month-end basic
  }

  // --- Deductions dependent on gross ---
  const lopDeduction = totalDays > 0 ? Math.round((lopDays * grossSalary) / totalDays * 100) / 100 : 0;

  const empState  = (emp.state || '').trim().toLowerCase();
  const profTax   = empState && stateTaxMap.has(empState) ? stateTaxMap.get(empState)! : 0;
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

  // --- Arrears for retroactive revisions ---
  const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  let arrears      = 0;
  let arrearsLabel = '';

  for (const rev of empHist.arrearRevisions) {
    const effDate     = new Date(rev.effective_date);
    const pastMonth   = effDate.getMonth() + 1;
    const pastYear    = effDate.getFullYear();
    const pastTotalDays = getDaysInMonth(pastMonth, pastYear);
    const effDay      = effDate.getDate();
    const daysUnderNew = pastTotalDays - effDay + 1;

    const oldBasic = Number(rev.prev_basic  ?? rev.sm_basic  ?? 0);
    const oldHra   = Number(rev.prev_hra    ?? rev.sm_hra    ?? 0);
    const oldMeal  = Number(rev.prev_meal   ?? rev.sm_meal   ?? 0);
    const oldConv  = Number(rev.prev_conv   ?? rev.sm_conv   ?? 0);
    const oldSpec  = Number(rev.prev_special ?? rev.sm_special ?? 0);
    const oldGross = oldBasic + oldHra + oldMeal + oldConv + oldSpec;

    const newGross = Number(rev.basic_salary) + Number(rev.hra) + Number(rev.meal_allowance) + Number(rev.conveyance_allowance) + Number(rev.special_allowance);

    arrears += (newGross - oldGross) / pastTotalDays * daysUnderNew;
    allProcessedHistoryIds.push(rev.id);

    if (empHist.arrearRevisions.length === 1) {
      arrearsLabel = `${MONTHS_SHORT[effDate.getMonth()]} ${pastYear}`;
    } else {
      arrearsLabel = 'Prior Months';
    }
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
```

- [ ] **Step 6: Update the bulk INSERT column list and count**

Change `const cols = 26;` to `const cols = 28;` and update the INSERT statement to include `arrears, arrears_label`:

```typescript
const cols = 28;
// ...
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
```

- [ ] **Step 7: Mark processed history rows inside the transaction**

After the `gratuity_accruals` INSERT inside the `db.transaction` block, add:

```typescript
if (allProcessedHistoryIds.length > 0) {
  const idPlaceholders = allProcessedHistoryIds.map(() => '?').join(', ');
  await tx.run(
    `UPDATE salary_master_history SET arrears_processed = TRUE WHERE id IN (${idPlaceholders})`,
    allProcessedHistoryIds,
  );
}
```

- [ ] **Step 8: Verify manually**

1. Add a salary revision for an employee with `effective_date` in a past month via the revise endpoint (Task 2).
2. Generate payroll for the current month via `POST /api/payroll`.
3. Fetch the payroll run and check the employee's record: `arrears` should be non-zero, `arrears_label` should match the past month.
4. Check that `salary_master_history.arrears_processed = TRUE` for the used revision.
5. Generate payroll again (re-generate) → arrears should be 0 now (already processed).

- [ ] **Step 9: Commit**

```bash
git add backend/src/routes/payroll.ts
git commit -m "feat: prorate salary on mid-month revision and compute retroactive arrears in payroll generation"
```

---

## Task 5: Backend — Payslip PDF arrears line item

**Files:**
- Modify: `backend/src/payroll/payslipPdf.ts`
- Modify: `backend/src/routes/payroll.ts` (payslip endpoint, ~line 487)

- [ ] **Step 1: Add `arrears` and `arrearsLabel` to `PayslipData` interface**

In `backend/src/payroll/payslipPdf.ts`, add to the `PayslipData` interface after `advanceDeduction`:

```typescript
arrears: number;
arrearsLabel: string;
```

- [ ] **Step 2: Add arrears row to earningsRows and update netSalary**

In `streamPayslipPdf`, find the `earningsRows` array (around line 123). Replace it with:

```typescript
const earningsRows: [string, number][] = [
  ['Basic Salary',         data.basicSalary],
  ['HRA',                  data.hra],
  ['Conveyance Allowance', data.conveyanceAllowance],
  ['Meal Allowance',       data.mealAllowance],
  ['Special Allowance',    data.specialAllowance],
  ['Gross Earnings',       data.grossSalary],
  ['LOP Deduction',        -data.lopDeduction],
  ['Earned Salary',        data.earnedSalary],
];
if (data.arrears !== 0) {
  const label = data.arrearsLabel ? `Salary Arrears (${data.arrearsLabel})` : 'Salary Arrears';
  earningsRows.push([label, data.arrears]);
}
```

- [ ] **Step 3: Update the payslip endpoint to pass arrears**

In `backend/src/routes/payroll.ts`, in the payslip endpoint (around line 513), update the `netSalary` calculation and `PayslipData` construction:

Change:
```typescript
const netSalary = earned - totalEmpDeductions;
```
To:
```typescript
const arrears = record.arrears ?? 0;
const netSalary = earned + arrears - totalEmpDeductions;
```

Then in the `data: PayslipData` object, add after `advanceDeduction`:
```typescript
arrears:         arrears,
arrearsLabel:    record.arrears_label ?? '',
```

Also update `totalCtc` so it uses the updated `netSalary` (it already does since it references the variable).

- [ ] **Step 4: Verify manually**

Generate a payslip for an employee who has arrears. Download the PDF. Confirm:
- A "Salary Arrears (Mon YYYY): ₹X" row appears in the Earnings section after Earned Salary.
- Net salary on the payslip = earned + arrears - deductions.

- [ ] **Step 5: Commit**

```bash
git add backend/src/payroll/payslipPdf.ts backend/src/routes/payroll.ts
git commit -m "feat: show salary arrears as separate line item on payslip PDF"
```

---

## Task 6: Frontend API Layer

**Files:**
- Modify: `frontend/src/api/payroll.ts`
- Modify: `frontend/src/utils/payroll.ts`

- [ ] **Step 1: Add `arrears` to `PayrollRecord` interface**

In `frontend/src/api/payroll.ts`, add to the `PayrollRecord` interface after `esic_exempt`:

```typescript
arrears: number;
arrears_label: string;
```

- [ ] **Step 2: Add `SalaryHistoryEntry` interface**

After the `SalaryMasterEntry` interface, add:

```typescript
export interface SalaryHistoryEntry {
  id: number;
  effective_date: string;
  basic_salary: number;
  hra: number;
  meal_allowance: number;
  conveyance_allowance: number;
  special_allowance: number;
  deductions: number;
  arrears_processed: boolean;
  created_at: string;
  created_by_name: string | null;
}
```

- [ ] **Step 3: Add `reviseSalary` and `getSalaryHistory` API functions**

After `updateSalaryMaster`, add:

```typescript
export interface SalaryRevisePayload {
  effective_date: string;
  basic_salary: number;
  hra: number;
  meal_allowance: number;
  conveyance_allowance: number;
  special_allowance: number;
  deductions: number;
}

export const reviseSalary = (userId: number, data: SalaryRevisePayload) =>
  apiFetch<{ ok: boolean; effective_date: string }>(`${BASE}/salary-master/${userId}/revise`, {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const getSalaryHistory = (userId: number) =>
  apiFetch<SalaryHistoryEntry[]>(`${BASE}/salary-master/${userId}/history`);
```

- [ ] **Step 4: Update `calcNetPay` to include arrears**

In `frontend/src/utils/payroll.ts`, update `calcNetPay`:

```typescript
import type { PayrollRecord } from '../api/payroll';

export function calcNetPay(r: PayrollRecord): number {
  return (
    r.gross_salary -
    r.lop_deduction +
    r.arrears -
    r.epf_employee -
    r.esic_employee -
    r.lwf_employee -
    r.prof_tax -
    r.tds_deduction -
    r.advance_deduction -
    r.deductions
  );
}
```

- [ ] **Step 5: Run TypeScript check**

```bash
cd frontend && npx tsc --noEmit
```
Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/api/payroll.ts frontend/src/utils/payroll.ts
git commit -m "feat: add SalaryHistoryEntry type, reviseSalary/getSalaryHistory API functions, include arrears in calcNetPay"
```

---

## Task 7: SalaryMasterPage — Revise + History panels

**Files:**
- Modify: `frontend/src/pages/SalaryMasterPage.tsx`

The current page has an inline Edit row. Replace the Edit button with two buttons (Revise, History) and add two inline expansion panels below each employee row.

- [ ] **Step 1: Update imports**

Replace the existing import block:

```typescript
import React, { useState, useEffect, useCallback } from 'react';
import AppLayout from '../components/shared/AppLayout';
import {
  getSalaryMaster, reviseSalary, getSalaryHistory,
  type SalaryMasterEntry, type SalaryHistoryEntry, type SalaryRevisePayload,
} from '../api/payroll';
```

- [ ] **Step 2: Replace state declarations**

Replace the existing state declarations with:

```typescript
const [salaryMaster, setSalaryMaster] = useState<SalaryMasterEntry[]>([]);
const [loading, setLoading] = useState(true);
const [msg, setMsg] = useState('');
const [error, setError] = useState('');

// Revise panel state
const [reviseOpenId, setReviseOpenId] = useState<number | null>(null);
const [reviseForm, setReviseForm] = useState<Record<number, {
  effective_date: string;
  basic_salary: string;
  hra: string;
  meal_allowance: string;
  conveyance_allowance: string;
  special_allowance: string;
}>>({});
const [reviseSaving, setReviseSaving] = useState(false);

// History panel state
const [historyOpenId, setHistoryOpenId] = useState<number | null>(null);
const [historyData, setHistoryData] = useState<Record<number, SalaryHistoryEntry[]>>({});
const [historyLoading, setHistoryLoading] = useState<number | null>(null);
```

- [ ] **Step 3: Replace helper functions**

Replace all the old helper functions (`flash`, `loadSalaryMaster`, `startSmEdit`, `handleSmSave`, `tdNum`) with:

```typescript
const flash = (m: string, isErr = false) => {
  if (isErr) { setError(m); setTimeout(() => setError(''), 4000); }
  else { setMsg(m); setTimeout(() => setMsg(''), 3000); }
};

const loadSalaryMaster = useCallback(async () => {
  setLoading(true);
  try { setSalaryMaster(await getSalaryMaster()); }
  finally { setLoading(false); }
}, []);

useEffect(() => { loadSalaryMaster(); }, [loadSalaryMaster]);

const nextMonthFirst = () => {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + 1);
  return d.toISOString().slice(0, 10);
};

const openRevise = (entry: SalaryMasterEntry) => {
  setHistoryOpenId(null);
  setReviseOpenId(prev => prev === entry.employee_id ? null : entry.employee_id);
  setReviseForm(prev => ({
    ...prev,
    [entry.employee_id]: {
      effective_date:      nextMonthFirst(),
      basic_salary:        String(entry.basic_salary),
      hra:                 String(entry.hra),
      meal_allowance:      String(entry.meal_allowance),
      conveyance_allowance: String(entry.conveyance_allowance),
      special_allowance:   String(entry.special_allowance),
    },
  }));
};

const openHistory = async (entry: SalaryMasterEntry) => {
  setReviseOpenId(null);
  if (historyOpenId === entry.employee_id) { setHistoryOpenId(null); return; }
  setHistoryOpenId(entry.employee_id);
  if (historyData[entry.employee_id]) return; // already loaded
  setHistoryLoading(entry.employee_id);
  try {
    const rows = await getSalaryHistory(entry.employee_id);
    setHistoryData(prev => ({ ...prev, [entry.employee_id]: rows }));
  } finally { setHistoryLoading(null); }
};

const handleRevise = async (employeeId: number) => {
  const f = reviseForm[employeeId];
  if (!f) return;
  if (!f.effective_date) { flash('Effective date is required', true); return; }
  setReviseSaving(true);
  try {
    const payload: SalaryRevisePayload = {
      effective_date:      f.effective_date,
      basic_salary:        Number(f.basic_salary)        || 0,
      hra:                 Number(f.hra)                  || 0,
      meal_allowance:      Number(f.meal_allowance)      || 0,
      conveyance_allowance: Number(f.conveyance_allowance) || 0,
      special_allowance:   Number(f.special_allowance)   || 0,
      deductions:          0,
    };
    await reviseSalary(employeeId, payload);
    setReviseOpenId(null);
    // Bust history cache for this employee
    setHistoryData(prev => { const n = { ...prev }; delete n[employeeId]; return n; });
    await loadSalaryMaster();
    flash('Salary revision saved');
  } catch (e: unknown) {
    flash(e instanceof Error ? e.message : 'Save failed', true);
  } finally { setReviseSaving(false); }
};
```

- [ ] **Step 4: Replace the JSX return**

Replace everything inside `<AppLayout>` with:

```tsx
<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
  <div>
    <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#111827' }}>Salary Master</h2>
    <p style={{ margin: '2px 0 0', fontSize: 13, color: '#6b7280' }}>
      Set each employee's base salary components. Use Revise to add effective-dated changes.
    </p>
  </div>
</div>

{msg && (
  <div style={{ marginBottom: 14, padding: '10px 16px', borderRadius: 8, background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', fontSize: 13 }}>
    {msg}
  </div>
)}
{error && (
  <div style={{ marginBottom: 14, padding: '10px 16px', borderRadius: 8, background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', fontSize: 13 }}>
    {error}
  </div>
)}

{loading ? (
  <p style={{ color: '#9ca3af', fontSize: 14 }}>Loading…</p>
) : (
  <div style={{ background: '#fff', borderRadius: 14, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
    <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
      <colgroup>
        <col style={{ width: '7%' }} />
        <col style={{ width: '14%' }} />
        <col style={{ width: '10%' }} />
        <col style={{ width: '10%' }} />
        <col style={{ width: '9%' }} />
        <col style={{ width: '7%' }} />
        <col style={{ width: '8%' }} />
        <col style={{ width: '8%' }} />
        <col style={{ width: '9%' }} />
        <col style={{ width: '8%' }} />
        <col style={{ width: '10%' }} />
      </colgroup>
      <thead>
        <tr style={{ background: '#f9fafb' }}>
          {['Emp ID', 'Employee', 'Designation', 'Gross', 'Basic', 'HRA', 'Meal', 'Conv.', 'Special', 'Updated', ''].map(h => (
            <th key={h} style={{ padding: '9px 8px', textAlign: h === '' ? 'center' : 'left', fontSize: 10, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {salaryMaster.map(entry => {
          const gross = entry.basic_salary + entry.hra + entry.meal_allowance + entry.conveyance_allowance + entry.special_allowance;
          const isReviseOpen  = reviseOpenId  === entry.employee_id;
          const isHistoryOpen = historyOpenId === entry.employee_id;
          const rf = reviseForm[entry.employee_id];
          const reviseGross = rf
            ? (Number(rf.basic_salary) || 0) + (Number(rf.hra) || 0) + (Number(rf.meal_allowance) || 0) + (Number(rf.conveyance_allowance) || 0) + (Number(rf.special_allowance) || 0)
            : 0;

          return (
            <React.Fragment key={entry.employee_id}>
              {/* Main row */}
              <tr style={{ borderTop: '1px solid #f3f4f6', background: (isReviseOpen || isHistoryOpen) ? '#faf5ff' : 'transparent' }}>
                <td style={{ padding: '10px 8px', fontSize: 12, color: '#6b7280', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {entry.emp_id ?? <span style={{ color: '#d1d5db' }}>—</span>}
                </td>
                <td style={{ padding: '10px 8px', fontSize: 12, fontWeight: 600, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={entry.employee_name}>{entry.employee_name}</td>
                <td style={{ padding: '10px 8px', fontSize: 11, color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.employee_designation || entry.employee_role}</td>
                <td style={{ padding: '10px 8px', fontSize: 12, fontWeight: 600, color: gross > 0 ? '#1e40af' : '#d1d5db', textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {gross > 0 ? fmt(gross) : '—'}
                </td>
                {[entry.basic_salary, entry.hra, entry.meal_allowance, entry.conveyance_allowance, entry.special_allowance].map((v, i) => (
                  <td key={i} style={{ padding: '10px 8px', fontSize: 12, color: v > 0 ? '#374151' : '#d1d5db', textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {v > 0 ? fmt(v) : '—'}
                  </td>
                ))}
                <td style={{ padding: '10px 8px', fontSize: 11, color: '#9ca3af', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {entry.updated_at ? new Date(entry.updated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—'}
                </td>
                <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                  <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                    <button onClick={() => openRevise(entry)} style={{
                      padding: '3px 8px', borderRadius: 6, border: 'none', cursor: 'pointer',
                      background: isReviseOpen ? '#6d28d9' : '#ede9fe',
                      color: isReviseOpen ? '#fff' : '#6d28d9', fontWeight: 600, fontSize: 11,
                    }}>Revise</button>
                    <button onClick={() => openHistory(entry)} style={{
                      padding: '3px 8px', borderRadius: 6, border: '1px solid #e5e7eb', cursor: 'pointer',
                      background: isHistoryOpen ? '#f3f4f6' : '#fff',
                      color: '#6b7280', fontSize: 11,
                    }}>History</button>
                  </div>
                </td>
              </tr>

              {/* Revise panel */}
              {isReviseOpen && rf && (
                <tr>
                  <td colSpan={11} style={{ padding: '0', borderTop: '1px solid #ede9fe' }}>
                    <div style={{ padding: '14px 16px', background: '#faf5ff' }}>
                      <p style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 600, color: '#6d28d9' }}>New Salary Revision</p>
                      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                        <label style={{ fontSize: 11, color: '#6b7280' }}>
                          Effective Date *
                          <input type="date" value={rf.effective_date}
                            onChange={e => setReviseForm(p => ({ ...p, [entry.employee_id]: { ...p[entry.employee_id], effective_date: e.target.value } }))}
                            style={{ display: 'block', marginTop: 3, padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 12 }} />
                        </label>
                        {([
                          ['Basic', 'basic_salary'],
                          ['HRA', 'hra'],
                          ['Meal Allow.', 'meal_allowance'],
                          ['Conv. Allow.', 'conveyance_allowance'],
                          ['Special Allow.', 'special_allowance'],
                        ] as const).map(([label, field]) => (
                          <label key={field} style={{ fontSize: 11, color: '#6b7280' }}>
                            {label}
                            <input type="number" min="0" value={rf[field]}
                              onChange={e => setReviseForm(p => ({ ...p, [entry.employee_id]: { ...p[entry.employee_id], [field]: e.target.value } }))}
                              style={{ display: 'block', marginTop: 3, width: 80, padding: '4px 6px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 12, textAlign: 'right' }} />
                          </label>
                        ))}
                        <div style={{ fontSize: 11, color: '#6b7280' }}>
                          New Gross
                          <div style={{ marginTop: 3, padding: '4px 8px', fontSize: 13, fontWeight: 700, color: '#1e40af' }}>
                            {fmt(reviseGross)}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
                          <button onClick={() => handleRevise(entry.employee_id)} disabled={reviseSaving} style={{
                            padding: '5px 14px', borderRadius: 6, border: 'none', cursor: 'pointer',
                            background: '#6d28d9', color: '#fff', fontWeight: 600, fontSize: 12,
                            opacity: reviseSaving ? 0.6 : 1,
                          }}>{reviseSaving ? 'Saving…' : 'Save Revision'}</button>
                          <button onClick={() => setReviseOpenId(null)} style={{
                            padding: '5px 10px', borderRadius: 6, border: '1px solid #d1d5db', cursor: 'pointer',
                            background: '#fff', color: '#6b7280', fontSize: 12,
                          }}>Cancel</button>
                        </div>
                      </div>
                    </div>
                  </td>
                </tr>
              )}

              {/* History panel */}
              {isHistoryOpen && (
                <tr>
                  <td colSpan={11} style={{ padding: '0', borderTop: '1px solid #ede9fe' }}>
                    <div style={{ padding: '14px 16px', background: '#f9fafb' }}>
                      <p style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 600, color: '#374151' }}>Salary Revision History</p>
                      {historyLoading === entry.employee_id ? (
                        <p style={{ color: '#9ca3af', fontSize: 13 }}>Loading…</p>
                      ) : !historyData[entry.employee_id] || historyData[entry.employee_id].length === 0 ? (
                        <p style={{ color: '#9ca3af', fontSize: 13 }}>No revisions recorded yet.</p>
                      ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                          <thead>
                            <tr>
                              {['Effective Date', 'Basic', 'HRA', 'Meal', 'Conv.', 'Special', 'Gross', 'Revised By', 'On'].map(h => (
                                <th key={h} style={{ padding: '5px 8px', textAlign: 'left', fontSize: 10, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', borderBottom: '1px solid #e5e7eb' }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {historyData[entry.employee_id].map(h => {
                              const hGross = h.basic_salary + h.hra + h.meal_allowance + h.conveyance_allowance + h.special_allowance;
                              return (
                                <tr key={h.id} style={{ borderTop: '1px solid #f3f4f6' }}>
                                  <td style={{ padding: '6px 8px', fontWeight: 600, color: '#111827' }}>
                                    {new Date(h.effective_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                    {h.arrears_processed && <span style={{ marginLeft: 6, fontSize: 10, color: '#16a34a', background: '#dcfce7', borderRadius: 4, padding: '1px 5px' }}>Arrears Paid</span>}
                                  </td>
                                  <td style={{ padding: '6px 8px', color: '#374151', textAlign: 'right' }}>{fmt(h.basic_salary)}</td>
                                  <td style={{ padding: '6px 8px', color: '#374151', textAlign: 'right' }}>{h.hra > 0 ? fmt(h.hra) : '—'}</td>
                                  <td style={{ padding: '6px 8px', color: '#374151', textAlign: 'right' }}>{h.meal_allowance > 0 ? fmt(h.meal_allowance) : '—'}</td>
                                  <td style={{ padding: '6px 8px', color: '#374151', textAlign: 'right' }}>{h.conveyance_allowance > 0 ? fmt(h.conveyance_allowance) : '—'}</td>
                                  <td style={{ padding: '6px 8px', color: '#374151', textAlign: 'right' }}>{h.special_allowance > 0 ? fmt(h.special_allowance) : '—'}</td>
                                  <td style={{ padding: '6px 8px', fontWeight: 600, color: '#1e40af', textAlign: 'right' }}>{fmt(hGross)}</td>
                                  <td style={{ padding: '6px 8px', color: '#6b7280' }}>{h.created_by_name ?? '—'}</td>
                                  <td style={{ padding: '6px 8px', color: '#9ca3af', whiteSpace: 'nowrap' }}>
                                    {new Date(h.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </React.Fragment>
          );
        })}
      </tbody>
    </table>
  </div>
)}
```

- [ ] **Step 5: Run TypeScript check**

```bash
cd frontend && npx tsc --noEmit
```
Expected: No errors.

- [ ] **Step 6: Verify in browser**

1. Open Salary Master page.
2. Click **Revise** on any employee → inline form appears with today+1 month as default date, current values pre-filled.
3. Change values, click Save Revision → flash "Salary revision saved", form closes, gross column updates if effective_date ≤ today.
4. Click **History** → table loads showing the revision just saved.
5. Click **Revise** again → revise panel closes.
6. Click **History** again → history panel closes.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/pages/SalaryMasterPage.tsx
git commit -m "feat: replace inline edit on SalaryMasterPage with Revise (effective-date form) and History panels"
```

---

## Task 8: PayrollCTCTable — Arrears column

**Files:**
- Modify: `frontend/src/components/payroll/PayrollCTCTable.tsx`

- [ ] **Step 1: Add arrears entry to TIPS**

In the `TIPS` constant, add after the `earnedGross` entry:

```typescript
arrears: 'Retroactive salary difference for past months where a revision was effective but payroll had already been processed. Paid out as a lump sum in this month\'s run.',
```

- [ ] **Step 2: Update the Earnings group colSpan**

Find the group header `<th>` for "Earnings" (the one with `colSpan`). Increase its `colSpan` by 1 (adding the Arrears column). The current Earnings columns are: basic, allowances, gross, lopDeduction, earnedGross — that's 5. After adding arrears it becomes 6.

- [ ] **Step 3: Add Arrears column header**

After the `<InfoTh>` for `earnedGross`, add:

```tsx
<InfoTh label="Arrears" tip={TIPS.arrears} thStyle={thStyle} onInfo={handleInfo} />
```

- [ ] **Step 4: Add Arrears data cell in each row**

After the `earnedGross` `<td>`, add:

```tsx
<td style={{ ...tdStyle, color: r.arrears > 0 ? '#d97706' : r.arrears < 0 ? '#dc2626' : '#d1d5db', textAlign: 'right' }}>
  {r.arrears !== 0 ? fmt(r.arrears) : '—'}
</td>
```

- [ ] **Step 5: Run TypeScript check**

```bash
cd frontend && npx tsc --noEmit
```
Expected: No errors.

- [ ] **Step 6: Verify in browser**

1. Generate payroll for a month where an employee has an unprocessed retroactive revision.
2. Open the Payroll page → the Arrears column shows a non-zero value in amber.
3. Hover the ⓘ on Arrears → tooltip explains the field.
4. Employees with no arrears show "—" in the column.
5. The "Total Net Payout" summary card correctly includes arrears (via updated `calcNetPay`).

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/payroll/PayrollCTCTable.tsx
git commit -m "feat: add Arrears column to PayrollCTCTable with tooltip and amber highlighting"
```
