import { useState, useEffect } from 'react';
import { createEmployee } from '../../../api/auth';
import { getManagers, type Manager } from '../../../api/users';

const ROLES = ['employee', 'hr', 'director', 'projectlead', 'businesshead', 'admin'];
const ROLE_LABELS: Record<string, string> = {
  employee: 'Employee',
  hr: 'HR',
  director: 'Director',
  projectlead: 'Project Lead',
  businesshead: 'Business Head',
  admin: 'Admin',
};

const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500';
const labelCls = 'block text-sm font-medium text-gray-700 mb-1';

export default function CreateEmployeeForm({ onSuccess }: { onSuccess?: () => void }) {
  const [form, setForm] = useState({
    name: '',
    username: '',
    email: '',
    password: '',
    role: 'employee',
    emp_id: '',
    dob: '',
    date_of_joining: '',
    designation: '',
    project: '',
    location: '',
    state: '',
    site_office: '',
    status: 'active',
  });
  const [managerId, setManagerId] = useState<number | null>(null);
  const [managers, setManagers] = useState<Manager[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    getManagers().then(setManagers).catch(() => {});
  }, []);

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await createEmployee({
        ...form,
        emp_id: form.emp_id || undefined,
        dob: form.dob || undefined,
        date_of_joining: form.date_of_joining || undefined,
        reporting_manager_id: managerId,
      });
      onSuccess?.();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create employee');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Row 1: Name + Username */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label className={labelCls}>Full Name *</label>
          <input className={inputCls} value={form.name} onChange={set('name')} required />
        </div>
        <div>
          <label className={labelCls}>Username *</label>
          <input className={inputCls} value={form.username} onChange={set('username')} required />
        </div>
      </div>

      {/* Row 2: Email + Password */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label className={labelCls}>Email *</label>
          <input type="email" className={inputCls} value={form.email} onChange={set('email')} required />
        </div>
        <div>
          <label className={labelCls}>Password *</label>
          <input type="password" className={inputCls} value={form.password} onChange={set('password')} required />
        </div>
      </div>

      {/* Row 3: Role + Emp ID */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label className={labelCls}>Role</label>
          <select className={inputCls} value={form.role} onChange={set('role')}>
            {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Employee ID</label>
          <input className={inputCls} placeholder="e.g. EMP001" value={form.emp_id} onChange={set('emp_id')} />
        </div>
      </div>

      {/* Row 4: DOB + Date of Joining */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label className={labelCls}>Date of Birth</label>
          <input type="date" className={inputCls} value={form.dob} onChange={set('dob')} />
        </div>
        <div>
          <label className={labelCls}>Date of Joining</label>
          <input type="date" className={inputCls} value={form.date_of_joining} onChange={set('date_of_joining')} />
        </div>
      </div>

      {/* Row 5: Designation + Status */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label className={labelCls}>Designation</label>
          <input className={inputCls} placeholder="e.g. Senior Engineer" value={form.designation} onChange={set('designation')} />
        </div>
        <div>
          <label className={labelCls}>Status</label>
          <select className={inputCls} value={form.status} onChange={set('status')}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      {/* Row 6: Project + Location */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label className={labelCls}>Project</label>
          <input className={inputCls} value={form.project} onChange={set('project')} />
        </div>
        <div>
          <label className={labelCls}>Location</label>
          <input className={inputCls} value={form.location} onChange={set('location')} />
        </div>
      </div>

      {/* Row 7: State + Site/Office */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label className={labelCls}>State</label>
          <input className={inputCls} value={form.state} onChange={set('state')} />
        </div>
        <div>
          <label className={labelCls}>Site/Office</label>
          <select className={inputCls} value={form.site_office} onChange={set('site_office')}>
            <option value="">— Select —</option>
            <option value="Site">Site</option>
            <option value="Office">Office</option>
          </select>
        </div>
      </div>

      {/* Row 8: Reporting Manager */}
      <div>
        <label className={labelCls}>Reporting Manager</label>
        <select
          className={inputCls}
          value={managerId ?? ''}
          onChange={e => setManagerId(e.target.value ? Number(e.target.value) : null)}
        >
          <option value="">— None —</option>
          {managers.map(m => (
            <option key={m.id} value={m.id}>{m.name} ({m.role})</option>
          ))}
        </select>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? 'Creating…' : 'Create Employee'}
        </button>
      </div>
    </form>
  );
}
