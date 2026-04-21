import { apiFetch } from './client';

export interface Subcontractor {
  id: number;
  name: string;
  company: string;
  contact_person: string;
  email: string;
  phone: string;
  expertise: string;
  status: 'active' | 'inactive' | 'blacklisted';
  location: string;
  projects_worked: string;
  notes: string;
  added_by: number;
  added_by_name: string;
  created_at: string;
  updated_at: string;
}

export type SubcontractorPayload = Omit<Subcontractor, 'id' | 'added_by' | 'added_by_name' | 'created_at' | 'updated_at'>;

const BASE = '/api/kb/subcontractors';

export function listSubcontractors(params?: { search?: string; status?: string }) {
  const qs = new URLSearchParams();
  if (params?.search) qs.set('search', params.search);
  if (params?.status && params.status !== 'all') qs.set('status', params.status);
  const query = qs.toString() ? `?${qs}` : '';
  return apiFetch<Subcontractor[]>(`${BASE}${query}`);
}

export function createSubcontractor(data: SubcontractorPayload) {
  return apiFetch<Subcontractor>(BASE, { method: 'POST', body: JSON.stringify(data) });
}

export function updateSubcontractor(id: number, data: Partial<SubcontractorPayload>) {
  return apiFetch<Subcontractor>(`${BASE}/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export function deleteSubcontractor(id: number) {
  return apiFetch<void>(`${BASE}/${id}`, { method: 'DELETE' });
}
