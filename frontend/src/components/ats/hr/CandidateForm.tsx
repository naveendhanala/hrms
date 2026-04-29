import { useState, useEffect } from 'react';
import { listPositions } from '../../../api/ats-positions';
import { getDirectory } from '../../../api/users';
import type { Candidate, Position } from '../../../types';
import { HR_SPOC_OPTIONS } from '../../../types';

interface Props {
  initial?: Candidate | null;
  onSubmit: (data: Partial<Candidate>) => Promise<void>;
  onCancel: () => void;
}

const EMPTY: Partial<Candidate> = {
  name: '',
  mobile: '',
  alternate_mobile: '',
  job_id: '',
  candidate_current_role: '',
  interviewer: '',
  feedback: '',
  sourcing_date: '',
  interview_done_date: '',
  offer_release_date: '',
  expected_joining_date: '',
  joined_date: '',
  hr_spoc: HR_SPOC_OPTIONS[0] as string,
};

export default function CandidateForm({ initial, onSubmit, onCancel }: Props) {
  const [form, setForm] = useState<Partial<Candidate>>(EMPTY);
  const [positions, setPositions] = useState<Position[]>([]);
  const [employees, setEmployees] = useState<{ id: string; name: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [interviewerError, setInterviewerError] = useState('');
  const [mobileError, setMobileError] = useState('');
  const [altMobileError, setAltMobileError] = useState('');

  useEffect(() => {
    listPositions().then(setPositions).catch(console.error);
    getDirectory().then(setEmployees).catch(console.error);
  }, []);

  useEffect(() => {
    if (initial) {
      setForm({
        ...initial,
        sourcing_date: initial.sourcing_date?.slice(0, 10) ?? '',
        interview_done_date: initial.interview_done_date?.slice(0, 10) ?? '',
        offer_release_date: initial.offer_release_date?.slice(0, 10) ?? '',
        expected_joining_date: initial.expected_joining_date?.slice(0, 10) ?? '',
        joined_date: initial.joined_date?.slice(0, 10) ?? '',
      });
    } else {
      setForm(EMPTY);
    }
  }, [initial]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;

    if (name === 'mobile' || name === 'alternate_mobile') {
      const digits = value.replace(/\D/g, '').slice(0, 10);
      setForm((prev) => ({ ...prev, [name]: digits }));
      const setErr = name === 'mobile' ? setMobileError : setAltMobileError;
      if (digits.length > 0 && digits.length < 10) setErr('Must be exactly 10 digits');
      else setErr('');
      return;
    }

    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((form.mobile ?? '').length !== 10) {
      setMobileError('Must be exactly 10 digits');
      return;
    }
    if (form.alternate_mobile && form.alternate_mobile.length !== 10) {
      setAltMobileError('Must be exactly 10 digits');
      return;
    }
    if (!form.interviewer?.trim()) {
      setInterviewerError('Please select an interviewer.');
      return;
    }
    setInterviewerError('');
    setSaving(true);
    try {
      const normalized = { ...form, alternate_mobile: form.alternate_mobile?.trim() || null };
      const payload = initial
        ? normalized
        : { ...normalized, sourcing_date: new Date().toISOString().slice(0, 10) };
      await onSubmit(payload);
    } finally {
      setSaving(false);
    }
  };

  const suggestedPanel = positions.find((p) => p.job_id === form.job_id)?.interview_panel;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Name <span className="text-red-500">*</span></label>
          <input name="name" value={form.name ?? ''} onChange={handleChange} required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Mobile <span className="text-red-500">*</span></label>
          <input
            name="mobile"
            value={form.mobile ?? ''}
            onChange={handleChange}
            required
            inputMode="numeric"
            maxLength={10}
            placeholder="10-digit number"
            className={`w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${mobileError ? 'border-red-400' : 'border-gray-300'}`}
          />
          {mobileError && <p className="text-red-500 text-xs mt-1">{mobileError}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Alternate Mobile</label>
          <input
            name="alternate_mobile"
            value={form.alternate_mobile ?? ''}
            onChange={handleChange}
            inputMode="numeric"
            maxLength={10}
            placeholder="10-digit number"
            className={`w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${altMobileError ? 'border-red-400' : 'border-gray-300'}`}
          />
          {altMobileError && <p className="text-red-500 text-xs mt-1">{altMobileError}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Job ID <span className="text-red-500">*</span></label>
          <select name="job_id" value={form.job_id ?? ''} onChange={handleChange} required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500">
            <option value="">Select position</option>
            {positions.map((p) => (
              <option key={p.job_id} value={p.job_id}>
                {p.job_id} - {p.project} ({p.role})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Current Role</label>
          <input name="candidate_current_role" value={form.candidate_current_role ?? ''} onChange={handleChange} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
        </div>
        {initial && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Stage</label>
            <div className="w-full border border-gray-200 bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-600">
              {initial.stage}
            </div>
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Interviewer <span className="text-red-500">*</span></label>
          {suggestedPanel && (
            <p className="text-xs text-indigo-600 bg-indigo-50 border border-indigo-100 rounded px-2 py-1 mb-1">
              Suggested from position: <span className="font-medium">{suggestedPanel}</span>
            </p>
          )}
          <select
            name="interviewer"
            value={form.interviewer ?? ''}
            onChange={handleChange}
            disabled={!!initial?.feedback}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed"
          >
            <option value="">Select interviewer</option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.name}>{emp.name}</option>
            ))}
          </select>
          {interviewerError && <p className="text-red-500 text-xs mt-1">{interviewerError}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">HR SPOC <span className="text-red-500">*</span></label>
          <select
            name="hr_spoc"
            value={form.hr_spoc ?? ''}
            onChange={handleChange}
            required
            disabled={!!initial}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed"
          >
            {HR_SPOC_OPTIONS.map((h) => (
              <option key={h} value={h}>{h}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">
          Cancel
        </button>
        <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50">
          {saving ? 'Saving...' : initial ? 'Update Candidate' : 'Add Candidate'}
        </button>
      </div>
    </form>
  );
}
