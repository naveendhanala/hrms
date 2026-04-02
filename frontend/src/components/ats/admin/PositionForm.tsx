import { useState, useEffect } from 'react';
import type { Position } from '../../../types';
import { HR_SPOC_OPTIONS, LEVEL_OPTIONS, POSITION_STATUS_OPTIONS } from '../../../types';

interface Props {
  initial?: Position | null;
  onSubmit: (data: Partial<Position>) => Promise<void>;
  onCancel: () => void;
}

const EMPTY: Partial<Position> = {
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
  hr_spoc: HR_SPOC_OPTIONS[0],
  level: LEVEL_OPTIONS[0],
};

export default function PositionForm({ initial, onSubmit, onCancel }: Props) {
  const [form, setForm] = useState<Partial<Position>>(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (initial) {
      setForm({
        ...initial,
        indent_date: initial.indent_date?.slice(0, 10) ?? '',
        required_by_date: initial.required_by_date?.slice(0, 10) ?? '',
      });
    } else {
      setForm(EMPTY);
    }
  }, [initial]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: name === 'total_req' ? Number(value) : value }));
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
          <label className="block text-sm font-medium text-gray-700 mb-1">Job ID</label>
          <input
            name="job_id"
            value={form.job_id ?? ''}
            onChange={handleChange}
            required
            disabled={!!initial}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100"
          />
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
          <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
          <select name="status" value={form.status ?? 'Active'} onChange={handleChange} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500">
            {POSITION_STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
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

      <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? 'Saving...' : initial ? 'Update Position' : 'Create Position'}
        </button>
      </div>
    </form>
  );
}
