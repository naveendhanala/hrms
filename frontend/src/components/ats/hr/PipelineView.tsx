import { useState, useEffect, useMemo } from 'react';
import { getPipeline, updatePosition } from '../../../api/ats-positions';
import { listCandidates } from '../../../api/ats-candidates';
import type { PipelineItem, Candidate } from '../../../types';
import { HR_SPOC_OPTIONS } from '../../../types';
import Badge from '../../shared/Badge';

const TOTAL_COLS = 13;

export default function PipelineView() {
  const [pipeline, setPipeline] = useState<PipelineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [expanded, setExpanded] = useState<{ jobId: string; stage: string } | null>(null);
  const [candidateCache, setCandidateCache] = useState<Record<string, Candidate[]>>({});
  const [spocEdits, setSpocEdits] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);

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

  if (loading) return <p className="text-gray-500">Loading pipeline...</p>;

  return (
    <div>
      {/* Summary cards + toggle */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div className="flex flex-wrap gap-3">
          {summary.map(([spoc, open]) => (
            <div key={spoc} className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-4 py-2.5 shadow-sm">
              <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 text-xs font-bold">
                {spoc.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-800 leading-tight">{spoc}</p>
                <p className="text-xs font-medium text-green-600 leading-tight">{open} open</p>
              </div>
            </div>
          ))}
        </div>

        <div className="flex rounded-lg border border-gray-300 overflow-hidden text-sm font-medium flex-shrink-0">
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
              {pipeline.map((p) => {
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
                        {p.job_id}
                        {isClosed && <span className="ml-1.5 px-1 py-0.5 rounded text-xs font-semibold bg-gray-200 text-gray-500">Closed</span>}
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
                                    <td className="py-1.5 pr-6 text-gray-900 font-medium">{c.name}</td>
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
    </div>
  );
}
