import { apiFetch } from './client';

export interface GratuityAccrual {
  employee_id: number;
  emp_id: string | null;
  employee_name: string;
  date_of_joining: string | null;
  total_accrued: number;
  cumulative_amount: number;
  last_monthly_provision: number;
}

export interface GratuityDisbursement {
  id: number;
  employee_id: number;
  employee_name: string;
  emp_id: string | null;
  exit_date: string;
  years_of_service: number;
  accrued_amount: number;
  paid_amount: number;
  payment_date: string;
  recorded_by_name: string | null;
  notes: string | null;
  created_at: string;
}

const BASE = '/api/gratuity';

export const getGratuityAccruals = () =>
  apiFetch<GratuityAccrual[]>(`${BASE}/accruals`);

export const getGratuityDisbursements = () =>
  apiFetch<GratuityDisbursement[]>(`${BASE}/disbursements`);

export const recordGratuityDisbursement = (data: {
  employee_id: number;
  exit_date: string;
  years_of_service: number;
  accrued_amount: number;
  paid_amount: number;
  payment_date: string;
  notes?: string;
}) =>
  apiFetch<{ id: number }>(`${BASE}/disbursements`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
