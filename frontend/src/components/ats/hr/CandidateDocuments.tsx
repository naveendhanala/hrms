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
