import { apiFetch } from './client';

export interface SlabBreakdown {
  label: string;
  rate: string;
  taxableAmount: number;
  tax: number;
}

export interface SalaryComponents {
  basic_salary: number;
  hra: number;
  meal_allowance: number;
  conveyance_allowance: number;
  special_allowance: number;
}

export interface TaxEmployee {
  employee_id: number;
  emp_id: string | null;
  name: string;
  designation: string;
  tax_regime: 'old' | 'new';
  monthly_gross: number;
  salary_components: SalaryComponents;
  annualGross: number;
  standardDeduction: number;
  taxableIncome: number;
  slabBreakdown: SlabBreakdown[];
  taxBeforeRebate: number;
  rebate: number;
  rebateNote: string;
  taxAfterRebate: number;
  surcharge: number;
  surchargeLabel: string;
  marginalRelief: number;
  cess: number;
  totalAnnualTax: number;
  monthlyTds: number;
  monthsInFY: number;
  joiningDate: string | null;
  tdsAlreadyDeducted: number;
  processedMonthsInFY: number;
  remainingMonths: number;
  fyLabel: string;
}

const BASE = '/api/tax-computation';

export const getTaxComputation = () => apiFetch<TaxEmployee[]>(BASE);

export const updateTaxRegime = (employeeId: number, regime: 'old' | 'new') =>
  apiFetch<{ ok: boolean }>(`${BASE}/${employeeId}/regime`, {
    method: 'PUT',
    body: JSON.stringify({ regime }),
  });
