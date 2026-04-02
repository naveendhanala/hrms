import { apiFetch } from './client';
import type { Attempt } from '../types';

const BASE = '/api/lms/attempts';

export function markWatched(courseId: number) {
  return apiFetch<Attempt>(`${BASE}/${courseId}/watch`, {
    method: 'POST',
  });
}

export function getQuiz(courseId: number) {
  return apiFetch<any[]>(`${BASE}/${courseId}/quiz`);
}

export function submitQuiz(courseId: number, answers: Record<number, string>) {
  return apiFetch<{ score: number; total: number; correct: number; attempt: Attempt }>(
    `${BASE}/${courseId}/submit`,
    {
      method: 'POST',
      body: JSON.stringify({ answers }),
    },
  );
}

export function getAttempt(courseId: number) {
  return apiFetch<Attempt | null>(`${BASE}/${courseId}`);
}

export function myAttempts() {
  return apiFetch<Attempt[]>(`${BASE}/my`);
}
