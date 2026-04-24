import { apiFetch } from './client';
import type { AuthUser } from '../types';

export function login(username: string, password: string) {
  return apiFetch<{ token: string; user: AuthUser }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}

export function me() {
  return apiFetch<AuthUser>('/api/auth/me');
}

export function createEmployee(data: {
  username: string;
  email: string;
  password: string;
  name: string;
  role?: string;
  reporting_manager_id?: number | null;
  emp_id?: string;
  dob?: string;
  date_of_joining?: string;
  project?: string;
  location?: string;
  state?: string;
  site_office?: string;
  designation?: string;
  status?: string;
}) {
  return apiFetch<AuthUser>('/api/auth/create-employee', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}
