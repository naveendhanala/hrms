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

const NO_INTERVIEW_OPTIONS: { value: NoInterviewReason; label: string }[] = [
  { value: 'not_responding',  label: 'Candidate Not Responding' },
  { value: 'resume_mismatch', label: 'Resume does not align with job' },
];

export default function FeedbackPage() {
  const [step, setStep] = useState<Step>('lookup');
  const [mobile, setMobile] = useState('');
  const [candidate, setCandidate] = useState<CandidateInfo | null>(null);

  // Part 1 state
  const [interviewCompleted, setInterviewCompleted] = useState<boolean | null>(null);
  const [noInterviewReason, setNoInterviewReason] = useState<NoInterviewReason | null>(null);

  // Part 2 (interview completed) state
  const [interviewer, setInterviewer] = useState('');
  const [result, setResult] = useState<'accepted' | 'rejected'>('accepted');
  const [rejectReason, setRejectReason] = useState('');
  const [remarks, setRemarks] = useState('');

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
    setLoading(true);
    try {
      await apiFetch('/api/ats/feedback', {
        method: 'POST',
        body: JSON.stringify({
          mobile,
          interviewer,
          result,
          reject_reason: result === 'rejected' ? rejectReason : undefined,
          remarks,
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
    setInterviewer('');
    setResult('accepted');
    setRejectReason('');
    setRemarks('');
    setError('');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-teal-50">
      <div className="w-full max-w-lg">
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

              <button
                type="submit"
                disabled={!noInterviewReason || loading}
                className="w-full py-2.5 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-40"
              >
                {loading ? 'Submitting...' : 'Submit'}
              </button>
            </form>
          )}

          {/* ── Step 3b: Interview completed — feedback form ── */}
          {step === 'feedback' && candidate && (
            <>
              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <p className="text-sm font-medium text-gray-900">{candidate.name}</p>
                <p className="text-xs text-gray-500">{candidate.project} · {candidate.role} ({candidate.job_id})</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Your Name (Interviewer)</label>
                  <input
                    value={interviewer}
                    onChange={(e) => setInterviewer(e.target.value)}
                    required
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Result</label>
                  <div className="flex gap-4">
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
                        <span className="text-sm capitalize">{r}</span>
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Remarks</label>
                  <textarea
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    rows={3}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                >
                  {loading ? 'Submitting...' : 'Submit Feedback'}
                </button>
              </form>
            </>
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
