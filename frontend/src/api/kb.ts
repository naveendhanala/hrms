import { apiFetch } from './client';

export interface KBArticle {
  id: number;
  title: string;
  content: string;
  category: string;
  tags: string;
  created_by: number;
  author_name: string;
  created_at: string;
  updated_at: string;
}

const BASE = '/api/kb/articles';

export function listArticles(params?: { search?: string; category?: string }) {
  const qs = new URLSearchParams();
  if (params?.search) qs.set('search', params.search);
  if (params?.category && params.category !== 'All') qs.set('category', params.category);
  const query = qs.toString() ? `?${qs}` : '';
  return apiFetch<KBArticle[]>(`${BASE}${query}`);
}

export function getArticle(id: number) {
  return apiFetch<KBArticle>(`${BASE}/${id}`);
}

export function createArticle(data: { title: string; content: string; category: string; tags: string }) {
  return apiFetch<KBArticle>(BASE, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateArticle(id: number, data: Partial<{ title: string; content: string; category: string; tags: string }>) {
  return apiFetch<KBArticle>(`${BASE}/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export function deleteArticle(id: number) {
  return apiFetch<void>(`${BASE}/${id}`, { method: 'DELETE' });
}
