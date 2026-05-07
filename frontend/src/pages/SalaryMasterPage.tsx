import React, { useState, useEffect, useCallback } from 'react';
import AppLayout from '../components/shared/AppLayout';
import {
  getSalaryMaster, reviseSalary, getSalaryHistory,
  type SalaryMasterEntry, type SalaryHistoryEntry, type SalaryRevisePayload,
} from '../api/payroll';

function fmt(n: number) {
  return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function SalaryMasterPage() {
  const [salaryMaster, setSalaryMaster] = useState<SalaryMasterEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const [reviseOpenId, setReviseOpenId] = useState<number | null>(null);
  const [reviseForm, setReviseForm] = useState<Record<number, {
    effective_date: string;
    basic_salary: string;
    hra: string;
    meal_allowance: string;
    conveyance_allowance: string;
    special_allowance: string;
  }>>({});
  const [reviseSaving, setReviseSaving] = useState(false);

  const [historyOpenId, setHistoryOpenId] = useState<number | null>(null);
  const [historyData, setHistoryData] = useState<Record<number, SalaryHistoryEntry[]>>({});
  const [historyLoading, setHistoryLoading] = useState<number | null>(null);

  const flash = (m: string, isErr = false) => {
    if (isErr) { setError(m); setTimeout(() => setError(''), 4000); }
    else { setMsg(m); setTimeout(() => setMsg(''), 3000); }
  };

  const loadSalaryMaster = useCallback(async () => {
    setLoading(true);
    try { setSalaryMaster(await getSalaryMaster()); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadSalaryMaster(); }, [loadSalaryMaster]);

  const nextMonthFirst = () => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() + 1);
    return d.toISOString().slice(0, 10);
  };

  const openRevise = (entry: SalaryMasterEntry) => {
    setHistoryOpenId(null);
    setReviseOpenId(prev => prev === entry.employee_id ? null : entry.employee_id);
    setReviseForm(prev => ({
      ...prev,
      [entry.employee_id]: {
        effective_date:       nextMonthFirst(),
        basic_salary:         String(entry.basic_salary),
        hra:                  String(entry.hra),
        meal_allowance:       String(entry.meal_allowance),
        conveyance_allowance: String(entry.conveyance_allowance),
        special_allowance:    String(entry.special_allowance),
      },
    }));
  };

  const openHistory = async (entry: SalaryMasterEntry) => {
    setReviseOpenId(null);
    if (historyOpenId === entry.employee_id) { setHistoryOpenId(null); return; }
    setHistoryOpenId(entry.employee_id);
    if (historyData[entry.employee_id]) return;
    setHistoryLoading(entry.employee_id);
    try {
      const rows = await getSalaryHistory(entry.employee_id);
      setHistoryData(prev => ({ ...prev, [entry.employee_id]: rows }));
    } finally { setHistoryLoading(null); }
  };

  const handleRevise = async (employeeId: number) => {
    const f = reviseForm[employeeId];
    if (!f) return;
    if (!f.effective_date) { flash('Effective date is required', true); return; }
    setReviseSaving(true);
    try {
      const payload: SalaryRevisePayload = {
        effective_date:       f.effective_date,
        basic_salary:         Number(f.basic_salary)         || 0,
        hra:                  Number(f.hra)                   || 0,
        meal_allowance:       Number(f.meal_allowance)       || 0,
        conveyance_allowance: Number(f.conveyance_allowance) || 0,
        special_allowance:    Number(f.special_allowance)    || 0,
        deductions:           0,
      };
      await reviseSalary(employeeId, payload);
      setReviseOpenId(null);
      setHistoryData(prev => { const n = { ...prev }; delete n[employeeId]; return n; });
      await loadSalaryMaster();
      flash('Salary revision saved');
    } catch (e: unknown) {
      flash(e instanceof Error ? e.message : 'Save failed', true);
    } finally { setReviseSaving(false); }
  };

  return (
    <AppLayout>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#111827' }}>Salary Master</h2>
          <p style={{ margin: '2px 0 0', fontSize: 13, color: '#6b7280' }}>
            Set each employee's base salary components. Use Revise to add effective-dated changes.
          </p>
        </div>
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

      {loading ? (
        <p style={{ color: '#9ca3af', fontSize: 14 }}>Loading…</p>
      ) : (
        <div style={{ background: '#fff', borderRadius: 14, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: '7%' }} />
              <col style={{ width: '14%' }} />
              <col style={{ width: '10%' }} />
              <col style={{ width: '10%' }} />
              <col style={{ width: '9%' }} />
              <col style={{ width: '7%' }} />
              <col style={{ width: '8%' }} />
              <col style={{ width: '8%' }} />
              <col style={{ width: '9%' }} />
              <col style={{ width: '8%' }} />
              <col style={{ width: '10%' }} />
            </colgroup>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                {['Emp ID', 'Employee', 'Designation', 'Gross', 'Basic', 'HRA', 'Meal', 'Conv.', 'Special', 'Updated', ''].map(h => (
                  <th key={h} style={{ padding: '9px 8px', textAlign: h === '' ? 'center' : 'left', fontSize: 10, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {salaryMaster.map(entry => {
                const gross = entry.basic_salary + entry.hra + entry.meal_allowance + entry.conveyance_allowance + entry.special_allowance;
                const isReviseOpen  = reviseOpenId  === entry.employee_id;
                const isHistoryOpen = historyOpenId === entry.employee_id;
                const rf = reviseForm[entry.employee_id];
                const reviseGross = rf
                  ? (Number(rf.basic_salary) || 0) + (Number(rf.hra) || 0) + (Number(rf.meal_allowance) || 0) + (Number(rf.conveyance_allowance) || 0) + (Number(rf.special_allowance) || 0)
                  : 0;

                return (
                  <React.Fragment key={entry.employee_id}>
                    <tr style={{ borderTop: '1px solid #f3f4f6', background: (isReviseOpen || isHistoryOpen) ? '#faf5ff' : 'transparent' }}>
                      <td style={{ padding: '10px 8px', fontSize: 12, color: '#6b7280', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {entry.emp_id ?? <span style={{ color: '#d1d5db' }}>—</span>}
                      </td>
                      <td style={{ padding: '10px 8px', fontSize: 12, fontWeight: 600, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={entry.employee_name}>{entry.employee_name}</td>
                      <td style={{ padding: '10px 8px', fontSize: 11, color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.employee_designation || entry.employee_role}</td>
                      <td style={{ padding: '10px 8px', fontSize: 12, fontWeight: 600, color: gross > 0 ? '#1e40af' : '#d1d5db', textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {gross > 0 ? fmt(gross) : '—'}
                      </td>
                      {[entry.basic_salary, entry.hra, entry.meal_allowance, entry.conveyance_allowance, entry.special_allowance].map((v, i) => (
                        <td key={i} style={{ padding: '10px 8px', fontSize: 12, color: v > 0 ? '#374151' : '#d1d5db', textAlign: 'right', whiteSpace: 'nowrap' }}>
                          {v > 0 ? fmt(v) : '—'}
                        </td>
                      ))}
                      <td style={{ padding: '10px 8px', fontSize: 11, color: '#9ca3af', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {entry.updated_at ? new Date(entry.updated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—'}
                      </td>
                      <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                          <button onClick={() => openRevise(entry)} style={{
                            padding: '3px 8px', borderRadius: 6, border: 'none', cursor: 'pointer',
                            background: isReviseOpen ? '#6d28d9' : '#ede9fe',
                            color: isReviseOpen ? '#fff' : '#6d28d9', fontWeight: 600, fontSize: 11,
                          }}>Revise</button>
                          <button onClick={() => openHistory(entry)} style={{
                            padding: '3px 8px', borderRadius: 6, border: '1px solid #e5e7eb', cursor: 'pointer',
                            background: isHistoryOpen ? '#f3f4f6' : '#fff',
                            color: '#6b7280', fontSize: 11,
                          }}>History</button>
                        </div>
                      </td>
                    </tr>

                    {isReviseOpen && rf && (
                      <tr>
                        <td colSpan={11} style={{ padding: '0', borderTop: '1px solid #ede9fe' }}>
                          <div style={{ padding: '14px 16px', background: '#faf5ff' }}>
                            <p style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 600, color: '#6d28d9' }}>New Salary Revision</p>
                            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                              <label style={{ fontSize: 11, color: '#6b7280' }}>
                                Effective Date *
                                <input type="date" value={rf.effective_date}
                                  onChange={e => setReviseForm(p => ({ ...p, [entry.employee_id]: { ...p[entry.employee_id], effective_date: e.target.value } }))}
                                  style={{ display: 'block', marginTop: 3, padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 12 }} />
                              </label>
                              {([
                                ['Basic', 'basic_salary'],
                                ['HRA', 'hra'],
                                ['Meal Allow.', 'meal_allowance'],
                                ['Conv. Allow.', 'conveyance_allowance'],
                                ['Special Allow.', 'special_allowance'],
                              ] as const).map(([label, field]) => (
                                <label key={field} style={{ fontSize: 11, color: '#6b7280' }}>
                                  {label}
                                  <input type="number" min="0" value={rf[field]}
                                    onChange={e => setReviseForm(p => ({ ...p, [entry.employee_id]: { ...p[entry.employee_id], [field]: e.target.value } }))}
                                    style={{ display: 'block', marginTop: 3, width: 80, padding: '4px 6px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 12, textAlign: 'right' }} />
                                </label>
                              ))}
                              <div style={{ fontSize: 11, color: '#6b7280' }}>
                                New Gross
                                <div style={{ marginTop: 3, padding: '4px 8px', fontSize: 13, fontWeight: 700, color: '#1e40af' }}>
                                  {fmt(reviseGross)}
                                </div>
                              </div>
                              <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
                                <button onClick={() => handleRevise(entry.employee_id)} disabled={reviseSaving} style={{
                                  padding: '5px 14px', borderRadius: 6, border: 'none', cursor: 'pointer',
                                  background: '#6d28d9', color: '#fff', fontWeight: 600, fontSize: 12,
                                  opacity: reviseSaving ? 0.6 : 1,
                                }}>{reviseSaving ? 'Saving…' : 'Save Revision'}</button>
                                <button onClick={() => setReviseOpenId(null)} style={{
                                  padding: '5px 10px', borderRadius: 6, border: '1px solid #d1d5db', cursor: 'pointer',
                                  background: '#fff', color: '#6b7280', fontSize: 12,
                                }}>Cancel</button>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}

                    {isHistoryOpen && (
                      <tr>
                        <td colSpan={11} style={{ padding: '0', borderTop: '1px solid #ede9fe' }}>
                          <div style={{ padding: '14px 16px', background: '#f9fafb' }}>
                            <p style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 600, color: '#374151' }}>Salary Revision History</p>
                            {historyLoading === entry.employee_id ? (
                              <p style={{ color: '#9ca3af', fontSize: 13 }}>Loading…</p>
                            ) : !historyData[entry.employee_id] || historyData[entry.employee_id].length === 0 ? (
                              <p style={{ color: '#9ca3af', fontSize: 13 }}>No revisions recorded yet.</p>
                            ) : (
                              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                                <thead>
                                  <tr>
                                    {['Effective Date', 'Basic', 'HRA', 'Meal', 'Conv.', 'Special', 'Gross', 'Revised By', 'On'].map(h => (
                                      <th key={h} style={{ padding: '5px 8px', textAlign: 'left', fontSize: 10, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', borderBottom: '1px solid #e5e7eb' }}>{h}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {historyData[entry.employee_id].map(h => {
                                    const hGross = h.basic_salary + h.hra + h.meal_allowance + h.conveyance_allowance + h.special_allowance;
                                    return (
                                      <tr key={h.id} style={{ borderTop: '1px solid #f3f4f6' }}>
                                        <td style={{ padding: '6px 8px', fontWeight: 600, color: '#111827' }}>
                                          {new Date(h.effective_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                          {h.arrears_processed && <span style={{ marginLeft: 6, fontSize: 10, color: '#16a34a', background: '#dcfce7', borderRadius: 4, padding: '1px 5px' }}>Arrears Paid</span>}
                                        </td>
                                        <td style={{ padding: '6px 8px', color: '#374151', textAlign: 'right' }}>{fmt(h.basic_salary)}</td>
                                        <td style={{ padding: '6px 8px', color: '#374151', textAlign: 'right' }}>{h.hra > 0 ? fmt(h.hra) : '—'}</td>
                                        <td style={{ padding: '6px 8px', color: '#374151', textAlign: 'right' }}>{h.meal_allowance > 0 ? fmt(h.meal_allowance) : '—'}</td>
                                        <td style={{ padding: '6px 8px', color: '#374151', textAlign: 'right' }}>{h.conveyance_allowance > 0 ? fmt(h.conveyance_allowance) : '—'}</td>
                                        <td style={{ padding: '6px 8px', color: '#374151', textAlign: 'right' }}>{h.special_allowance > 0 ? fmt(h.special_allowance) : '—'}</td>
                                        <td style={{ padding: '6px 8px', fontWeight: 600, color: '#1e40af', textAlign: 'right' }}>{fmt(hGross)}</td>
                                        <td style={{ padding: '6px 8px', color: '#6b7280' }}>{h.created_by_name ?? '—'}</td>
                                        <td style={{ padding: '6px 8px', color: '#9ca3af', whiteSpace: 'nowrap' }}>
                                          {new Date(h.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </AppLayout>
  );
}
