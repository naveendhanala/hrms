import { apiFetch } from './client';

export interface Employee {
  id: number;
  emp_id: string | null;
  username: string;
  email: string;
  name: string;
  role: string;
  level: string;
  dob: string | null;
  date_of_joining: string | null;
  project: string;
  department: string;
  location: string;
  state: string;
  site_office: string;
  designation: string;
  status: string;
  created_at: string;
  reporting_manager_id: number | null;
  reporting_manager_name: string | null;
}

export interface Manager {
  id: number;
  name: string;
  role: string;
}

export interface EmployeeUpdate {
  name: string;
  email: string;
  role?: string;
  emp_id?: string;
  dob?: string;
  date_of_joining?: string;
  project?: string;
  department?: string;
  location?: string;
  state?: string;
  site_office?: string;
  designation?: string;
  status?: string;
  reporting_manager_id?: number | null;
  level?: string;
}

export interface Reportee {
  id: number;
  emp_id: string | null;
  name: string;
  email: string;
  role: string;
  designation: string;
  project: string;
  department: string;
  location: string;
  site_office: string;
  status: string;
  date_of_joining: string | null;
}

export const getMyReportees = () =>
  apiFetch<Reportee[]>('/api/users/my-reportees');

export const getEmployees = () =>
  apiFetch<Employee[]>('/api/users');

export const getDirectory = () =>
  apiFetch<{ id: number; name: string; designation: string; role: string }[]>('/api/users/directory');

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

export const getMe = () =>
  apiFetch<Employee & { level: string; reporting_manager_name: string | null }>('/api/users/me');
