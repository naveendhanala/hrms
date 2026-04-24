import { apiFetch } from './client';

export interface EmployeeAdvance {
  id: number;
  employee_id: number;
  employee_name: string;
  emp_id: string | null;
  amount: number;
  months: number;
  monthly_amt: number;
  recovered: number;
  status: 'active' | 'closed';
  created_at: string;
}

const BASE = '/api/advances';

export const getAdvances = () => apiFetch<EmployeeAdvance[]>(BASE);

export const createAdvance = (data: { employee_id: number; amount: number; months: number }) =>
  apiFetch<{ id: number }>(BASE, { method: 'POST', body: JSON.stringify(data) });

export const updateAdvance = (id: number, data: { amount: number; months: number }) =>
  apiFetch<{ ok: boolean }>(`${BASE}/${id}`, { method: 'PUT', body: JSON.stringify(data) });

export const deleteAdvance = (id: number) =>
  apiFetch<{ ok: boolean }>(`${BASE}/${id}`, { method: 'DELETE' });
