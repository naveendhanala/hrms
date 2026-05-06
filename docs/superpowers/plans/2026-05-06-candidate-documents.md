# Candidate Documents Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Supabase Storage-backed document uploads (PAN, Aadhaar, salary slips, etc.) to ATS candidates, replacing the disk-based resume upload.

**Architecture:** A new `candidate_documents` DB table stores file metadata; files live in a private Supabase Storage bucket. A new Express route handles upload (multer memory storage → Supabase), list (with signed URLs), and delete. The frontend adds a Documents tab to the candidate detail modal and moves resume uploads into the same system.

**Tech Stack:** `@supabase/storage-js`, multer (memory), Express, React, TailwindCSS

---

## Before You Start

### One-time manual setup in Supabase dashboard
1. Go to **Storage → New bucket**
2. Name: `candidate-documents`
3. Toggle: **Private** (do NOT enable public access)
4. Click Create

### New environment variables
Add to `.env` (local) and Vercel dashboard (production):
```
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```
Both values are in **Supabase dashboard → Settings → API**.
`SUPABASE_SERVICE_ROLE_KEY` is the `service_role` key — not the `anon` key.

---

## File Map

| Action | Path |
|--------|------|
| **Create** | `backend/src/routes/ats/candidateDocuments.ts` |
| **Create** | `frontend/src/api/ats-documents.ts` |
| **Create** | `frontend/src/components/ats/hr/CandidateDocuments.tsx` |
| **Modify** | `backend/src/db.ts` — add `candidate_documents` migration + null `resume_url` |
| **Modify** | `backend/src/app.ts` — mount new route |
| **Modify** | `backend/src/routes/ats/candidates.ts` — remove disk multer setup + `POST /:id/resume` |
| **Modify** | `backend/package.json` — add `@supabase/storage-js` |
| **Modify** | `package.json` (root) — add `@supabase/storage-js` |
| **Modify** | `frontend/src/components/ats/hr/CandidateForm.tsx` — remove `resume_url` link, add tabs |
| **Modify** | `frontend/src/components/ats/hr/CandidateList.tsx` — swap resume upload call |
| **Modify** | `frontend/src/api/ats-candidates.ts` — remove `uploadCandidateResume` |

---

## Task 1: Add @supabase/storage-js to packages

**Files:**
- Modify: `package.json` (root)
- Modify: `backend/package.json`

- [ ] **Step 1: Add to root package.json dependencies**

Open `package.json` (root). Add `"@supabase/storage-js": "^2.7.1"` to `dependencies`:

```json
"dependencies": {
  "@google/genai": "^1.51.0",
  "@supabase/storage-js": "^2.7.1",
  "bcryptjs": "^2.4.3",
  "cors": "^2.8.5",
  "express": "^4.18.3",
  "jsonwebtoken": "^9.0.2",
  "mammoth": "^1.12.0",
  "multer": "^2.1.1",
  "pdf-parse": "^2.4.5",
  "pg": "^8.20.0",
  "uuid": "^9.0.1"
}
```

- [ ] **Step 2: Add to backend/package.json dependencies**

Open `backend/package.json`. Add `"@supabase/storage-js": "^2.7.1"` to `dependencies`:

```json
"dependencies": {
  "@google/genai": "^1.51.0",
  "@supabase/storage-js": "^2.7.1",
  "bcryptjs": "^2.4.3",
  "cors": "^2.8.5",
  "dotenv": "^17.4.2",
  "express": "^4.18.3",
  "jsonwebtoken": "^9.0.2",
  "mammoth": "^1.12.0",
  "multer": "^2.1.1",
  "pdf-parse": "^2.4.5",
  "pg": "^8.20.0",
  "uuid": "^9.0.1"
}
```

- [ ] **Step 3: Install**

```bash
npm install
cd backend && npm install && cd ..
```

Expected: no errors, `node_modules/@supabase/storage-js` exists in both root and backend.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json backend/package.json backend/package-lock.json
git commit -m "chore: add @supabase/storage-js to root and backend packages"
```

---

## Task 2: DB migration — candidate_documents table

**Files:**
- Modify: `backend/src/db.ts`

- [ ] **Step 1: Add migrations to `_runMigrations` in `backend/src/db.ts`**

Inside the `Promise.all([...])` array in `_runMigrations`, add these two entries at the end of the array (before the closing `])`):

```typescript
pool.query(`CREATE TABLE IF NOT EXISTS candidate_documents (
  id           SERIAL PRIMARY KEY,
  candidate_id TEXT NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  doc_type     TEXT NOT NULL DEFAULT '',
  file_name    TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  uploaded_by  INTEGER REFERENCES users(id),
  uploaded_at  TEXT NOT NULL DEFAULT ''
)`),
pool.query(`UPDATE candidates SET resume_url = NULL WHERE resume_url IS NOT NULL`),
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/db.ts
git commit -m "feat: add candidate_documents table migration and null resume_url"
```

---

## Task 3: Create backend candidateDocuments route

**Files:**
- Create: `backend/src/routes/ats/candidateDocuments.ts`

- [ ] **Step 1: Create the file with the full implementation**

```typescript
import { Router, Response } from 'express';
import multer from 'multer';
import { StorageClient } from '@supabase/storage-js';
import db from '../../db';
import { authenticateToken, requireRole, AuthRequest } from '../../middleware/auth';

const BUCKET = 'candidate-documents';
const ALLOWED_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
]);

function storageClient(): StorageClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  return new StorageClient(`${url}/storage/v1`, {
    apikey: key,
    Authorization: `Bearer ${key}`,
  });
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    cb(null, ALLOWED_TYPES.has(file.mimetype));
  },
});

const router = Router();

// List documents for a candidate, each with a 1-hour signed URL
router.get('/:id/documents', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const docs = await db.query<any>(
      `SELECT cd.*, u.name AS uploaded_by_name
       FROM candidate_documents cd
       LEFT JOIN users u ON u.id = cd.uploaded_by
       WHERE cd.candidate_id = ?
       ORDER BY cd.uploaded_at DESC`,
      [req.params.id],
    );
    const client = storageClient();
    const withUrls = await Promise.all(
      docs.map(async (doc) => {
        const { data } = await client.from(BUCKET).createSignedUrl(doc.storage_path, 3600);
        return { ...doc, signed_url: data?.signedUrl ?? null };
      }),
    );
    res.json(withUrls);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Upload a new document
router.post(
  '/:id/documents',
  authenticateToken,
  requireRole('admin', 'hr', 'vp_hr'),
  upload.single('file'),
  async (req: AuthRequest, res: Response) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    if (!ALLOWED_TYPES.has(req.file.mimetype))
      return res.status(400).json({ error: 'Unsupported file type. Use PDF, DOC, DOCX, JPG, or PNG.' });

    const docType = (req.body.doc_type ?? '').trim();
    if (!docType) return res.status(400).json({ error: 'doc_type is required' });

    const safe = req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `${req.params.id}/${Date.now()}-${safe}`;

    try {
      const client = storageClient();
      const { error: uploadError } = await client.from(BUCKET).upload(storagePath, req.file.buffer, {
        contentType: req.file.mimetype,
      });
      if (uploadError) {
        console.error('[candidateDocuments] storage upload failed:', uploadError.message);
        return res.status(500).json({ error: 'Upload failed' });
      }

      const result = await db.run(
        `INSERT INTO candidate_documents
           (candidate_id, doc_type, file_name, storage_path, uploaded_by, uploaded_at)
         VALUES (?, ?, ?, ?, ?, ?) RETURNING id`,
        [req.params.id, docType, req.file.originalname, storagePath, req.user!.id, new Date().toISOString()],
      );
      res.status(201).json({ id: result.lastInsertRowid });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },
);

// Delete a document
router.delete('/:id/documents/:docId', authenticateToken, requireRole('admin', 'hr'), async (req: AuthRequest, res: Response) => {
  try {
    const doc = await db.queryOne<any>(
      'SELECT * FROM candidate_documents WHERE id = ? AND candidate_id = ?',
      [req.params.docId, req.params.id],
    );
    if (!doc) return res.status(404).json({ error: 'Document not found' });

    const client = storageClient();
    // Idempotent — don't fail if the file was already gone from storage
    await client.from(BUCKET).remove([doc.storage_path]);

    await db.run('DELETE FROM candidate_documents WHERE id = ?', [req.params.docId]);
    res.status(204).end();
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/routes/ats/candidateDocuments.ts
git commit -m "feat: add candidateDocuments backend route (Supabase Storage)"
```

---

## Task 4: Mount route + remove old resume endpoint

**Files:**
- Modify: `backend/src/app.ts`
- Modify: `backend/src/routes/ats/candidates.ts`

- [ ] **Step 1: Mount the new route in `backend/src/app.ts`**

After the existing import block, add:
```typescript
import candidateDocumentsRoutes from './routes/ats/candidateDocuments';
```

After this line:
```typescript
app.use('/api/ats/config', atsConfigRoutes);
```
Add:
```typescript
app.use('/api/ats/candidates', candidateDocumentsRoutes);
```

- [ ] **Step 2: Remove disk-based multer setup from `backend/src/routes/ats/candidates.ts`**

Remove these lines from the top of `candidates.ts` (roughly lines 1–19):
```typescript
import os from 'os';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
```

And remove:
```typescript
const uploadsDir = process.env.VERCEL
  ? path.join(os.tmpdir(), 'hrms-resumes')
  : path.join(__dirname, '../../../uploads/resumes');
fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (_req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}-${safe}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });
```

- [ ] **Step 3: Remove the `POST /:id/resume` endpoint from `candidates.ts`**

Find and delete the entire route handler block that starts with:
```typescript
router.post('/:id/resume', upload.single('resume'), ...
```
Delete everything from that line through its closing `});`.

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd backend && npx tsc --noEmit
```
Expected: no errors. Fix any import errors (e.g. unused `multer` import).

- [ ] **Step 5: Commit**

```bash
git add backend/src/app.ts backend/src/routes/ats/candidates.ts
git commit -m "feat: mount candidateDocuments route, remove disk-based resume upload endpoint"
```

---

## Task 5: Frontend API — ats-documents.ts

**Files:**
- Create: `frontend/src/api/ats-documents.ts`
- Modify: `frontend/src/api/ats-candidates.ts`

- [ ] **Step 1: Create `frontend/src/api/ats-documents.ts`**

```typescript
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
```

- [ ] **Step 2: Remove `uploadCandidateResume` from `frontend/src/api/ats-candidates.ts`**

Find and delete the `uploadCandidateResume` function. It looks like:
```typescript
export function uploadCandidateResume(id: string, file: File) {
  const token = localStorage.getItem('hrms_token');
  const formData = new FormData();
  formData.append('resume', file);
  return fetch(`/api/ats/candidates/${id}/resume`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  }).then((res) => res.json());
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/api/ats-documents.ts frontend/src/api/ats-candidates.ts
git commit -m "feat: add ats-documents API, remove uploadCandidateResume"
```

---

## Task 6: Create CandidateDocuments component

**Files:**
- Create: `frontend/src/components/ats/hr/CandidateDocuments.tsx`

- [ ] **Step 1: Create the file**

```tsx
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../../context/AuthContext';
import {
  listCandidateDocuments,
  uploadCandidateDocument,
  deleteCandidateDocument,
  type CandidateDocument,
} from '../../../api/ats-documents';

const ACCEPTED = '.pdf,.doc,.docx,.jpg,.jpeg,.png';
const MAX_SIZE = 5 * 1024 * 1024;

export default function CandidateDocuments({ candidateId }: { candidateId: string }) {
  const { user } = useAuth();
  const canManage = user?.role === 'admin' || user?.role === 'hr' || user?.role === 'vp_hr';
  const canDelete = user?.role === 'admin' || user?.role === 'hr';

  const [docs, setDocs] = useState<CandidateDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [docType, setDocType] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setDocs(await listCandidateDocuments(candidateId));
    } catch {
      // silently fail — list stays empty
    } finally {
      setLoading(false);
    }
  }, [candidateId]);

  useEffect(() => { load(); }, [load]);

  const handleUpload = async () => {
    if (!file) { setError('Please select a file'); return; }
    if (!docType.trim()) { setError('Please enter a label'); return; }
    if (file.size > MAX_SIZE) { setError('File must be under 5 MB'); return; }
    setError('');
    setUploading(true);
    try {
      await uploadCandidateDocument(candidateId, file, docType.trim());
      setFile(null);
      setDocType('');
      // Reset the file input by re-rendering via key change handled by parent
      await load();
    } catch (e: any) {
      setError(e.message ?? 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (docId: number) => {
    if (!window.confirm('Delete this document?')) return;
    try {
      await deleteCandidateDocument(candidateId, docId);
      setDocs((prev) => prev.filter((d) => d.id !== docId));
    } catch (e: any) {
      alert(e.message ?? 'Delete failed');
    }
  };

  return (
    <div className="space-y-4 py-2">
      {canManage && (
        <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50/40 p-4 space-y-3">
          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Upload Document</p>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-600 mb-1">Label</label>
              <input
                value={docType}
                onChange={(e) => setDocType(e.target.value)}
                placeholder="e.g. PAN, Aadhaar, Salary Slip…"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-600 mb-1">File (PDF, DOC, DOCX, JPG, PNG — max 5 MB)</label>
              <input
                type="file"
                accept={ACCEPTED}
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="block w-full text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-indigo-600 file:text-white hover:file:bg-indigo-700 cursor-pointer"
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleUpload}
              disabled={uploading || !file || !docType.trim()}
              className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              {uploading ? 'Uploading…' : 'Upload'}
            </button>
            {error && <p className="text-red-600 text-xs">{error}</p>}
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-400 text-center py-6">Loading…</p>
      ) : docs.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-6">No documents uploaded yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Label</th>
                <th className="text-left py-2 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">File</th>
                <th className="text-left py-2 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Uploaded By</th>
                <th className="text-left py-2 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th>
                {canDelete && <th />}
              </tr>
            </thead>
            <tbody>
              {docs.map((doc) => (
                <tr key={doc.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-2.5 pr-4 font-medium text-gray-800 whitespace-nowrap">{doc.doc_type || '—'}</td>
                  <td className="py-2.5 pr-4">
                    {doc.signed_url ? (
                      <a
                        href={doc.signed_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-indigo-600 hover:underline truncate block max-w-[200px]"
                        title={doc.file_name}
                      >
                        {doc.file_name}
                      </a>
                    ) : (
                      <span className="text-gray-400 truncate block max-w-[200px]" title={doc.file_name}>
                        {doc.file_name}
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 pr-4 text-gray-600 whitespace-nowrap">{doc.uploaded_by_name ?? '—'}</td>
                  <td className="py-2.5 pr-4 text-gray-500 whitespace-nowrap">
                    {doc.uploaded_at ? new Date(doc.uploaded_at).toLocaleDateString() : '—'}
                  </td>
                  {canDelete && (
                    <td className="py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => handleDelete(doc.id)}
                        className="text-xs text-red-500 hover:text-red-700 font-medium"
                      >
                        Delete
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/ats/hr/CandidateDocuments.tsx
git commit -m "feat: add CandidateDocuments tab component"
```

---

## Task 7: Update CandidateForm — tabs + resume saves to Supabase

**Files:**
- Modify: `frontend/src/components/ats/hr/CandidateForm.tsx`

- [ ] **Step 1: Add tab state and import CandidateDocuments**

At the top of `CandidateForm.tsx`, add to the imports:
```tsx
import CandidateDocuments from './CandidateDocuments';
```

Inside the component, add a new state after the existing state declarations:
```tsx
const [activeTab, setActiveTab] = useState<'details' | 'documents'>('details');
```

- [ ] **Step 2: Remove the "View current resume" link**

Find and delete this block (lines 174–187 approximately):
```tsx
{initial?.resume_url && !resumeFile && (
  <div className="flex items-center gap-2 mb-2">
    <a
      href={initial.resume_url}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-800 underline"
    >
      View current resume
    </a>
    <span className="text-gray-300">·</span>
    <span className="text-xs text-gray-400">Upload a new file to replace it</span>
  </div>
)}
```

- [ ] **Step 3: Replace the return statement with tabbed layout**

Replace the entire `return (...)` block with:

```tsx
return (
  <form onSubmit={handleSubmit} className="space-y-4">
    {/* Tab navigation — only shown for existing candidates */}
    {initial && (
      <div className="flex border-b border-gray-200">
        <button
          type="button"
          onClick={() => setActiveTab('details')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            activeTab === 'details'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Details
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('documents')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            activeTab === 'documents'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Documents
        </button>
      </div>
    )}

    {activeTab === 'documents' ? (
      <CandidateDocuments candidateId={initial!.id} />
    ) : (
      <>
        {/* Resume upload */}
        <div className="rounded-xl border-2 border-dashed border-indigo-200 bg-indigo-50/40 px-4 py-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Resume <span className="text-gray-400 font-normal">(PDF / DOC / DOCX, max 5 MB)</span>
          </label>
          <input
            type="file"
            accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={(e) => setResumeFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-indigo-600 file:text-white hover:file:bg-indigo-700 cursor-pointer"
          />
          {resumeFile && (
            <div className="mt-2 flex items-center gap-3">
              <p className="text-xs text-indigo-700 font-medium truncate">{resumeFile.name}</p>
              {!initial && (
                <button
                  type="button"
                  onClick={handleParseResume}
                  disabled={parsing}
                  className="shrink-0 px-3 py-1 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                >
                  {parsing ? 'Parsing…' : 'Parse & Auto-fill'}
                </button>
              )}
            </div>
          )}
          {parseMsg && (
            <p className={`mt-1.5 text-xs font-medium ${parseMsg.startsWith('Auto-filled') ? 'text-green-700' : 'text-amber-600'}`}>
              {parseMsg}
            </p>
          )}
        </div>

        {/* Basic fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name <span className="text-red-500">*</span></label>
            <input name="name" value={form.name ?? ''} onChange={handleChange} required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mobile <span className="text-red-500">*</span></label>
            <input
              name="mobile"
              value={form.mobile ?? ''}
              onChange={handleChange}
              required
              inputMode="numeric"
              maxLength={10}
              placeholder="10-digit number"
              className={`w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${mobileError ? 'border-red-400' : 'border-gray-300'}`}
            />
            {mobileError && <p className="text-red-500 text-xs mt-1">{mobileError}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Alternate Mobile</label>
            <input
              name="alternate_mobile"
              value={form.alternate_mobile ?? ''}
              onChange={handleChange}
              inputMode="numeric"
              maxLength={10}
              placeholder="10-digit number"
              className={`w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${altMobileError ? 'border-red-400' : 'border-gray-300'}`}
            />
            {altMobileError && <p className="text-red-500 text-xs mt-1">{altMobileError}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Job ID <span className="text-red-500">*</span></label>
            <select name="job_id" value={form.job_id ?? ''} onChange={handleChange} required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500">
              <option value="">Select position</option>
              {positions.map((p) => (
                <option key={p.job_id} value={p.job_id}>
                  {p.job_id} - {p.project} ({p.role})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Current Role</label>
            <input name="candidate_current_role" value={form.candidate_current_role ?? ''} onChange={handleChange} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
          </div>
          {initial && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Stage</label>
              <div className="w-full border border-gray-200 bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-600">
                {initial.stage}
              </div>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Interviewer <span className="text-red-500">*</span></label>
            {suggestedPanel && (
              <p className="text-xs text-indigo-600 bg-indigo-50 border border-indigo-100 rounded px-2 py-1 mb-1">
                Suggested from position: <span className="font-medium">{suggestedPanel}</span>
              </p>
            )}
            <select
              name="interviewer"
              value={form.interviewer ?? ''}
              onChange={handleChange}
              disabled={!!initial?.feedback}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed"
            >
              <option value="">Select interviewer</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.name}>{emp.name}</option>
              ))}
            </select>
            {interviewerError && <p className="text-red-500 text-xs mt-1">{interviewerError}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">HR SPOC <span className="text-red-500">*</span></label>
            <select
              name="hr_spoc"
              value={form.hr_spoc ?? ''}
              onChange={handleChange}
              required
              disabled={!!initial}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed"
            >
              {HR_SPOC_OPTIONS.map((h) => (
                <option key={h} value={h}>{h}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Education */}
        <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700">Education</h3>
            <button
              type="button"
              onClick={() => setEduRows((r) => [...r, { ...EMPTY_EDU }])}
              className="text-xs font-medium text-indigo-600 hover:text-indigo-800 border border-indigo-200 rounded-md px-2.5 py-1 hover:bg-indigo-50"
            >
              + Add
            </button>
          </div>
          {eduRows.length === 0 && (
            <p className="text-xs text-gray-400">No education entries yet. Click &quot;+ Add&quot; to add one.</p>
          )}
          <div className="space-y-3">
            {eduRows.map((row, idx) => (
              <div key={idx} className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-white border border-gray-200 rounded-lg p-3 relative">
                <button
                  type="button"
                  onClick={() => setEduRows((r) => r.filter((_, i) => i !== idx))}
                  className="absolute top-2 right-2 text-gray-300 hover:text-red-400 text-xs font-bold leading-none"
                  title="Remove"
                >
                  ✕
                </button>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Degree</label>
                  <input
                    value={row.degree}
                    onChange={(e) => updateEdu(idx, 'degree', e.target.value)}
                    placeholder="e.g. B.Tech, MBA"
                    className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">College / University</label>
                  <input
                    value={row.college}
                    onChange={(e) => updateEdu(idx, 'college', e.target.value)}
                    placeholder="Institution name"
                    className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Year of Graduation</label>
                  <input
                    value={row.year}
                    onChange={(e) => updateEdu(idx, 'year', e.target.value)}
                    placeholder="e.g. 2019"
                    maxLength={4}
                    className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Work Experience */}
        <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700">Work Experience</h3>
            <button
              type="button"
              onClick={() => setExpRows((r) => [...r, { ...EMPTY_EXP }])}
              className="text-xs font-medium text-indigo-600 hover:text-indigo-800 border border-indigo-200 rounded-md px-2.5 py-1 hover:bg-indigo-50"
            >
              + Add
            </button>
          </div>
          {expRows.length === 0 && (
            <p className="text-xs text-gray-400">No experience entries yet. Click &quot;+ Add&quot; to add one.</p>
          )}
          <div className="space-y-3">
            {expRows.map((row, idx) => (
              <div key={idx} className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-white border border-gray-200 rounded-lg p-3 relative">
                <button
                  type="button"
                  onClick={() => setExpRows((r) => r.filter((_, i) => i !== idx))}
                  className="absolute top-2 right-2 text-gray-300 hover:text-red-400 text-xs font-bold leading-none"
                  title="Remove"
                >
                  ✕
                </button>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Company Name</label>
                  <input
                    value={row.company}
                    onChange={(e) => updateExp(idx, 'company', e.target.value)}
                    placeholder="Company name"
                    className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Designation</label>
                  <input
                    value={row.designation}
                    onChange={(e) => updateExp(idx, 'designation', e.target.value)}
                    placeholder="Job title / role"
                    className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">From</label>
                  <input
                    type="month"
                    value={row.from}
                    onChange={(e) => updateExp(idx, 'from', e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">To</label>
                  <input
                    type="month"
                    value={row.to}
                    onChange={(e) => updateExp(idx, 'to', e.target.value)}
                    placeholder="Leave blank if current"
                    className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Project Name</label>
                  <input
                    value={row.project}
                    onChange={(e) => updateExp(idx, 'project', e.target.value)}
                    placeholder="Project worked on"
                    className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
          <button type="button" onClick={onCancel} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50">
            {saving ? 'Saving...' : initial ? 'Update Candidate' : 'Add Candidate'}
          </button>
        </div>
      </>
    )}
  </form>
);
```

- [ ] **Step 4: Verify TypeScript**

```bash
cd frontend && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/ats/hr/CandidateForm.tsx
git commit -m "feat: add Details/Documents tabs to candidate form, remove resume_url link"
```

---

## Task 8: Update CandidateList — swap resume upload

**Files:**
- Modify: `frontend/src/components/ats/hr/CandidateList.tsx`

- [ ] **Step 1: Replace import in CandidateList.tsx**

Find this import line:
```typescript
import { listCandidates, listCandidatesPaged, createCandidate, updateCandidate, requestOfferApproval, uploadCandidateResume } from '../../../api/ats-candidates';
```

Replace with:
```typescript
import { listCandidates, listCandidatesPaged, createCandidate, updateCandidate, requestOfferApproval } from '../../../api/ats-candidates';
import { uploadCandidateDocument } from '../../../api/ats-documents';
```

- [ ] **Step 2: Update handleCreate**

Find this line (inside `handleCreate`):
```typescript
if (resumeFile) await uploadCandidateResume(created.id, resumeFile).catch(() => {});
```

Replace with:
```typescript
if (resumeFile) await uploadCandidateDocument(created.id, resumeFile, 'Resume').catch(() => {});
```

- [ ] **Step 3: Update handleUpdate**

Find this line (inside `handleUpdate`):
```typescript
if (resumeFile) await uploadCandidateResume(editing.id, resumeFile).catch(() => {});
```

Replace with:
```typescript
if (resumeFile) await uploadCandidateDocument(editing.id, resumeFile, 'Resume').catch(() => {});
```

- [ ] **Step 4: Verify TypeScript**

```bash
cd frontend && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/ats/hr/CandidateList.tsx
git commit -m "feat: resume upload now saves to Supabase Storage via candidateDocuments API"
```

---

## Task 9: Push and verify in production

- [ ] **Step 1: Push all commits**

```bash
git push origin main
```

- [ ] **Step 2: Add env vars in Vercel**

In Vercel dashboard → your project → Settings → Environment Variables, add:
- `SUPABASE_URL` = `https://your-project-ref.supabase.co`
- `SUPABASE_SERVICE_ROLE_KEY` = your service_role key

- [ ] **Step 3: Verify deployment**

Wait for Vercel deployment to complete. Then:
1. Open the app → ATS → open any existing candidate
2. Click the **Documents** tab — should show "No documents uploaded yet"
3. Upload a file (e.g. a PDF) with label "Test" — should appear in list with a clickable filename
4. Click the filename — should open the file in a new tab (signed URL)
5. Click Delete — document should be removed
6. Create a new candidate with a resume — after saving, open the candidate → Documents tab should show the resume tagged as "Resume"
7. Check Supabase Storage → `candidate-documents` bucket → confirm files are being saved there

- [ ] **Step 4: Check Vercel function logs for any errors**

Vercel dashboard → your project → Logs. Look for any `[candidateDocuments]` errors.
