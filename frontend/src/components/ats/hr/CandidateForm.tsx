import { useState, useEffect } from 'react';
import { listPositions } from '../../../api/ats-positions';
import { getDirectory } from '../../../api/users';
import type { Candidate, Position } from '../../../types';
import { HR_SPOC_OPTIONS } from '../../../types';

interface Props {
  initial?: Candidate | null;
  onSubmit: (data: Partial<Candidate>, resumeFile?: File) => Promise<void>;
  onCancel: () => void;
}

interface EduRow {
  degree: string;
  college: string;
  year: string;
}

interface ExpRow {
  company: string;
  designation: string;
  from: string;
  to: string;
  project: string;
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

const EMPTY_EDU: EduRow = { degree: '', college: '', year: '' };
const EMPTY_EXP: ExpRow = { company: '', designation: '', from: '', to: '', project: '' };

function parseJson<T>(raw: string | undefined | null, fallback: T[]): T[] {
  if (!raw) return fallback;
  try { return JSON.parse(raw) as T[]; } catch { return fallback; }
}

export default function CandidateForm({ initial, onSubmit, onCancel }: Props) {
  const [form, setForm] = useState<Partial<Candidate>>(EMPTY);
  const [positions, setPositions] = useState<Position[]>([]);
  const [employees, setEmployees] = useState<{ id: number; name: string }[]>([]);
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [interviewerError, setInterviewerError] = useState('');
  const [mobileError, setMobileError] = useState('');
  const [altMobileError, setAltMobileError] = useState('');

  const [eduRows, setEduRows] = useState<EduRow[]>([]);
  const [expRows, setExpRows] = useState<ExpRow[]>([]);

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
      setEduRows(parseJson<EduRow>(initial.education, []));
      setExpRows(parseJson<ExpRow>(initial.work_experience, []));
    } else {
      setForm(EMPTY);
      setEduRows([]);
      setExpRows([]);
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

  const updateEdu = (idx: number, field: keyof EduRow, value: string) => {
    setEduRows((rows) => rows.map((r, i) => i === idx ? { ...r, [field]: value } : r));
  };

  const updateExp = (idx: number, field: keyof ExpRow, value: string) => {
    setExpRows((rows) => rows.map((r, i) => i === idx ? { ...r, [field]: value } : r));
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
      const normalized = {
        ...form,
        alternate_mobile: form.alternate_mobile?.trim() || undefined,
        education: JSON.stringify(eduRows),
        work_experience: JSON.stringify(expRows),
      };
      const payload = initial
        ? normalized
        : { ...normalized, sourcing_date: new Date().toISOString().slice(0, 10) };
      await onSubmit(payload, resumeFile ?? undefined);
    } finally {
      setSaving(false);
    }
  };

  const suggestedPanel = positions.find((p) => p.job_id === form.job_id)?.interview_panel;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Resume upload */}
      <div className="rounded-xl border-2 border-dashed border-indigo-200 bg-indigo-50/40 px-4 py-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Resume <span className="text-gray-400 font-normal">(PDF / DOC / DOCX, max 5 MB)</span>
        </label>
        {initial?.resume_url && !resumeFile && (
          <div className="flex items-center gap-2 mb-2">
            <a
              href={initial.resume_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-800 underline"
            >
              View current resume
            </a>
            <span className="text-gray-300">·</span>
            <span className="text-xs text-gray-400">Upload a new file to replace it</span>
          </div>
        )}
        <input
          type="file"
          accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          onChange={(e) => setResumeFile(e.target.files?.[0] ?? null)}
          className="block w-full text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-indigo-600 file:text-white hover:file:bg-indigo-700 cursor-pointer"
        />
        {resumeFile && (
          <p className="mt-1.5 text-xs text-indigo-700 font-medium">{resumeFile.name}</p>
        )}
      </div>

      {/* Basic fields */}
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

      {/* Education */}
      <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-700">Education</h3>
          <button
            type="button"
            onClick={() => setEduRows((r) => [...r, { ...EMPTY_EDU }])}
            className="text-xs font-medium text-indigo-600 hover:text-indigo-800 border border-indigo-200 rounded-md px-2.5 py-1 hover:bg-indigo-50"
          >
            + Add
          </button>
        </div>
        {eduRows.length === 0 && (
          <p className="text-xs text-gray-400">No education entries yet. Click "+ Add" to add one.</p>
        )}
        <div className="space-y-3">
          {eduRows.map((row, idx) => (
            <div key={idx} className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-white border border-gray-200 rounded-lg p-3 relative">
              <button
                type="button"
                onClick={() => setEduRows((r) => r.filter((_, i) => i !== idx))}
                className="absolute top-2 right-2 text-gray-300 hover:text-red-400 text-xs font-bold leading-none"
                title="Remove"
              >
                ✕
              </button>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Degree</label>
                <input
                  value={row.degree}
                  onChange={(e) => updateEdu(idx, 'degree', e.target.value)}
                  placeholder="e.g. B.Tech, MBA"
                  className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">College / University</label>
                <input
                  value={row.college}
                  onChange={(e) => updateEdu(idx, 'college', e.target.value)}
                  placeholder="Institution name"
                  className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Year of Graduation</label>
                <input
                  value={row.year}
                  onChange={(e) => updateEdu(idx, 'year', e.target.value)}
                  placeholder="e.g. 2019"
                  maxLength={4}
                  className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Work Experience */}
      <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-700">Work Experience</h3>
          <button
            type="button"
            onClick={() => setExpRows((r) => [...r, { ...EMPTY_EXP }])}
            className="text-xs font-medium text-indigo-600 hover:text-indigo-800 border border-indigo-200 rounded-md px-2.5 py-1 hover:bg-indigo-50"
          >
            + Add
          </button>
        </div>
        {expRows.length === 0 && (
          <p className="text-xs text-gray-400">No experience entries yet. Click "+ Add" to add one.</p>
        )}
        <div className="space-y-3">
          {expRows.map((row, idx) => (
            <div key={idx} className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-white border border-gray-200 rounded-lg p-3 relative">
              <button
                type="button"
                onClick={() => setExpRows((r) => r.filter((_, i) => i !== idx))}
                className="absolute top-2 right-2 text-gray-300 hover:text-red-400 text-xs font-bold leading-none"
                title="Remove"
              >
                ✕
              </button>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Company Name</label>
                <input
                  value={row.company}
                  onChange={(e) => updateExp(idx, 'company', e.target.value)}
                  placeholder="Company name"
                  className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Designation</label>
                <input
                  value={row.designation}
                  onChange={(e) => updateExp(idx, 'designation', e.target.value)}
                  placeholder="Job title / role"
                  className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">From</label>
                <input
                  type="month"
                  value={row.from}
                  onChange={(e) => updateExp(idx, 'from', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">To</label>
                <input
                  type="month"
                  value={row.to}
                  onChange={(e) => updateExp(idx, 'to', e.target.value)}
                  placeholder="Leave blank if current"
                  className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Project Name</label>
                <input
                  value={row.project}
                  onChange={(e) => updateExp(idx, 'project', e.target.value)}
                  placeholder="Project worked on"
                  className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            </div>
          ))}
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
