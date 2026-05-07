import { apiFetch } from './client';

export interface EmployeeStatutoryConfig {
  employee_id: number;
  emp_id: string | null;
  employee_name: string;
  uan_number: string;
  esic_number: string;
  pan_number: string;
  epf_exempt: boolean;
  esic_exempt: boolean;
  lwf_exempt: boolean;
}

export interface LwfState {
  state: string;
  employee_amount: number;
  employer_amount: number;
  frequency: 'monthly' | 'half_yearly' | 'annually';
}

const BASE = '/api/payroll';

export const getStatutoryConfig = () =>
  apiFetch<EmployeeStatutoryConfig[]>(`${BASE}/statutory-config`);

export const updateStatutoryConfig = (employeeId: number, data: Partial<EmployeeStatutoryConfig>) =>
  apiFetch<{ ok: boolean }>(`${BASE}/statutory-config/${employeeId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });

export const getLwfStates = () =>
  apiFetch<LwfState[]>(`${BASE}/lwf-states`);

export const updateLwfState = (data: LwfState) =>
  apiFetch<{ ok: boolean }>(`${BASE}/lwf-states`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
