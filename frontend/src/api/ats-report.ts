import { apiFetch } from './client';

export interface ReportRow {
  project: string;
  level: string;
  department: string;
  role: string;
  total_req: number;
  total_joined: number;
  total_offer_released: number;
  open: number;
}

export function getReport(filters?: Record<string, string>) {
  const qs = filters ? '?' + new URLSearchParams(filters).toString() : '';
  return apiFetch<ReportRow[]>(`/api/ats/report${qs}`);
}
