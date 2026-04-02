import { apiFetch } from './client';
import type { Course } from '../types';

const BASE = '/api/lms/courses';

export function listCourses() {
  return apiFetch<Course[]>(BASE);
}

export function getCourse(id: number) {
  return apiFetch<Course>(`${BASE}/${id}`);
}

export function createCourse(data: { title: string; description: string; youtube_url: string }) {
  return apiFetch<Course>(BASE, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateCourse(id: number, data: Partial<Course>) {
  return apiFetch<Course>(`${BASE}/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export function deleteCourse(id: number) {
  return apiFetch<void>(`${BASE}/${id}`, { method: 'DELETE' });
}
