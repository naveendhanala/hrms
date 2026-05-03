import { apiFetch } from './client';

export interface ExitRequest {
  id: number;
  employee_id: number;
  employee_name: string;
  emp_id: string | null;
  designation: string;
  project?: string;
  department?: string;
  submitted_at: string;
  notice_period_days: number;
  last_working_day: string;
  reason: string;
  status: 'pending_manager' | 'pending_vp' | 'approved' | 'revoked';
  manager_accepted_at: string | null;
  manager_name: string | null;
  vp_accepted_at: string | null;
  vp_name: string | null;
  reporting_manager_name?: string | null;
  replacement_job_id?: string | null;
}

export const submitResignation = (reason: string) =>
  apiFetch<{ ok: boolean; last_working_day: string; notice_period_days: number }>('/api/exit', {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });

export const getMyExit = () =>
  apiFetch<ExitRequest | null>('/api/exit/my');

export const revokeResignation = () =>
  apiFetch<{ ok: boolean }>('/api/exit/revoke', { method: 'PATCH' });

export const getTeamExits = () =>
  apiFetch<ExitRequest[]>('/api/exit/team');

export const managerAccept = (id: number) =>
  apiFetch<{ ok: boolean }>(`/api/exit/${id}/manager-accept`, { method: 'PATCH' });

export const getAllExits = () =>
  apiFetch<ExitRequest[]>('/api/exit/all');

export const vpAccept = (id: number) =>
  apiFetch<{ ok: boolean }>(`/api/exit/${id}/vp-accept`, { method: 'PATCH' });

export const setReplacement = (id: number, job_id: string) =>
  apiFetch<{ ok: boolean }>(`/api/exit/${id}/set-replacement`, {
    method: 'PATCH',
    body: JSON.stringify({ job_id }),
  });
