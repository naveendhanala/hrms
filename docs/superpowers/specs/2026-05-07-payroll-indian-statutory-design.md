# Payroll Tab — Indian Statutory Compliance & CTC Redesign

**Date:** 2026-05-07
**Status:** Approved for implementation

---

## 1. Overview

Extend the existing Payroll module to support the full Indian statutory compliance suite: EPF, ESIC, LWF, and Gratuity. Redesign the payroll table around a full CTC view. Add downloadable payslip PDFs and compliance export files (ECR, ESI challan, LWF statement).

---

## 2. Architecture

### New Sub-pages (Payroll menu)
| Route | Page | Description |
|---|---|---|
| `/payroll` | PayrollPage (restructured) | CTC-grouped payroll table |
| `/payroll/gratuity` | GratuityPage (new) | Accruals, eligibility, disbursements |
| `/payroll/configurations` | ConfigurationsPage (extended) | + LWF by state + Employee statutory config |

### Existing pages unchanged
- `/payroll/salary-master`
- `/payroll/advances`
- `/payroll/tax-computation`

---

## 3. Statutory Calculation Rules

### EPF (Employee Provident Fund)
- **Employee contribution:** 12% of Basic Salary
- **Employer EPF contribution:** 3.67% of Basic Salary
- **Employer EPS contribution:** 8.33% of Basic Salary
- **Wage ceiling:** Both employee and employer contributions capped at Basic Salary of ₹15,000 (max employee EPF = ₹1,800/month)
- **Exemption:** Skipped if employee is flagged `epf_exempt` in statutory config

### ESIC (Employee State Insurance)
- **Applicability:** Only when employee's gross salary ≤ ₹21,000/month
- **Employee contribution:** 0.75% of gross salary
- **Employer contribution:** 3.25% of gross salary
- **Exemption:** Skipped if employee is flagged `esic_exempt` in statutory config
- **Display:** Show "N/A" in payroll table and payslip when not applicable

### LWF (Labour Welfare Fund)
- **Amounts:** Configurable per state in the `lwf_by_state` table (employee amount + employer amount)
- **Frequency:** Configurable per state (Monthly / Half-Yearly / Annually); applicable months: Monthly = every month, Half-Yearly = June and December, Annually = December only
- **Auto-apply:** Based on employee's registered state
- **Exemption:** Skipped if employee is flagged `lwf_exempt` in statutory config
- **States without LWF:** Leave `lwf_by_state` entry at ₹0 or omit; system treats as ₹0

### Gratuity Provision (monthly)
- **Formula:** `(Basic Salary × 15) / 26 / 12`
- **Nature:** Employer cost only — not deducted from employee salary
- **Eligibility for payout:** Employee must have ≥ 5 years of continuous service
- **Tracked in:** `gratuity_accruals` table (monthly) and `gratuity_disbursements` table (on exit)

---

## 4. Database Changes

### Modified table: `payroll_records`
Add columns:
```sql
epf_employee        NUMERIC(10,2) DEFAULT 0,
epf_employer        NUMERIC(10,2) DEFAULT 0,
eps_employer        NUMERIC(10,2) DEFAULT 0,
esic_employee       NUMERIC(10,2) DEFAULT 0,
esic_employer       NUMERIC(10,2) DEFAULT 0,
lwf_employee        NUMERIC(10,2) DEFAULT 0,
lwf_employer        NUMERIC(10,2) DEFAULT 0,
gratuity_provision  NUMERIC(10,2) DEFAULT 0
```

### Extended table: `payroll_config`
Add keys to the existing key-value `payroll_config` table:
- `company_name` — displayed on payslip header
- `company_address` — displayed on payslip header
- `pf_registration_number` — PF reg no. on payslip
- `esic_registration_number` — ESIC reg no. on payslip
- `hr_email` — shown in payslip footer

These are configured via the existing Configurations page (new "Company Info" section in the General tab).

### New table: `lwf_by_state`
```sql
CREATE TABLE lwf_by_state (
  id               SERIAL PRIMARY KEY,
  state            TEXT UNIQUE NOT NULL,
  employee_amount  NUMERIC(10,2) NOT NULL DEFAULT 0,
  employer_amount  NUMERIC(10,2) NOT NULL DEFAULT 0,
  frequency        TEXT NOT NULL DEFAULT 'monthly' -- 'monthly' | 'half_yearly' | 'annually'
);
```

### New table: `employee_statutory_config`
```sql
CREATE TABLE employee_statutory_config (
  id           SERIAL PRIMARY KEY,
  employee_id  INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  uan_number   TEXT,
  esic_number  TEXT,
  pan_number   TEXT,
  epf_exempt   BOOLEAN NOT NULL DEFAULT false,
  esic_exempt  BOOLEAN NOT NULL DEFAULT false,
  lwf_exempt   BOOLEAN NOT NULL DEFAULT false,
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);
```

### New table: `gratuity_accruals`
```sql
CREATE TABLE gratuity_accruals (
  id                SERIAL PRIMARY KEY,
  run_id            INTEGER REFERENCES payroll_runs(id) ON DELETE CASCADE,
  employee_id       INTEGER REFERENCES users(id) ON DELETE CASCADE,
  month             INTEGER NOT NULL,
  year              INTEGER NOT NULL,
  basic_salary      NUMERIC(10,2) NOT NULL,
  provision_amount  NUMERIC(10,2) NOT NULL,
  cumulative_amount NUMERIC(12,2) NOT NULL,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(run_id, employee_id)
);
```

### New table: `gratuity_disbursements`
```sql
CREATE TABLE gratuity_disbursements (
  id              SERIAL PRIMARY KEY,
  employee_id     INTEGER REFERENCES users(id) ON DELETE CASCADE,
  exit_date       DATE NOT NULL,
  years_of_service NUMERIC(5,2) NOT NULL,
  accrued_amount  NUMERIC(12,2) NOT NULL,
  paid_amount     NUMERIC(12,2) NOT NULL,
  payment_date    DATE NOT NULL,
  recorded_by     INTEGER REFERENCES users(id),
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 5. Backend API Changes

### Extended payroll generation (`POST /api/payroll`)
Generation logic extended to:
1. Load `employee_statutory_config` for all employees (exemption flags, UAN, ESIC numbers)
2. Load `lwf_by_state` config
3. Calculate EPF employee/employer/EPS per employee (respecting exemption + ₹15,000 ceiling)
4. Calculate ESIC employee/employer per employee (only if gross ≤ ₹21,000 and not exempt)
5. Calculate LWF employee/employer per employee (by state, respecting frequency + exemption)
6. Calculate gratuity provision per employee
7. Insert all new columns into `payroll_records`
8. Insert rows into `gratuity_accruals`

### New endpoints
| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/payroll/:runId/payslip/:employeeId` | Generate payslip PDF |
| GET | `/api/payroll/:runId/export/ecr` | Download ECR 2.0 text file |
| GET | `/api/payroll/:runId/export/esic` | Download ESI challan CSV |
| GET | `/api/payroll/:runId/export/lwf` | Download LWF statement CSV |
| GET | `/api/payroll/statutory-config` | Get all employee statutory configs |
| PUT | `/api/payroll/statutory-config/:userId` | Update employee statutory config |
| GET | `/api/payroll/lwf-states` | Get LWF by state config |
| PUT | `/api/payroll/lwf-states` | Update LWF for a state |
| GET | `/api/payroll/gratuity/accruals` | Get all gratuity accruals |
| GET | `/api/payroll/gratuity/disbursements` | Get disbursement records |
| POST | `/api/payroll/gratuity/disbursements` | Record a gratuity disbursement |

### Payslip PDF generation
Use `pdfkit` or `puppeteer` (HTML-to-PDF) on the backend. Template mirrors the designed payslip layout: company header, employee info, attendance strip, earnings, employee deductions, net pay highlight, employer contributions, CTC summary footer.

### ECR File format (EPF)
Tab-delimited `.txt` per EPFO ECR 2.0 spec:
```
UAN | MemberName | GrossWages | EPFWages | EPSWages | EDLIWages | EPFContrib | EPSContrib | EPFEmployer | NCPDays | RefundOfAdvances
```

### ESI Challan CSV
```
ESICNumber | EmployeeName | GrossWages | EmployeeContrib | EmployerContrib | TotalContrib
```

### LWF Statement CSV
```
EmployeeID | EmployeeName | State | EmployeeContrib | EmployerContrib | Total
```

---

## 6. Frontend Changes

### PayrollPage — CTC Grouped Table
Replace the flat column layout with 6 grouped column sections:

| Group | Columns | Color indicator |
|---|---|---|
| Employee Info | Emp ID, Name, Designation, State | — |
| Attendance | Working Days, Present, Leave, Absent, LOP Days | — |
| Earnings | Basic, Allowances, Gross | — |
| Employee Deductions | LOP Ded., EPF (12%), ESIC (0.75%), LWF, Prof Tax, TDS, Advance | Red |
| Employer Contributions | EPF Employer (3.67%), EPS (8.33%), ESIC Employer (3.25%), LWF Employer, Gratuity Provision | Orange |
| Net Pay & CTC | Net Salary, Employer Cost, Total CTC | Green / Purple |

- Group headers span their columns with distinct background colors
- "N/A" displayed (not ₹0) in ESIC columns for exempt/over-ceiling employees
- Exports dropdown button added to the action bar (visible when run status is "processed" or "paid")
- Per-row payslip download icon in the rightmost column

### GratuityPage (`/payroll/gratuity`)
Three tabs:

**Accruals** — Table: Employee Name, Emp ID, Date of Joining, Years of Service, Monthly Provision, Cumulative Accrued, Eligibility Badge (green "Eligible" ≥5yr / grey "Accruing")

**Eligibility** — Filtered to employees ≥ 5 years service. Columns: Name, Date of Joining, Years of Service, Accrued Amount, "Record Disbursement" action button.

**Disbursements** — Audit log: Employee Name, Exit Date, Years of Service, Accrued Amount, Paid Amount, Payment Date, Recorded By. "Add Disbursement" button opens a modal form.

### ConfigurationsPage — New Tabs

**LWF by State** — Same table pattern as existing Prof Tax by State. Columns: State, Employee Amount (₹), Employer Amount (₹), Frequency (dropdown: Monthly/Half-Yearly/Annually), Edit/Save inline.

**Employee Statutory Config** — Table of all employees. Columns: Name, UAN Number (editable), ESIC Number (editable), PAN Number (editable), EPF Exempt (toggle), ESIC Exempt (toggle), LWF Exempt (toggle). Inline edit + save per row.

---

## 7. Payslip Design

Single-page PDF with these sections (top to bottom):
1. **Company header** — Logo placeholder, company name, address, PF registration number, ESIC registration number
2. **Payslip title + period** — "PAYSLIP — April 2025", generation date
3. **Employee info grid** — Name, Emp ID, Designation, Department, UAN, PAN, Bank account (masked), Tax regime
4. **Attendance strip** — Working Days | Present | Leave | Absent | LOP Days (5-cell horizontal bar)
5. **Earnings + Employee Deductions** — Two-column layout side by side
   - Earnings: Basic, HRA, Conveyance, Meal, Special Allowance → Gross → LOP deduction → Earned Salary
   - Employee Deductions: EPF, ESIC (or N/A), LWF, Prof Tax, TDS, Advance → Total Deductions
6. **Net Take-Home** — Full-width dark highlight bar showing net salary
7. **Employer Contributions** — Bordered section: EPF Employer, EPS, ESIC Employer (or N/A), LWF Employer, Gratuity Provision → Total Employer Contributions
8. **CTC Summary** — Three cards: Net Salary (green) | Employer Cost (orange) | Total CTC (purple)
9. **Footer** — "Computer-generated payslip, no signature required" + HR contact email

---

## 8. Implementation Scope Summary

**Backend:**
- Migrate `payroll_records` table (add 8 columns)
- Create 4 new tables: `lwf_by_state`, `employee_statutory_config`, `gratuity_accruals`, `gratuity_disbursements`
- Extend payroll generation logic with statutory calculations
- Add 11 new API endpoints
- Add PDF generation dependency (`pdfkit` or `puppeteer`)

**Frontend:**
- Restructure `PayrollPage` table (grouped columns, exports dropdown, per-row payslip download)
- New `GratuityPage` with 3 tabs
- Extend `ConfigurationsPage` with 2 new tabs
- New API client functions for all new endpoints

**Not in scope:**
- Form 16 generation
- Payroll bank transfer file (NEFT/RTGS)
- Employee self-service payslip portal
- Automated EPFO/ESIC portal integration
