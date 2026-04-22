import { useEffect, useState } from 'react';
import AppLayout from '../components/shared/AppLayout';
import Modal from '../components/shared/Modal';
import CreateEmployeeForm from '../components/lms/admin/CreateEmployeeForm';
import { getEmployees, getManagers, updateEmployee, type Employee, type Manager } from '../api/users';

const ROLE_COLORS: Record<string, { bg: string; text: string }> = {
  admin:        { bg: '#ede9fe', text: '#6d28d9' },
  hr:           { bg: '#dbeafe', text: '#1d4ed8' },
  director:     { bg: '#fef3c7', text: '#92400e' },
  projectlead:  { bg: '#dcfce7', text: '#166534' },
  businesshead: { bg: '#fce7f3', text: '#9d174d' },
  employee:     { bg: '#f3f4f6', text: '#374151' },
};

const ROLES = ['admin', 'hr', 'director', 'projectlead', 'businesshead', 'employee'];

const ROLE_LABELS: Record<string, string> = {
  admin:        'Admin',
  hr:           'HR',
  director:     'Director',
  projectlead:  'Project Lead',
  businesshead: 'Business Head',
  employee:     'Employee',
};

const MODULES = [
  { key: 'DASHBOARD',  label: 'Dashboard',   roles: ['admin', 'hr', 'director', 'projectlead', 'businesshead', 'employee'] },
  { key: 'EMPLOYEES',  label: 'Employees',   roles: ['admin', 'hr'] },
  { key: 'ATS',        label: 'ATS',         roles: ['admin', 'hr', 'director', 'projectlead', 'businesshead'] },
  { key: 'LMS',        label: 'LMS',         roles: ['admin', 'hr', 'director', 'projectlead', 'businesshead', 'employee'] },
  { key: 'ATTENDANCE', label: 'Attendance',  roles: ['admin', 'hr', 'director', 'projectlead', 'businesshead', 'employee'] },
];

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function CrossIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="2">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

export default function EmployeesPage() {
  const [tab, setTab] = useState<'list' | 'permissions'>('list');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [managers, setManagers] = useState<Manager[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [editForm, setEditForm] = useState<Partial<Employee>>({});
  const [saving, setSaving] = useState(false);

  const fetchEmployees = () => {
    setLoading(true);
    getEmployees()
      .then(setEmployees)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchEmployees();
    getManagers().then(setManagers).catch(() => {});
  }, []);

  const openEdit = (emp: Employee) => {
    setEditingEmployee(emp);
    setEditForm({ ...emp });
  };

  const handleSaveEdit = async () => {
    if (!editingEmployee) return;
    setSaving(true);
    try {
      await updateEmployee(editingEmployee.id, {
        name:                 editForm.name ?? editingEmployee.name,
        email:                editForm.email ?? editingEmployee.email,
        emp_id:               editForm.emp_id ?? undefined,
        dob:                  editForm.dob ?? undefined,
        project:              editForm.project ?? '',
        location:             editForm.location ?? '',
        status:               editForm.status ?? 'active',
        reporting_manager_id: editForm.reporting_manager_id ?? null,
      });
      fetchEmployees();
      setEditingEmployee(null);
    } catch (e: any) {
      alert(e.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const q = search.toLowerCase();
  const filtered = employees.filter(e =>
    e.name.toLowerCase().includes(q) ||
    e.email.toLowerCase().includes(q) ||
    (e.emp_id ?? '').toLowerCase().includes(q) ||
    e.role.toLowerCase().includes(q) ||
    e.project.toLowerCase().includes(q) ||
    e.location.toLowerCase().includes(q)
  );

  return (
    <AppLayout>
      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#111827' }}>Employees</h2>
          <p style={{ margin: '2px 0 0 0', fontSize: 13, color: '#6b7280' }}>
            {employees.length} total members
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {tab === 'list' && (
            <input
              type="text"
              placeholder="Search by name, email, or role…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: 260,
                padding: '8px 14px',
                borderRadius: 8,
                border: '1px solid #e5e7eb',
                fontSize: 13,
                outline: 'none',
                background: '#fff',
              }}
            />
          )}
          <button
            onClick={() => setShowAddForm(true)}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              border: 'none',
              background: '#6d28d9',
              color: '#fff',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            + Add Employee
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid #e5e7eb' }}>
        {([['list', 'All Employees'], ['permissions', 'Role Permissions']] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            style={{
              padding: '8px 18px',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: tab === key ? 600 : 500,
              color: tab === key ? '#6d28d9' : '#6b7280',
              borderBottom: tab === key ? '2px solid #6d28d9' : '2px solid transparent',
              marginBottom: -1,
              transition: 'color 0.15s',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'list' ? (
        /* ── Employee list table ── */
        <div style={{ background: '#fff', borderRadius: 14, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>Loading…</div>
          ) : error ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#ef4444', fontSize: 14 }}>{error}</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
                  {['Employee', 'Emp ID', 'Role', 'Status', 'Project', 'Location', 'Reporting Manager', ''].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: '12px 18px',
                        textAlign: 'left',
                        fontSize: 12,
                        fontWeight: 600,
                        color: '#9ca3af',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ padding: 32, textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>
                      No employees found
                    </td>
                  </tr>
                ) : (
                  filtered.map((emp) => {
                    const roleColor = ROLE_COLORS[emp.role] ?? ROLE_COLORS.employee;
                    const initials = emp.name
                      .split(' ')
                      .map((n) => n[0])
                      .join('')
                      .slice(0, 2)
                      .toUpperCase();
                    return (
                      <tr
                        key={emp.id}
                        style={{ borderBottom: '1px solid #f9fafb' }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = '#f9fafb')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        {/* Employee name + email */}
                        <td style={{ padding: '12px 18px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 11, flexShrink: 0 }}>
                              {initials}
                            </div>
                            <div>
                              <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#111827' }}>{emp.name}</p>
                              <p style={{ margin: 0, fontSize: 11, color: '#9ca3af' }}>{emp.email}</p>
                            </div>
                          </div>
                        </td>
                        {/* Emp ID */}
                        <td style={{ padding: '12px 18px', fontSize: 12, color: '#6b7280', fontFamily: 'monospace' }}>
                          {emp.emp_id ?? <span style={{ color: '#d1d5db' }}>—</span>}
                        </td>
                        {/* Role */}
                        <td style={{ padding: '12px 18px' }}>
                          <span style={{ padding: '2px 9px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: roleColor.bg, color: roleColor.text, textTransform: 'capitalize' }}>
                            {emp.role}
                          </span>
                        </td>
                        {/* Status */}
                        <td style={{ padding: '12px 18px' }}>
                          <span style={{ padding: '2px 9px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: emp.status === 'active' ? '#dcfce7' : '#fee2e2', color: emp.status === 'active' ? '#166534' : '#991b1b', textTransform: 'capitalize' }}>
                            {emp.status ?? 'active'}
                          </span>
                        </td>
                        {/* Project */}
                        <td style={{ padding: '12px 18px', fontSize: 13, color: '#374151', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {emp.project || <span style={{ color: '#d1d5db' }}>—</span>}
                        </td>
                        {/* Location */}
                        <td style={{ padding: '12px 18px', fontSize: 13, color: '#374151' }}>
                          {emp.location || <span style={{ color: '#d1d5db' }}>—</span>}
                        </td>
                        {/* Reporting Manager */}
                        <td style={{ padding: '12px 18px', fontSize: 13, color: emp.reporting_manager_name ? '#374151' : '#d1d5db' }}>
                          {emp.reporting_manager_name ?? '—'}
                        </td>
                        {/* Edit */}
                        <td style={{ padding: '12px 18px' }}>
                          <button onClick={() => openEdit(emp)} style={{ padding: '4px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', background: '#ede9fe', color: '#6d28d9', fontWeight: 600, fontSize: 12 }}>
                            Edit
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
        </div>
      ) : (
        /* ── Role permissions matrix ── */
        <div style={{ background: '#fff', borderRadius: 14, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
                <th
                  style={{
                    padding: '14px 20px',
                    textAlign: 'left',
                    fontSize: 12,
                    fontWeight: 600,
                    color: '#9ca3af',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    width: 160,
                  }}
                >
                  Module
                </th>
                {ROLES.map((role) => {
                  const c = ROLE_COLORS[role];
                  return (
                    <th
                      key={role}
                      style={{
                        padding: '14px 12px',
                        textAlign: 'center',
                        fontSize: 12,
                        fontWeight: 600,
                        letterSpacing: '0.03em',
                      }}
                    >
                      <span
                        style={{
                          padding: '4px 12px',
                          borderRadius: 999,
                          background: c.bg,
                          color: c.text,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {ROLE_LABELS[role]}
                      </span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {MODULES.map((mod, i) => (
                <tr
                  key={mod.key}
                  style={{ borderBottom: i < MODULES.length - 1 ? '1px solid #f3f4f6' : 'none' }}
                >
                  <td style={{ padding: '16px 20px', fontSize: 14, fontWeight: 600, color: '#111827' }}>
                    {mod.label}
                  </td>
                  {ROLES.map((role) => {
                    const allowed = mod.roles.includes(role);
                    return (
                      <td key={role} style={{ padding: '16px 12px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                          {allowed ? <CheckIcon /> : <CrossIcon />}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Modal open={showAddForm} onClose={() => setShowAddForm(false)} title="Add Employee">
        <CreateEmployeeForm onSuccess={() => { setShowAddForm(false); fetchEmployees(); }} />
      </Modal>

      {/* Edit Employee Modal */}
      <Modal open={!!editingEmployee} onClose={() => setEditingEmployee(null)} title="Edit Employee">
        {editingEmployee && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Row 1 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  value={editForm.name ?? ''} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input type="email" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  value={editForm.email ?? ''} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} />
              </div>
            </div>
            {/* Row 2 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Employee ID</label>
                <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="e.g. EMP001" value={editForm.emp_id ?? ''} onChange={e => setEditForm(f => ({ ...f, emp_id: e.target.value || undefined }))} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
                <input type="date" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  value={editForm.dob ?? ''} onChange={e => setEditForm(f => ({ ...f, dob: e.target.value || undefined }))} />
              </div>
            </div>
            {/* Row 3 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Project</label>
                <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  value={editForm.project ?? ''} onChange={e => setEditForm(f => ({ ...f, project: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  value={editForm.location ?? ''} onChange={e => setEditForm(f => ({ ...f, location: e.target.value }))} />
              </div>
            </div>
            {/* Row 4 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  value={editForm.status ?? 'active'} onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reporting Manager</label>
                <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  value={editForm.reporting_manager_id ?? ''} onChange={e => setEditForm(f => ({ ...f, reporting_manager_id: e.target.value ? Number(e.target.value) : null }))}>
                  <option value="">— None —</option>
                  {managers.map(m => <option key={m.id} value={m.id}>{m.name} ({m.role})</option>)}
                </select>
              </div>
            </div>
            {/* Actions */}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
              <button onClick={() => setEditingEmployee(null)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">
                Cancel
              </button>
              <button onClick={handleSaveEdit} disabled={saving} className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </AppLayout>
  );
}
