import { apiFetch } from './client';

export interface RoleEntry {
  name: string;
  level: string;
}

export interface DeptRole {
  department: string;
  roles: RoleEntry[];
}

export function getDeptRoles() {
  return apiFetch<DeptRole[]>('/api/ats/config/dept-roles');
}

export function saveDeptRoles(data: DeptRole[]) {
  return apiFetch<{ ok: boolean }>('/api/ats/config/dept-roles', {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}
