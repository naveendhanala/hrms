import { apiFetch } from './client';

export interface PayrollRecord {
  id: number;
  run_id: number;
  employee_id: number;
  emp_id: string | null;
  employee_name: string;
  employee_role: string;
  employee_designation: string;
  employee_state: string;
  manager_name: string | null;
  basic_salary: number;
  allowances: number;
  deductions: number;
  gross_salary: number;
  working_days: number;
  present_days: number;
  leave_days: number;
  absent_days: number;
  lop_days: number;
  lop_deduction: number;
  prof_tax: number;
  advance_deduction: number;
  tds_deduction: number;
}

export interface PayrollRun {
  id: number;
  month: number;
  year: number;
  status: 'draft' | 'processed' | 'paid';
  created_by_name: string;
  created_at: string;
  records: PayrollRecord[];
}

export interface PayrollHistoryItem {
  id: number;
  month: number;
  year: number;
  status: 'draft' | 'processed' | 'paid';
  created_by_name: string;
  created_at: string;
  employee_count: number;
  total_net: number | null;
}

export interface SalaryMasterEntry {
  employee_id: number;
  emp_id: string | null;
  employee_name: string;
  employee_role: string;
  employee_designation: string;
  basic_salary: number;
  hra: number;
  meal_allowance: number;
  fuel_allowance: number;
  driver_allowance: number;
  special_allowance: number;
  deductions: number;
  updated_at: string | null;
}

const BASE = '/api/payroll';

export const getPayrollRun = (month: number, year: number) =>
  apiFetch<PayrollRun | null>(`${BASE}?month=${month}&year=${year}`);

export const getPayrollHistory = () =>
  apiFetch<PayrollHistoryItem[]>(`${BASE}/history`);

export const generatePayroll = (month: number, year: number) =>
  apiFetch<{ id: number }>(`${BASE}`, {
    method: 'POST',
    body: JSON.stringify({ month, year }),
  });

export const updatePayrollRecord = (
  recordId: number,
  data: { basic_salary: number; allowances: number; deductions: number }
) =>
  apiFetch<{ ok: boolean }>(`${BASE}/records/${recordId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });

export const regeneratePayroll = (runId: number) =>
  apiFetch<{ ok: boolean }>(`${BASE}/${runId}/regenerate`, { method: 'POST' });

export const updatePayrollStatus = (runId: number, status: 'processed' | 'paid') =>
  apiFetch<{ ok: boolean }>(`${BASE}/${runId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });

export interface PayrollConfig {
  prof_tax_amount: number;
  tds_percentage: number;
}

export const getPayrollConfig = () =>
  apiFetch<PayrollConfig>(`${BASE}/config`);

export const updatePayrollConfig = (data: Partial<PayrollConfig>) =>
  apiFetch<{ ok: boolean }>(`${BASE}/config`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });

export interface ProfTaxByState {
  state: string;
  amount: number;
}

export const getProfTaxByState = () =>
  apiFetch<ProfTaxByState[]>(`${BASE}/prof-tax-states`);

export const updateProfTaxForState = (state: string, amount: number) =>
  apiFetch<{ ok: boolean }>(`${BASE}/prof-tax-states`, {
    method: 'PUT',
    body: JSON.stringify({ state, amount }),
  });

export interface TdsSlab { id: string; range: string; rate: string }
export interface TdsSlabs { old: TdsSlab[]; new: TdsSlab[] }

export const getTdsSlabs = () =>
  apiFetch<TdsSlabs>(`${BASE}/tds-slabs`);

export const updateTdsSlabs = (regime: 'old' | 'new', slabs: TdsSlab[]) =>
  apiFetch<{ ok: boolean }>(`${BASE}/tds-slabs`, {
    method: 'PUT',
    body: JSON.stringify({ regime, slabs }),
  });

export const getSalaryMaster = () =>
  apiFetch<SalaryMasterEntry[]>(`${BASE}/salary-master`);

export const updateSalaryMaster = (
  userId: number,
  data: { basic_salary: number; hra: number; meal_allowance: number; fuel_allowance: number; driver_allowance: number; special_allowance: number; deductions: number }
) =>
  apiFetch<{ ok: boolean }>(`${BASE}/salary-master/${userId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
