import { apiFetch } from './client';

export interface Manager {
  id: number;
  name: string;
  role: string;
}

export interface EmployeeUpdate {
  name: string;
  email: string;
  emp_id?: string;
  dob?: string;
  project?: string;
  location?: string;
  status?: string;
  reporting_manager_id?: number | null;
}

export const getManagers = () =>
  apiFetch<Manager[]>('/api/users/managers');

export const updateEmployee = (userId: number, data: EmployeeUpdate) =>
  apiFetch<{ ok: boolean }>(`/api/users/${userId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });

export const updateReportingManager = (userId: number, managerId: number | null) =>
  apiFetch<{ ok: boolean }>(`/api/users/${userId}/manager`, {
    method: 'PATCH',
    body: JSON.stringify({ reporting_manager_id: managerId }),
  });
