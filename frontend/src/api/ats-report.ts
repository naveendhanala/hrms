import { apiFetch } from './client';
import type { Candidate } from '../types';

export function getReport(filters?: Record<string, string>) {
  const qs = filters ? '?' + new URLSearchParams(filters).toString() : '';
  return apiFetch<Candidate[]>(`/api/ats/report${qs}`);
}
