import { useState, useEffect, useCallback } from 'react';
import AppLayout from '../../components/shared/AppLayout';
import { listCandidates, approveOffer, rejectOffer } from '../../api/ats-candidates';
import type { Candidate } from '../../types';
import ReportView from '../../components/ats/hr/ReportView';

type Tab = 'approvals' | 'reports';

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
  try {
    const obj = JSON.parse(text);
    return {
      result: (obj.result ?? '').toLowerCase(),
      reason: obj.reject_reason ?? '',
      remarks: obj.remarks ?? '',
    };
  } catch {
    // legacy pipe-delimited rows
    const result  = text.match(/Result:\s*(accepted|rejected)/i)?.[1]?.toLowerCase() ?? '';
    const reason  = text.match(/Reason:\s*([^|]+)/)?.[1]?.trim() ?? '';
    const remarks = text.match(/Remarks:\s*([\s\S]*)$/)?.[1]?.trim() ?? '';
    return { result, reason, remarks };
  }
}

function CandidateDetailModal({ candidate, onClose }: { candidate: Candidate; onClose: () => void }) {
  const parsedFeedback = candidate.feedback ? parseFeedback(candidate.feedback) : null;
  const competencies = (() => {
    try { return candidate.competency_feedback ? JSON.parse(candidate.competency_feedback) : null; }
    catch { return null; }
  })();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{candidate.name}</h2>
            <p className="text-sm text-gray-500 mt-0.5">{candidate.job_id} · {candidate.role} · {candidate.project}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
        </div>

        <div className="px-6 py-5 overflow-y-auto flex-1 space-y-6">

          {/* Basic Info */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            {[
              ['Mobile', candidate.mobile],
              ['Stage', candidate.stage],
              ['Interviewer', candidate.interviewer],
              ['HR SPOC', candidate.hr_spoc],
              ['Current Role', candidate.candidate_current_role],
              ['Current Company', candidate.current_company],
              ['Experience', candidate.experience],
              ['Current CTC', candidate.current_ctc],
              ['Expected CTC', candidate.expected_ctc],
              ['Notice Period', candidate.notice_period],
            ].filter(([, v]) => v).map(([label, value]) => (
              <div key={label as string}>
                <p className="text-xs text-gray-500 mb-0.5">{label}</p>
                <p className="font-medium text-gray-800">{value}</p>
              </div>
            ))}
          </div>

          {/* Offer Details */}
          {(candidate.offered_ctc || candidate.expected_joining_date) && (
            <div className="pt-4 border-t-2 border-amber-100 space-y-3">
              <h3 className="text-sm font-bold text-amber-700 uppercase tracking-wide">Offer Details</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                {candidate.offered_ctc && (
                  <div>
                    <p className="text-xs text-gray-500 mb-0.5">Offered CTC</p>
                    <p className="font-bold text-amber-700">{candidate.offered_ctc}</p>
                  </div>
                )}
                {candidate.expected_joining_date && (
                  <div>
                    <p className="text-xs text-gray-500 mb-0.5">Expected Joining Date</p>
                    <p className="font-medium text-gray-800">{candidate.expected_joining_date.slice(0, 10)}</p>
                  </div>
                )}
              </div>
              {candidate.offer_notes && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">Offer Notes</p>
                  <p className="text-sm text-gray-700 bg-amber-50 rounded-lg px-3 py-2 border border-amber-200 whitespace-pre-wrap">{candidate.offer_notes}</p>
                </div>
              )}
            </div>
          )}

          {/* Interviewer Assessment */}
          {(candidate.feedback || candidate.interview_done_date) && (
            <div className="pt-4 border-t-2 border-indigo-100 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-indigo-700 uppercase tracking-wide">Interviewer Assessment</h3>
                {candidate.interview_done_date && (
                  <span className="text-xs text-gray-500">
                    Interview done: <span className="font-medium text-gray-700">{candidate.interview_done_date.slice(0, 10)}</span>
                  </span>
                )}
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
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex justify-end flex-shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DirectorPage() {
  const [tab, setTab] = useState<Tab>('approvals');
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailCandidate, setDetailCandidate] = useState<Candidate | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listCandidates();
      setCandidates(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const pending = candidates.filter((c) => c.stage === 'Offer Approval Pending');

  const handleApprove = async (id: string) => {
    await approveOffer(id);
    setDetailCandidate(null);
    load();
  };

  const handleReject = async (id: string) => {
    await rejectOffer(id);
    setDetailCandidate(null);
    load();
  };

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-1">Director Dashboard</h1>
        <p className="text-gray-500">Applicant Tracking System</p>
      </div>

      <div className="flex gap-1 mb-6 border-b border-gray-200">
        <button
          onClick={() => setTab('approvals')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === 'approvals' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Offer Approvals
          {pending.length > 0 && (
            <span className="ml-2 inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-red-500 rounded-full">
              {pending.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab('reports')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === 'reports' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Reports
        </button>
      </div>

      {tab === 'approvals' && (
        <div>
          {loading ? (
            <p className="text-gray-500">Loading...</p>
          ) : pending.length === 0 ? (
            <p className="text-gray-500">No pending offer approvals.</p>
          ) : (
            <div className="overflow-x-auto bg-white rounded-xl shadow-sm border border-gray-200">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {['Candidate', 'Job ID / Role', 'Offered CTC', 'Exp. Joining Date', 'HR SPOC', 'Actions'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {pending.map((c) => (
                    <tr
                      key={c.id}
                      className="hover:bg-indigo-50 cursor-pointer group"
                      onClick={() => setDetailCandidate(c)}
                    >
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{c.name}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        <span className="font-medium">{c.job_id}</span>
                        <span className="text-gray-400"> · {c.role}</span>
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-amber-700">{c.offered_ctc || '—'}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{c.expected_joining_date?.slice(0, 10) || '—'}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{c.hr_spoc}</td>
                      <td className="px-4 py-3 text-sm" onClick={(e) => e.stopPropagation()}>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleReject(c.id)}
                            className="px-3 py-1.5 text-xs font-medium text-white bg-red-500 rounded-lg hover:bg-red-600"
                          >
                            Reject
                          </button>
                          <button
                            onClick={() => handleApprove(c.id)}
                            className="px-3 py-1.5 text-xs font-medium text-white bg-green-600 rounded-lg hover:bg-green-700"
                          >
                            Approve
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'reports' && <ReportView />}

      {detailCandidate && (
        <CandidateDetailModal
          candidate={detailCandidate}
          onClose={() => setDetailCandidate(null)}
        />
      )}
    </AppLayout>
  );
}
