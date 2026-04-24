import { useState, useEffect, useCallback } from 'react';
import AppLayout from '../components/shared/AppLayout';
import { getAdvances, createAdvance, updateAdvance, deleteAdvance, type EmployeeAdvance } from '../api/advances';
import { getEmployees, type Employee } from '../api/users';

function fmt(n: number) {
  return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const TH: React.CSSProperties = {
  padding: '11px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600,
  color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap',
};

const TD: React.CSSProperties = { padding: '13px 16px', fontSize: 13 };

export default function AdvancesPage() {
  const [advances, setAdvances] = useState<EmployeeAdvance[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const [empId, setEmpId] = useState('');
  const [amount, setAmount] = useState('');
  const [months, setMonths] = useState('');

  const [editAdvance, setEditAdvance] = useState<EmployeeAdvance | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editMonths, setEditMonths] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  const flash = (m: string, isErr = false) => {
    if (isErr) setError(m); else setMsg(m);
    setTimeout(() => { setMsg(''); setError(''); }, 3500);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [adv, emps] = await Promise.all([getAdvances(), getEmployees()]);
      setAdvances(adv);
      setEmployees(emps.filter(e => e.status === 'active' && e.role !== 'admin'));
    } catch (e: any) {
      flash(e.message || 'Failed to load', true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!empId || !amount || !months) return;
    const amt = Number(amount);
    const mo  = Number(months);
    if (amt <= 0 || mo <= 0 || !Number.isInteger(mo)) {
      flash('Amount must be > 0 and months must be a positive integer', true);
      return;
    }
    setSaving(true);
    try {
      await createAdvance({ employee_id: Number(empId), amount: amt, months: mo });
      flash('Advance added successfully');
      setShowForm(false);
      setEmpId(''); setAmount(''); setMonths('');
      load();
    } catch (e: any) {
      flash(e.message || 'Failed to save', true);
    } finally {
      setSaving(false);
    }
  };

  const handleEditOpen = (a: EmployeeAdvance) => {
    setEditAdvance(a);
    setEditAmount(String(a.amount));
    setEditMonths(String(a.months));
  };

  const handleEditSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editAdvance) return;
    const amt = Number(editAmount);
    const mo  = Number(editMonths);
    if (amt <= 0 || mo <= 0 || !Number.isInteger(mo)) {
      flash('Amount must be > 0 and months must be a positive integer', true);
      return;
    }
    setEditSaving(true);
    try {
      await updateAdvance(editAdvance.id, { amount: amt, months: mo });
      flash('Advance updated successfully');
      setEditAdvance(null);
      load();
    } catch (e: any) {
      flash(e.message || 'Failed to update', true);
    } finally {
      setEditSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Delete this advance record?')) return;
    try {
      await deleteAdvance(id);
      flash('Advance deleted');
      load();
    } catch (e: any) {
      flash(e.message || 'Failed to delete', true);
    }
  };

  const monthlyPreview = empId && amount && months && Number(amount) > 0 && Number(months) > 0
    ? Math.round((Number(amount) / Number(months)) * 100) / 100
    : null;

  return (
    <AppLayout>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#111827' }}>Advances</h2>
          <p style={{ margin: '2px 0 0', fontSize: 13, color: '#6b7280' }}>Manage salary advances and recovery</p>
        </div>
        <button
          onClick={() => setShowForm(v => !v)}
          style={{
            padding: '8px 18px', borderRadius: 8, border: 'none', cursor: 'pointer',
            background: '#6d28d9', color: '#fff', fontWeight: 600, fontSize: 13,
          }}
        >
          {showForm ? 'Cancel' : '+ Add Advance'}
        </button>
      </div>

      {msg && (
        <div style={{ marginBottom: 14, padding: '10px 16px', borderRadius: 8, background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', fontSize: 13 }}>
          {msg}
        </div>
      )}
      {error && (
        <div style={{ marginBottom: 14, padding: '10px 16px', borderRadius: 8, background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', fontSize: 13 }}>
          {error}
        </div>
      )}

      {editAdvance && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 100,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            background: '#fff', borderRadius: 16, padding: 28, width: 480, maxWidth: '95vw',
            boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
          }}>
            <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700, color: '#111827' }}>Edit Advance</h3>
            <p style={{ margin: '0 0 20px', fontSize: 13, color: '#6b7280' }}>
              {editAdvance.employee_name}{editAdvance.emp_id ? ` (${editAdvance.emp_id})` : ''}
            </p>
            {Number(editAdvance.recovered) > 0 && (
              <p style={{ margin: '0 0 16px', fontSize: 12, color: '#92400e', background: '#fef3c7', borderRadius: 8, padding: '8px 12px' }}>
                ₹{Number(editAdvance.recovered).toLocaleString('en-IN')} already recovered — amount cannot be set below this value.
              </p>
            )}
            <form onSubmit={handleEditSave} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Advance Amount (₹) *</label>
                <input
                  type='number' min='1' step='1' value={editAmount}
                  onChange={e => setEditAmount(e.target.value)}
                  required
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Recovery Months *</label>
                <input
                  type='number' min='1' step='1' value={editMonths}
                  onChange={e => setEditMonths(e.target.value)}
                  required
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, boxSizing: 'border-box' }}
                />
              </div>
              {editAmount && editMonths && Number(editAmount) > 0 && Number(editMonths) > 0 && (
                <p style={{ gridColumn: '1 / -1', margin: 0, fontSize: 13, color: '#6d28d9', fontWeight: 600 }}>
                  Monthly deduction: {fmt(Math.round((Number(editAmount) / Number(editMonths)) * 100) / 100)}
                </p>
              )}
              <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
                <button
                  type='button'
                  onClick={() => setEditAdvance(null)}
                  style={{
                    padding: '8px 20px', borderRadius: 8, border: '1px solid #d1d5db',
                    background: '#fff', color: '#374151', fontWeight: 600, fontSize: 13, cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type='submit' disabled={editSaving}
                  style={{
                    padding: '8px 24px', borderRadius: 8, border: 'none',
                    background: '#6d28d9', color: '#fff', fontWeight: 600, fontSize: 13,
                    cursor: editSaving ? 'not-allowed' : 'pointer', opacity: editSaving ? 0.6 : 1,
                  }}
                >
                  {editSaving ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showForm && (
        <div style={{ background: '#fff', borderRadius: 14, padding: 24, marginBottom: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', border: '1px solid #e5e7eb' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 600, color: '#111827' }}>New Advance</h3>
          <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Employee *</label>
              <select
                value={empId}
                onChange={e => setEmpId(e.target.value)}
                required
                style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13 }}
              >
                <option value=''>Select employee…</option>
                {employees.map(e => (
                  <option key={e.id} value={e.id}>
                    {e.name}{e.emp_id ? ` (${e.emp_id})` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Advance Amount (₹) *</label>
              <input
                type='number' min='1' step='1' value={amount}
                onChange={e => setAmount(e.target.value)}
                required placeholder='e.g. 60000'
                style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Recovery Months *</label>
              <input
                type='number' min='1' step='1' value={months}
                onChange={e => setMonths(e.target.value)}
                required placeholder='e.g. 6'
                style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 16 }}>
              {monthlyPreview !== null && (
                <p style={{ margin: 0, fontSize: 13, color: '#6d28d9', fontWeight: 600 }}>
                  Monthly deduction: {fmt(monthlyPreview)}
                </p>
              )}
              <button
                type='submit' disabled={saving}
                style={{
                  marginLeft: 'auto', padding: '8px 24px', borderRadius: 8, border: 'none',
                  background: '#6d28d9', color: '#fff', fontWeight: 600, fontSize: 13,
                  cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1,
                }}
              >
                {saving ? 'Saving…' : 'Save Advance'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div style={{ background: '#fff', borderRadius: 14, overflow: 'auto', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        {loading ? (
          <p style={{ padding: 32, color: '#9ca3af', fontSize: 14 }}>Loading…</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                {['Emp ID', 'Employee', 'Advance Amount', 'Monthly Deduction', 'Months', 'Recovered', 'Pending', 'Status', ''].map(h => (
                  <th key={h} style={TH}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {advances.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ padding: 32, textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>
                    No advances recorded yet
                  </td>
                </tr>
              ) : advances.map(a => {
                const pending = Math.max(0, Number(a.amount) - Number(a.recovered));
                const isActive = a.status === 'active';
                return (
                  <tr key={a.id} style={{ borderTop: '1px solid #f3f4f6' }}>
                    <td style={{ ...TD, color: '#6b7280', fontFamily: 'monospace', fontSize: 12 }}>
                      {a.emp_id || <span style={{ color: '#d1d5db' }}>—</span>}
                    </td>
                    <td style={{ ...TD, fontWeight: 600, color: '#111827' }}>{a.employee_name}</td>
                    <td style={{ ...TD, textAlign: 'right', color: '#374151' }}>{fmt(Number(a.amount))}</td>
                    <td style={{ ...TD, textAlign: 'right', color: '#6d28d9', fontWeight: 600 }}>{fmt(Number(a.monthly_amt))}</td>
                    <td style={{ ...TD, textAlign: 'right', color: '#374151' }}>{a.months}</td>
                    <td style={{ ...TD, textAlign: 'right', color: '#16a34a' }}>{fmt(Number(a.recovered))}</td>
                    <td style={{ ...TD, textAlign: 'right', fontWeight: 700, color: pending > 0 ? '#991b1b' : '#6b7280' }}>
                      {pending > 0 ? fmt(pending) : '—'}
                    </td>
                    <td style={{ ...TD }}>
                      <span style={{
                        padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600,
                        background: isActive ? '#fef3c7' : '#f0fdf4',
                        color: isActive ? '#92400e' : '#166534',
                      }}>
                        {isActive ? 'Active' : 'Closed'}
                      </span>
                    </td>
                    <td style={{ ...TD }}>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          onClick={() => handleEditOpen(a)}
                          style={{
                            padding: '4px 12px', borderRadius: 6, fontSize: 12, fontWeight: 500,
                            border: '1px solid #c4b5fd', background: '#f5f3ff', color: '#6d28d9', cursor: 'pointer',
                          }}
                        >
                          Edit
                        </button>
                        {Number(a.recovered) === 0 && (
                          <button
                            onClick={() => handleDelete(a.id)}
                            style={{
                              padding: '4px 12px', borderRadius: 6, fontSize: 12, fontWeight: 500,
                              border: '1px solid #fecaca', background: '#fef2f2', color: '#991b1b', cursor: 'pointer',
                            }}
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </AppLayout>
  );
}
