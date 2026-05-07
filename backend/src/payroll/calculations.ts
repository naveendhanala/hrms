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
  if (frequency === 'monthly')     return true;
  if (frequency === 'half_yearly') return month === 6 || month === 12;
  if (frequency === 'annually')    return month === 12;
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
