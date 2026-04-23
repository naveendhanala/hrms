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

const TH_STYLE: React.CSSProperties = {
  padding: '11px 12px', textAlign: 'left',
  fontSize: 11, fontWeight: 600, color: '#9ca3af',
  textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap',
};

const TD_R: React.CSSProperties = { padding: '12px 12px', fontSize: 13, textAlign: 'right' };

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
  const [error, setError] = useState('');

  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 3000); };

  const loadRun = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getPayrollRun(month, year);
      setRun(data);
    } catch (e: any) {
      setError(e.message || 'Failed to load payroll data');
      setRun(null);
    } finally { setLoading(false); }
  }, [month, year]);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    setError('');
    try { setHistory(await getPayrollHistory()); }
    catch (e: any) { setError(e.message || 'Failed to load history'); }
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

  const totalNet   = run?.records.reduce((s, r) => s + r.gross_salary - r.lop_deduction - (r.advance_deduction ?? 0) - r.prof_tax, 0) ?? 0;
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
      {error && (
        <div style={{ marginBottom: 14, padding: '10px 16px', borderRadius: 8, background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* ── PROCESS PAYROLL ── */}
      {tab === 'process' && (
        <div>
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

              <div style={{ background: '#fff', borderRadius: 14, overflow: 'auto', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1200 }}>
                  <thead>
                    <tr style={{ background: '#f9fafb' }}>
                      {[
                        'Emp ID', 'Employee Name', 'State', 'Designation',
                        'Gross Salary', 'Total Days', 'Present Days', 'Leave', 'Absent Days',
                        'LOP Days', 'LOP Deduction', 'Earned Salary', 'Advance',
                        'Prof Tax', 'Net Paid',
                      ].map(h => <th key={h} style={TH_STYLE}>{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {run.records.map(r => {
                      const netGross = r.gross_salary - r.lop_deduction;
                      const netPaid  = netGross - (r.advance_deduction ?? 0) - r.prof_tax;
                      return (
                        <tr key={r.id} style={{ borderTop: '1px solid #f3f4f6' }}>
                          <td style={{ padding: '12px 12px', fontSize: 13, color: '#6b7280', fontFamily: 'monospace' }}>{r.emp_id ?? <span style={{ color: '#d1d5db' }}>—</span>}</td>
                          <td style={{ padding: '12px 12px', fontSize: 13, fontWeight: 600, color: '#111827', whiteSpace: 'nowrap' }}>{r.employee_name}</td>
                          <td style={{ padding: '12px 12px', fontSize: 12, color: '#6b7280', whiteSpace: 'nowrap' }}>
                            {r.employee_state || <span style={{ color: '#d1d5db' }}>—</span>}
                          </td>
                          <td style={{ padding: '12px 12px', fontSize: 12, color: '#6b7280', whiteSpace: 'nowrap' }}>{r.employee_designation || r.employee_role}</td>
                          <td style={{ ...TD_R, color: '#374151' }}>{fmt(r.gross_salary)}</td>
                          <td style={{ ...TD_R, color: '#374151' }}>{r.working_days}</td>
                          <td style={{ ...TD_R, color: '#16a34a' }}>{r.present_days}</td>
                          <td style={{ ...TD_R, color: '#2563eb' }}>{r.leave_days}</td>
                          <td style={{ ...TD_R, color: '#dc2626' }}>{r.absent_days}</td>
                          <td style={{ ...TD_R, color: r.lop_days > 0 ? '#991b1b' : '#9ca3af' }}>
                            {r.lop_days > 0 ? r.lop_days : '—'}
                          </td>
                          <td style={{ ...TD_R, color: r.lop_deduction > 0 ? '#991b1b' : '#9ca3af' }}>
                            {r.lop_deduction > 0 ? fmt(r.lop_deduction) : '—'}
                          </td>
                          <td style={{ ...TD_R, fontWeight: 500, color: '#1e40af' }}>{fmt(netGross)}</td>
                          <td style={{ ...TD_R, color: r.advance_deduction > 0 ? '#7c3aed' : '#9ca3af' }}>
                            {r.advance_deduction > 0 ? fmt(r.advance_deduction) : '—'}
                          </td>
                          <td style={{ ...TD_R, color: r.prof_tax > 0 ? '#6b7280' : '#9ca3af' }}>
                            {r.prof_tax > 0 ? fmt(r.prof_tax) : '—'}
                          </td>
                          <td style={{ ...TD_R, fontWeight: 700, color: netPaid >= 0 ? '#166534' : '#991b1b' }}>{fmt(netPaid)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ borderTop: '2px solid #e5e7eb', background: '#f9fafb' }}>
                      <td colSpan={4} style={{ padding: '12px 12px', fontSize: 13, fontWeight: 700, color: '#111827' }}>
                        Total ({run.records.length} employees)
                      </td>
                      <td style={{ ...TD_R, fontWeight: 600, color: '#374151' }}>
                        {fmt(run.records.reduce((s, r) => s + r.gross_salary, 0))}
                      </td>
                      <td /><td /><td /><td />
                      <td style={{ ...TD_R, fontWeight: 600, color: '#991b1b' }}>
                        {run.records.reduce((s, r) => s + r.lop_days, 0)}
                      </td>
                      <td style={{ ...TD_R, fontWeight: 600, color: '#991b1b' }}>
                        {fmt(run.records.reduce((s, r) => s + r.lop_deduction, 0))}
                      </td>
                      <td style={{ ...TD_R, fontWeight: 700, color: '#1e40af' }}>
                        {fmt(run.records.reduce((s, r) => s + r.gross_salary - r.lop_deduction, 0))}
                      </td>
                      <td style={{ ...TD_R, fontWeight: 600, color: '#7c3aed' }}>
                        {run.records.some(r => r.advance_deduction > 0)
                          ? fmt(run.records.reduce((s, r) => s + (r.advance_deduction ?? 0), 0))
                          : <span style={{ color: '#9ca3af' }}>—</span>}
                      </td>
                      <td style={{ ...TD_R, fontWeight: 600, color: '#6b7280' }}>
                        {fmt(run.records.reduce((s, r) => s + r.prof_tax, 0))}
                      </td>
                      <td style={{ ...TD_R, fontWeight: 700, color: '#166534' }}>
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
