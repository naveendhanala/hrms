import { useState, useEffect, useCallback } from 'react';
import { listPositions, updatePosition, getPipeline } from '../../../api/ats-positions';
import { listCandidates } from '../../../api/ats-candidates';
import { getDeptRoles } from '../../../api/ats-config';
import type { Position, PipelineItem, Candidate } from '../../../types';
import type { DeptRole } from '../../../api/ats-config';
import { HR_SPOC_OPTIONS, POSITION_STATUS_OPTIONS } from '../../../types';
import EmployeeMultiSelect from '../../shared/EmployeeMultiSelect';

const countWords = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;

export default function PositionRequestList() {
  const [positions, setPositions] = useState<Position[]>([]);
  const [pipelineMap, setPipelineMap] = useState<Record<string, PipelineItem>>({});
  const [deptRoles, setDeptRoles] = useState<DeptRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'pending' | 'all'>('all');
  const [selected, setSelected] = useState<Position | null>(null);
  const [form, setForm] = useState<Partial<Position>>({});
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState<{ jobId: string; stage: string } | null>(null);
  const [candidateCache, setCandidateCache] = useState<Record<string, Candidate[]>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [data, pipeline] = await Promise.all([
        listPositions({ approval_status: 'requests' }),
        getPipeline(),
      ]);
      setPositions(data);
      setPipelineMap(Object.fromEntries(pipeline.map((p) => [p.job_id, p])));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { getDeptRoles().then(setDeptRoles).catch(console.error); }, []);

  const availableRoles = deptRoles.find((d) => d.department === form.department)?.roles ?? [];

  const openModal = (p: Position) => {
    setSelected(p);
    setForm({
      ...p,
      required_by_date: p.required_by_date?.slice(0, 10) ?? '',
    });
  };

  const closeModal = () => { setSelected(null); setForm({}); };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (name === 'department') {
      setForm((prev) => ({ ...prev, department: value, role: '', level: '' }));
    } else if (name === 'role') {
      const roleEntry = availableRoles.find((r) => r.name === value);
      setForm((prev) => ({ ...prev, role: value, level: roleEntry?.level ?? prev.level ?? '' }));
    } else {
      setForm((prev) => ({ ...prev, [name]: name === 'total_req' ? Number(value) : value }));
    }
  };

  const handleSave = async (extraFields?: Partial<Position>) => {
    if (!selected) return;
    setSaving(true);
    try {
      await updatePosition(selected.job_id, { ...form, ...extraFields });
      await load();
      closeModal();
    } finally {
      setSaving(false);
    }
  };

  const toggleExpand = async (jobId: string, stage: string, count: number, e: React.MouseEvent) => {
    e.stopPropagation();
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

  const filtered =
    filter === 'pending'
      ? positions.filter((p) => p.approval_status === 'pending')
      : positions;

  const COLS = ['Job ID', 'Project', 'Department', 'Role', 'Total Req', 'Joined', 'Offer Released', 'Status', ''];

  return (
    <div>
      <div className="mb-6">
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 text-sm rounded-lg font-medium ${filter === 'all' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-600 hover:bg-gray-100'}`}
          >
            All
          </button>
          <button
            onClick={() => setFilter('pending')}
            className={`px-3 py-1.5 text-sm rounded-lg font-medium ${filter === 'pending' ? 'bg-yellow-100 text-yellow-700' : 'text-gray-600 hover:bg-gray-100'}`}
          >
            {(() => { const n = positions.filter((p) => p.approval_status === 'pending').length; return n > 0 ? `Pending (${n})` : 'Pending'; })()}
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : filtered.length === 0 ? (
        <p className="text-gray-500">No position requests found.</p>
      ) : (
        <div className="overflow-x-auto bg-white rounded-xl shadow-sm border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {COLS.map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filtered.map((p) => {
                const counts = pipelineMap[p.job_id]?.stage_counts ?? {};
                const joinedCount = counts['Joined'] ?? 0;
                const offerCount = counts['Offer Released'] ?? 0;
                const isExpanded = expanded?.jobId === p.job_id;
                const expandedKey = `${p.job_id}::${expanded?.stage}`;
                const expandedCandidates = candidateCache[expandedKey] ?? [];

                const CountCell = ({ stage, count }: { stage: string; count: number }) => {
                  const isOpen = isExpanded && expanded?.stage === stage;
                  return (
                    <td className="px-4 py-3 text-sm text-center" onClick={(e) => e.stopPropagation()}>
                      {count > 0 ? (
                        <button
                          onClick={(e) => toggleExpand(p.job_id, stage, count, e)}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold transition-colors ${
                            isOpen ? 'bg-indigo-600 text-white' : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
                          }`}
                        >
                          {count}
                          <span className="text-[10px]">{isOpen ? '▲' : '▼'}</span>
                        </button>
                      ) : (
                        <span className="text-gray-400">0</span>
                      )}
                    </td>
                  );
                };

                return (
                  <>
                    <tr key={p.id} className="hover:bg-indigo-50 cursor-pointer group" onClick={() => openModal(p)}>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{p.job_id}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{p.project}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{p.department}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{p.role}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{p.total_req}</td>
                      <CountCell stage="Joined" count={joinedCount} />
                      <CountCell stage="Offer Released" count={offerCount} />
                      <td className="px-4 py-3 text-sm" onClick={(e) => e.stopPropagation()}>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          p.status === 'closed' ? 'bg-gray-100 text-gray-500'
                            : p.approval_status === 'approved' ? 'bg-green-100 text-green-700'
                              : p.approval_status === 'rejected' ? 'bg-red-100 text-red-700'
                                : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {p.status === 'closed' ? 'closed' : p.approval_status}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-gray-300 group-hover:text-indigo-400 transition-colors text-base">
                        ›
                      </td>
                    </tr>

                    {isExpanded && (
                      <tr key={`${p.id}-exp`} className="bg-indigo-50">
                        <td colSpan={COLS.length} className="px-6 py-3">
                          <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wider mb-2">
                            {expanded.stage} — {expandedCandidates.length} candidate{expandedCandidates.length !== 1 ? 's' : ''}
                          </p>
                          {expandedCandidates.length === 0 ? (
                            <p className="text-xs text-gray-400">Loading…</p>
                          ) : (
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="text-xs text-indigo-600 uppercase tracking-wider">
                                  <th className="text-left pb-1 pr-6 font-medium">Name</th>
                                  <th className="text-left pb-1 pr-6 font-medium">Mobile</th>
                                  <th className="text-left pb-1 pr-6 font-medium">Expected Joining Date</th>
                                  <th className="text-left pb-1 pr-6 font-medium">
                                    {expanded.stage === 'Joined' ? 'Joined Date' : 'Offer Release Date'}
                                  </th>
                                  <th className="text-left pb-1 font-medium">HR SPOC</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-indigo-100">
                                {expandedCandidates.map((c) => (
                                  <tr key={c.id}>
                                    <td className="py-1.5 pr-6 text-gray-900 font-medium">{c.name}</td>
                                    <td className="py-1.5 pr-6 text-gray-600">{c.mobile}</td>
                                    <td className="py-1.5 pr-6 text-gray-600">{c.expected_joining_date?.slice(0, 10) || '—'}</td>
                                    <td className="py-1.5 pr-6 text-gray-600">
                                      {(expanded.stage === 'Joined' ? c.joined_date : c.offer_release_date)?.slice(0, 10) || '—'}
                                    </td>
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

      {/* ── Edit / Approve Modal ─────────────────────────────────────── */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Position Request</h3>
                <p className="text-sm text-gray-500">{selected.job_id}</p>
              </div>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 text-xl font-bold">&times;</button>
            </div>

            <div className="px-6 py-4 space-y-4">
              {/* Two-column grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Job ID</label>
                  <input name="job_id" value={form.job_id ?? ''} disabled className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-gray-100 text-gray-500 cursor-not-allowed" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Project</label>
                  <input name="project" value={form.project ?? ''} disabled className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-gray-100 text-gray-500 cursor-not-allowed" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nature of Work</label>
                  <input name="nature_of_work" value={form.nature_of_work ?? ''} onChange={handleChange} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                  <select name="department" value={form.department ?? ''} onChange={handleChange} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500">
                    <option value="">Select department</option>
                    {deptRoles.map((d) => <option key={d.department} value={d.department}>{d.department}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                  <select name="role" value={form.role ?? ''} onChange={handleChange} disabled={!form.department} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100">
                    <option value="">Select role</option>
                    {availableRoles.map((r) => <option key={r.name} value={r.name}>{r.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Total Required</label>
                  <input name="total_req" type="number" min={1} value={form.total_req ?? 1} onChange={handleChange} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Required By Date</label>
                  <input name="required_by_date" type="date" value={form.required_by_date ?? ''} onChange={handleChange} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">HR SPOC</label>
                  <select name="hr_spoc" value={form.hr_spoc ?? ''} onChange={handleChange} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500">
                    {HR_SPOC_OPTIONS.map((h) => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select name="status" value={form.status ?? 'Active'} onChange={handleChange} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500">
                    {POSITION_STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Interview Panel</label>
                  <EmployeeMultiSelect
                    value={form.interview_panel ?? ''}
                    onChange={(val) => setForm((prev) => ({ ...prev, interview_panel: val }))}
                  />
                </div>
              </div>

              {/* Job Description — full width */}
              <div>
                <div className="flex items-baseline justify-between mb-1">
                  <label className="block text-sm font-medium text-gray-700">Job Description</label>
                  <span className={`text-xs ${countWords(form.job_description ?? '') < 50 ? 'text-red-500' : 'text-green-600'}`}>
                    {countWords(form.job_description ?? '')} / 50 words minimum
                  </span>
                </div>
                <textarea
                  name="job_description"
                  value={form.job_description ?? ''}
                  onChange={handleChange}
                  rows={6}
                  placeholder="Describe the role, responsibilities, required skills and qualifications…"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-y"
                />
              </div>
            </div>

            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">
              <button
                onClick={closeModal}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <div className="flex gap-2">
                <button
                  onClick={() => handleSave()}
                  disabled={saving}
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
                {selected.approval_status === 'approved' && selected.status !== 'closed' && (
                  <button
                    onClick={() => handleSave({ status: 'closed' })}
                    disabled={saving}
                    className="px-4 py-2 text-sm font-medium text-white bg-gray-600 rounded-lg hover:bg-gray-700 disabled:opacity-50"
                  >
                    Mark as Closed
                  </button>
                )}
                {selected.approval_status === 'pending' && (
                  <>
                    <button
                      onClick={() => handleSave({ approval_status: 'rejected' })}
                      disabled={saving}
                      className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
                    >
                      Reject
                    </button>
                    <button
                      onClick={() => handleSave({ approval_status: 'approved' })}
                      disabled={saving}
                      className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50"
                    >
                      Approve
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
