import { useState, useEffect, useCallback } from 'react';
import AppLayout from '../../components/shared/AppLayout';
import { useAuth } from '../../context/AuthContext';
import {
  getMyAttendance, getAllAttendance, getAttendanceReport,
  getMyLeaves, getAllLeaves, applyLeave,
  approveLeave, rejectLeave, getLeaveBalance, setManualAttendance,
  getAllLeaveBalances, grantQuarterlyLeaves,
  type AttendanceRecord, type LeaveRequest, type EmployeeAttendanceSummary,
} from '../../api/attendance';
import { getEmployees } from '../../api/users';

type Tab = 'summary' | 'history' | 'leaves' | 'all-attendance' | 'manage-leaves' | 'mark-attendance';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function downloadCSV(filename: string, headers: string[], rows: (string | number | null | undefined)[][]) {
  const escape = (v: string | number | null) => {
    const s = v == null ? '' : String(v);
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [headers, ...rows].map((r: any) => (Array.isArray(r) ? r : [r]).map(escape).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  present:  { bg: '#dcfce7', color: '#166534' },
  leave:    { bg: '#dbeafe', color: '#1e40af' },
  absent:   { bg: '#fee2e2', color: '#991b1b' },
  pending:  { bg: '#fef9c3', color: '#854d0e' },
  approved: { bg: '#dcfce7', color: '#166534' },
  rejected: { bg: '#fee2e2', color: '#991b1b' },
};

function Badge({ label }: { label: string }) {
  const s = STATUS_STYLE[label.toLowerCase()] || { bg: '#f3f4f6', color: '#374151' };
  return (
    <span style={{
      padding: '2px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600,
      background: s.bg, color: s.color, textTransform: 'capitalize',
    }}>
      {label}
    </span>
  );
}

export default function AttendancePage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'hr';

  const [tab, setTab] = useState<Tab>('history');
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());

  const [history, setHistory] = useState<AttendanceRecord[]>([]);
  const [allRecords, setAllRecords] = useState<AttendanceRecord[]>([]);
  const [report, setReport] = useState<EmployeeAttendanceSummary[]>([]);
  const [reportSearch, setReportSearch] = useState('');
  const [leaveBalance, setLeaveBalance] = useState<number>(0);
  const [myLeaves, setMyLeaves] = useState<LeaveRequest[]>([]);
  const [allLeaves, setAllLeaves] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState('');

  // mark-attendance state
  const [markGrid, setMarkGrid] = useState<Record<number, Record<string, string>>>({});
  const [markEmployees, setMarkEmployees] = useState<{ user_id: number; user_name: string }[]>([]);
  const [markBalances, setMarkBalances] = useState<Record<number, number>>({});
  const [markLoading, setMarkLoading] = useState(false);
  const [markError, setMarkError] = useState('');
  const [markSaving, setMarkSaving] = useState<string | null>(null);
  const [markGranting, setMarkGranting] = useState(false);

  // Leave form
  const [leaveForm, setLeaveForm] = useState({ start_date: '', end_date: '', type: 'casual', reason: '' });
  const [showLeaveForm, setShowLeaveForm] = useState(false);

  const flash = (msg: string) => { setActionMsg(msg); setTimeout(() => setActionMsg(''), 3000); };

  const loadHistory = useCallback(async () => {
    setLoading(true);
    try { setHistory(await getMyAttendance(month, year)); }
    finally { setLoading(false); }
  }, [month, year]);

  const loadAllAttendance = useCallback(async () => {
    setLoading(true);
    try { setAllRecords(await getAllAttendance(month, year)); }
    finally { setLoading(false); }
  }, [month, year]);

  const loadReport = useCallback(async () => {
    setLoading(true);
    try { setReport(await getAttendanceReport(month, year)); }
    finally { setLoading(false); }
  }, [month, year]);

  const loadLeaves = useCallback(async () => {
    setLoading(true);
    try {
      const [leaves, bal] = await Promise.all([getMyLeaves(), getLeaveBalance()]);
      setMyLeaves(leaves);
      setLeaveBalance(bal.balance);
    }
    finally { setLoading(false); }
  }, []);

  const loadAllLeaves = useCallback(async () => {
    setLoading(true);
    try { setAllLeaves(await getAllLeaves()); }
    finally { setLoading(false); }
  }, []);

  const loadMarkAttendance = useCallback(async () => {
    setMarkLoading(true);
    setMarkError('');
    try {
      const [employees, records, balances] = await Promise.all([
        getEmployees(),
        getAllAttendance(month, year),
        getAllLeaveBalances(),
      ]);
      const active = employees.filter(e => e.role !== 'admin' && e.status === 'active');
      setMarkEmployees(active.map(e => ({ user_id: e.id, user_name: e.name })));
      const grid: Record<number, Record<string, string>> = {};
      for (const r of records) {
        if (!grid[r.user_id]) grid[r.user_id] = {};
        grid[r.user_id][r.date] = r.status;
      }
      setMarkGrid(grid);
      const balMap: Record<number, number> = {};
      for (const b of balances) balMap[b.user_id] = b.balance;
      setMarkBalances(balMap);
    } catch (err: any) {
      setMarkError(err.message || 'Failed to load attendance data');
    } finally {
      setMarkLoading(false);
    }
  }, [month, year]);

  useEffect(() => { if (tab === 'summary') loadReport(); }, [tab, loadReport]);
  useEffect(() => { if (tab === 'history') loadHistory(); }, [tab, loadHistory]);
  useEffect(() => { if (tab === 'all-attendance') loadAllAttendance(); }, [tab, loadAllAttendance]);
  useEffect(() => { if (tab === 'leaves') loadLeaves(); }, [tab, loadLeaves]);
  useEffect(() => { if (tab === 'manage-leaves') loadAllLeaves(); }, [tab, loadAllLeaves]);
  useEffect(() => { if (tab === 'mark-attendance') loadMarkAttendance(); }, [tab, loadMarkAttendance]);

  const handleApplyLeave = async () => {
    if (!leaveForm.start_date || !leaveForm.end_date || !leaveForm.reason) {
      flash('Please fill all fields'); return;
    }
    try {
      await applyLeave(leaveForm);
      setLeaveForm({ start_date: '', end_date: '', type: 'casual', reason: '' });
      setShowLeaveForm(false);
      flash('Leave applied successfully');
      loadLeaves();
    } catch (e: any) { flash(e.message || 'Error applying leave'); }
  };

  const handleApprove = async (id: number) => {
    try { await approveLeave(id); flash('Leave approved'); loadAllLeaves(); }
    catch (e: any) { flash(e.message || 'Error'); }
  };

  const handleReject = async (id: number) => {
    try { await rejectLeave(id); flash('Leave rejected'); loadAllLeaves(); }
    catch (e: any) { flash(e.message || 'Error'); }
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: 'history', label: 'My Attendance' },
    { key: 'leaves', label: 'My Leaves' },
    ...(isAdmin ? [
      { key: 'manage-leaves' as Tab, label: 'Manage Leaves' },
      { key: 'mark-attendance' as Tab, label: 'Mark Attendance' },
      { key: 'summary' as Tab, label: 'Summary' },
      { key: 'all-attendance' as Tab, label: 'All Attendance' },
    ] : []),
  ];


  return (
    <AppLayout>
      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, borderBottom: '1px solid #e5e7eb', marginBottom: 20 }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: '8px 16px', fontSize: 13, fontWeight: 500, border: 'none', cursor: 'pointer',
            background: 'none', borderBottom: tab === t.key ? '2px solid #6366f1' : '2px solid transparent',
            color: tab === t.key ? '#6366f1' : '#6b7280', transition: 'color 0.15s',
          }}>{t.label}</button>
        ))}
      </div>

      {actionMsg && (
        <div style={{ marginBottom: 14, padding: '10px 16px', borderRadius: 8, background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', fontSize: 13 }}>
          {actionMsg}
        </div>
      )}

      {/* ── SUMMARY (Admin/HR) ── */}
      {tab === 'summary' && isAdmin && (() => {
        const filtered = report.filter(e =>
          e.user_name.toLowerCase().includes(reportSearch.toLowerCase()) ||
          e.user_role.toLowerCase().includes(reportSearch.toLowerCase())
        );
        const totalPresent = report.reduce((s, e) => s + e.present, 0);
        const totalAbsent  = report.reduce((s, e) => s + e.absent, 0);
        const totalLeave   = report.reduce((s, e) => s + e.leave_days, 0);
        const presentToday = report.filter(e => e.today_status === 'present').length;
        const onLeaveToday = report.filter(e => e.today_status === 'leave').length;

        const statCard = (label: string, value: number | string, color: string, sub?: string) => (
          <div style={{ background: '#fff', borderRadius: 12, padding: '16px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', flex: 1 }}>
            <p style={{ margin: '0 0 4px', fontSize: 12, color: '#6b7280', fontWeight: 500 }}>{label}</p>
            <p style={{ margin: 0, fontSize: 28, fontWeight: 700, color }}>{value}</p>
            {sub && <p style={{ margin: '4px 0 0', fontSize: 11, color: '#9ca3af' }}>{sub}</p>}
          </div>
        );

        const TODAY_STYLE: Record<string, { bg: string; color: string }> = {
          present: { bg: '#dcfce7', color: '#166534' },
          leave:   { bg: '#dbeafe', color: '#1e40af' },
          absent:  { bg: '#fee2e2', color: '#991b1b' },
        };

        return (
          <div>
            {/* Month selector */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <select value={month} onChange={e => setMonth(Number(e.target.value))}
                  style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #e5e7eb', fontSize: 13 }}>
                  {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m} {year}</option>)}
                </select>
                <button
                  onClick={() => {
                    const headers = ['Employee', 'Role', 'Today Status', 'Present', 'On Leave', 'Absent', 'Avg Hours', 'Attendance %'];
                    const rows = filtered.map(e => {
                      const totalTracked = e.present + e.leave_days + e.absent;
                      const pct = totalTracked > 0 ? Math.round(e.present / totalTracked * 100) : '';
                      return [e.user_name, e.user_role, e.today_status ?? '', e.present, e.leave_days, e.absent, e.avg_hours ?? '', pct === '' ? '' : `${pct}%`];
                    });
                    downloadCSV(`attendance_summary_${MONTHS[month-1]}_${year}.csv`, headers, rows);
                  }}
                  style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 13, color: '#374151', display: 'flex', alignItems: 'center', gap: 5 }}
                >
                  ↓ Download CSV
                </button>
              </div>
              <input
                type="text"
                placeholder="Search by name or role…"
                value={reportSearch}
                onChange={e => setReportSearch(e.target.value)}
                style={{ width: 220, padding: '6px 12px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 13, outline: 'none' }}
              />
            </div>

            {/* Stat cards */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
              {statCard('Total Employees', report.length, '#111827')}
              {statCard('Present Today', presentToday, '#166534', `${report.length ? Math.round(presentToday / report.length * 100) : 0}% of team`)}
              {statCard('On Leave Today', onLeaveToday, '#1e40af')}
              {statCard(`Present (${MONTHS[month-1]})`, totalPresent, '#166534')}
              {statCard(`On Leave (${MONTHS[month-1]})`, totalLeave, '#1e40af')}
              {statCard(`Absent (${MONTHS[month-1]})`, totalAbsent, '#991b1b')}
            </div>

            {/* Per-employee table */}
            {loading ? <p style={{ color: '#9ca3af', fontSize: 13 }}>Loading...</p> : (
              <div style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f9fafb' }}>
                      {['Employee', 'Role', 'Today', 'Present', 'On Leave', 'Absent', 'Avg Hours', 'Attendance %'].map(h => (
                        <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 ? (
                      <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>No records</td></tr>
                    ) : filtered.map(e => {
                      const totalTracked = e.present + e.leave_days + e.absent;
                      const attendancePct = totalTracked > 0 ? Math.round(e.present / totalTracked * 100) : null;
                      const ts = e.today_status ? TODAY_STYLE[e.today_status] || { bg: '#f3f4f6', color: '#374151' } : null;
                      return (
                        <tr key={e.user_id} style={{ borderTop: '1px solid #f3f4f6' }}>
                          <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 600, color: '#111827' }}>{e.user_name}</td>
                          <td style={{ padding: '10px 14px', fontSize: 12, color: '#6b7280', textTransform: 'capitalize' }}>{e.user_role}</td>
                          <td style={{ padding: '10px 14px' }}>
                            {ts ? (
                              <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: ts.bg, color: ts.color, textTransform: 'capitalize' }}>
                                {e.today_status}
                              </span>
                            ) : <span style={{ fontSize: 12, color: '#9ca3af' }}>—</span>}
                          </td>
                          <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 600, color: '#166534' }}>{e.present}</td>
                          <td style={{ padding: '10px 14px', fontSize: 13, color: '#1e40af' }}>{e.leave_days}</td>
                          <td style={{ padding: '10px 14px', fontSize: 13, color: '#991b1b' }}>{e.absent}</td>
                          <td style={{ padding: '10px 14px', fontSize: 13, color: '#374151' }}>{e.avg_hours != null ? `${e.avg_hours}h` : '—'}</td>
                          <td style={{ padding: '10px 14px' }}>
                            {attendancePct !== null ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{ flex: 1, height: 6, background: '#f3f4f6', borderRadius: 3, minWidth: 60 }}>
                                  <div style={{ width: `${attendancePct}%`, height: '100%', borderRadius: 3, background: attendancePct >= 80 ? '#22c55e' : attendancePct >= 60 ? '#f59e0b' : '#ef4444' }} />
                                </div>
                                <span style={{ fontSize: 12, fontWeight: 600, color: '#374151', minWidth: 32 }}>{attendancePct}%</span>
                              </div>
                            ) : <span style={{ fontSize: 12, color: '#9ca3af' }}>—</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })()}

      {/* ── MY ATTENDANCE HISTORY ── */}
      {tab === 'history' && (
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            <select value={month} onChange={e => setMonth(Number(e.target.value))} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #e5e7eb', fontSize: 13 }}>
              {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m} {year}</option>)}
            </select>
          </div>
          {loading ? <p style={{ color: '#9ca3af', fontSize: 13 }}>Loading...</p> : (
            <div style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f9fafb' }}>
                    {['Date', 'Check In', 'Check Out', 'Hours', 'Status', 'Notes'].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {history.length === 0 ? (
                    <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>No records for this month</td></tr>
                  ) : history.map(r => (
                    <tr key={r.id} style={{ borderTop: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '10px 14px', fontSize: 13, color: '#111827', fontWeight: 500 }}>{r.date}</td>
                      <td style={{ padding: '10px 14px', fontSize: 13, color: '#374151' }}>{r.check_in || '—'}</td>
                      <td style={{ padding: '10px 14px', fontSize: 13, color: '#374151' }}>{r.check_out || '—'}</td>
                      <td style={{ padding: '10px 14px', fontSize: 13, color: '#374151' }}>{r.work_hours != null ? `${r.work_hours}h` : '—'}</td>
                      <td style={{ padding: '10px 14px' }}><Badge label={r.status} /></td>
                      <td style={{ padding: '10px 14px', fontSize: 12, color: '#9ca3af' }}>{r.notes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── MY LEAVES ── */}
      {tab === 'leaves' && (
        <div>
          {/* Leave balance banner */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ background: '#fff', borderRadius: 10, padding: '12px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div>
                  <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Available Leave Balance</p>
                  <p style={{ margin: '2px 0 0', fontSize: 24, fontWeight: 700, color: leaveBalance > 0 ? '#166534' : '#991b1b' }}>{leaveBalance} {leaveBalance === 1 ? 'day' : 'days'}</p>
                </div>
              </div>
              <div style={{ background: '#fff', borderRadius: 10, padding: '12px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Credit Policy</p>
                <p style={{ margin: '2px 0 0', fontSize: 13, color: '#374151' }}>
                  {user?.site_office === 'Site' ? '9 days / quarter' : user?.site_office === 'Office' ? '5 days / quarter' : '—'}
                  &nbsp;·&nbsp; Carry-forward &nbsp;·&nbsp; Resets in April
                </p>
              </div>
            </div>
            <button onClick={() => setShowLeaveForm(v => !v)} style={{
              padding: '8px 18px', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: '#6366f1', color: 'white', fontWeight: 600, fontSize: 13,
            }}>+ Apply Leave</button>
          </div>  {/* end balance banner row */}

          {showLeaveForm && (
            <div style={{ background: '#fff', borderRadius: 12, padding: 20, marginBottom: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 600, color: '#111827' }}>Apply for Leave</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 4 }}>Start Date</label>
                  <input type="date" value={leaveForm.start_date} onChange={e => setLeaveForm(f => ({ ...f, start_date: e.target.value }))}
                    style={{ width: '100%', padding: '7px 10px', border: '1px solid #e5e7eb', borderRadius: 7, fontSize: 13 }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 4 }}>End Date</label>
                  <input type="date" value={leaveForm.end_date} onChange={e => setLeaveForm(f => ({ ...f, end_date: e.target.value }))}
                    style={{ width: '100%', padding: '7px 10px', border: '1px solid #e5e7eb', borderRadius: 7, fontSize: 13 }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 4 }}>Leave Type</label>
                  <select value={leaveForm.type} onChange={e => setLeaveForm(f => ({ ...f, type: e.target.value }))}
                    style={{ width: '100%', padding: '7px 10px', border: '1px solid #e5e7eb', borderRadius: 7, fontSize: 13 }}>
                    <option value="casual">Casual</option>
                    <option value="sick">Sick</option>
                    <option value="earned">Earned</option>
                    <option value="unpaid">Unpaid</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 4 }}>Reason</label>
                  <input type="text" value={leaveForm.reason} onChange={e => setLeaveForm(f => ({ ...f, reason: e.target.value }))}
                    placeholder="Reason for leave"
                    style={{ width: '100%', padding: '7px 10px', border: '1px solid #e5e7eb', borderRadius: 7, fontSize: 13 }} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={handleApplyLeave} style={{ padding: '7px 18px', borderRadius: 7, border: 'none', cursor: 'pointer', background: '#6366f1', color: 'white', fontWeight: 600, fontSize: 13 }}>Submit</button>
                <button onClick={() => setShowLeaveForm(false)} style={{ padding: '7px 18px', borderRadius: 7, border: '1px solid #e5e7eb', cursor: 'pointer', background: 'white', color: '#374151', fontSize: 13 }}>Cancel</button>
              </div>
            </div>
          )}

          {loading ? <p style={{ color: '#9ca3af', fontSize: 13 }}>Loading...</p> : (
            <div style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f9fafb' }}>
                    {['From', 'To', 'Type', 'Reason', 'Status', 'Reviewed By', 'Applied On'].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {myLeaves.length === 0 ? (
                    <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>No leave requests</td></tr>
                  ) : myLeaves.map(l => (
                    <tr key={l.id} style={{ borderTop: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '10px 14px', fontSize: 13 }}>{l.start_date}</td>
                      <td style={{ padding: '10px 14px', fontSize: 13 }}>{l.end_date}</td>
                      <td style={{ padding: '10px 14px', fontSize: 13, textTransform: 'capitalize' }}>{l.type}</td>
                      <td style={{ padding: '10px 14px', fontSize: 13, color: '#6b7280', maxWidth: 200 }}>{l.reason}</td>
                      <td style={{ padding: '10px 14px' }}><Badge label={l.status} /></td>
                      <td style={{ padding: '10px 14px', fontSize: 13, color: '#6b7280' }}>{l.reviewer_name || '—'}</td>
                      <td style={{ padding: '10px 14px', fontSize: 12, color: '#9ca3af' }}>{l.created_at.split('T')[0]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── ALL ATTENDANCE (Admin/HR) ── */}
      {tab === 'all-attendance' && isAdmin && (
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            <select value={month} onChange={e => setMonth(Number(e.target.value))} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #e5e7eb', fontSize: 13 }}>
              {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m} {year}</option>)}
            </select>
            <button
              onClick={() => {
                const headers = ['Employee', 'Role', 'Date', 'Check In', 'Check Out', 'Hours', 'Status'];
                const rows = allRecords.map(r => [r.user_name, r.user_role, r.date, r.check_in ?? '', r.check_out ?? '', r.work_hours ?? '', r.status]);
                downloadCSV(`all_attendance_${MONTHS[month-1]}_${year}.csv`, headers, rows);
              }}
              style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 13, color: '#374151', display: 'flex', alignItems: 'center', gap: 5 }}
            >
              ↓ Download CSV
            </button>
          </div>
          {loading ? <p style={{ color: '#9ca3af', fontSize: 13 }}>Loading...</p> : (
            <div style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f9fafb' }}>
                    {['Employee', 'Role', 'Date', 'Check In', 'Check Out', 'Hours', 'Status'].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {allRecords.length === 0 ? (
                    <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>No records</td></tr>
                  ) : allRecords.map(r => (
                    <tr key={r.id} style={{ borderTop: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 500, color: '#111827' }}>{r.user_name}</td>
                      <td style={{ padding: '10px 14px', fontSize: 12, color: '#6b7280', textTransform: 'capitalize' }}>{r.user_role}</td>
                      <td style={{ padding: '10px 14px', fontSize: 13 }}>{r.date}</td>
                      <td style={{ padding: '10px 14px', fontSize: 13 }}>{r.check_in || '—'}</td>
                      <td style={{ padding: '10px 14px', fontSize: 13 }}>{r.check_out || '—'}</td>
                      <td style={{ padding: '10px 14px', fontSize: 13 }}>{r.work_hours != null ? `${r.work_hours}h` : '—'}</td>
                      <td style={{ padding: '10px 14px' }}><Badge label={r.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── MARK ATTENDANCE (Admin/HR) ── */}
      {tab === 'mark-attendance' && isAdmin && (() => {
        const daysInMonth = new Date(year, month, 0).getDate();
        const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
        const CYCLE: Record<string, 'present' | 'absent' | 'leave'> = { present: 'absent', absent: 'leave', leave: 'present' };
        const CELL: Record<string, { bg: string; color: string; label: string }> = {
          present: { bg: '#dcfce7', color: '#166534', label: 'P' },
          absent:  { bg: '#fee2e2', color: '#991b1b', label: 'A' },
          leave:   { bg: '#dbeafe', color: '#1e40af', label: 'L' },
        };
        const refreshBalances = async () => {
          try {
            const balances = await getAllLeaveBalances();
            const balMap: Record<number, number> = {};
            for (const b of balances) balMap[b.user_id] = b.balance;
            setMarkBalances(balMap);
          } catch {} // non-critical
        };

        const handleCell = async (userId: number, day: number) => {
          const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const key = `${userId}-${dateStr}`;
          if (markSaving === key) return;
          const current = markGrid[userId]?.[dateStr];
          const next = current ? CYCLE[current] || 'present' : 'present';
          setMarkGrid(prev => ({ ...prev, [userId]: { ...prev[userId], [dateStr]: next } }));
          setMarkSaving(key);
          try {
            await setManualAttendance(userId, dateStr, next);
            await refreshBalances();
          } catch (err: any) {
            setMarkGrid(prev => {
              const g = { ...prev[userId] };
              if (current) g[dateStr] = current; else delete g[dateStr];
              return { ...prev, [userId]: g };
            });
            flash(err.message || 'Save failed');
          } finally { setMarkSaving(null); }
        };

        const handleGrant = async () => {
          setMarkGranting(true);
          try {
            const result = await grantQuarterlyLeaves();
            flash(`Quarterly leaves granted — Site: ${result.site} emp, Office: ${result.office} emp`);
            await refreshBalances();
          } catch (err: any) {
            flash(err.message || 'Grant failed');
          } finally { setMarkGranting(false); }
        };
        return (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <select value={month} onChange={e => setMonth(Number(e.target.value))} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #e5e7eb', fontSize: 13 }}>
                  {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                </select>
                <select value={year} onChange={e => setYear(Number(e.target.value))} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #e5e7eb', fontSize: 13 }}>
                  {[year - 1, year, year + 1].map(y => <option key={y} value={y}>{y}</option>)}
                </select>
                <span style={{ fontSize: 12, color: '#9ca3af' }}>Click cell: <b style={{ color: '#166534' }}>P</b> → <b style={{ color: '#991b1b' }}>A</b> → <b style={{ color: '#1e40af' }}>L</b></span>
              </div>
              <button onClick={handleGrant} disabled={markGranting} style={{
                padding: '6px 14px', borderRadius: 7, border: 'none', cursor: markGranting ? 'not-allowed' : 'pointer',
                background: markGranting ? '#f3f4f6' : '#6366f1', color: markGranting ? '#9ca3af' : '#fff',
                fontWeight: 600, fontSize: 12,
              }}>
                {markGranting ? 'Granting…' : 'Grant Quarterly Leaves'}
              </button>
            </div>
            {markError && (
              <div style={{ marginBottom: 12, padding: '10px 16px', borderRadius: 8, background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', fontSize: 13 }}>
                {markError}
                <button onClick={loadMarkAttendance} style={{ marginLeft: 12, padding: '2px 10px', borderRadius: 5, border: '1px solid #fca5a5', background: '#fff', color: '#991b1b', cursor: 'pointer', fontSize: 12 }}>Retry</button>
              </div>
            )}
            {markLoading ? <p style={{ color: '#9ca3af', fontSize: 13 }}>Loading...</p> : (
              <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', overflowX: 'auto' }}>
                <table style={{ borderCollapse: 'collapse', minWidth: '100%' }}>
                  <thead>
                    <tr style={{ background: '#f9fafb' }}>
                      <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', position: 'sticky', left: 0, background: '#f9fafb', zIndex: 1, minWidth: 150, borderRight: '1px solid #e5e7eb' }}>Employee</th>
                      <th style={{ padding: '10px 8px', textAlign: 'center', fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', position: 'sticky', left: 150, background: '#f9fafb', zIndex: 1, minWidth: 58, borderRight: '1px solid #e5e7eb' }}>Bal</th>
                      {days.map(d => (
                        <th key={d} style={{ padding: '10px 4px', textAlign: 'center', fontSize: 11, fontWeight: 600, color: '#9ca3af', minWidth: 28 }}>{d}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {markEmployees.length === 0 ? (
                      <tr><td colSpan={daysInMonth + 2} style={{ padding: 24, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>No employees found</td></tr>
                    ) : markEmployees.map(emp => (
                      <tr key={emp.user_id} style={{ borderTop: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '6px 12px', fontSize: 12, fontWeight: 500, color: '#111827', position: 'sticky', left: 0, background: '#fff', zIndex: 1, borderRight: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>
                          {emp.user_name}
                        </td>
                        <td style={{ padding: '6px 8px', textAlign: 'center', fontSize: 11, fontWeight: 700, position: 'sticky', left: 150, background: '#fff', zIndex: 1, borderRight: '1px solid #e5e7eb', color: (markBalances[emp.user_id] ?? 0) > 0 ? '#166534' : '#9ca3af' }}>
                          {markBalances[emp.user_id] ?? 0}
                        </td>
                        {days.map(d => {
                          const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                          const status = markGrid[emp.user_id]?.[dateStr];
                          const key = `${emp.user_id}-${dateStr}`;
                          const cs = status ? CELL[status] : null;
                          return (
                            <td key={d} onClick={() => handleCell(emp.user_id, d)} style={{ padding: '4px 2px', textAlign: 'center', cursor: 'pointer' }}>
                              {cs ? (
                                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, borderRadius: 4, background: cs.bg, color: cs.color, fontSize: 10, fontWeight: 700, opacity: markSaving === key ? 0.4 : 1 }}>{cs.label}</span>
                              ) : (
                                <span style={{ display: 'inline-block', width: 22, height: 22, borderRadius: 4, background: '#f3f4f6', opacity: markSaving === key ? 0.4 : 1 }} />
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })()}

      {/* ── MANAGE LEAVES (Admin/HR) ── */}
      {tab === 'manage-leaves' && isAdmin && (
        <div>
          {loading ? <p style={{ color: '#9ca3af', fontSize: 13 }}>Loading...</p> : (
            <div style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f9fafb' }}>
                    {['Employee', 'From', 'To', 'Type', 'Reason', 'Status', 'Actions'].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {allLeaves.length === 0 ? (
                    <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>No leave requests</td></tr>
                  ) : allLeaves.map(l => (
                    <tr key={l.id} style={{ borderTop: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 500, color: '#111827' }}>{l.user_name}</td>
                      <td style={{ padding: '10px 14px', fontSize: 13 }}>{l.start_date}</td>
                      <td style={{ padding: '10px 14px', fontSize: 13 }}>{l.end_date}</td>
                      <td style={{ padding: '10px 14px', fontSize: 13, textTransform: 'capitalize' }}>{l.type}</td>
                      <td style={{ padding: '10px 14px', fontSize: 13, color: '#6b7280', maxWidth: 180 }}>{l.reason}</td>
                      <td style={{ padding: '10px 14px' }}><Badge label={l.status} /></td>
                      <td style={{ padding: '10px 14px' }}>
                        {l.status === 'pending' ? (
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button onClick={() => handleApprove(l.id)} style={{ padding: '4px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', background: '#dcfce7', color: '#166534', fontWeight: 600, fontSize: 12 }}>Approve</button>
                            <button onClick={() => handleReject(l.id)} style={{ padding: '4px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', background: '#fee2e2', color: '#991b1b', fontWeight: 600, fontSize: 12 }}>Reject</button>
                          </div>
                        ) : (
                          <span style={{ fontSize: 12, color: '#9ca3af' }}>Reviewed</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </AppLayout>
  );
}
