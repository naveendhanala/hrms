import { useState, useEffect, useCallback } from 'react';
import AppLayout from '../../components/shared/AppLayout';
import PositionRequestForm from '../../components/ats/projectlead/PositionRequestForm';
import InterviewerFeedbackTab from '../../components/ats/shared/InterviewerFeedbackTab';
import { listPositions, getPipeline } from '../../api/ats-positions';
import { listCandidates } from '../../api/ats-candidates';
import type { Position, PipelineItem, Candidate } from '../../types';

type Tab = 'new' | 'requests' | 'feedback';

export default function ProjectLeadPage() {
  const [tab, setTab] = useState<Tab>('new');
  const [requests, setRequests] = useState<Position[]>([]);
  const [pipelineMap, setPipelineMap] = useState<Record<string, PipelineItem>>({});
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<{ jobId: string; stage: string } | null>(null);
  const [candidateCache, setCandidateCache] = useState<Record<string, Candidate[]>>({});

  const loadRequests = useCallback(() => {
    setLoading(true);
    Promise.all([
      listPositions({ approval_status: 'requests' }),
      getPipeline(),
    ])
      .then(([positions, pipeline]) => {
        setRequests(positions);
        setPipelineMap(Object.fromEntries(pipeline.map((p) => [p.job_id, p])));
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadRequests(); }, [loadRequests]);

  const handleSubmitSuccess = () => {
    loadRequests();
    setTab('requests');
  };

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

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-1">Project Lead Dashboard</h1>
        <p className="text-gray-500">Applicant Tracking System</p>
      </div>

      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {([['new', 'New Request'], ['requests', 'My Requests'], ['feedback', 'My Interviews']] as [Tab, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === key ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'new' && <PositionRequestForm onSuccess={handleSubmitSuccess} />}
      {tab === 'feedback' && <InterviewerFeedbackTab />}

      {tab === 'requests' && (
        <div>
          {loading ? (
            <p className="text-gray-500">Loading...</p>
          ) : requests.length === 0 ? (
            <p className="text-gray-500">No requests submitted yet.</p>
          ) : (
            <div className="overflow-x-auto bg-white rounded-xl shadow-sm border border-gray-200">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {['Job ID', 'Project', 'Department', 'Role', 'Total Req', 'Joined', 'Offer Released', 'Status'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {requests.map((p) => {
                    const counts = pipelineMap[p.job_id]?.stage_counts ?? {};
                    const joinedCount = counts['Joined'] ?? 0;
                    const offerCount = counts['Offer Released'] ?? 0;

                    const CountCell = ({ stage, count }: { stage: string; count: number }) => {
                      const isOpen = expanded?.jobId === p.job_id && expanded?.stage === stage;
                      return (
                        <td className="px-4 py-3 text-sm text-center">
                          {count > 0 ? (
                            <button
                              onClick={() => toggleExpand(p.job_id, stage, count)}
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

                    const expandedKey = `${p.job_id}::${expanded?.stage}`;
                    const expandedCandidates = candidateCache[expandedKey] ?? [];
                    const isExpanded = expanded?.jobId === p.job_id;

                    return (
                      <>
                        <tr key={p.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">{p.job_id}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{p.project}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{p.department}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{p.role}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{p.total_req}</td>
                          <CountCell stage="Joined" count={joinedCount} />
                          <CountCell stage="Offer Released" count={offerCount} />
                          <td className="px-4 py-3 text-sm">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              p.approval_status === 'approved' ? 'bg-green-100 text-green-700'
                                : p.approval_status === 'rejected' ? 'bg-red-100 text-red-700'
                                  : 'bg-yellow-100 text-yellow-700'
                            }`}>
                              {p.approval_status}
                            </span>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr key={`${p.id}-expanded`} className="bg-indigo-50">
                            <td colSpan={8} className="px-6 py-3">
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
                                      <th className="text-left pb-1 pr-6 font-medium">Current Role</th>
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
                                        <td className="py-1.5 pr-6 text-gray-600">{c.candidate_current_role || '—'}</td>
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
        </div>
      )}
    </AppLayout>
  );
}
