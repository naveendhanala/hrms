import { useState, useEffect, useMemo } from 'react';
import { getPipeline, updatePosition } from '../../../api/ats-positions';
import { listCandidates } from '../../../api/ats-candidates';
import type { PipelineItem, Candidate } from '../../../types';
import { HR_SPOC_OPTIONS } from '../../../types';
import Badge from '../../shared/Badge';

const STAGE_COLORS: Record<string, string> = {
  'Interview':                 'bg-blue-100 text-blue-700',
  'Offer Negotiation':         'bg-yellow-100 text-yellow-700',
  'Offer Approval Pending':    'bg-amber-100 text-amber-700',
  'Offer Released':            'bg-indigo-100 text-indigo-700',
  'Joined':                    'bg-green-100 text-green-700',
  'Rejected':                  'bg-red-100 text-red-700',
  'Offer Dropped':             'bg-gray-100 text-gray-600',
  'Candidate Not Responding':  'bg-orange-100 text-orange-700',
  'Screen Reject':             'bg-rose-100 text-rose-700',
};

const RATINGS = ['Poor', 'Average', 'Good', 'Excellent'] as const;
const FUNCTIONAL_ITEMS = ['Job Knowledge', 'Hands on exposure', 'Knowledge on industry trends'] as const;
const BEHAVIORAL_ITEMS = ['Analytical skills', 'Communication skills', 'Leadership skills'] as const;

function ReadOnlyCompetencyTable({ title, items, ratings }: {
  title: string; items: readonly string[]; ratings: Record<string, string>;
}) {
  return (
    <div>
      <p className="text-sm font-semibold text-gray-700 mb-2">{title}</p>
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-400 w-52" />
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
                    <input type="radio" readOnly disabled checked={ratings[item] === r}
                      className="w-4 h-4 accent-indigo-600 cursor-not-allowed" />
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
  try {
    const obj = JSON.parse(text);
    return { result: (obj.result ?? '').toLowerCase(), reason: obj.reject_reason ?? '', remarks: obj.remarks ?? '' };
  } catch {
    return {
      result:  text.match(/Result:\s*(accepted|rejected)/i)?.[1]?.toLowerCase() ?? '',
      reason:  text.match(/Reason:\s*([^|]+)/)?.[1]?.trim() ?? '',
      remarks: text.match(/Remarks:\s*([\s\S]*)$/)?.[1]?.trim() ?? '',
    };
  }
}

function CandidateProfileModal({ candidate, onClose }: { candidate: Candidate; onClose: () => void }) {
  const parsedFeedback = candidate.feedback ? parseFeedback(candidate.feedback) : null;
  const competencies = (() => {
    try { return candidate.competency_feedback ? JSON.parse(candidate.competency_feedback) : null; }
    catch { return null; }
  })();
  const interviewDone = !!(candidate.feedback || candidate.interview_done_date);
  const hasOffer = !!(candidate.offered_ctc || candidate.offer_release_date);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-start justify-between gap-4 flex-shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{candidate.name}</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {candidate.project} · {candidate.role}
              {candidate.job_id && <span className="text-gray-400"> · {candidate.job_id}</span>}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {candidate.resume_url && (
              <a
                href={candidate.resume_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100"
              >
                View Resume
              </a>
            )}
            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${STAGE_COLORS[candidate.stage] ?? 'bg-gray-100 text-gray-600'}`}>
              {candidate.stage}
            </span>
            <button onClick={onClose} className="ml-1 text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-6">

          {/* Contact & Pipeline */}
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Contact & Pipeline</p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              {[
                ['Mobile', candidate.mobile],
                ['Alternate Mobile', candidate.alternate_mobile],
                ['Interviewer', candidate.interviewer],
                ['HR SPOC', candidate.hr_spoc],
                ['Sourcing Date', candidate.sourcing_date?.slice(0, 10)],
                ['Interview Done', candidate.interview_done_date?.slice(0, 10)],
              ].map(([label, value]) => value ? (
                <div key={label}>
                  <p className="text-xs text-gray-400 mb-0.5">{label}</p>
                  <p className="text-sm text-gray-800 font-medium">{value}</p>
                </div>
              ) : null)}
            </div>
          </div>

          {/* Professional Background */}
          {(candidate.candidate_current_role || (candidate as any).current_company ||
            (candidate as any).experience || (candidate as any).current_ctc ||
            (candidate as any).expected_ctc || (candidate as any).notice_period) && (
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Professional Background</p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                {[
                  ['Current Role', candidate.candidate_current_role],
                  ['Current Company', (candidate as any).current_company],
                  ['Experience', (candidate as any).experience],
                  ['Current CTC', (candidate as any).current_ctc],
                  ['Expected CTC', (candidate as any).expected_ctc],
                  ['Notice Period', (candidate as any).notice_period],
                ].map(([label, value]) => value ? (
                  <div key={label}>
                    <p className="text-xs text-gray-400 mb-0.5">{label}</p>
                    <p className="text-sm text-gray-800 font-medium">{value}</p>
                  </div>
                ) : null)}
              </div>
            </div>
          )}

          {/* Interviewer Assessment */}
          {interviewDone && (
            <div className="space-y-4 pt-2 border-t-2 border-indigo-100">
              <p className="text-xs font-bold text-indigo-700 uppercase tracking-wide pt-2">Interviewer Assessment</p>
              {competencies?.functional && (
                <ReadOnlyCompetencyTable
                  title="Functional / Technical Competencies"
                  items={FUNCTIONAL_ITEMS}
                  ratings={competencies.functional}
                />
              )}
              {competencies?.behavioral && (
                <ReadOnlyCompetencyTable
                  title="Behavioral Competencies"
                  items={BEHAVIORAL_ITEMS}
                  ratings={competencies.behavioral}
                />
              )}
              {parsedFeedback && (
                <div className="space-y-3">
                  {parsedFeedback.result && (
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-gray-600">Result:</span>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${
                        parsedFeedback.result === 'accepted' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>{parsedFeedback.result}</span>
                    </div>
                  )}
                  {parsedFeedback.reason && (
                    <div>
                      <p className="text-xs text-gray-400 mb-1">Rejection Reason</p>
                      <p className="text-sm text-gray-700 bg-gray-50 rounded-lg px-3 py-2 border border-gray-200">{parsedFeedback.reason}</p>
                    </div>
                  )}
                  {parsedFeedback.remarks && (
                    <div>
                      <p className="text-xs text-gray-400 mb-1">Remarks</p>
                      <p className="text-sm text-gray-700 bg-gray-50 rounded-lg px-3 py-2 border border-gray-200 whitespace-pre-wrap">{parsedFeedback.remarks}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Offer Details */}
          {hasOffer && (
            <div className="pt-2 border-t-2 border-amber-100">
              <p className="text-xs font-bold text-amber-700 uppercase tracking-wide pt-2 mb-3">Offer Details</p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                {[
                  ['Offered CTC', candidate.offered_ctc],
                  ['Expected Joining Date', candidate.expected_joining_date?.slice(0, 10)],
                  ['Offer Release Date', candidate.offer_release_date?.slice(0, 10)],
                  ['Joined Date', candidate.joined_date?.slice(0, 10)],
                ].map(([label, value]) => value ? (
                  <div key={label}>
                    <p className="text-xs text-gray-400 mb-0.5">{label}</p>
                    <p className="text-sm text-gray-800 font-medium">{value}</p>
                  </div>
                ) : null)}
              </div>
              {candidate.offer_notes && (
                <div className="mt-3">
                  <p className="text-xs text-gray-400 mb-1">Offer Notes</p>
                  <p className="text-sm text-gray-700 bg-amber-50 rounded-lg px-3 py-2 border border-amber-100 whitespace-pre-wrap">{candidate.offer_notes}</p>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

const TOTAL_COLS = 13;

export default function PipelineView() {
  const [pipeline, setPipeline] = useState<PipelineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [expanded, setExpanded] = useState<{ jobId: string; stage: string } | null>(null);
  const [candidateCache, setCandidateCache] = useState<Record<string, Candidate[]>>({});
  const [spocEdits, setSpocEdits] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [jdExpanded, setJdExpanded] = useState<string | null>(null);
  const [spocFilter, setSpocFilter] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const load = (all: boolean) => {
    setLoading(true);
    getPipeline(all ? { showAll: 'true' } : undefined)
      .then(setPipeline)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(showAll); }, [showAll]);

  const handleSpocChange = (jobId: string, value: string) => {
    setSpocEdits((prev) => ({ ...prev, [jobId]: value }));
  };

  const handleSpocSave = async (jobId: string) => {
    const spoc = spocEdits[jobId];
    if (!spoc) return;
    setSaving(jobId);
    try {
      await updatePosition(jobId, { hr_spoc: spoc });
      setPipeline((prev) => prev.map((p) => p.job_id === jobId ? { ...p, hr_spoc: spoc } : p));
      setSpocEdits((prev) => { const next = { ...prev }; delete next[jobId]; return next; });
    } finally {
      setSaving(null);
    }
  };

  const currentSpoc = (p: PipelineItem) => spocEdits[p.job_id] ?? p.hr_spoc;
  const isSpocDirty = (p: PipelineItem) => spocEdits[p.job_id] !== undefined && spocEdits[p.job_id] !== p.hr_spoc;

  const toggleExpand = async (jobId: string, stage: string, count: number) => {
    if (count === 0) return;
    const key = `${jobId}::${stage}`;
    if (expanded?.jobId === jobId && expanded?.stage === stage) {
      setExpanded(null);
      return;
    }
    setExpanded({ jobId, stage });
    if (!candidateCache[key]) {
      const data = await listCandidates({ job_id: jobId, stage });
      setCandidateCache((prev) => ({ ...prev, [key]: data }));
    }
  };

  // Summary cards: per HR SPOC — open & total active positions
  const summary = useMemo(() => {
    const map: Record<string, number> = {};
    for (const p of pipeline.filter((p) => p.status === 'Active')) {
      const spoc = p.hr_spoc || 'Unassigned';
      const open = Math.max(0, p.total_req - (p.stage_counts['Joined'] ?? 0) - (p.stage_counts['Offer Released'] ?? 0));
      map[spoc] = (map[spoc] ?? 0) + open;
    }
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [pipeline]);

  const visiblePipeline = spocFilter
    ? pipeline.filter((p) => (p.hr_spoc || 'Unassigned') === spocFilter)
    : pipeline;

  const handleExport = async () => {
    setExporting(true);
    try {
      const XLSX = await import('xlsx');
      const headers = [
        'Job ID', 'Project', 'Department', 'Role', 'Required By', 'HR SPOC', 'Status',
        'Total Req', 'Joined', 'Offer Released', 'Open',
        'Offer Approval Pending', 'Offer Negotiation', 'Interview',
      ];
      const rows = visiblePipeline.map((p) => {
        const open = Math.max(0, p.total_req - (p.stage_counts['Joined'] ?? 0) - (p.stage_counts['Offer Released'] ?? 0));
        return [
          p.job_id,
          p.project,
          p.department || '',
          p.role,
          p.required_by_date?.slice(0, 10) || '',
          p.hr_spoc,
          p.status,
          p.total_req,
          p.stage_counts['Joined'] ?? 0,
          p.stage_counts['Offer Released'] ?? 0,
          open,
          p.stage_counts['Offer Approval Pending'] ?? 0,
          p.stage_counts['Offer Negotiation'] ?? 0,
          p.stage_counts['Interview'] ?? 0,
        ];
      });
      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      ws['!cols'] = headers.map((h) => ({ wch: Math.max(h.length + 2, 14) }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Requirement List');
      const label = spocFilter ? `_${spocFilter.replace(/\s+/g, '_')}` : '';
      const mode = showAll ? '_all' : '_active';
      XLSX.writeFile(wb, `requirement_list${label}${mode}_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (err) {
      console.error(err);
    } finally {
      setExporting(false);
    }
  };

  if (loading) return <p className="text-gray-500">Loading pipeline...</p>;

  return (
    <div>
      {/* Summary cards + toggle */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div className="flex flex-wrap gap-3">
          {summary.map(([spoc, open]) => {
            const active = spocFilter === spoc;
            return (
              <button
                key={spoc}
                onClick={() => setSpocFilter(active ? null : spoc)}
                className={`flex items-center gap-2 rounded-xl px-4 py-2.5 shadow-sm border transition-colors ${
                  active
                    ? 'bg-indigo-600 border-indigo-600 text-white'
                    : 'bg-white border-gray-200 hover:border-indigo-300 hover:bg-indigo-50'
                }`}
              >
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                  active ? 'bg-indigo-500 text-white' : 'bg-indigo-100 text-indigo-700'
                }`}>
                  {spoc.charAt(0).toUpperCase()}
                </div>
                <div className="text-left">
                  <p className={`text-xs font-semibold leading-tight ${active ? 'text-white' : 'text-gray-800'}`}>{spoc}</p>
                  <p className={`text-xs font-medium leading-tight ${active ? 'text-indigo-200' : 'text-green-600'}`}>{open} open</p>
                </div>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={handleExport}
            disabled={exporting || visiblePipeline.length === 0}
            className="px-4 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 whitespace-nowrap"
          >
            {exporting ? 'Exporting…' : `↓ Export${visiblePipeline.length > 0 ? ` (${visiblePipeline.length})` : ''}`}
          </button>
          <div className="flex rounded-lg border border-gray-300 overflow-hidden text-sm font-medium">
            <button
              onClick={() => setShowAll(false)}
              className={`px-3 py-1.5 transition-colors ${!showAll ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
            >
              Active
            </button>
            <button
              onClick={() => setShowAll(true)}
              className={`px-3 py-1.5 transition-colors border-l border-gray-300 ${showAll ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
            >
              All
            </button>
          </div>
        </div>
      </div>

      {pipeline.length === 0 ? (
        <p className="text-gray-500">No pipeline data available.</p>
      ) : (
        <div className="overflow-x-auto bg-white rounded-xl shadow-sm border border-gray-200">
          <table className="w-full divide-y divide-gray-200 text-xs">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-2 py-2 text-left font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Job ID</th>
                <th className="px-2 py-2 text-left font-medium text-gray-500 uppercase tracking-wider">Project</th>
                <th className="px-2 py-2 text-left font-medium text-gray-500 uppercase tracking-wider">Dept</th>
                <th className="px-2 py-2 text-left font-medium text-gray-500 uppercase tracking-wider">Role</th>
                <th className="px-2 py-2 text-left font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Req By</th>
                <th className="px-2 py-2 text-left font-medium text-gray-500 uppercase tracking-wider">HR SPOC</th>
                <th className="px-2 py-2 text-center font-medium text-gray-500 uppercase tracking-wider">Req</th>
                <th className="px-2 py-2 text-center font-medium text-teal-600 uppercase tracking-wider">Joined</th>
                <th className="px-2 py-2 text-center font-medium text-green-600 uppercase tracking-wider whitespace-nowrap">Offer Released</th>
                <th className="px-2 py-2 text-center font-medium text-gray-500 uppercase tracking-wider">Open</th>
                <th className="px-2 py-2 text-center font-medium text-amber-600 uppercase tracking-wider whitespace-nowrap">Offer Approval Pending</th>
                <th className="px-2 py-2 text-center font-medium text-yellow-600 uppercase tracking-wider whitespace-nowrap">Offer Negotiation</th>
                <th className="px-2 py-2 text-center font-medium text-blue-600 uppercase tracking-wider">Interview</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {visiblePipeline.map((p) => {
                const isExpanded = expanded?.jobId === p.job_id;
                const expandedKey = `${p.job_id}::${expanded?.stage}`;
                const expandedCandidates = candidateCache[expandedKey] ?? [];
                const open = Math.max(0, p.total_req - (p.stage_counts['Joined'] ?? 0) - (p.stage_counts['Offer Released'] ?? 0));
                const isClosed = p.status !== 'Active';

                const StageCell = ({ stage, color }: { stage: string; color: 'blue' | 'yellow' | 'green' | 'teal' | 'red' | 'gray' }) => {
                  const count = p.stage_counts[stage] ?? 0;
                  const active = isExpanded && expanded?.stage === stage;
                  return (
                    <td className="px-2 py-2 text-center">
                      {count > 0 ? (
                        <button onClick={() => toggleExpand(p.job_id, stage, count)} className="inline-flex items-center gap-0.5">
                          <Badge label={`${count}${active ? ' ▲' : ' ▼'}`} color={active ? 'blue' : color} />
                        </button>
                      ) : (
                        <span className="text-gray-300">0</span>
                      )}
                    </td>
                  );
                };

                return (
                  <>
                    <tr key={p.job_id} className={isClosed ? 'bg-gray-50 opacity-60' : 'hover:bg-gray-50'}>
                      <td className="px-2 py-2 font-medium text-gray-900 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span>{p.job_id}</span>
                          {isClosed && <span className="px-1 py-0.5 rounded text-xs font-semibold bg-gray-200 text-gray-500">Closed</span>}
                          {p.job_description && (
                            <button
                              onClick={() => setJdExpanded(jdExpanded === p.job_id ? null : p.job_id)}
                              title="View Job Description"
                              className={`px-1.5 py-0.5 rounded text-xs font-semibold transition-colors ${
                                jdExpanded === p.job_id
                                  ? 'bg-indigo-600 text-white'
                                  : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
                              }`}
                            >
                              JD
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-2 py-2 text-gray-600">{p.project}</td>
                      <td className="px-2 py-2 text-gray-600">{p.department || '—'}</td>
                      <td className="px-2 py-2 text-gray-600">{p.role}</td>
                      <td className="px-2 py-2 text-gray-600 whitespace-nowrap">{p.required_by_date?.slice(0, 10) || '—'}</td>
                      <td className="px-2 py-2">
                        {isClosed ? (
                          <span className="text-gray-500 text-xs">{p.hr_spoc || '—'}</span>
                        ) : (
                          <div className="flex items-center gap-1">
                            <select
                              value={currentSpoc(p)}
                              onChange={(e) => handleSpocChange(p.job_id, e.target.value)}
                              className="border border-gray-300 rounded px-1.5 py-0.5 text-xs focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                            >
                              {HR_SPOC_OPTIONS.map((h) => <option key={h} value={h}>{h}</option>)}
                            </select>
                            {isSpocDirty(p) && (
                              <button
                                onClick={() => handleSpocSave(p.job_id)}
                                disabled={saving === p.job_id}
                                className="px-1.5 py-0.5 text-xs font-medium text-white bg-indigo-600 rounded hover:bg-indigo-700 disabled:opacity-50 whitespace-nowrap"
                              >
                                {saving === p.job_id ? '…' : 'Save'}
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-2 py-2 text-gray-600 text-center">{p.total_req}</td>
                      <StageCell stage="Joined"                 color="teal"   />
                      <StageCell stage="Offer Released"         color="green"  />
                      <td className="px-2 py-2 font-semibold text-gray-900 text-center">{open}</td>
                      <StageCell stage="Offer Approval Pending" color="yellow" />
                      <StageCell stage="Offer Negotiation"      color="yellow" />
                      <StageCell stage="Interview"              color="blue"   />
                    </tr>

                    {jdExpanded === p.job_id && (
                      <tr key={`${p.job_id}-jd`} className="bg-indigo-50/60 border-t border-indigo-100">
                        <td colSpan={TOTAL_COLS} className="px-6 py-4">
                          <p className="text-xs font-bold text-indigo-700 uppercase tracking-wider mb-2">Job Description — {p.job_id}</p>
                          <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{p.job_description}</p>
                        </td>
                      </tr>
                    )}

                    {isExpanded && (
                      <tr key={`${p.job_id}-exp`} className="bg-indigo-50">
                        <td colSpan={TOTAL_COLS} className="px-6 py-3">
                          <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wider mb-2">
                            {expanded!.stage} — {expandedCandidates.length} candidate{expandedCandidates.length !== 1 ? 's' : ''}
                          </p>
                          {expandedCandidates.length === 0 ? (
                            <p className="text-xs text-gray-400">Loading…</p>
                          ) : (
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="text-xs text-indigo-600 uppercase tracking-wider">
                                  <th className="text-left pb-1 pr-6 font-medium">Name</th>
                                  <th className="text-left pb-1 pr-6 font-medium">Mobile</th>
                                  <th className="text-left pb-1 pr-6 font-medium">Current Role</th>
                                  <th className="text-left pb-1 pr-6 font-medium">Sourcing Date</th>
                                  <th className="text-left pb-1 pr-6 font-medium">Interviewer</th>
                                  <th className="text-left pb-1 font-medium">HR SPOC</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-indigo-100">
                                {expandedCandidates.map((c) => (
                                  <tr key={c.id}>
                                    <td className="py-1.5 pr-6">
                                      <button
                                        onClick={() => setSelectedCandidate(c)}
                                        className="text-indigo-700 font-medium hover:underline text-left"
                                      >
                                        {c.name}
                                      </button>
                                    </td>
                                    <td className="py-1.5 pr-6 text-gray-600">{c.mobile}</td>
                                    <td className="py-1.5 pr-6 text-gray-600">{c.candidate_current_role || '—'}</td>
                                    <td className="py-1.5 pr-6 text-gray-600">{c.sourcing_date?.slice(0, 10) || '—'}</td>
                                    <td className="py-1.5 pr-6 text-gray-600">{c.interviewer}</td>
                                    <td className="py-1.5 text-gray-600">{c.hr_spoc}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {selectedCandidate && (
        <CandidateProfileModal
          candidate={selectedCandidate}
          onClose={() => setSelectedCandidate(null)}
        />
      )}
    </div>
  );
}
