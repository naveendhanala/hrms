import { useState, useEffect, useCallback, useRef } from 'react';
import { listCandidates, listCandidatesPaged, createCandidate, updateCandidate, requestOfferApproval } from '../../../api/ats-candidates';
import { listPositions } from '../../../api/ats-positions';
import type { Candidate } from '../../../types';
import { STAGES } from '../../../types';
import Modal from '../../shared/Modal';
import CandidateForm from './CandidateForm';

const PAGE_SIZE = 50;

const RATINGS = ['Poor', 'Average', 'Good', 'Excellent'] as const;
const FUNCTIONAL_ITEMS = ['Job Knowledge', 'Hands on exposure', 'Knowledge on industry trends'] as const;
const BEHAVIORAL_ITEMS = ['Analytical skills', 'Communication skills', 'Leadership skills'] as const;

function ReadOnlyCompetencyTable({
  title,
  items,
  ratings,
}: {
  title: string;
  items: readonly string[];
  ratings: Record<string, string>;
}) {
  return (
    <div>
      <p className="text-sm font-semibold text-gray-700 mb-2">{title}</p>
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-400 w-52"></th>
              {RATINGS.map((r) => (
                <th key={r} className="px-2 py-2 text-center text-xs font-semibold text-gray-500">{r}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.map((item) => (
              <tr key={item} className="bg-gray-50/40">
                <td className="px-3 py-2.5 text-gray-700 text-xs font-medium">{item}</td>
                {RATINGS.map((r) => (
                  <td key={r} className="px-2 py-2.5 text-center">
                    <input
                      type="radio"
                      readOnly
                      disabled
                      checked={ratings[item] === r}
                      className="w-4 h-4 accent-indigo-600 cursor-not-allowed"
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function parseFeedback(text: string) {
  const result  = text.match(/Result:\s*(accepted|rejected)/i)?.[1]?.toLowerCase() ?? '';
  const reason  = text.match(/Reason:\s*([^|]+)/)?.[1]?.trim() ?? '';
  const remarks = text.match(/Remarks:\s*([\s\S]*)$/)?.[1]?.trim() ?? '';
  return { result, reason, remarks };
}

export default function CandidateList() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Candidate | null>(null);

  // Debounced search: searchInput drives the text box, search fires the query
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [filterProject, setFilterProject] = useState('');
  const [filterStage, setFilterStage] = useState('');
  const [projects, setProjects] = useState<string[]>([]);

  // Offer Details section state
  const [offerForm, setOfferForm] = useState({ offered_ctc: '', offer_notes: '', expected_joining_date: '' });
  const [savingOffer, setSavingOffer] = useState(false);
  const [offerError, setOfferError] = useState('');

  // Request Approval state
  const [requestingApproval, setRequestingApproval] = useState(false);
  const [exporting, setExporting] = useState(false);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Fetch distinct projects from positions for the filter dropdown
  useEffect(() => {
    listPositions()
      .then((pos) => {
        const unique = [...new Set(pos.map((p) => p.project).filter(Boolean))].sort();
        setProjects(unique);
      })
      .catch(() => {});
  }, []);

  const load = useCallback(async (pg = page) => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(pg), limit: String(PAGE_SIZE) };
      if (search)        params.search  = search;
      if (filterStage)   params.stage   = filterStage;
      if (filterProject) params.project = filterProject;
      const result = await listCandidatesPaged(params);
      setCandidates(result.data);
      setTotal(result.total);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, search, filterStage, filterProject]);

  useEffect(() => { load(); }, [load]);

  // Debounce search input — fires server query 400 ms after typing stops
  const handleSearchInput = (value: string) => {
    setSearchInput(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearch(value);
      setPage(1);
    }, 400);
  };

  const handleFilterChange = (setter: (v: string) => void) => (e: React.ChangeEvent<HTMLSelectElement>) => {
    setter(e.target.value);
    setPage(1);
  };

  const handleCreate = async (data: Partial<Candidate>) => {
    await createCandidate(data);
    setShowForm(false);
    load(1);
    setPage(1);
  };

  const handleUpdate = async (data: Partial<Candidate>) => {
    if (!editing) return;
    await updateCandidate(editing.id, data);
    setEditing(null);
    setShowForm(false);
    load();
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const params: Record<string, string> = {};
      if (search)        params.search  = search;
      if (filterStage)   params.stage   = filterStage;
      if (filterProject) params.project = filterProject;
      const all = await listCandidates(params);

      const XLSX = await import('xlsx');
      const headers = ['Name', 'Mobile', 'Alternate Mobile', 'Job ID', 'Project', 'Department', 'Role',
                       'Stage', 'HR SPOC', 'Interviewer', 'Sourcing Date', 'Interview Done Date',
                       'Offer Release Date', 'Expected Joining Date', 'Joined Date', 'Offered CTC'];
      const rows = all.map((c) => [
        c.name, c.mobile, c.alternate_mobile, c.job_id, c.project, c.department, c.role,
        c.stage, c.hr_spoc, c.interviewer,
        c.sourcing_date?.slice(0, 10) || '',
        c.interview_done_date?.slice(0, 10) || '',
        c.offer_release_date?.slice(0, 10) || '',
        c.expected_joining_date?.slice(0, 10) || '',
        c.joined_date?.slice(0, 10) || '',
        c.offered_ctc || '',
      ]);

      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      ws['!cols'] = headers.map((h) => ({ wch: Math.max(h.length + 2, 14) }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Candidates');
      const label = [filterProject, filterStage].filter(Boolean).join('_') || 'all';
      XLSX.writeFile(wb, `candidates_${label}_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (err) {
      console.error(err);
    } finally {
      setExporting(false);
    }
  };

  const handleSaveOffer = async () => {
    if (!editing) return;
    if (!offerForm.offered_ctc.trim()) {
      setOfferError('Offered CTC is required.');
      return;
    }
    if (!offerForm.expected_joining_date) {
      setOfferError('Expected Joining Date is required.');
      return;
    }
    setOfferError('');
    setSavingOffer(true);
    try {
      const updated = await updateCandidate(editing.id, {
        offered_ctc: offerForm.offered_ctc,
        offer_notes: offerForm.offer_notes,
        expected_joining_date: offerForm.expected_joining_date || '',
      });
      setEditing(updated as Candidate);
      load();
    } finally {
      setSavingOffer(false);
    }
  };

  const handleRequestApproval = async () => {
    if (!editing) return;
    setRequestingApproval(true);
    try {
      await requestOfferApproval(editing.id);
      setEditing(null);
      setShowForm(false);
      load();
    } finally {
      setRequestingApproval(false);
    }
  };

  const openRow = (c: Candidate) => {
    setEditing(c);
    setOfferForm({
      offered_ctc: c.offered_ctc ?? '',
      offer_notes: c.offer_notes ?? '',
      expected_joining_date: c.expected_joining_date?.slice(0, 10) ?? '',
    });
    setOfferError('');
    setShowForm(true);
  };

  const closeModal = () => { setShowForm(false); setEditing(null); };

  // Derived state for modal sections
  const interviewDone   = !!(editing?.feedback || editing?.interview_done_date);
  const showOfferSection = editing && (editing.stage === 'Offer Negotiation' || editing.stage === 'Offer Approval Pending' || editing.offered_ctc);
  const POST_NEGOTIATION_STAGES = ['Offer Approval Pending', 'Offer Released', 'Joined', 'Offer Dropped', 'Rejected'];
  const offerLocked = POST_NEGOTIATION_STAGES.includes(editing?.stage ?? '');
  const showRequestApproval = (
    editing?.stage === 'Offer Negotiation' &&
    !!editing?.offered_ctc &&
    !!editing?.expected_joining_date
  );

  const parsedFeedback = editing?.feedback ? parseFeedback(editing.feedback) : null;
  const competencies = (() => {
    try { return editing?.competency_feedback ? JSON.parse(editing.competency_feedback) : null; }
    catch { return null; }
  })();

  return (
    <div>
      <div className="flex flex-wrap gap-3 mb-4">
        <input
          type="text"
          placeholder="Search by name or mobile..."
          value={searchInput}
          onChange={(e) => handleSearchInput(e.target.value)}
          className="flex-1 min-w-48 max-w-md border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        />
        <select
          value={filterProject}
          onChange={handleFilterChange(setFilterProject)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-600"
        >
          <option value="">All Projects</option>
          {projects.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select
          value={filterStage}
          onChange={handleFilterChange(setFilterStage)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-600"
        >
          <option value="">All Stages</option>
          {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <div className="ml-auto flex gap-2">
          <button
            onClick={handleExport}
            disabled={exporting || total === 0}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 whitespace-nowrap"
          >
            {exporting ? 'Exporting…' : `↓ Export${total > 0 ? ` (${total})` : ''}`}
          </button>
          <button
            onClick={() => { setEditing(null); setShowForm(true); }}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 whitespace-nowrap"
          >
            + Add Candidate
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : candidates.length === 0 ? (
        <p className="text-gray-500">No candidates found.</p>
      ) : (
        <div className="overflow-x-auto bg-white rounded-xl shadow-sm border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {['Name', 'Mobile', 'Project', 'Job ID', 'Department', 'Role', 'Stage', 'Interviewer', 'HR SPOC', ''].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {candidates.map((c) => (
                <tr key={c.id} className="hover:bg-indigo-50 cursor-pointer group" onClick={() => openRow(c)}>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{c.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{c.mobile}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{c.project || '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{c.job_id}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{c.department || '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{c.role || '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{c.stage}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{c.interviewer}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{c.hr_spoc}</td>
                  <td className="px-3 py-3 text-gray-300 group-hover:text-indigo-400 transition-colors text-base">›</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination controls */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
            <p className="text-xs text-gray-500">
              Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total} candidates
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(1)}
                disabled={page === 1}
                className="px-2 py-1 text-xs rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-100"
              >«</button>
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-2 py-1 text-xs rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-100"
              >‹</button>
              <span className="px-3 py-1 text-xs text-gray-700 font-medium">
                Page {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-2 py-1 text-xs rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-100"
              >›</button>
              <button
                onClick={() => setPage(totalPages)}
                disabled={page === totalPages}
                className="px-2 py-1 text-xs rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-100"
              >»</button>
            </div>
          </div>
        </div>
      )}

      <Modal open={showForm} onClose={closeModal} title={editing ? 'Edit Candidate' : 'Add Candidate'} size="lg">
        <CandidateForm
          initial={editing}
          onSubmit={editing ? handleUpdate : handleCreate}
          onCancel={closeModal}
        />

        {/* ── Offer Details section ── */}
        {showOfferSection && (
          <div className="mt-6 pt-5 border-t-2 border-amber-100 space-y-4">
            <h3 className="text-sm font-bold text-amber-700 uppercase tracking-wide">Offer Details</h3>

            {offerLocked ? (
              /* Read-only view */
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">Offered CTC</p>
                  <p className="text-sm font-semibold text-gray-800">{editing?.offered_ctc || '—'}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">Expected Joining Date</p>
                  <p className="text-sm font-semibold text-gray-800">{editing?.expected_joining_date?.slice(0, 10) || '—'}</p>
                </div>
                {editing?.offer_release_date && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-1">Offer Release Date</p>
                    <p className="text-sm font-semibold text-green-700">{editing.offer_release_date.slice(0, 10)}</p>
                  </div>
                )}
                {editing?.joined_date && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-1">Joined Date</p>
                    <p className="text-sm font-semibold text-green-700">{editing.joined_date.slice(0, 10)}</p>
                  </div>
                )}
                {editing?.offer_notes && (
                  <div className="md:col-span-2">
                    <p className="text-xs font-medium text-gray-500 mb-1">Offer Notes</p>
                    <p className="text-sm text-gray-700 bg-gray-50 rounded-lg px-3 py-2 border border-gray-200 whitespace-pre-wrap">{editing.offer_notes}</p>
                  </div>
                )}
              </div>
            ) : (
              /* Editable form */
              <div className="space-y-3">
                {offerError && (
                  <p className="text-sm text-red-600">{offerError}</p>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Offered CTC <span className="text-red-500">*</span>
                    </label>
                    <input
                      value={offerForm.offered_ctc}
                      onChange={(e) => setOfferForm((p) => ({ ...p, offered_ctc: e.target.value }))}
                      placeholder="e.g. 8 LPA"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-400 focus:border-amber-400"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Expected Joining Date <span className="text-red-500">*</span></label>
                    <input
                      type="date"
                      value={offerForm.expected_joining_date}
                      onChange={(e) => setOfferForm((p) => ({ ...p, expected_joining_date: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-400 focus:border-amber-400"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Offer Notes</label>
                  <textarea
                    value={offerForm.offer_notes}
                    onChange={(e) => setOfferForm((p) => ({ ...p, offer_notes: e.target.value }))}
                    rows={2}
                    placeholder="Joining bonus, notice period buyout, special conditions…"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-400 focus:border-amber-400"
                  />
                </div>
                <div className="flex justify-end">
                  <button
                    onClick={handleSaveOffer}
                    disabled={savingOffer}
                    className="px-4 py-2 text-sm font-medium text-white bg-amber-500 rounded-lg hover:bg-amber-600 disabled:opacity-50"
                  >
                    {savingOffer ? 'Saving…' : 'Save Offer Details'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Interviewer Assessment (read-only) ── */}
        {interviewDone && (
          <div className="mt-6 pt-5 border-t-2 border-indigo-100 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-indigo-700 uppercase tracking-wide">Interviewer Assessment</h3>
              <div className="flex items-center gap-4 text-xs text-gray-500">
                {editing?.sourcing_date && (
                  <span>Sourcing Date: <span className="font-medium text-gray-700">{editing.sourcing_date.slice(0, 10)}</span></span>
                )}
                {editing?.interview_done_date && (
                  <span>Interview done: <span className="font-medium text-gray-700">{editing.interview_done_date.slice(0, 10)}</span></span>
                )}
              </div>
            </div>

            {competencies?.functional && (
              <ReadOnlyCompetencyTable
                title="Assessment of functional / technical competencies"
                items={FUNCTIONAL_ITEMS}
                ratings={competencies.functional}
              />
            )}

            {competencies?.behavioral && (
              <ReadOnlyCompetencyTable
                title="Assessment of behavioral competencies"
                items={BEHAVIORAL_ITEMS}
                ratings={competencies.behavioral}
              />
            )}

            {parsedFeedback && (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-gray-600">Result:</span>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${
                    parsedFeedback.result === 'accepted' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {parsedFeedback.result}
                  </span>
                </div>
                {parsedFeedback.reason && (
                  <div>
                    <p className="text-sm font-medium text-gray-600 mb-1">Rejection Reason</p>
                    <p className="text-sm text-gray-700 bg-gray-50 rounded-lg px-3 py-2 border border-gray-200">{parsedFeedback.reason}</p>
                  </div>
                )}
                {parsedFeedback.remarks && (
                  <div>
                    <p className="text-sm font-medium text-gray-600 mb-1">Remarks</p>
                    <p className="text-sm text-gray-700 bg-gray-50 rounded-lg px-3 py-2 border border-gray-200 whitespace-pre-wrap">{parsedFeedback.remarks}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Request Approval ── */}
        {showRequestApproval && (
          <div className="mt-4 pt-4 border-t border-gray-200 flex items-center justify-between">
            <p className="text-xs text-gray-500">Offer details saved. Send to Director for approval.</p>
            <button
              onClick={handleRequestApproval}
              disabled={requestingApproval}
              className="px-4 py-2 text-sm font-medium text-white bg-amber-500 rounded-lg hover:bg-amber-600 disabled:opacity-50"
            >
              {requestingApproval ? 'Requesting…' : 'Request Approval'}
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}
