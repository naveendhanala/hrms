import { useState, useEffect } from 'react';
import { listPositions } from '../../../api/ats-positions';
import type { Candidate, Position, Stage } from '../../../types';
import { STAGES, HR_SPOC_OPTIONS } from '../../../types';

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
  stage: STAGES[0],
  interviewer: '',
  interviewer_feedback: '',
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
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    listPositions().then(setPositions).catch(console.error);
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
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit(form);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
          <input name="name" value={form.name ?? ''} onChange={handleChange} required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Mobile</label>
          <input name="mobile" value={form.mobile ?? ''} onChange={handleChange} required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Alternate Mobile</label>
          <input name="alternate_mobile" value={form.alternate_mobile ?? ''} onChange={handleChange} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Job ID</label>
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
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Stage</label>
          <select name="stage" value={form.stage ?? STAGES[0]} onChange={handleChange} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500">
            {STAGES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Interviewer</label>
          <input name="interviewer" value={form.interviewer ?? ''} onChange={handleChange} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">HR SPOC</label>
          <select name="hr_spoc" value={form.hr_spoc ?? ''} onChange={handleChange} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500">
            {HR_SPOC_OPTIONS.map((h) => (
              <option key={h} value={h}>{h}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Sourcing Date</label>
          <input name="sourcing_date" type="date" value={form.sourcing_date ?? ''} onChange={handleChange} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Interview Done Date</label>
          <input name="interview_done_date" type="date" value={form.interview_done_date ?? ''} onChange={handleChange} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Offer Release Date</label>
          <input name="offer_release_date" type="date" value={form.offer_release_date ?? ''} onChange={handleChange} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Expected Joining Date</label>
          <input name="expected_joining_date" type="date" value={form.expected_joining_date ?? ''} onChange={handleChange} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Joined Date</label>
          <input name="joined_date" type="date" value={form.joined_date ?? ''} onChange={handleChange} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">Interviewer Feedback</label>
          <textarea name="interviewer_feedback" value={form.interviewer_feedback ?? ''} onChange={handleChange} rows={3} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
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
