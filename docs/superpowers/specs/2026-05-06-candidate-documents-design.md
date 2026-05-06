# Candidate Documents — Design Spec
**Date:** 2026-05-06

## Overview

Add a document management system for ATS candidates. HR/Admin can upload any file (PAN, Aadhaar, salary slips, work experience letters, education certificates, resume, etc.) against a candidate at any pipeline stage. Files are stored in Supabase Storage. The existing resume upload panel is retained at the top of the candidate form — uploading a resume both parses/auto-fills the form AND saves the file to Supabase Storage, appearing in the Documents tab tagged as "Resume".

---

## Data Model

### New table: `candidate_documents`

```sql
CREATE TABLE candidate_documents (
  id           SERIAL PRIMARY KEY,
  candidate_id TEXT NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  doc_type     TEXT NOT NULL DEFAULT '',          -- free text label e.g. "PAN", "Aadhaar"
  file_name    TEXT NOT NULL,                     -- original filename shown in UI
  storage_path TEXT NOT NULL,                     -- path within Supabase Storage bucket
  uploaded_by  INTEGER REFERENCES users(id),
  uploaded_at  TEXT NOT NULL DEFAULT ''           -- ISO timestamp
)
```

### Existing `candidates.resume_url` column
- Nulled out via one-time migration query (all rows set to NULL).
- Column kept in schema to avoid a breaking ALTER TABLE; can be dropped in a future cleanup.
- Old on-disk resume files in `backend/uploads/` deleted locally (project is not yet live).

### Supabase Storage
- **Bucket:** `candidate-documents` (private)
- **Path format:** `{candidate_id}/{timestamp}-{sanitized_filename}`
- Signed URLs generated server-side with 1-hour expiry for all downloads.

---

## Backend

### One-time Supabase setup (manual)
1. Supabase dashboard → Storage → New bucket → name: `candidate-documents` → **Private** (do NOT enable public access)

### New env vars (add to Vercel + local `.env`)
| Var | Source |
|-----|--------|
| `SUPABASE_URL` | Supabase dashboard → Settings → API → Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase dashboard → Settings → API → service_role key (not the anon key) |

### New package
`@supabase/storage-js` added to root `package.json` and `backend/package.json`.

### New route file: `backend/src/routes/ats/candidateDocuments.ts`
Mounted in `app.ts` at `/api/ats/candidates`.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/:id/documents` | Any authenticated | List all documents for candidate. Returns array with signed download URLs (1hr expiry). |
| `POST` | `/:id/documents` | HR / Admin / VP_HR | Upload file + `doc_type` label. Multer memory storage → Supabase Storage → DB insert. |
| `DELETE` | `/:id/documents/:docId` | HR / Admin only | Delete from Supabase Storage + DB row. |

**Upload constraints:** PDF, DOC, DOCX, JPG, JPEG, PNG — max 5 MB.

### Resume upload endpoint changes
- `POST /:id/resume` (disk-based) is **removed**.
- Resume upload now calls `POST /:id/documents` with `doc_type = "Resume"`.
- Parse endpoint (`POST /api/ats/parse-resume`) is unchanged — still accepts a file and returns parsed fields without saving.

### DB migration (added to `db.ts` `_runMigrations`)
```sql
-- New table
CREATE TABLE IF NOT EXISTS candidate_documents (...)

-- Null out legacy resume URLs
UPDATE candidates SET resume_url = NULL WHERE resume_url IS NOT NULL
```

---

## Frontend

### Resume upload panel (top of candidate form) — unchanged position, updated behaviour
- File picker + "Parse & Auto-fill" button remains at top of the form.
- On upload: file is sent to parse endpoint (auto-fills fields) AND uploaded to Supabase Storage via `POST /:id/documents` with `doc_type = "Resume"`.
- For new candidates: parse happens before the candidate exists in DB, so the document upload is queued and executed immediately after candidate creation (same pattern as current resume upload).
- Legacy `resume_url` links removed from display.

### New Documents tab in candidate detail modal
Shown for existing candidates only (not during new candidate creation).

**Layout:**
- **Upload row** (HR/Admin/VP_HR only): file picker + free-text label input (placeholder: "e.g. PAN, Aadhaar, Salary Slip…") + Upload button. Shows inline progress/error.
- **Document list table:**

| Column | Notes |
|--------|-------|
| Label | `doc_type` value |
| File Name | Original filename, clickable — opens signed URL in new tab |
| Uploaded By | User name |
| Uploaded At | Formatted date |
| Actions | Delete button (HR/Admin only) |

- **Empty state:** "No documents uploaded yet."

### Frontend API additions (`frontend/src/api/ats-candidates.ts`)
```ts
listCandidateDocuments(candidateId)   // GET /:id/documents
uploadCandidateDocument(candidateId, file, docType)  // POST /:id/documents
deleteCandidateDocument(candidateId, docId)           // DELETE /:id/documents/:docId
```

---

## Error Handling

| Scenario | Behaviour |
|----------|-----------|
| File too large (>5MB) | 400 — "File must be under 5MB" |
| Invalid file type | 400 — "Unsupported file type" |
| Supabase Storage upload fails | 500 — logged server-side, "Upload failed" shown in UI |
| Signed URL generation fails | Document shown without download link, error logged |
| Delete — file not found in storage | DB row still deleted (idempotent) |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` missing | Server startup logs warning; uploads return 500 |

---

## Out of Scope
- Document verification / status workflow (mark as verified)
- Notifications when documents are uploaded
- Document expiry or re-upload requests
- Migrating existing on-disk resume files to Supabase (project not yet live, files deleted)
