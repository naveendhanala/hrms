import { apiFetch } from './client';

export interface CandidateDocument {
  id: number;
  candidate_id: string;
  doc_type: string;
  file_name: string;
  storage_path: string;
  uploaded_by: number | null;
  uploaded_by_name: string | null;
  uploaded_at: string;
  signed_url: string | null;
}

export function listCandidateDocuments(candidateId: string): Promise<CandidateDocument[]> {
  return apiFetch(`/api/ats/candidates/${candidateId}/documents`);
}

export function uploadCandidateDocument(
  candidateId: string,
  file: File,
  docType: string,
): Promise<{ id: number }> {
  const token = localStorage.getItem('hrms_token');
  const formData = new FormData();
  formData.append('file', file);
  formData.append('doc_type', docType);
  return fetch(`/api/ats/candidates/${candidateId}/documents`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  }).then(async (res) => {
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error((body as any).error ?? 'Upload failed');
    }
    return res.json() as Promise<{ id: number }>;
  });
}

export function deleteCandidateDocument(candidateId: string, docId: number): Promise<void> {
  return apiFetch(`/api/ats/candidates/${candidateId}/documents/${docId}`, {
    method: 'DELETE',
  });
}
