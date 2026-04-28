import { useState, useEffect } from 'react';
import { apiFetch } from '../../../api/client';

interface AssignedCandidate {
  id: string;
  name: string;
  mobile: string;
  job_id: string;
  stage: string;
  interviewer: string;
  feedback: string;
  interview_done_date: string;
  sourcing_date: string;
  role: string;
  project: string;
  department: string;
}

function daysPending(sourcing_date: string): number {
  if (!sourcing_date) return 0;
  const diff = Date.now() - new Date(sourcing_date).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

const STAGE_COLORS: Record<string, string> = {
  'Interview': 'bg-blue-100 text-blue-700',
  'Offer Negotiation':               'bg-yellow-100 text-yellow-700',
  'Offer Released':                  'bg-indigo-100 text-indigo-700',
  'Joined':                          'bg-green-100 text-green-700',
  'Rejected':                        'bg-red-100 text-red-700',
  'Offer Dropped':                   'bg-gray-100 text-gray-600',
  'Candidate Not Responding':        'bg-orange-100 text-orange-700',
  'Screen Reject':                   'bg-rose-100 text-rose-700',
  'Offer Approval Pending':          'bg-amber-100 text-amber-700',
};

type Rating = 'Poor' | 'Average' | 'Good' | 'Excellent';
const RATINGS: Rating[] = ['Poor', 'Average', 'Good', 'Excellent'];

const FUNCTIONAL_ITEMS = ['Job Knowledge', 'Hands on exposure', 'Knowledge on industry trends'] as const;
const BEHAVIORAL_ITEMS = ['Analytical skills', 'Communication skills', 'Leadership skills'] as const;

type FunctionalKey = (typeof FUNCTIONAL_ITEMS)[number];
type BehavioralKey = (typeof BEHAVIORAL_ITEMS)[number];

function CompetencyTable<T extends string>({
  title,
  items,
  ratings,
  onChange,
}: {
  title: string;
  items: readonly T[];
  ratings: Partial<Record<T, Rating>>;
  onChange: (item: T, rating: Rating) => void;
}) {
  return (
    <div>
      <p className="text-sm font-semibold text-gray-800 mb-2">
        {title} <span className="text-red-500">*</span>
      </p>
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 w-48"></th>
              {RATINGS.map((r) => (
                <th key={r} className="px-2 py-2 text-center text-xs font-semibold text-gray-500">{r}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.map((item) => (
              <tr key={item} className="hover:bg-gray-50">
                <td className="px-3 py-2.5 text-gray-700 font-medium text-xs">{item}</td>
                {RATINGS.map((r) => (
                  <td key={r} className="px-2 py-2.5 text-center">
                    <input
                      type="radio"
                      name={item}
                      checked={ratings[item] === r}
                      onChange={() => onChange(item, r)}
                      className="w-4 h-4 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
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

type ModalStep = 'check' | 'no_interview' | 'feedback';
type NoInterviewReason = 'not_responding' | 'resume_mismatch';

const NO_INTERVIEW_OPTIONS: { value: NoInterviewReason; label: string }[] = [
  { value: 'not_responding',  label: 'Candidate Not Responding' },
  { value: 'resume_mismatch', label: 'Resume does not align with job' },
];

export default function InterviewerFeedbackTab({ onPendingCount }: { onPendingCount?: (n: number) => void }) {
  const [candidates, setCandidates] = useState<AssignedCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<AssignedCandidate | null>(null);

  // Modal step state
  const [modalStep, setModalStep] = useState<ModalStep>('check');
  const [interviewCompleted, setInterviewCompleted] = useState<boolean | null>(null);
  const [noInterviewReason, setNoInterviewReason] = useState<NoInterviewReason | null>(null);

  // Feedback form state
  const [result, setResult] = useState<'accepted' | 'rejected'>('accepted');
  const [rejectReason, setRejectReason] = useState('');
  const [remarks, setRemarks] = useState('');
  const [functionalRatings, setFunctionalRatings] = useState<Partial<Record<FunctionalKey, Rating>>>({});
  const [behavioralRatings, setBehavioralRatings] = useState<Partial<Record<BehavioralKey, Rating>>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const fetchCandidates = () => {
    setLoading(true);
    apiFetch<AssignedCandidate[]>('/api/ats/feedback/my-candidates')
      .then((data) => {
        setCandidates(data);
        onPendingCount?.(data.filter((c) => c.stage === 'Interview').length);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchCandidates(); }, []);

  const openModal = (c: AssignedCandidate) => {
    setSelected(c);
    setModalStep('check');
    setInterviewCompleted(null);
    setNoInterviewReason(null);
    setResult('accepted');
    setRejectReason('');
    setRemarks('');
    setFunctionalRatings({});
    setBehavioralRatings({});
    setError('');
  };

  const closeModal = () => setSelected(null);

  const handleInterviewCheck = () => {
    if (interviewCompleted === null) return;
    setError('');
    if (interviewCompleted) {
      setModalStep('feedback');
    } else {
      setNoInterviewReason(null);
      setModalStep('no_interview');
    }
  };

  const handleIncompleteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected || !noInterviewReason) return;
    setSaving(true);
    setError('');
    try {
      await apiFetch(`/api/ats/feedback/by-candidate/${selected.id}/incomplete`, {
        method: 'POST',
        body: JSON.stringify({ reason: noInterviewReason }),
      });
      closeModal();
      fetchCandidates();
    } catch {
      setError('Failed to submit. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;

    if (!remarks.trim()) {
      setError('Remarks is required.');
      return;
    }
    const missingFunctional = FUNCTIONAL_ITEMS.find((k) => !functionalRatings[k]);
    if (missingFunctional) {
      setError(`Please rate "${missingFunctional}" in functional competencies.`);
      return;
    }
    const missingBehavioral = BEHAVIORAL_ITEMS.find((k) => !behavioralRatings[k]);
    if (missingBehavioral) {
      setError(`Please rate "${missingBehavioral}" in behavioral competencies.`);
      return;
    }

    setSaving(true);
    setError('');
    try {
      await apiFetch(`/api/ats/feedback/by-candidate/${selected.id}`, {
        method: 'POST',
        body: JSON.stringify({
          result,
          reject_reason: result === 'rejected' ? rejectReason : undefined,
          remarks,
          functional_competencies: functionalRatings,
          behavioral_competencies: behavioralRatings,
        }),
      });
      closeModal();
      fetchCandidates();
    } catch {
      setError('Failed to submit feedback. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const pending = candidates.filter((c) => c.stage === 'Interview');
  const done    = candidates.filter((c) => c.stage !== 'Interview');

  if (loading) return <p className="text-gray-400 text-sm">Loading…</p>;

  return (
    <div className="space-y-8">
      {candidates.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
          No candidates assigned to you yet.
        </div>
      ) : (
        <>
          {pending.length > 0 && (
            <section>
              <h2 className="text-base font-semibold text-gray-700 mb-3">Pending Feedback ({pending.length})</h2>
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      {['Candidate', 'Mobile', 'Position', 'Sourcing Date', 'Days Pending', 'Stage', ''].map((h) => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {pending.map((c) => (
                      <tr key={c.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-900">{c.name}</td>
                        <td className="px-4 py-3 text-gray-500">{c.mobile}</td>
                        <td className="px-4 py-3 text-gray-600">{c.project} / {c.role}</td>
                        <td className="px-4 py-3 text-gray-500">{c.sourcing_date?.slice(0, 10) || '—'}</td>
                        <td className="px-4 py-3 text-gray-500">{c.sourcing_date ? `${daysPending(c.sourcing_date)}d` : '—'}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STAGE_COLORS[c.stage] ?? 'bg-gray-100 text-gray-600'}`}>
                            {c.stage}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => openModal(c)}
                            className="px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
                          >
                            Submit Feedback
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {done.length > 0 && (
            <section>
              <h2 className="text-base font-semibold text-gray-700 mb-3">Feedback Submitted ({done.length})</h2>
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      {['Candidate', 'Mobile', 'Position', 'Stage', 'Feedback'].map((h) => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {done.map((c) => (
                      <tr key={c.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-900">{c.name}</td>
                        <td className="px-4 py-3 text-gray-500">{c.mobile}</td>
                        <td className="px-4 py-3 text-gray-600">{c.project} / {c.role}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STAGE_COLORS[c.stage] ?? 'bg-gray-100 text-gray-600'}`}>
                            {c.stage}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-500 max-w-xs truncate">{c.feedback || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}

      {/* Feedback modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200 flex-shrink-0">
              <h2 className="text-lg font-semibold text-gray-900">Interview Feedback</h2>
              <p className="text-sm text-gray-500 mt-0.5">{selected.name} · {selected.project} / {selected.role}</p>
            </div>

            {/* ── Part 1: Is Interview Completed? ── */}
            {modalStep === 'check' && (
              <div className="px-6 py-6 space-y-6">
                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
                )}
                <div>
                  <p className="text-sm font-semibold text-gray-800 mb-3">Is Interview Completed?</p>
                  <div className="flex gap-3">
                    {([true, false] as const).map((val) => (
                      <label
                        key={String(val)}
                        className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 cursor-pointer transition-colors ${
                          interviewCompleted === val
                            ? val
                              ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                              : 'border-red-400 bg-red-50 text-red-700'
                            : 'border-gray-200 text-gray-600 hover:border-gray-300'
                        }`}
                      >
                        <input
                          type="radio"
                          name="interview_completed"
                          className="sr-only"
                          checked={interviewCompleted === val}
                          onChange={() => setInterviewCompleted(val)}
                        />
                        <span className="text-sm font-medium">{val ? 'Yes' : 'No'}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="flex justify-end gap-3">
                  <button type="button" onClick={closeModal} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleInterviewCheck}
                    disabled={interviewCompleted === null}
                    className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-40"
                  >
                    Continue
                  </button>
                </div>
              </div>
            )}

            {/* ── Part 1b: Interview not completed — reason ── */}
            {modalStep === 'no_interview' && (
              <form onSubmit={handleIncompleteSubmit} className="px-6 py-6 space-y-6">
                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
                )}
                <div>
                  <p className="text-sm font-semibold text-gray-800 mb-3">Reason?</p>
                  <div className="space-y-2">
                    {NO_INTERVIEW_OPTIONS.map((opt) => (
                      <label
                        key={opt.value}
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 cursor-pointer transition-colors ${
                          noInterviewReason === opt.value
                            ? 'border-amber-400 bg-amber-50 text-amber-800'
                            : 'border-gray-200 text-gray-600 hover:border-gray-300'
                        }`}
                      >
                        <input
                          type="radio"
                          name="no_interview_reason"
                          className="w-4 h-4 accent-amber-500"
                          checked={noInterviewReason === opt.value}
                          onChange={() => setNoInterviewReason(opt.value)}
                        />
                        <span className="text-sm font-medium">{opt.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="flex justify-end gap-3">
                  <button type="button" onClick={() => setModalStep('check')} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={!noInterviewReason || saving}
                    className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-40"
                  >
                    {saving ? 'Submitting…' : 'Submit'}
                  </button>
                </div>
              </form>
            )}

            {/* ── Part 2: Interview completed — full feedback form ── */}
            {modalStep === 'feedback' && (
              <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
                <div className="px-6 py-5 space-y-5 overflow-y-auto flex-1">
                  {error && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
                  )}

                  <CompetencyTable
                    title="Assessment of functional / technical competencies"
                    items={FUNCTIONAL_ITEMS}
                    ratings={functionalRatings}
                    onChange={(item, rating) => setFunctionalRatings((prev) => ({ ...prev, [item]: rating }))}
                  />

                  <CompetencyTable
                    title="Assessment of behavioral competencies"
                    items={BEHAVIORAL_ITEMS}
                    ratings={behavioralRatings}
                    onChange={(item, rating) => setBehavioralRatings((prev) => ({ ...prev, [item]: rating }))}
                  />

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Result <span className="text-red-500">*</span></label>
                    <div className="flex gap-6">
                      {(['accepted', 'rejected'] as const).map((r) => (
                        <label key={r} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="result"
                            value={r}
                            checked={result === r}
                            onChange={() => setResult(r)}
                            className="text-indigo-600 focus:ring-indigo-500"
                          />
                          <span className="text-sm capitalize font-medium">{r}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {result === 'rejected' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Rejection Reason</label>
                      <textarea
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        rows={2}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Remarks <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                      rows={3}
                      placeholder="Strengths, areas of improvement, overall impression…"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      required
                    />
                  </div>
                </div>

                <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3 flex-shrink-0">
                  <button type="button" onClick={() => setModalStep('check')} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">
                    Back
                  </button>
                  <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                    {saving ? 'Submitting…' : 'Submit Feedback'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
