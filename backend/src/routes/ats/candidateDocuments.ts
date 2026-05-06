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

router.get('/:id/documents', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const docs = await db.query<any>(
      `SELECT cd.*, u.name AS uploaded_by_name
       FROM candidate_documents cd
       LEFT JOIN users u ON u.id = cd.uploaded_by
       WHERE cd.candidate_id = $1
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

    const candidate = await db.queryOne<any>('SELECT id FROM candidates WHERE id = $1', [req.params.id]);
    if (!candidate) return res.status(404).json({ error: 'Candidate not found' });

    const safe = req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    let storagePath = `${req.params.id}/${Date.now()}-${safe}`;

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
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [req.params.id, docType, req.file.originalname, storagePath, req.user!.id, new Date().toISOString()],
      );
      res.status(201).json({ id: result.lastInsertRowid });
    } catch (err: any) {
      // attempt to remove orphaned file if upload succeeded but DB insert failed
      try {
        const client = storageClient();
        await client.from(BUCKET).remove([storagePath]);
      } catch {
        // best-effort cleanup, ignore secondary errors
      }
      res.status(500).json({ error: err.message });
    }
  },
);

router.delete('/:id/documents/:docId', authenticateToken, requireRole('admin', 'hr'), async (req: AuthRequest, res: Response) => {
  try {
    const doc = await db.queryOne<any>(
      'SELECT * FROM candidate_documents WHERE id = $1 AND candidate_id = $2',
      [req.params.docId, req.params.id],
    );
    if (!doc) return res.status(404).json({ error: 'Document not found' });

    const client = storageClient();
    await client.from(BUCKET).remove([doc.storage_path]);

    await db.run('DELETE FROM candidate_documents WHERE id = $1', [req.params.docId]);
    res.status(204).end();
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
