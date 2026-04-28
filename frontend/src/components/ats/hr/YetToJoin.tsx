import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { listCandidates, updateCandidate } from '../../../api/ats-candidates';
import type { Candidate, Stage } from '../../../types';

function ActionMenu({
  candidateId,
  busy,
  onAction,
}: {
  candidateId: string;
  busy: boolean;
  onAction: (id: string, stage: Stage) => void;
}) {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });
  const chevronRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (chevronRef.current && !chevronRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleChevron = () => {
    if (!chevronRef.current) return;
    const rect = chevronRef.current.getBoundingClientRect();
    setMenuPos({
      top: rect.bottom + window.scrollY + 4,
      right: window.innerWidth - rect.right - window.scrollX,
    });
    setOpen((v) => !v);
  };

  return (
    <>
      <div className="flex items-center rounded-lg overflow-hidden border border-green-600 text-xs font-medium w-fit">
        <button
          disabled={busy}
          onClick={() => onAction(candidateId, 'Joined')}
          className="px-3 py-1.5 text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 whitespace-nowrap"
        >
          {busy ? 'Saving…' : 'Mark as Joined'}
        </button>
        <button
          ref={chevronRef}
          disabled={busy}
          onClick={handleChevron}
          className="px-2 py-1.5 text-white bg-green-600 hover:bg-green-700 border-l border-green-500 disabled:opacity-50"
          aria-label="More actions"
        >
          ▾
        </button>
      </div>

      {open && createPortal(
        <div
          style={{ position: 'absolute', top: menuPos.top, right: menuPos.right, zIndex: 9999 }}
          className="w-36 bg-white border border-gray-200 rounded-lg shadow-lg"
        >
          <button
            onMouseDown={(e) => e.stopPropagation()}
            onClick={() => { setOpen(false); onAction(candidateId, 'Offer Dropped'); }}
            className="w-full text-left px-3 py-2 text-xs text-red-600 hover:bg-red-50 rounded-lg"
          >
            Offer Dropped
          </button>
        </div>,
        document.body,
      )}
    </>
  );
}

export default function YetToJoin() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listCandidates({ stage: 'Offer Released' });
      setCandidates(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAction = async (id: string, stage: Stage) => {
    setBusy(id);
    try {
      await updateCandidate(id, { stage });
      setCandidates((prev) => prev.filter((x) => x.id !== id));
    } catch (err) {
      console.error(err);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-end mb-4">
        {!loading && (
          <span className="px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-sm font-medium">
            {candidates.length} pending
          </span>
        )}
      </div>

      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : candidates.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <div className="text-4xl mb-3">🎉</div>
          <p className="font-medium text-gray-600">No pending joinings</p>
          <p className="text-sm">All offer-released candidates have joined.</p>
        </div>
      ) : (
        <div className="overflow-x-auto bg-white rounded-xl shadow-sm border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {['Name', 'Mobile', 'Project', 'Job ID', 'Department', 'Role', 'HR SPOC', 'Expected Date of Joining', 'Action'].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {candidates.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{c.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{c.mobile}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{c.project || '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{c.job_id}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{c.department || '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{c.role || '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{c.hr_spoc}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{c.expected_joining_date?.slice(0, 10) || '—'}</td>
                  <td className="px-4 py-3 text-sm">
                    <ActionMenu
                      candidateId={c.id}
                      busy={busy === c.id}
                      onAction={handleAction}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
