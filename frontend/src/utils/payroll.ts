import type { PayrollRecord } from '../api/payroll';

export function calcNetPay(r: PayrollRecord): number {
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
