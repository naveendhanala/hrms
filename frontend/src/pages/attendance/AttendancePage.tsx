import { useState, useEffect, useCallback } from 'react';
import AppLayout from '../../components/shared/AppLayout';
import { useAuth } from '../../context/AuthContext';
import {
  getToday, getSummary, getMyAttendance, getAllAttendance, getAttendanceReport,
  getMyLeaves, getAllLeaves, checkIn, checkOut, applyLeave,
  approveLeave, rejectLeave, getLeaveBalance,
  type AttendanceRecord, type LeaveRequest, type AttendanceSummary, type EmployeeAttendanceSummary,
} from '../../api/attendance';

type Tab = 'summary' | 'overview' | 'history' | 'leaves' | 'all-attendance' | 'manage-leaves';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function downloadCSV(filename: string, headers: string[], rows: (string | number | null)[]) {
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

  const [tab, setTab] = useState<Tab>('overview');
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year] = useState(now.getFullYear());

  const [today, setToday] = useState<AttendanceRecord | null>(null);
  const [summary, setSummary] = useState<AttendanceSummary>({ present: 0, absent: 0, leave: 0 });
  const [history, setHistory] = useState<AttendanceRecord[]>([]);
  const [allRecords, setAllRecords] = useState<AttendanceRecord[]>([]);
  const [report, setReport] = useState<EmployeeAttendanceSummary[]>([]);
  const [reportSearch, setReportSearch] = useState('');
  const [leaveBalance, setLeaveBalance] = useState<number>(0);
  const [myLeaves, setMyLeaves] = useState<LeaveRequest[]>([]);
  const [allLeaves, setAllLeaves] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState('');

  // Leave form
  const [leaveForm, setLeaveForm] = useState({ start_date: '', end_date: '', type: 'casual', reason: '' });
  const [showLeaveForm, setShowLeaveForm] = useState(false);

  const flash = (msg: string) => { setActionMsg(msg); setTimeout(() => setActionMsg(''), 3000); };

  const loadOverview = useCallback(async () => {
    setLoading(true);
    try {
      const [t, s] = await Promise.all([getToday(), getSummary(month, year)]);
      setToday(t);
      setSummary(s);
    } finally { setLoading(false); }
  }, [month, year]);

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

  useEffect(() => { if (tab === 'summary') loadReport(); }, [tab, loadReport]);
  useEffect(() => { if (tab === 'overview') loadOverview(); }, [tab, loadOverview]);
  useEffect(() => { if (tab === 'history') loadHistory(); }, [tab, loadHistory]);
  useEffect(() => { if (tab === 'all-attendance') loadAllAttendance(); }, [tab, loadAllAttendance]);
  useEffect(() => { if (tab === 'leaves') loadLeaves(); }, [tab, loadLeaves]);
  useEffect(() => { if (tab === 'manage-leaves') loadAllLeaves(); }, [tab, loadAllLeaves]);

  const handleCheckIn = async () => {
    try { setToday(await checkIn()); flash('Checked in successfully'); }
    catch (e: any) { flash(e.message || 'Error checking in'); }
  };

  const handleCheckOut = async () => {
    try { setToday(await checkOut()); flash('Checked out successfully'); }
    catch (e: any) { flash(e.message || 'Error checking out'); }
  };

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
    { key: 'overview', label: 'Overview' },
    { key: 'history', label: 'My Attendance' },
    { key: 'leaves', label: 'My Leaves' },
    ...(isAdmin ? [
      { key: 'manage-leaves' as Tab, label: 'Manage Leaves' },
      { key: 'summary' as Tab, label: 'Summary' },
      { key: 'all-attendance' as Tab, label: 'All Attendance' },
    ] : []),
  ];

  const card = (label: string, value: number, bg: string, color: string) => (
    <div style={{ background: '#fff', borderRadius: 12, padding: '16px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
      <p style={{ margin: '0 0 4px', fontSize: 12, color: '#6b7280', fontWeight: 500 }}>{label}</p>
      <p style={{ margin: 0, fontSize: 28, fontWeight: 700, color }}>{value}</p>
      <div style={{ marginTop: 6, height: 3, borderRadius: 2, background: bg, opacity: 0.5 }} />
    </div>
  );

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

      {/* ── OVERVIEW ── */}
      {tab === 'overview' && (
        <div>
          {/* Check-in / Check-out card */}
          <div style={{ background: '#fff', borderRadius: 14, padding: '20px 24px', marginBottom: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
            <div>
              <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>Today — {now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
              {today ? (
                <div style={{ marginTop: 6, display: 'flex', gap: 20 }}>
                  <span style={{ fontSize: 13 }}><b>In:</b> {today.check_in || '—'}</span>
                  <span style={{ fontSize: 13 }}><b>Out:</b> {today.check_out || '—'}</span>
                  {today.work_hours != null && <span style={{ fontSize: 13 }}><b>Hours:</b> {today.work_hours}h</span>}
                  <Badge label={today.status} />
                </div>
              ) : (
                <p style={{ margin: '6px 0 0', fontSize: 13, color: '#9ca3af' }}>Not checked in yet</p>
              )}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={handleCheckIn} disabled={!!today?.check_in} style={{
                padding: '8px 20px', borderRadius: 8, border: 'none', cursor: today?.check_in ? 'not-allowed' : 'pointer',
                background: today?.check_in ? '#f3f4f6' : '#6366f1', color: today?.check_in ? '#9ca3af' : 'white',
                fontWeight: 600, fontSize: 13,
              }}>Check In</button>
              <button onClick={handleCheckOut} disabled={!today?.check_in || !!today?.check_out} style={{
                padding: '8px 20px', borderRadius: 8, border: 'none',
                cursor: (!today?.check_in || !!today?.check_out) ? 'not-allowed' : 'pointer',
                background: (!today?.check_in || !!today?.check_out) ? '#f3f4f6' : '#10b981',
                color: (!today?.check_in || !!today?.check_out) ? '#9ca3af' : 'white',
                fontWeight: 600, fontSize: 13,
              }}>Check Out</button>
            </div>
          </div>

          {/* Month selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <span style={{ fontSize: 13, color: '#6b7280', fontWeight: 500 }}>Month:</span>
            <select value={month} onChange={e => setMonth(Number(e.target.value))} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #e5e7eb', fontSize: 13 }}>
              {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m} {year}</option>)}
            </select>
          </div>

          {/* Summary cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            {card('Present', summary.present, '#22c55e', '#166534')}
            {card('On Leave', summary.leave, '#6366f1', '#3730a3')}
            {card('Absent', summary.absent, '#ef4444', '#991b1b')}
          </div>
        </div>
      )}

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
                <p style={{ margin: '2px 0 0', fontSize: 13, color: '#374151' }}>2 days / month &nbsp;·&nbsp; Carry-forward &nbsp;·&nbsp; Resets in April</p>
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
