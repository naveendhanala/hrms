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
