import { useState } from 'react';
import { createPosition } from '../../../api/ats-positions';
import type { Position } from '../../../types';
import { HR_SPOC_OPTIONS, LEVEL_OPTIONS } from '../../../types';

export default function PositionRequestForm() {
  const [form, setForm] = useState<Partial<Position>>({
    job_id: '',
    project: '',
    nature_of_work: '',
    department: '',
    indent_date: '',
    role: '',
    status: 'Active',
    total_req: 1,
    required_by_date: '',
    interview_panel: '',
    hr_spoc: HR_SPOC_OPTIONS[0] as string,
    level: LEVEL_OPTIONS[0] as string,
  });
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: name === 'total_req' ? Number(value) : value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess(false);
    try {
      await createPosition({ ...form, approval_status: 'pending' });
      setSuccess(true);
      setForm({
        job_id: '',
        project: '',
        nature_of_work: '',
        department: '',
        indent_date: '',
        role: '',
        status: 'Active',
        total_req: 1,
        required_by_date: '',
        interview_panel: '',
        hr_spoc: HR_SPOC_OPTIONS[0] as string,
        level: LEVEL_OPTIONS[0] as string,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to submit request');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Request New Position</h2>

      {success && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
          Position request submitted successfully! Awaiting Business Head approval.
        </div>
      )}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Job ID</label>
            <input name="job_id" value={form.job_id ?? ''} onChange={handleChange} required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Project</label>
            <input name="project" value={form.project ?? ''} onChange={handleChange} required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nature of Work</label>
            <input name="nature_of_work" value={form.nature_of_work ?? ''} onChange={handleChange} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
            <input name="department" value={form.department ?? ''} onChange={handleChange} required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Indent Date</label>
            <input name="indent_date" type="date" value={form.indent_date ?? ''} onChange={handleChange} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
            <input name="role" value={form.role ?? ''} onChange={handleChange} required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Interview Panel</label>
            <input name="interview_panel" value={form.interview_panel ?? ''} onChange={handleChange} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Level</label>
            <select name="level" value={form.level ?? ''} onChange={handleChange} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500">
              {LEVEL_OPTIONS.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex justify-end pt-6">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? 'Submitting...' : 'Submit Request'}
          </button>
        </div>
      </form>
    </div>
  );
}
