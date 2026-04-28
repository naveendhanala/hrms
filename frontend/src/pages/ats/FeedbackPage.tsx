import { useState } from 'react';
import { apiFetch } from '../../api/client';

interface CandidateInfo {
  id: string;
  name: string;
  job_id: string;
  stage: string;
  role: string;
  project: string;
  department: string;
}

type Step = 'lookup' | 'interview_check' | 'no_interview' | 'feedback' | 'done';
type NoInterviewReason = 'not_responding' | 'resume_mismatch';
type Rating = 'Poor' | 'Average' | 'Good' | 'Excellent';

const RATINGS: Rating[] = ['Poor', 'Average', 'Good', 'Excellent'];
const FUNCTIONAL_ITEMS = ['Job Knowledge', 'Hands on exposure', 'Knowledge on industry trends'] as const;
const BEHAVIORAL_ITEMS = ['Analytical skills', 'Communication skills', 'Leadership skills'] as const;
type FunctionalKey = (typeof FUNCTIONAL_ITEMS)[number];
type BehavioralKey = (typeof BEHAVIORAL_ITEMS)[number];

const NO_INTERVIEW_OPTIONS: { value: NoInterviewReason; label: string }[] = [
  { value: 'not_responding',  label: 'Candidate Not Responding' },
  { value: 'resume_mismatch', label: 'Resume does not align with job' },
];

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
                      className="w-4 h-4 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
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

export default function FeedbackPage() {
  const [step, setStep] = useState<Step>('lookup');
  const [mobile, setMobile] = useState('');
  const [candidate, setCandidate] = useState<CandidateInfo | null>(null);

  const [interviewCompleted, setInterviewCompleted] = useState<boolean | null>(null);
  const [noInterviewReason, setNoInterviewReason] = useState<NoInterviewReason | null>(null);

  const [result, setResult] = useState<'accepted' | 'rejected'>('accepted');
  const [rejectReason, setRejectReason] = useState('');
  const [remarks, setRemarks] = useState('');
  const [functionalRatings, setFunctionalRatings] = useState<Partial<Record<FunctionalKey, Rating>>>({});
  const [behavioralRatings, setBehavioralRatings] = useState<Partial<Record<BehavioralKey, Rating>>>({});

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await apiFetch<CandidateInfo>(`/api/ats/feedback/lookup?mobile=${encodeURIComponent(mobile)}`);
      setCandidate(data);
      setStep('interview_check');
    } catch {
      setError('Candidate not found with this mobile number.');
    } finally {
      setLoading(false);
    }
  };

  const handleInterviewCheck = () => {
    if (interviewCompleted === null) return;
    if (interviewCompleted) {
      setStep('feedback');
    } else {
      setNoInterviewReason(null);
      setStep('no_interview');
    }
  };

  const handleNoInterviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noInterviewReason) return;
    setError('');
    setLoading(true);
    try {
      await apiFetch('/api/ats/feedback/incomplete', {
        method: 'POST',
        body: JSON.stringify({ mobile, reason: noInterviewReason }),
      });
      setStep('done');
    } catch {
      setError('Failed to submit. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

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

    setLoading(true);
    try {
      await apiFetch('/api/ats/feedback', {
        method: 'POST',
        body: JSON.stringify({
          mobile,
          result,
          reject_reason: result === 'rejected' ? rejectReason : undefined,
          remarks,
          functional_competencies: functionalRatings,
          behavioral_competencies: behavioralRatings,
        }),
      });
      setStep('done');
    } catch {
      setError('Failed to submit feedback.');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setStep('lookup');
    setMobile('');
    setCandidate(null);
    setInterviewCompleted(null);
    setNoInterviewReason(null);
    setResult('accepted');
    setRejectReason('');
    setRemarks('');
    setFunctionalRatings({});
    setBehavioralRatings({});
    setError('');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-teal-50">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Interview Feedback</h1>
          <p className="text-gray-500 mt-1">Submit your interview feedback</p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
          )}

          {/* ── Step 1: Lookup ── */}
          {step === 'lookup' && (
            <form onSubmit={handleLookup} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Candidate Mobile Number</label>
                <input
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  required
                  placeholder="Enter mobile number"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50"
              >
                {loading ? 'Looking up...' : 'Find Candidate'}
              </button>
            </form>
          )}

          {/* ── Step 2: Is interview completed? ── */}
          {step === 'interview_check' && candidate && (
            <div className="space-y-6">
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm font-medium text-gray-900">{candidate.name}</p>
                <p className="text-xs text-gray-500">{candidate.project} · {candidate.role} ({candidate.job_id})</p>
              </div>

              <div>
                <p className="text-sm font-semibold text-gray-800 mb-3">Is Interview Completed?</p>
                <div className="flex gap-4">
                  {([true, false] as const).map((val) => (
                    <label
                      key={String(val)}
                      className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 cursor-pointer transition-colors ${
                        interviewCompleted === val
                          ? val ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-red-400 bg-red-50 text-red-700'
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

              <button
                onClick={handleInterviewCheck}
                disabled={interviewCompleted === null}
                className="w-full py-2.5 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-40"
              >
                Continue
              </button>
            </div>
          )}

          {/* ── Step 3a: Interview not completed — reason ── */}
          {step === 'no_interview' && candidate && (
            <form onSubmit={handleNoInterviewSubmit} className="space-y-6">
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm font-medium text-gray-900">{candidate.name}</p>
                <p className="text-xs text-gray-500">{candidate.project} · {candidate.role} ({candidate.job_id})</p>
              </div>

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

              <div className="flex gap-3">
                <button type="button" onClick={() => setStep('interview_check')} className="flex-1 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">
                  Back
                </button>
                <button
                  type="submit"
                  disabled={!noInterviewReason || loading}
                  className="flex-1 py-2.5 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-40"
                >
                  {loading ? 'Submitting...' : 'Submit'}
                </button>
              </div>
            </form>
          )}

          {/* ── Step 3b: Interview completed — feedback form ── */}
          {step === 'feedback' && candidate && (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm font-medium text-gray-900">{candidate.name}</p>
                <p className="text-xs text-gray-500">{candidate.project} · {candidate.role} ({candidate.job_id})</p>
              </div>

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
                        className="text-emerald-600 focus:ring-emerald-500"
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
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
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
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>

              <div className="flex gap-3">
                <button type="button" onClick={() => setStep('interview_check')} className="flex-1 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">
                  Back
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-2.5 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                >
                  {loading ? 'Submitting...' : 'Submit Feedback'}
                </button>
              </div>
            </form>
          )}

          {/* ── Done ── */}
          {step === 'done' && (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-green-600 text-3xl">&#10003;</span>
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Submitted</h2>
              <p className="text-gray-500 mb-6">Thank you for your feedback.</p>
              <button
                onClick={handleReset}
                className="px-6 py-2 text-sm font-medium text-emerald-700 bg-emerald-100 rounded-lg hover:bg-emerald-200"
              >
                Submit Another
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
