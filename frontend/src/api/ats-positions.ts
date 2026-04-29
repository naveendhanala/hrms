import { apiFetch } from './client';
import type { Position, PipelineItem } from '../types';

const BASE = '/api/ats/positions';

export function listPositions(params?: Record<string, string>) {
  const qs = params ? '?' + new URLSearchParams(params).toString() : '';
  return apiFetch<Position[]>(`${BASE}${qs}`);
}

export function getPosition(jobId: string) {
  return apiFetch<Position>(`${BASE}/${jobId}`);
}

export function createPosition(data: Partial<Position>) {
  return apiFetch<Position>(BASE, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updatePosition(jobId: string, data: Partial<Position>) {
  return apiFetch<Position>(`${BASE}/${jobId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export function deletePosition(jobId: string) {
  return apiFetch<void>(`${BASE}/${jobId}`, { method: 'DELETE' });
}

export function approvePositionRequest(jobId: string) {
  return apiFetch<Position>(`${BASE}/${jobId}/approve`, { method: 'POST' });
}

export function rejectPositionRequest(jobId: string) {
  return apiFetch<Position>(`${BASE}/${jobId}/reject`, { method: 'POST' });
}

export function getPipeline(params?: Record<string, string>) {
  const qs = params ? '?' + new URLSearchParams(params).toString() : '';
  return apiFetch<PipelineItem[]>(`${BASE}/pipeline${qs}`);
}
