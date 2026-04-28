import { useState, useEffect } from 'react';
import { createPosition } from '../../../api/ats-positions';
import { getDeptRoles } from '../../../api/ats-config';
import type { Position } from '../../../types';
import type { DeptRole } from '../../../api/ats-config';
import { HR_SPOC_OPTIONS } from '../../../types';
import EmployeeMultiSelect from '../../shared/EmployeeMultiSelect';

const countWords = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;

const EMPTY = (): Partial<Position> => ({
  project: '',
  nature_of_work: '',
  department: '',
  role: '',
  level: '',
  status: 'Active',
  total_req: 1,
  required_by_date: '',
  interview_panel: '',
  hr_spoc: HR_SPOC_OPTIONS[0] as string,
  job_description: '',
});

interface Props { onSuccess?: () => void; }

export default function BusinessHeadRequestForm({ onSuccess }: Props) {
  const [form, setForm] = useState<Partial<Position>>(EMPTY());
  const [deptRoles, setDeptRoles] = useState<DeptRole[]>([]);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    getDeptRoles().then(setDeptRoles).catch(console.error);
  }, []);

  const availableRoles = deptRoles.find((d) => d.department === form.department)?.roles ?? [];

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (name === 'department') {
      setForm((prev) => ({ ...prev, department: value, role: '', level: '' }));
    } else if (name === 'role') {
      const roleEntry = availableRoles.find((r) => r.name === value);
      setForm((prev) => ({ ...prev, role: value, level: roleEntry?.level ?? '' }));
    } else {
      setForm((prev) => ({ ...prev, [name]: name === 'total_req' ? Number(value) : value }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (countWords(form.job_description ?? '') < 50) {
      setError('Job Description must be at least 50 words.');
      return;
    }
    setSaving(true);
    setError('');
    setSuccess(false);
    try {
      await createPosition({ ...form, approval_status: 'approved' });
      setSuccess(true);
      setForm(EMPTY());
      onSuccess?.();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create position');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">New Position</h2>

      {success && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
          Position created and approved successfully.
        </div>
      )}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
            <select name="department" value={form.department ?? ''} onChange={handleChange} required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500">
              <option value="">Select department</option>
              {deptRoles.map((d) => <option key={d.department} value={d.department}>{d.department}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
            <select name="role" value={form.role ?? ''} onChange={handleChange} required disabled={!form.department} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100">
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
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Interview Panel</label>
            <EmployeeMultiSelect
              value={form.interview_panel ?? ''}
              onChange={(val) => setForm((prev) => ({ ...prev, interview_panel: val }))}
            />
          </div>
        </div>

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

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            {saving ? 'Creating...' : 'Create & Approve'}
          </button>
        </div>
      </form>
    </div>
  );
}
