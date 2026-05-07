import { useState } from 'react';
import { downloadPayslip, type PayrollRecord } from '../../api/payroll';

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

function calcNetPay(r: PayrollRecord): number {
  return (
    r.gross_salary -
    r.lop_deduction -
    r.epf_employee -
    r.esic_employee -
    r.lwf_employee -
    r.prof_tax -
    r.tds_deduction -
    r.advance_deduction -
    r.deductions
  );
}

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

export default function PayrollCTCTable({ records, runId }: Props) {
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  const allEsicExempt = records.every(r => r.esic_exempt || (r.esic_employee === 0 && r.esic_employer === 0));

  const handleDownload = (employeeId: number) => {
    setDownloadingId(employeeId);
    // downloadPayslip is fire-and-forget (returns void)
    downloadPayslip(runId, employeeId);
    setTimeout(() => setDownloadingId(null), 1500);
  };

  // Totals
  const totBasic           = records.reduce((s, r) => s + r.basic_salary, 0);
  const totAllowances      = records.reduce((s, r) => s + r.allowances, 0);
  const totGross           = records.reduce((s, r) => s + r.gross_salary, 0);
  const totLopDeduction    = records.reduce((s, r) => s + r.lop_deduction, 0);
  const totEarnedGross     = records.reduce((s, r) => s + (r.gross_salary - r.lop_deduction), 0);
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
    <div style={{ overflowX: 'auto' }}>
      <table style={{ borderCollapse: 'collapse', minWidth: 1800, width: '100%' }}>
        <thead>
          {/* Group header row */}
          <tr>
            {/* Group 1: Employee Info */}
            <th
              colSpan={4}
              style={{ ...GROUP_TH, background: '#f5f3ff', color: '#5b21b6' }}
            >
              Employee Info
            </th>
            {/* Group 2: Attendance */}
            <th
              colSpan={5}
              style={{ ...GROUP_TH, background: '#eff6ff', color: '#1d4ed8' }}
            >
              Attendance
            </th>
            {/* Group 3: Earnings */}
            <th
              colSpan={5}
              style={{ ...GROUP_TH, background: '#f0fdf4', color: '#15803d' }}
            >
              Earnings
            </th>
            {/* Group 4: Employee Deductions */}
            <th
              colSpan={7}
              style={{ ...GROUP_TH, background: '#fef2f2', color: '#dc2626' }}
            >
              Employee Deductions
            </th>
            {/* Group 5: Employer Contributions */}
            <th
              colSpan={5}
              style={{ ...GROUP_TH, background: '#fff7ed', color: '#c2410c' }}
            >
              Employer Contributions
            </th>
            {/* Group 6: Net Pay & CTC */}
            <th
              colSpan={3}
              style={{ ...GROUP_TH, background: '#f0fdf4', color: '#15803d' }}
            >
              Net Pay &amp; CTC
            </th>
          </tr>
          {/* Column header row */}
          <tr>
            {/* Employee Info columns */}
            <th style={COL_TH_LEFT}>Emp ID</th>
            <th style={COL_TH_LEFT}>Name</th>
            <th style={COL_TH_LEFT}>Designation</th>
            <th style={COL_TH_LEFT}>State</th>
            {/* Attendance columns */}
            <th style={COL_TH_RIGHT}>Working Days</th>
            <th style={COL_TH_RIGHT}>Present</th>
            <th style={COL_TH_RIGHT}>Leave</th>
            <th style={COL_TH_RIGHT}>Absent</th>
            <th style={COL_TH_RIGHT}>LOP Days</th>
            {/* Earnings columns */}
            <th style={COL_TH_RIGHT}>Basic</th>
            <th style={COL_TH_RIGHT}>Allowances</th>
            <th style={COL_TH_RIGHT}>Gross</th>
            <th style={COL_TH_RIGHT}>LOP Deduction</th>
            <th style={COL_TH_RIGHT}>Earned Gross</th>
            {/* Employee Deductions columns */}
            <th style={COL_TH_RIGHT}>EPF</th>
            <th style={COL_TH_RIGHT}>ESIC</th>
            <th style={COL_TH_RIGHT}>LWF</th>
            <th style={COL_TH_RIGHT}>Prof Tax</th>
            <th style={COL_TH_RIGHT}>TDS</th>
            <th style={COL_TH_RIGHT}>Advance</th>
            <th style={COL_TH_RIGHT}>Total Deductions</th>
            {/* Employer Contributions columns */}
            <th style={COL_TH_RIGHT}>EPF</th>
            <th style={COL_TH_RIGHT}>EPS</th>
            <th style={COL_TH_RIGHT}>ESIC</th>
            <th style={COL_TH_RIGHT}>LWF</th>
            <th style={COL_TH_RIGHT}>Gratuity Provision</th>
            {/* Net Pay & CTC columns */}
            <th style={COL_TH_RIGHT}>Net Pay</th>
            <th style={COL_TH_RIGHT}>CTC</th>
            <th style={{ ...COL_TH_BASE, textAlign: 'center' }}>Payslip</th>
          </tr>
        </thead>

        <tbody>
          {records.map(r => {
            const earnedGross       = r.gross_salary - r.lop_deduction;
            const totalDeductions   = calcTotalEmployeeDeductions(r);
            const netPay            = calcNetPay(r);
            const ctc               = calcCTC(r);
            const esicEmpDisplay    = r.esic_exempt || r.esic_employee === 0;
            const esicErpDisplay    = r.esic_exempt || r.esic_employer === 0;

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
            {/* Employee Info totals */}
            <td
              colSpan={4}
              style={{ ...TFOOT_TD, textAlign: 'left', color: '#111827' }}
            >
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

            {/* Employee Deductions totals */}
            <td style={{ ...TFOOT_TD, color: '#374151' }}>{totEpfEmp > 0 ? fmt(totEpfEmp) : <span style={{ color: '#d1d5db', fontWeight: 400 }}>—</span>}</td>
            <td style={{ ...TFOOT_TD, color: '#374151' }}>
              {allEsicExempt
                ? <span style={{ color: '#d1d5db', fontWeight: 400 }}>—</span>
                : fmt(totEsicEmp)}
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
              {allEsicExempt
                ? <span style={{ color: '#d1d5db', fontWeight: 400 }}>—</span>
                : fmt(totEsicErp)}
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
  );
}
