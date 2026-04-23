import { useState, useEffect, useCallback } from 'react';
import AppLayout from '../components/shared/AppLayout';
import {
  getPayrollRun, getPayrollHistory, generatePayroll, regeneratePayroll,
  updatePayrollStatus,
  type PayrollRun, type PayrollHistoryItem,
} from '../api/payroll';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const STATUS_CONFIG = {
  draft:     { label: 'Draft',     bg: '#fef9c3', color: '#854d0e' },
  processed: { label: 'Processed', bg: '#dbeafe', color: '#1e40af' },
  paid:      { label: 'Paid',      bg: '#dcfce7', color: '#166534' },
};

function fmt(n: number) {
  return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function StatusBadge({ status }: { status: 'draft' | 'processed' | 'paid' }) {
  const c = STATUS_CONFIG[status];
  return (
    <span style={{ padding: '3px 12px', borderRadius: 999, fontSize: 12, fontWeight: 600, background: c.bg, color: c.color }}>
      {c.label}
    </span>
  );
}

const PROF_TAX = 200;

export default function PayrollPage() {
  const now = new Date();
  const [tab, setTab] = useState<'process' | 'history'>('process');
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year] = useState(now.getFullYear());

  const [run, setRun] = useState<PayrollRun | null | undefined>(undefined);
  const [history, setHistory] = useState<PayrollHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [statusSaving, setStatusSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 3000); };

  const loadRun = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getPayrollRun(month, year);
      setRun(data);
    } finally { setLoading(false); }
  }, [month, year]);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    try { setHistory(await getPayrollHistory()); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { if (tab === 'process') loadRun(); }, [tab, loadRun]);
  useEffect(() => { if (tab === 'history') loadHistory(); }, [tab, loadHistory]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await generatePayroll(month, year);
      flash('Payroll run created');
      loadRun();
    } catch (e: any) {
      flash(e.message || 'Failed to generate');
    } finally { setGenerating(false); }
  };

  const handleRegenerate = async () => {
    if (!run) return;
    if (!window.confirm(`Re-generate payroll for ${MONTHS[month - 1]} ${year}?\n\nThis will discard all current records and rebuild from the latest salary master and attendance data. Any manual edits to this run will be lost.`)) return;
    setRegenerating(true);
    try {
      await regeneratePayroll(run.id);
      flash('Payroll re-generated successfully');
      loadRun();
    } catch (e: any) {
      flash(e.message || 'Failed to re-generate');
    } finally { setRegenerating(false); }
  };

  const handleStatus = async (status: 'processed' | 'paid') => {
    if (!run) return;
    setStatusSaving(true);
    try {
      await updatePayrollStatus(run.id, status);
      flash(status === 'processed' ? 'Payroll marked as Processed' : 'Payroll marked as Paid');
      loadRun();
    } catch (e: any) {
      flash(e.message || 'Failed');
    } finally { setStatusSaving(false); }
  };

  const totalNet   = run?.records.reduce((s, r) => s + r.gross_salary - r.lop_deduction - PROF_TAX, 0) ?? 0;
  const totalGross = run?.records.reduce((s, r) => s + r.gross_salary, 0) ?? 0;

  return (
    <AppLayout>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#111827' }}>Payroll</h2>
          <p style={{ margin: '2px 0 0', fontSize: 13, color: '#6b7280' }}>Process and track employee salaries</p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid #e5e7eb', marginBottom: 20 }}>
        {([['process', 'Process Payroll'], ['history', 'History']] as const).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} style={{
            padding: '8px 18px', border: 'none', background: 'none', cursor: 'pointer',
            fontSize: 14, fontWeight: tab === key ? 600 : 500,
            color: tab === key ? '#6d28d9' : '#6b7280',
            borderBottom: tab === key ? '2px solid #6d28d9' : '2px solid transparent',
            marginBottom: -1,
          }}>{label}</button>
        ))}
      </div>

      {msg && (
        <div style={{ marginBottom: 14, padding: '10px 16px', borderRadius: 8, background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', fontSize: 13 }}>
          {msg}
        </div>
      )}

      {/* ── PROCESS PAYROLL ── */}
      {tab === 'process' && (
        <div>
          {/* Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <select value={month} onChange={e => setMonth(Number(e.target.value))}
              style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 13 }}>
              {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m} {year}</option>)}
            </select>

            {!loading && run === null && (
              <button onClick={handleGenerate} disabled={generating} style={{
                padding: '8px 18px', borderRadius: 8, border: 'none', cursor: 'pointer',
                background: '#6d28d9', color: '#fff', fontWeight: 600, fontSize: 13,
                opacity: generating ? 0.6 : 1,
              }}>
                {generating ? 'Generating…' : '+ Generate Payroll'}
              </button>
            )}

            {run && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 'auto' }}>
                <StatusBadge status={run.status} />
                {run.status === 'draft' && (
                  <>
                    <button onClick={handleRegenerate} disabled={regenerating} style={{
                      padding: '7px 16px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13,
                      background: '#fff', color: '#6b7280', border: '1px solid #d1d5db',
                      opacity: regenerating ? 0.6 : 1,
                    }}>
                      {regenerating ? 'Re-generating…' : '↺ Re-generate'}
                    </button>
                    <button onClick={() => handleStatus('processed')} disabled={statusSaving} style={{
                      padding: '7px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
                      background: '#dbeafe', color: '#1e40af', fontWeight: 600, fontSize: 13,
                    }}>Mark as Processed</button>
                  </>
                )}
                {run.status === 'processed' && (
                  <button onClick={() => handleStatus('paid')} disabled={statusSaving} style={{
                    padding: '7px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
                    background: '#dcfce7', color: '#166534', fontWeight: 600, fontSize: 13,
                  }}>Mark as Paid</button>
                )}
              </div>
            )}
          </div>

          {loading || run === undefined ? (
            <p style={{ color: '#9ca3af', fontSize: 14 }}>Loading…</p>
          ) : run === null ? (
            <div style={{ background: '#fff', borderRadius: 14, padding: 40, textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <p style={{ color: '#6b7280', fontSize: 14, margin: 0 }}>
                No payroll run for {MONTHS[month - 1]} {year}. Click <b>Generate Payroll</b> to create one.
              </p>
            </div>
          ) : (
            <>
              {/* Summary cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12, marginBottom: 16 }}>
                {[
                  { label: 'Total Gross', value: fmt(totalGross), color: '#1e40af' },
                  { label: 'Total Net Payout', value: fmt(totalNet), color: '#166534' },
                ].map(c => (
                  <div key={c.label} style={{ background: '#fff', borderRadius: 12, padding: '16px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                    <p style={{ margin: '0 0 4px', fontSize: 12, color: '#6b7280', fontWeight: 500 }}>{c.label}</p>
                    <p style={{ margin: 0, fontSize: 22, fontWeight: 700, color: c.color }}>{c.value}</p>
                  </div>
                ))}
              </div>

              {/* Payroll table */}
              <div style={{ background: '#fff', borderRadius: 14, overflow: 'auto', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1200 }}>
                  <thead>
                    <tr style={{ background: '#f9fafb' }}>
                      {[
                        'Emp ID', 'Employee Name', 'Role',
                        'Gross Salary', 'Total Days', 'Present Days', 'Leave', 'Absent Days',
                        'LOP Days', 'LOP Deduction', 'Earned Salary',
                        'Prof Tax', 'Net Paid',
                      ].map(h => (
                        <th key={h} style={{
                          padding: '11px 12px', textAlign: 'left',
                          fontSize: 11, fontWeight: 600, color: '#9ca3af',
                          textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap',
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {run.records.map(r => {
                      const netGross = r.gross_salary - r.lop_deduction;
                      const netPaid  = netGross - PROF_TAX;

                      return (
                        <tr key={r.id} style={{ borderTop: '1px solid #f3f4f6' }}>
                          <td style={{ padding: '12px 12px', fontSize: 13, color: '#6b7280', fontFamily: 'monospace' }}>{r.emp_id ?? <span style={{ color: '#d1d5db' }}>—</span>}</td>
                          <td style={{ padding: '12px 12px', fontSize: 13, fontWeight: 600, color: '#111827', whiteSpace: 'nowrap' }}>{r.employee_name}</td>
                          <td style={{ padding: '12px 12px', fontSize: 12, color: '#6b7280', textTransform: 'capitalize', whiteSpace: 'nowrap' }}>{r.employee_role}</td>
                          <td style={{ padding: '12px 12px', fontSize: 13, color: '#374151', textAlign: 'right' }}>{fmt(r.gross_salary)}</td>
                          <td style={{ padding: '12px 12px', fontSize: 13, color: '#374151', textAlign: 'right' }}>{r.working_days}</td>
                          <td style={{ padding: '12px 12px', fontSize: 13, color: '#16a34a', textAlign: 'right' }}>{r.present_days}</td>
                          <td style={{ padding: '12px 12px', fontSize: 13, color: '#2563eb', textAlign: 'right' }}>{r.leave_days}</td>
                          <td style={{ padding: '12px 12px', fontSize: 13, color: '#dc2626', textAlign: 'right' }}>{r.absent_days}</td>
                          <td style={{ padding: '12px 12px', fontSize: 13, color: r.lop_days > 0 ? '#991b1b' : '#9ca3af', textAlign: 'right' }}>
                            {r.lop_days > 0 ? r.lop_days : '—'}
                          </td>
                          <td style={{ padding: '12px 12px', fontSize: 13, color: r.lop_deduction > 0 ? '#991b1b' : '#9ca3af', textAlign: 'right' }}>
                            {r.lop_deduction > 0 ? fmt(r.lop_deduction) : '—'}
                          </td>
                          <td style={{ padding: '12px 12px', fontSize: 13, fontWeight: 500, color: '#1e40af', textAlign: 'right' }}>{fmt(netGross)}</td>
                          <td style={{ padding: '12px 12px', fontSize: 13, color: '#6b7280', textAlign: 'right' }}>{fmt(PROF_TAX)}</td>
                          <td style={{ padding: '12px 12px', fontSize: 13, fontWeight: 700, color: netPaid >= 0 ? '#166534' : '#991b1b', textAlign: 'right' }}>{fmt(netPaid)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  {/* Totals row */}
                  <tfoot>
                    <tr style={{ borderTop: '2px solid #e5e7eb', background: '#f9fafb' }}>
                      <td colSpan={3} style={{ padding: '12px 12px', fontSize: 13, fontWeight: 700, color: '#111827' }}>
                        Total ({run.records.length} employees)
                      </td>
                      {/* Gross Salary total */}
                      <td style={{ padding: '12px 12px', fontSize: 13, fontWeight: 600, textAlign: 'right', color: '#374151' }}>
                        {fmt(run.records.reduce((s, r) => s + r.gross_salary, 0))}
                      </td>
                      {/* Total Days, Present, Leave, Absent — skip */}
                      <td /><td /><td /><td />
                      {/* LOP Days total */}
                      <td style={{ padding: '12px 12px', fontSize: 13, fontWeight: 600, textAlign: 'right', color: '#991b1b' }}>
                        {run.records.reduce((s, r) => s + r.lop_days, 0)}
                      </td>
                      {/* LOP Deduction total */}
                      <td style={{ padding: '12px 12px', fontSize: 13, fontWeight: 600, textAlign: 'right', color: '#991b1b' }}>
                        {fmt(run.records.reduce((s, r) => s + r.lop_deduction, 0))}
                      </td>
                      {/* Earned Salary total */}
                      <td style={{ padding: '12px 12px', fontSize: 13, fontWeight: 700, textAlign: 'right', color: '#1e40af' }}>
                        {fmt(run.records.reduce((s, r) => s + r.gross_salary - r.lop_deduction, 0))}
                      </td>
                      {/* Prof Tax total */}
                      <td style={{ padding: '12px 12px', fontSize: 13, fontWeight: 600, textAlign: 'right', color: '#6b7280' }}>
                        {fmt(run.records.length * PROF_TAX)}
                      </td>
                      {/* Net Paid total */}
                      <td style={{ padding: '12px 12px', fontSize: 13, fontWeight: 700, textAlign: 'right', color: '#166534' }}>
                        {fmt(totalNet)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── HISTORY ── */}
      {tab === 'history' && (
        <div style={{ background: '#fff', borderRadius: 14, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          {loading ? (
            <p style={{ padding: 32, color: '#9ca3af', fontSize: 14 }}>Loading…</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f9fafb' }}>
                  {['Period', 'Employees', 'Total Net Payout', 'Status', 'Created By', 'Date'].map(h => (
                    <th key={h} style={{ padding: '11px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {history.length === 0 ? (
                  <tr><td colSpan={6} style={{ padding: 32, textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>No payroll runs yet</td></tr>
                ) : history.map(h => (
                  <tr key={h.id} style={{ borderTop: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '13px 16px', fontSize: 13, fontWeight: 600, color: '#111827' }}>
                      {MONTHS[h.month - 1]} {h.year}
                    </td>
                    <td style={{ padding: '13px 16px', fontSize: 13, color: '#374151' }}>{h.employee_count}</td>
                    <td style={{ padding: '13px 16px', fontSize: 13, fontWeight: 600, color: '#166534' }}>
                      {h.total_net != null ? fmt(h.total_net) : '—'}
                    </td>
                    <td style={{ padding: '13px 16px' }}><StatusBadge status={h.status} /></td>
                    <td style={{ padding: '13px 16px', fontSize: 13, color: '#6b7280' }}>{h.created_by_name}</td>
                    <td style={{ padding: '13px 16px', fontSize: 12, color: '#9ca3af' }}>
                      {new Date(h.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </AppLayout>
  );
}
