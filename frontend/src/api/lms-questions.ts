import { apiFetch } from './client';
import type { Question } from '../types';

export function listQuestions(courseId: number) {
  return apiFetch<Question[]>(`/api/lms/courses/${courseId}/questions`);
}

export function createQuestion(courseId: number, data: Partial<Question>) {
  return apiFetch<Question>(`/api/lms/courses/${courseId}/questions`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateQuestion(courseId: number, questionId: number, data: Partial<Question>) {
  return apiFetch<Question>(`/api/lms/courses/${courseId}/questions/${questionId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export function deleteQuestion(courseId: number, questionId: number) {
  return apiFetch<void>(`/api/lms/courses/${courseId}/questions/${questionId}`, {
    method: 'DELETE',
  });
}
