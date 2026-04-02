import { apiFetch } from './client';
import type { CompletionReport } from '../types';

const BASE = '/api/lms/reports';

export function getCompletionReport() {
  return apiFetch<CompletionReport[]>(`${BASE}/completion`);
}
