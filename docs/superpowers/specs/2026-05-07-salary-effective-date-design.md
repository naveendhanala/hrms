# Salary Effective Date Implementation Design

## Goal

Support salary revisions with an effective date, enabling mid-month proration (salary before and after the effective date computed separately) and retroactive arrears (difference for already-processed months paid out as a separate line item in the current payroll run).

## Architecture

Option A: add a `salary_master_history` append-only table alongside the existing `salary_master`. `salary_master` remains as a current-snapshot for backward compatibility with all existing reads. History drives payroll generation logic for proration and arrears. A single new `arrears` column is added to `payroll_records`.

## Tech Stack

PostgreSQL, Express/TypeScript backend, React/TypeScript frontend, pdfkit for payslip PDF.

---

## 1. Data Model

### New table: `salary_master_history`

```sql
CREATE TABLE salary_master_history (
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
);
CREATE INDEX idx_smh_employee ON salary_master_history(employee_id);
CREATE INDEX idx_smh_effective ON salary_master_history(employee_id, effective_date);
```

`arrears_processed`: flipped to `true` when this revision's arrears are included in a payroll run, preventing double-counting in future runs.

### Modified table: `payroll_records`

Add one column:
```sql
ALTER TABLE payroll_records ADD COLUMN arrears REAL NOT NULL DEFAULT 0;
```

### `salary_master` — no structural change

When HR saves a revision:
- Always insert a row into `salary_master_history`.
- If `effective_date <= today`, also update the matching row in `salary_master` (existing upsert).
- If `effective_date > today`, leave `salary_master` unchanged (future revision; nightly job or payroll generation will apply it when the date arrives).

---

## 2. Payroll Generation Logic

For each employee when generating payroll for month M / year Y:

### Step 1: Determine base salary

Query `salary_master_history` for the latest revision with `effective_date <= last day of M`. If none exists, fall back to `salary_master`. This is the "active" salary for this month.

### Step 2: Check for mid-month revision

Query `salary_master_history` for any row where `effective_date` falls strictly within month M (i.e., `>= 1st of M` and `<= last day of M`).

- **No mid-month revision:** use the active salary for the full month (standard path).
- **One mid-month revision found:**
  - `days_before` = effective_date day-of-month minus 1 (days under old salary)
  - `days_from` = working_days − days_before (days under new salary)
  - Old salary = the revision immediately before this one (or `salary_master` snapshot if no prior history)
  - `gross = (old_gross / working_days × days_before) + (new_gross / working_days × days_from)`
  - All statutory components (EPF, ESIC, LWF, Prof Tax) are computed on the blended gross using the new salary's components as basis (since the new salary is the one in effect at month-end, which determines EPF cap, ESIC eligibility, etc.).

### Step 3: Compute retroactive arrears

Query `salary_master_history` for all rows where:
- `employee_id = this employee`
- `effective_date < 1st of M` (revision is in a past month)
- `arrears_processed = FALSE`

For each such unprocessed revision:
1. Determine the month it falls in (call it month P).
2. Find the old salary in effect before this revision (prior history row or salary_master at time of revision).
3. `days_under_new = working_days_in_P - (effective_date day-of-month - 1)`
4. `old_gross_P = old basic + hra + meal + conveyance + special`
5. `new_gross_P = new basic + hra + meal + conveyance + special`
6. `arrears_for_P = (new_gross_P - old_gross_P) / working_days_in_P × days_under_new`

Sum arrears across all unprocessed revisions → `payroll_records.arrears`.

After inserting the payroll record, mark all processed revisions as `arrears_processed = TRUE` in the same DB transaction.

### Constraint: at most one revision per employee per month

The `UNIQUE(employee_id, effective_date)` constraint plus application-level validation ensures no two revisions share the same date. If two revisions fall in the same calendar month, the second insert will be rejected with a user-facing error: "A salary revision already exists for this employee in that month."

---

## 3. API Changes

### New endpoint: `POST /api/payroll/salary-master/:userId/revise`

Request body:
```json
{
  "effective_date": "2026-05-15",
  "basic_salary": 30000,
  "hra": 12000,
  "meal_allowance": 2000,
  "conveyance_allowance": 1600,
  "special_allowance": 5000,
  "deductions": 0
}
```

- Validates `effective_date` is a valid date.
- Validates no existing revision in the same calendar month for this employee.
- Inserts into `salary_master_history`.
- If `effective_date <= today`, also upserts `salary_master`.
- Returns `{ ok: true, effective_date }`.

### New endpoint: `GET /api/payroll/salary-master/:userId/history`

Returns all `salary_master_history` rows for the employee, ordered by `effective_date DESC`. Includes `created_by_name` via join with `users`.

### Existing `PUT /api/payroll/salary-master/:userId`

Retained for backward compatibility but now also inserts a history row with `effective_date = today` if none exists for today. In practice, the UI will route all changes through the new revise endpoint.

---

## 4. Frontend Changes

### `SalaryMasterPage.tsx`

- Each employee row gets two action buttons: **Revise Salary** and **History**.
- **Revise Salary** expands an inline panel below the row containing:
  - Date input for effective date (defaults to 1st of next month)
  - All salary component fields pre-filled with current values
  - Gross preview (computed live as fields change)
  - Save / Cancel
- **History** expands a secondary panel showing a table of past revisions:
  - Columns: Effective Date, Basic, Gross, Revised By, Revised On
  - Ordered newest first

### `PayrollCTCTable.tsx`

- New **Arrears** column added in the earnings section (after Earned Gross, before employee deductions).
- Column header gets an ⓘ tooltip: `"Retroactive salary difference for past months where a revision was effective but the payroll had already been processed. Paid out in this month's run."`
- Displayed as ₹0 when zero, non-zero highlighted in amber.

### `frontend/src/api/payroll.ts`

- Add `reviseSalary(userId, data)` → `POST /api/payroll/salary-master/:userId/revise`
- Add `getSalaryHistory(userId)` → `GET /api/payroll/salary-master/:userId/history`
- Add `arrears: number` to `PayrollRecord` interface

### Payslip PDF (backend)

- After the Earned Gross line, conditionally render: `Salary Arrears (Mon YYYY): ₹X,XXX` when `arrears > 0`.
- The month label in the arrears line comes from the earliest unprocessed revision month (or "Prior Months" if spanning multiple).

---

## 5. Error Handling

| Scenario | Handling |
|----------|----------|
| Two revisions in same calendar month | 409 with message "A salary revision already exists for this employee in [Month Year]" |
| effective_date missing or invalid | 400 with message "effective_date must be a valid date (YYYY-MM-DD)" |
| Negative arrears (salary reduction) | Allowed — arrears will be a negative number, reducing net pay. Frontend shows in red. |
| No prior history found when computing arrears | Fall back to salary_master values as "old salary" |

---

## 6. Out of Scope

- Nightly job to auto-apply future-dated revisions to salary_master (revisions with effective_date > today are applied at payroll generation time, not automatically on the day).
- Multiple revisions within the same calendar month.
- Reverting / deleting a salary revision after it has been processed.
