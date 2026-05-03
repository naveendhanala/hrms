import { apiFetch } from './client';
import type { Candidate } from '../types';

const BASE = '/api/ats/candidates';

export function listCandidates(params?: Record<string, string>) {
  const qs = params ? '?' + new URLSearchParams(params).toString() : '';
  return apiFetch<Candidate[]>(`${BASE}${qs}`);
}

export interface CandidatePage {
  data: Candidate[];
  total: number;
  page: number;
  limit: number;
}

export function listCandidatesPaged(params: Record<string, string>) {
  return apiFetch<CandidatePage>(`${BASE}?${new URLSearchParams(params).toString()}`);
}

export function createCandidate(data: Partial<Candidate>) {
  return apiFetch<Candidate>(BASE, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateCandidate(id: string, data: Partial<Candidate>) {
  return apiFetch<Candidate>(`${BASE}/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export function deleteCandidate(id: string) {
  return apiFetch<void>(`${BASE}/${id}`, { method: 'DELETE' });
}

export function requestOfferApproval(id: string) {
  return apiFetch<Candidate>(`${BASE}/${id}/request-approval`, { method: 'POST' });
}

export function approveOffer(id: string) {
  return apiFetch<Candidate>(`${BASE}/${id}/approve-offer`, { method: 'POST' });
}

export function rejectOffer(id: string) {
  return apiFetch<Candidate>(`${BASE}/${id}/reject-offer`, { method: 'POST' });
}

export function uploadCandidateResume(id: string, file: File) {
  const fd = new FormData();
  fd.append('resume', file);
  const token = localStorage.getItem('hrms_token');
  return fetch(`${BASE}/${id}/resume`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: fd,
  }).then(async (res) => {
    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as Record<string, unknown>;
      throw new Error(String(body.error ?? 'Upload failed'));
    }
    return res.json() as Promise<{ resume_url: string }>;
  });
}
