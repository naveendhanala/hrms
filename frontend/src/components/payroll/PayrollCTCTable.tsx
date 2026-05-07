import { useState, useEffect, useCallback } from 'react';
import { downloadPayslip, type PayrollRecord } from '../../api/payroll';
import { calcNetPay } from '../../utils/payroll';

interface Props {
  records: PayrollRecord[];
  runId: number;
}

function fmt(n: number): string {
  return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function Money({ n }: { n: number }) {
  if (n === 0) return <span style={{ color: '#d1d5db' }}>—</span>;
  return <>{fmt(n)}</>;
}

interface TooltipState {
  tip: string;
  x: number;
  y: number;
}

const GROUP_TH: React.CSSProperties = {
  textAlign: 'center',
  padding: '8px 12px',
  fontSize: 11,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};

const COL_TH_BASE: React.CSSProperties = {
  padding: '10px 10px',
  fontSize: 11,
  fontWeight: 600,
  color: '#9ca3af',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  whiteSpace: 'nowrap',
  background: '#f9fafb',
};

const COL_TH_RIGHT: React.CSSProperties = {
  ...COL_TH_BASE,
  textAlign: 'right',
};

const COL_TH_LEFT: React.CSSProperties = {
  ...COL_TH_BASE,
  textAlign: 'left',
};

const TD: React.CSSProperties = {
  padding: '11px 10px',
  fontSize: 12,
  whiteSpace: 'nowrap',
};

const TD_R: React.CSSProperties = {
  ...TD,
  textAlign: 'right',
};

const TD_L: React.CSSProperties = {
  ...TD,
  textAlign: 'left',
};

const TFOOT_TD: React.CSSProperties = {
  padding: '11px 10px',
  fontSize: 12,
  fontWeight: 700,
  whiteSpace: 'nowrap',
  textAlign: 'right',
  background: '#f9fafb',
  borderTop: '2px solid #e5e7eb',
};

function calcTotalEmployeeDeductions(r: PayrollRecord): number {
  return (
    r.epf_employee +
    r.esic_employee +
    r.lwf_employee +
    r.prof_tax +
    r.tds_deduction +
    r.advance_deduction +
    r.deductions
  );
}

function calcCTC(r: PayrollRecord): number {
  return (
    r.gross_salary +
    r.epf_employer +
    r.eps_employer +
    r.esic_employer +
    r.lwf_employer +
    r.gratuity_provision
  );
}

// Renders a <th> with a small clickable ⓘ that fires onInfo with click position + tip text
function InfoTh({
  label,
  tip,
  thStyle,
  onInfo,
}: {
  label: string;
  tip: string;
  thStyle: React.CSSProperties;
  onInfo: (e: React.MouseEvent<HTMLButtonElement>, tip: string) => void;
}) {
  return (
    <th style={thStyle}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
        <span>{label}</span>
        <button
          onClick={(e) => onInfo(e, tip)}
          title={tip}
          style={{
            width: 13,
            height: 13,
            borderRadius: '50%',
            border: '1.5px solid #c4b5fd',
            background: 'transparent',
            color: '#7c3aed',
            fontSize: 8,
            fontWeight: 700,
            fontStyle: 'italic',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 0,
            lineHeight: 1,
            flexShrink: 0,
            letterSpacing: 0,
          }}
        >
          i
        </button>
      </span>
    </th>
  );
}

// Column tooltip definitions
const TIPS = {
  empId:           'Unique employee code assigned during onboarding.',
  name:            'Full legal name of the employee.',
  designation:     'Job title or designation; falls back to role if not set.',
  state:           'Work state — determines the Professional Tax slab and LWF applicability.',
  workingDays:     'Total calendar working days in this payroll month (weekends excluded).',
  present:         'Days the employee was marked present.',
  leave:           'Approved paid leave days availed — not counted as absent or LOP.',
  absent:          'Days absent without approved leave; may or may not trigger LOP depending on policy.',
  lopDays:         'Loss of Pay days — unexcused absences that trigger a proportional salary cut.',
  basic:           'Fixed basic salary component as configured in the Salary Master.',
  allowances:      'HRA + Meal Allowance + Conveyance Allowance + Special Allowance.',
  gross:           'Basic + Allowances — full contracted monthly salary before any deductions.',
  lopDeduction:    'Gross ÷ Working Days × LOP Days — proportional deduction for loss-of-pay absences.',
  earnedGross:     'Gross − LOP Deduction — the salary actually earned this month.',
  arrears:         'Retroactive salary difference for past months where a revision was effective but payroll had already been processed. Paid out as a lump sum in this month\'s run.',
  epfEmployee:     '12% of Basic (capped at ₹15,000 Basic) — Employee\'s Provident Fund contribution deducted from salary.',
  esicEmployee:    '0.75% of Earned Gross — Employee ESIC contribution; applicable only when Earned Gross ≤ ₹21,000/month.',
  lwfEmployee:     'Fixed amount set by the state government — Employee\'s Labour Welfare Fund contribution.',
  profTax:         'Professional Tax per state slab, levied on earned gross; varies by state.',
  tds:             'Tax Deducted at Source based on annualised income and the employee\'s selected tax regime (old/new).',
  advance:         'Salary advance repayment deducted this month as per the advance schedule.',
  totalDeductions: 'EPF + ESIC + LWF + Prof Tax + TDS + Advance + Other Deductions.',
  epfEmployer:     '3.67% of Basic (capped at ₹15,000) — Employer\'s EPF contribution deposited to the employee\'s PF account.',
  eps:             '8.33% of Basic (capped at ₹15,000) — Employer\'s contribution to the Employee Pension Scheme.',
  esicEmployer:    '3.25% of Earned Gross — Employer\'s ESIC contribution; applicable only when Earned Gross ≤ ₹21,000/month.',
  lwfEmployer:     'Fixed amount set by the state government — Employer\'s Labour Welfare Fund contribution.',
  gratuity:        'Basic × 15 ÷ 26 ÷ 12 — Monthly gratuity liability accrued; employee is eligible after 5 years of service.',
  netPay:          'Earned Gross − Total Employee Deductions — the actual take-home salary.',
  ctc:             'Gross + EPF Employer + EPS Employer + ESIC Employer + LWF Employer + Gratuity Provision — total cost to company.',
  payslip:         'Download the individual payslip PDF for this employee.',
} as const;

export default function PayrollCTCTable({ records, runId }: Props) {
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  const allEsicExempt = records.length > 0 && records.every(r => r.esic_exempt || (r.esic_employee === 0 && r.esic_employer === 0));

  const handleDownload = (employeeId: number) => {
    setDownloadingId(employeeId);
    downloadPayslip(runId, employeeId).finally(() => setDownloadingId(null));
  };

  const handleInfo = useCallback((e: React.MouseEvent<HTMLButtonElement>, tip: string) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltip(prev =>
      // toggle off if same tip is already open
      prev?.tip === tip ? null : { tip, x: rect.left + rect.width / 2, y: rect.bottom + 8 }
    );
  }, []);

  // Dismiss on any click outside the ⓘ buttons
  useEffect(() => {
    if (!tooltip) return;
    const dismiss = () => setTooltip(null);
    document.addEventListener('click', dismiss);
    return () => document.removeEventListener('click', dismiss);
  }, [tooltip]);

  // Totals
  const totBasic           = records.reduce((s, r) => s + r.basic_salary, 0);
  const totAllowances      = records.reduce((s, r) => s + r.allowances, 0);
  const totGross           = records.reduce((s, r) => s + r.gross_salary, 0);
  const totLopDeduction    = records.reduce((s, r) => s + r.lop_deduction, 0);
  const totEarnedGross     = records.reduce((s, r) => s + (r.gross_salary - r.lop_deduction), 0);
  const totArrears         = records.reduce((s, r) => s + (r.arrears ?? 0), 0);
  const totWorkingDays     = records.reduce((s, r) => s + r.working_days, 0);
  const totPresentDays     = records.reduce((s, r) => s + r.present_days, 0);
  const totLeaveDays       = records.reduce((s, r) => s + r.leave_days, 0);
  const totAbsentDays      = records.reduce((s, r) => s + r.absent_days, 0);
  const totLopDays         = records.reduce((s, r) => s + r.lop_days, 0);
  const totEpfEmp          = records.reduce((s, r) => s + r.epf_employee, 0);
  const totEsicEmp         = records.reduce((s, r) => s + r.esic_employee, 0);
  const totLwfEmp          = records.reduce((s, r) => s + r.lwf_employee, 0);
  const totProfTax         = records.reduce((s, r) => s + r.prof_tax, 0);
  const totTds             = records.reduce((s, r) => s + r.tds_deduction, 0);
  const totAdvance         = records.reduce((s, r) => s + r.advance_deduction, 0);
  const totTotalDeductions = records.reduce((s, r) => s + calcTotalEmployeeDeductions(r), 0);
  const totEpfErp          = records.reduce((s, r) => s + r.epf_employer, 0);
  const totEpsErp          = records.reduce((s, r) => s + r.eps_employer, 0);
  const totEsicErp         = records.reduce((s, r) => s + r.esic_employer, 0);
  const totLwfErp          = records.reduce((s, r) => s + r.lwf_employer, 0);
  const totGratuity        = records.reduce((s, r) => s + r.gratuity_provision, 0);
  const totNetPay          = records.reduce((s, r) => s + calcNetPay(r), 0);
  const totCTC             = records.reduce((s, r) => s + calcCTC(r), 0);

  return (
    <>
      {/* Fixed-position tooltip — rendered outside the scrollable container so it's never clipped */}
      {tooltip && (
        <div
          style={{
            position: 'fixed',
            top: tooltip.y,
            left: tooltip.x,
            transform: 'translateX(-50%)',
            zIndex: 9999,
            background: '#1f2937',
            color: '#f9fafb',
            fontSize: 12,
            lineHeight: 1.55,
            borderRadius: 7,
            padding: '8px 12px',
            maxWidth: 240,
            whiteSpace: 'normal',
            boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
            pointerEvents: 'none',
          }}
        >
          {/* Arrow */}
          <div style={{
            position: 'absolute',
            top: -5,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 0,
            height: 0,
            borderLeft: '5px solid transparent',
            borderRight: '5px solid transparent',
            borderBottom: '5px solid #1f2937',
          }} />
          {tooltip.tip}
        </div>
      )}

      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', minWidth: 1800, width: '100%' }}>
          <thead>
            {/* Group header row */}
            <tr>
              <th colSpan={4}  style={{ ...GROUP_TH, background: '#f5f3ff', color: '#5b21b6' }}>Employee Info</th>
              <th colSpan={5}  style={{ ...GROUP_TH, background: '#eff6ff', color: '#1d4ed8' }}>Attendance</th>
              <th colSpan={6}  style={{ ...GROUP_TH, background: '#f0fdf4', color: '#15803d' }}>Earnings</th>
              <th colSpan={7}  style={{ ...GROUP_TH, background: '#fef2f2', color: '#dc2626' }}>Employee Deductions</th>
              <th colSpan={5}  style={{ ...GROUP_TH, background: '#fff7ed', color: '#c2410c' }}>Employer Contributions</th>
              <th colSpan={3}  style={{ ...GROUP_TH, background: '#f0fdf4', color: '#15803d' }}>Net Pay &amp; CTC</th>
            </tr>
            {/* Column header row — each with an ⓘ info button */}
            <tr>
              {/* Employee Info */}
              <InfoTh label="Emp ID"      tip={TIPS.empId}       thStyle={COL_TH_LEFT}  onInfo={handleInfo} />
              <InfoTh label="Name"        tip={TIPS.name}        thStyle={COL_TH_LEFT}  onInfo={handleInfo} />
              <InfoTh label="Designation" tip={TIPS.designation} thStyle={COL_TH_LEFT}  onInfo={handleInfo} />
              <InfoTh label="State"       tip={TIPS.state}       thStyle={COL_TH_LEFT}  onInfo={handleInfo} />
              {/* Attendance */}
              <InfoTh label="Working Days" tip={TIPS.workingDays} thStyle={COL_TH_RIGHT} onInfo={handleInfo} />
              <InfoTh label="Present"      tip={TIPS.present}     thStyle={COL_TH_RIGHT} onInfo={handleInfo} />
              <InfoTh label="Leave"        tip={TIPS.leave}       thStyle={COL_TH_RIGHT} onInfo={handleInfo} />
              <InfoTh label="Absent"       tip={TIPS.absent}      thStyle={COL_TH_RIGHT} onInfo={handleInfo} />
              <InfoTh label="LOP Days"     tip={TIPS.lopDays}     thStyle={COL_TH_RIGHT} onInfo={handleInfo} />
              {/* Earnings */}
              <InfoTh label="Basic"         tip={TIPS.basic}        thStyle={COL_TH_RIGHT} onInfo={handleInfo} />
              <InfoTh label="Allowances"    tip={TIPS.allowances}   thStyle={COL_TH_RIGHT} onInfo={handleInfo} />
              <InfoTh label="Gross"         tip={TIPS.gross}        thStyle={COL_TH_RIGHT} onInfo={handleInfo} />
              <InfoTh label="LOP Deduction" tip={TIPS.lopDeduction} thStyle={COL_TH_RIGHT} onInfo={handleInfo} />
              <InfoTh label="Earned Gross"  tip={TIPS.earnedGross}  thStyle={COL_TH_RIGHT} onInfo={handleInfo} />
              <InfoTh label="Arrears"      tip={TIPS.arrears}      thStyle={COL_TH_RIGHT} onInfo={handleInfo} />
              {/* Employee Deductions */}
              <InfoTh label="EPF"              tip={TIPS.epfEmployee}     thStyle={COL_TH_RIGHT} onInfo={handleInfo} />
              <InfoTh label="ESIC"             tip={TIPS.esicEmployee}    thStyle={COL_TH_RIGHT} onInfo={handleInfo} />
              <InfoTh label="LWF"              tip={TIPS.lwfEmployee}     thStyle={COL_TH_RIGHT} onInfo={handleInfo} />
              <InfoTh label="Prof Tax"         tip={TIPS.profTax}         thStyle={COL_TH_RIGHT} onInfo={handleInfo} />
              <InfoTh label="TDS"              tip={TIPS.tds}             thStyle={COL_TH_RIGHT} onInfo={handleInfo} />
              <InfoTh label="Advance"          tip={TIPS.advance}         thStyle={COL_TH_RIGHT} onInfo={handleInfo} />
              <InfoTh label="Total Deductions" tip={TIPS.totalDeductions} thStyle={COL_TH_RIGHT} onInfo={handleInfo} />
              {/* Employer Contributions */}
              <InfoTh label="EPF"               tip={TIPS.epfEmployer} thStyle={COL_TH_RIGHT} onInfo={handleInfo} />
              <InfoTh label="EPS"               tip={TIPS.eps}         thStyle={COL_TH_RIGHT} onInfo={handleInfo} />
              <InfoTh label="ESIC"              tip={TIPS.esicEmployer} thStyle={COL_TH_RIGHT} onInfo={handleInfo} />
              <InfoTh label="LWF"               tip={TIPS.lwfEmployer} thStyle={COL_TH_RIGHT} onInfo={handleInfo} />
              <InfoTh label="Gratuity Provision" tip={TIPS.gratuity}   thStyle={COL_TH_RIGHT} onInfo={handleInfo} />
              {/* Net Pay & CTC */}
              <InfoTh label="Net Pay" tip={TIPS.netPay}  thStyle={COL_TH_RIGHT}                             onInfo={handleInfo} />
              <InfoTh label="CTC"     tip={TIPS.ctc}     thStyle={COL_TH_RIGHT}                             onInfo={handleInfo} />
              <InfoTh label="Payslip" tip={TIPS.payslip} thStyle={{ ...COL_TH_BASE, textAlign: 'center' }} onInfo={handleInfo} />
            </tr>
          </thead>

          <tbody>
            {records.map(r => {
              const earnedGross     = r.gross_salary - r.lop_deduction;
              const totalDeductions = calcTotalEmployeeDeductions(r);
              const netPay          = calcNetPay(r);
              const ctc             = calcCTC(r);
              const esicEmpDisplay  = r.esic_exempt || r.esic_employee === 0;
              const esicErpDisplay  = r.esic_exempt || r.esic_employer === 0;

              return (
                <tr key={r.id} style={{ borderTop: '1px solid #f3f4f6' }}>
                  {/* Employee Info */}
                  <td style={{ ...TD_L, color: '#6b7280', fontFamily: 'monospace' }}>
                    {r.emp_id ?? <span style={{ color: '#d1d5db' }}>—</span>}
                  </td>
                  <td style={{ ...TD_L, fontWeight: 600, color: '#111827' }}>{r.employee_name}</td>
                  <td style={{ ...TD_L, color: '#6b7280' }}>{r.employee_designation || r.employee_role}</td>
                  <td style={{ ...TD_L, color: '#6b7280' }}>
                    {r.employee_state || <span style={{ color: '#d1d5db' }}>—</span>}
                  </td>

                  {/* Attendance */}
                  <td style={{ ...TD_R, color: '#374151' }}>{r.working_days}</td>
                  <td style={{ ...TD_R, color: '#16a34a' }}>{r.present_days}</td>
                  <td style={{ ...TD_R, color: '#2563eb' }}>{r.leave_days}</td>
                  <td style={{ ...TD_R, color: '#dc2626' }}>{r.absent_days}</td>
                  <td style={{ ...TD_R, color: r.lop_days > 0 ? '#991b1b' : '#d1d5db' }}>
                    {r.lop_days > 0 ? r.lop_days : '—'}
                  </td>

                  {/* Earnings */}
                  <td style={{ ...TD_R, color: '#374151' }}><Money n={r.basic_salary} /></td>
                  <td style={{ ...TD_R, color: '#374151' }}><Money n={r.allowances} /></td>
                  <td style={{ ...TD_R, color: '#374151', fontWeight: 500 }}>{fmt(r.gross_salary)}</td>
                  <td style={{ ...TD_R, color: r.lop_deduction > 0 ? '#991b1b' : '#d1d5db' }}>
                    {r.lop_deduction > 0 ? fmt(r.lop_deduction) : '—'}
                  </td>
                  <td style={{ ...TD_R, color: '#1e40af', fontWeight: 500 }}>{fmt(earnedGross)}</td>
                  <td style={{ ...TD_R, color: r.arrears > 0 ? '#d97706' : r.arrears < 0 ? '#dc2626' : '#d1d5db' }}>
                    {r.arrears !== 0 ? fmt(r.arrears) : '—'}
                  </td>

                  {/* Employee Deductions */}
                  <td style={{ ...TD_R, color: r.epf_employee > 0 ? '#374151' : '#d1d5db' }}>
                    {r.epf_employee > 0 ? fmt(r.epf_employee) : '—'}
                  </td>
                  <td style={{ ...TD_R, color: esicEmpDisplay ? '#d1d5db' : '#374151' }}>
                    {esicEmpDisplay ? '—' : fmt(r.esic_employee)}
                  </td>
                  <td style={{ ...TD_R, color: r.lwf_employee > 0 ? '#374151' : '#d1d5db' }}>
                    {r.lwf_employee > 0 ? fmt(r.lwf_employee) : '—'}
                  </td>
                  <td style={{ ...TD_R, color: r.prof_tax > 0 ? '#374151' : '#d1d5db' }}>
                    {r.prof_tax > 0 ? fmt(r.prof_tax) : '—'}
                  </td>
                  <td style={{ ...TD_R, color: r.tds_deduction > 0 ? '#dc2626' : '#d1d5db' }}>
                    {r.tds_deduction > 0 ? fmt(r.tds_deduction) : '—'}
                  </td>
                  <td style={{ ...TD_R, color: r.advance_deduction > 0 ? '#7c3aed' : '#d1d5db' }}>
                    {r.advance_deduction > 0 ? fmt(r.advance_deduction) : '—'}
                  </td>
                  <td style={{ ...TD_R, color: '#dc2626', fontWeight: 600 }}>{fmt(totalDeductions)}</td>

                  {/* Employer Contributions */}
                  <td style={{ ...TD_R, color: r.epf_employer > 0 ? '#374151' : '#d1d5db' }}>
                    {r.epf_employer > 0 ? fmt(r.epf_employer) : '—'}
                  </td>
                  <td style={{ ...TD_R, color: r.eps_employer > 0 ? '#374151' : '#d1d5db' }}>
                    {r.eps_employer > 0 ? fmt(r.eps_employer) : '—'}
                  </td>
                  <td style={{ ...TD_R, color: esicErpDisplay ? '#d1d5db' : '#374151' }}>
                    {esicErpDisplay ? '—' : fmt(r.esic_employer)}
                  </td>
                  <td style={{ ...TD_R, color: r.lwf_employer > 0 ? '#374151' : '#d1d5db' }}>
                    {r.lwf_employer > 0 ? fmt(r.lwf_employer) : '—'}
                  </td>
                  <td style={{ ...TD_R, color: r.gratuity_provision > 0 ? '#374151' : '#d1d5db' }}>
                    {r.gratuity_provision > 0 ? fmt(r.gratuity_provision) : '—'}
                  </td>

                  {/* Net Pay & CTC */}
                  <td style={{ ...TD_R, fontWeight: 700, color: netPay >= 0 ? '#166534' : '#991b1b' }}>
                    {fmt(netPay)}
                  </td>
                  <td style={{ ...TD_R, fontWeight: 700, color: '#374151' }}>{fmt(ctc)}</td>

                  {/* Payslip download */}
                  <td style={{ ...TD, textAlign: 'center' }}>
                    <button
                      onClick={() => handleDownload(r.employee_id)}
                      disabled={downloadingId === r.employee_id}
                      style={{
                        border: '1px solid #6d28d9',
                        color: '#6d28d9',
                        background: '#fff',
                        borderRadius: 6,
                        padding: '3px 10px',
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: downloadingId === r.employee_id ? 'wait' : 'pointer',
                        opacity: downloadingId === r.employee_id ? 0.6 : 1,
                      }}
                    >
                      {downloadingId === r.employee_id ? '…' : '↓ PDF'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>

          <tfoot>
            <tr>
              <td colSpan={4} style={{ ...TFOOT_TD, textAlign: 'left', color: '#111827' }}>
                Total ({records.length} {records.length === 1 ? 'employee' : 'employees'})
              </td>

              {/* Attendance totals */}
              <td style={{ ...TFOOT_TD, color: '#374151' }}>{totWorkingDays}</td>
              <td style={{ ...TFOOT_TD, color: '#16a34a' }}>{totPresentDays}</td>
              <td style={{ ...TFOOT_TD, color: '#2563eb' }}>{totLeaveDays}</td>
              <td style={{ ...TFOOT_TD, color: '#dc2626' }}>{totAbsentDays}</td>
              <td style={{ ...TFOOT_TD, color: '#991b1b' }}>{totLopDays > 0 ? totLopDays : <span style={{ color: '#d1d5db', fontWeight: 400 }}>—</span>}</td>

              {/* Earnings totals */}
              <td style={{ ...TFOOT_TD, color: '#374151' }}>{fmt(totBasic)}</td>
              <td style={{ ...TFOOT_TD, color: '#374151' }}>{fmt(totAllowances)}</td>
              <td style={{ ...TFOOT_TD, color: '#374151' }}>{fmt(totGross)}</td>
              <td style={{ ...TFOOT_TD, color: '#991b1b' }}>{totLopDeduction > 0 ? fmt(totLopDeduction) : <span style={{ color: '#d1d5db', fontWeight: 400 }}>—</span>}</td>
              <td style={{ ...TFOOT_TD, color: '#1e40af' }}>{fmt(totEarnedGross)}</td>
              <td style={{ ...TFOOT_TD, color: totArrears > 0 ? '#d97706' : totArrears < 0 ? '#dc2626' : '#374151' }}>
                {totArrears !== 0 ? fmt(totArrears) : <span style={{ color: '#d1d5db', fontWeight: 400 }}>—</span>}
              </td>

              {/* Employee Deductions totals */}
              <td style={{ ...TFOOT_TD, color: '#374151' }}>{totEpfEmp > 0 ? fmt(totEpfEmp) : <span style={{ color: '#d1d5db', fontWeight: 400 }}>—</span>}</td>
              <td style={{ ...TFOOT_TD, color: '#374151' }}>
                {allEsicExempt ? <span style={{ color: '#d1d5db', fontWeight: 400 }}>—</span> : fmt(totEsicEmp)}
              </td>
              <td style={{ ...TFOOT_TD, color: '#374151' }}>{totLwfEmp > 0 ? fmt(totLwfEmp) : <span style={{ color: '#d1d5db', fontWeight: 400 }}>—</span>}</td>
              <td style={{ ...TFOOT_TD, color: '#374151' }}>{totProfTax > 0 ? fmt(totProfTax) : <span style={{ color: '#d1d5db', fontWeight: 400 }}>—</span>}</td>
              <td style={{ ...TFOOT_TD, color: '#dc2626' }}>{totTds > 0 ? fmt(totTds) : <span style={{ color: '#d1d5db', fontWeight: 400 }}>—</span>}</td>
              <td style={{ ...TFOOT_TD, color: '#7c3aed' }}>{totAdvance > 0 ? fmt(totAdvance) : <span style={{ color: '#d1d5db', fontWeight: 400 }}>—</span>}</td>
              <td style={{ ...TFOOT_TD, color: '#dc2626' }}>{fmt(totTotalDeductions)}</td>

              {/* Employer Contributions totals */}
              <td style={{ ...TFOOT_TD, color: '#374151' }}>{totEpfErp > 0 ? fmt(totEpfErp) : <span style={{ color: '#d1d5db', fontWeight: 400 }}>—</span>}</td>
              <td style={{ ...TFOOT_TD, color: '#374151' }}>{totEpsErp > 0 ? fmt(totEpsErp) : <span style={{ color: '#d1d5db', fontWeight: 400 }}>—</span>}</td>
              <td style={{ ...TFOOT_TD, color: '#374151' }}>
                {allEsicExempt ? <span style={{ color: '#d1d5db', fontWeight: 400 }}>—</span> : fmt(totEsicErp)}
              </td>
              <td style={{ ...TFOOT_TD, color: '#374151' }}>{totLwfErp > 0 ? fmt(totLwfErp) : <span style={{ color: '#d1d5db', fontWeight: 400 }}>—</span>}</td>
              <td style={{ ...TFOOT_TD, color: '#374151' }}>{totGratuity > 0 ? fmt(totGratuity) : <span style={{ color: '#d1d5db', fontWeight: 400 }}>—</span>}</td>

              {/* Net Pay & CTC totals */}
              <td style={{ ...TFOOT_TD, color: '#166534' }}>{fmt(totNetPay)}</td>
              <td style={{ ...TFOOT_TD, color: '#374151' }}>{fmt(totCTC)}</td>

              {/* Payslip column — no total */}
              <td style={{ ...TFOOT_TD, textAlign: 'center' }} />
            </tr>
          </tfoot>
        </table>
      </div>
    </>
  );
}
