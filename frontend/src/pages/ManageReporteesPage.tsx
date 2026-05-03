import { useEffect, useState } from 'react';
import AppLayout from '../components/shared/AppLayout';
import { getMyReportees, type Reportee } from '../api/users';
import { getTeamExits, managerAccept, setReplacement, type ExitRequest } from '../api/exit';
import { createPosition } from '../api/ats-positions';
import { useAuth } from '../context/AuthContext';

const HR_SPOC_OPTIONS = ['Ravindra Varma', 'Srinivas', 'Venu'];

interface ReplacementForm {
  exitId: number;
  role: string;
  project: string;
  department: string;
  hr_spoc: string;
  required_by_date: string;
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin', hr: 'HR', director: 'Director',
  projectlead: 'Project Lead', businesshead: 'Business Head',
  employee: 'Employee', vp_hr: 'VP HR&OD',
};

const STATUS_LABELS: Record<string, { label: string; bg: string; color: string }> = {
  pending_manager: { label: 'Pending Your Approval', bg: '#fef3c7', color: '#92400e' },
  pending_vp:      { label: 'Pending VP Approval',   bg: '#dbeafe', color: '#1d4ed8' },
  approved:        { label: 'Approved',               bg: '#dcfce7', color: '#15803d' },
  revoked:         { label: 'Revoked',                bg: '#f3f4f6', color: '#6b7280' },
};

function fmtDate(d: string) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function ManageReporteesPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<'reportees' | 'exit'>('reportees');
  const [reportees, setReportees] = useState<Reportee[]>([]);
  const [exits, setExits] = useState<ExitRequest[]>([]);
  const [loadingReportees, setLoadingReportees] = useState(true);
  const [loadingExits, setLoadingExits] = useState(true);
  const [accepting, setAccepting] = useState<number | null>(null);
  const [replacementForm, setReplacementForm] = useState<ReplacementForm | null>(null);
  const [submittingReplacement, setSubmittingReplacement] = useState(false);

  useEffect(() => {
    getMyReportees().then(setReportees).finally(() => setLoadingReportees(false));
    getTeamExits().then(setExits).finally(() => setLoadingExits(false));
  }, []);

  const handleAccept = async (id: number) => {
    setAccepting(id);
    try {
      await managerAccept(id);
      setExits(prev => prev.map(e => e.id === id ? { ...e, status: 'pending_vp' as const } : e));
    } catch (e: any) {
      alert(e.message || 'Failed to accept.');
    } finally {
      setAccepting(null);
    }
  };

  const openReplacement = (ex: ExitRequest) => {
    setReplacementForm({
      exitId: ex.id,
      role: ex.designation || '',
      project: ex.project || '',
      department: ex.department || '',
      hr_spoc: HR_SPOC_OPTIONS[0],
      required_by_date: ex.last_working_day,
    });
  };

  const handleRequestReplacement = async () => {
    if (!replacementForm) return;
    setSubmittingReplacement(true);
    try {
      const isBH = user?.role === 'businesshead';
      const created = await createPosition({
        project: replacementForm.project,
        department: replacementForm.department.trim(),
        role: replacementForm.role,
        total_req: 1,
        hr_spoc: replacementForm.hr_spoc,
        required_by_date: replacementForm.required_by_date,
        approval_status: isBH ? 'approved' : 'pending',
        is_replacement: true,
      });
      await setReplacement(replacementForm.exitId, created.job_id);
      setExits(prev => prev.map(e => e.id === replacementForm.exitId
        ? { ...e, replacement_job_id: created.job_id }
        : e,
      ));
      setReplacementForm(null);
      alert('Replacement position request submitted successfully.');
    } catch (e: any) {
      alert(e.message || 'Failed to submit replacement request.');
    } finally {
      setSubmittingReplacement(false);
    }
  };

  const pendingCount = exits.filter(e => e.status === 'pending_manager').length;

  return (
    <AppLayout>
      <div style={{ maxWidth: 1100 }}>
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#111827' }}>Manage Reportees</h2>
          <p style={{ margin: '4px 0 0', fontSize: 14, color: '#6b7280' }}>
            {reportees.length} direct report{reportees.length !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid #e5e7eb' }}>
          {([['reportees', 'Reportees'], ['exit', `Exit Requests${pendingCount > 0 ? ` (${pendingCount})` : ''}`]] as const).map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)} style={{
              padding: '8px 18px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 14,
              fontWeight: tab === key ? 600 : 500, color: tab === key ? '#6d28d9' : '#6b7280',
              borderBottom: tab === key ? '2px solid #6d28d9' : '2px solid transparent', marginBottom: -1, transition: 'color 0.15s',
            }}>{label}</button>
          ))}
        </div>

        {tab === 'reportees' ? (
          loadingReportees ? (
            <div style={{ padding: 40, color: '#9ca3af', fontSize: 14 }}>Loading…</div>
          ) : reportees.length === 0 ? (
            <div style={{ padding: 48, textAlign: 'center', background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', color: '#6b7280', fontSize: 14 }}>
              No direct reportees assigned to you.
            </div>
          ) : (
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                <thead>
                  <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                    {['Employee', 'Emp ID', 'Designation', 'Role', 'Project', 'Location', 'Status'].map(h => (
                      <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: '#374151', fontSize: 12, letterSpacing: '0.02em', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {reportees.map((r, i) => (
                    <tr key={r.id} style={{ borderBottom: i < reportees.length - 1 ? '1px solid #f3f4f6' : 'none', transition: 'background 0.1s' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#fafafa')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 12, flexShrink: 0 }}>
                            {r.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, color: '#111827' }}>{r.name}</div>
                            <div style={{ fontSize: 12, color: '#9ca3af' }}>{r.email}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px', color: '#6b7280' }}>{r.emp_id || '—'}</td>
                      <td style={{ padding: '12px 16px', color: '#374151' }}>{r.designation || '—'}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 12, fontSize: 12, fontWeight: 500, background: '#ede9fe', color: '#6d28d9' }}>
                          {ROLE_LABELS[r.role] ?? r.role}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', color: '#374151' }}>{r.project || '—'}</td>
                      <td style={{ padding: '12px 16px', color: '#6b7280' }}>{[r.site_office, r.location].filter(Boolean).join(', ') || '—'}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 12, fontSize: 12, fontWeight: 500, background: r.status === 'active' ? '#dcfce7' : '#fee2e2', color: r.status === 'active' ? '#15803d' : '#b91c1c' }}>
                          {r.status === 'active' ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : (
          /* Exit Requests tab */
          loadingExits ? (
            <div style={{ padding: 40, color: '#9ca3af', fontSize: 14 }}>Loading…</div>
          ) : exits.length === 0 ? (
            <div style={{ padding: 48, textAlign: 'center', background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', color: '#6b7280', fontSize: 14 }}>
              No exit requests from your team.
            </div>
          ) : (
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                <thead>
                  <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                    {['Employee', 'Submitted', 'Notice Period', 'Last Working Day', 'Status', ''].map(h => (
                      <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: '#374151', fontSize: 12, whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {exits.map((ex, i) => {
                    const st = STATUS_LABELS[ex.status] ?? STATUS_LABELS.pending_manager;
                    return (
                      <tr key={ex.id} style={{ borderBottom: i < exits.length - 1 ? '1px solid #f3f4f6' : 'none' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#fafafa')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ fontWeight: 600, color: '#111827' }}>{ex.employee_name}</div>
                          <div style={{ fontSize: 12, color: '#9ca3af' }}>{ex.designation} {ex.emp_id ? `· ${ex.emp_id}` : ''}</div>
                        </td>
                        <td style={{ padding: '12px 16px', color: '#6b7280', fontSize: 13 }}>{fmtDate(ex.submitted_at)}</td>
                        <td style={{ padding: '12px 16px', color: '#374151', fontSize: 13 }}>{ex.notice_period_days} days</td>
                        <td style={{ padding: '12px 16px', fontWeight: 600, color: '#92400e', fontSize: 13 }}>{fmtDate(ex.last_working_day)}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 12, fontSize: 12, fontWeight: 500, background: st.bg, color: st.color }}>
                            {st.label}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            {ex.status === 'pending_manager' && (
                              <button
                                onClick={() => handleAccept(ex.id)}
                                disabled={accepting === ex.id}
                                style={{ padding: '5px 14px', borderRadius: 6, border: 'none', background: '#6d28d9', color: '#fff', fontWeight: 600, fontSize: 12, cursor: 'pointer', opacity: accepting === ex.id ? 0.6 : 1 }}
                              >
                                {accepting === ex.id ? 'Accepting…' : 'Accept'}
                              </button>
                            )}
                            {(ex.status === 'approved' || ex.status === 'pending_vp') && (
                              ex.replacement_job_id ? (
                                <span style={{ padding: '5px 14px', borderRadius: 6, border: '1px solid #d1d5db', background: '#f3f4f6', color: '#6b7280', fontWeight: 600, fontSize: 12, whiteSpace: 'nowrap' }}>
                                  Replacement Requested
                                </span>
                              ) : (
                                <button
                                  onClick={() => openReplacement(ex)}
                                  style={{ padding: '5px 14px', borderRadius: 6, border: '1px solid #d97706', background: '#fffbeb', color: '#d97706', fontWeight: 600, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}
                                >
                                  Request Replacement
                                </button>
                              )
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>

      {/* Request Replacement Modal */}
      {replacementForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 32, width: 460, maxWidth: '90vw', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <h3 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 700, color: '#111827' }}>Request Replacement</h3>
            <p style={{ margin: '0 0 20px', fontSize: 13, color: '#6b7280' }}>Review the details below and submit to create a new position request.</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 0, background: '#f9fafb', borderRadius: 10, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
              {([
                ['Role', replacementForm.role || '—'],
                ['Project', replacementForm.project || '—'],
                ['Department', replacementForm.department || '—'],
                ['HR SPOC', replacementForm.hr_spoc],
                ['Required By Date', fmtDate(replacementForm.required_by_date)],
              ] as [string, string][]).map(([label, value], i, arr) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', padding: '11px 16px', borderBottom: i < arr.length - 1 ? '1px solid #e5e7eb' : 'none', background: '#fff' }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', width: 140, flexShrink: 0 }}>{label}</span>
                  <span style={{ fontSize: 14, color: '#111827', fontWeight: 500 }}>{value}</span>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 28, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setReplacementForm(null)}
                disabled={submittingReplacement}
                style={{ padding: '8px 20px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', color: '#374151', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={handleRequestReplacement}
                disabled={submittingReplacement}
                style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: '#6d28d9', color: '#fff', fontWeight: 600, fontSize: 14, cursor: 'pointer', opacity: submittingReplacement ? 0.6 : 1 }}
              >
                {submittingReplacement ? 'Submitting…' : 'Submit Request'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
