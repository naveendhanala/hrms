import { useEffect, useState } from 'react';
import AppLayout from '../components/shared/AppLayout';
import { getMyExit, submitResignation, revokeResignation, type ExitRequest } from '../api/exit';

const STATUS_STEPS = [
  { key: 'pending_manager', label: 'Pending Manager Approval' },
  { key: 'pending_vp',      label: 'Pending VP HR Approval' },
  { key: 'approved',        label: 'Approved' },
];

function fmtDate(d: string) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function MyResignationPage() {
  const [request, setRequest] = useState<ExitRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    getMyExit().then(setRequest).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');
    try {
      await submitResignation(reason);
      setConfirm(false);
      load();
    } catch (e: any) {
      setError(e.message || 'Failed to submit.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevoke = async () => {
    if (!window.confirm('Are you sure you want to revoke your resignation?')) return;
    setRevoking(true);
    try {
      await revokeResignation();
      setRequest(null);
    } catch (e: any) {
      alert(e.message || 'Failed to revoke.');
    } finally {
      setRevoking(false);
    }
  };

  if (loading) return <AppLayout><div style={{ padding: 40, color: '#9ca3af', fontSize: 14 }}>Loading…</div></AppLayout>;

  const currentStepIndex = STATUS_STEPS.findIndex(s => s.key === request?.status);

  return (
    <AppLayout>
      <div style={{ maxWidth: 620 }}>
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#111827' }}>My Resignation</h2>
          <p style={{ margin: '4px 0 0', fontSize: 14, color: '#6b7280' }}>Submit or track your resignation request</p>
        </div>

        {!request ? (
          <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: 32 }}>
            {!confirm ? (
              <>
                <p style={{ margin: '0 0 8px', fontSize: 14, color: '#374151' }}>
                  Your Last Working Day will be automatically calculated based on your notice period.
                </p>
                <p style={{ margin: '0 0 20px', fontSize: 13, color: '#9ca3af' }}>
                  APM &amp; above: <strong>90 days</strong> notice &nbsp;|&nbsp; APM below: <strong>60 days</strong> notice
                </p>
                <button
                  onClick={() => setConfirm(true)}
                  style={{ padding: '9px 20px', borderRadius: 8, border: 'none', background: '#dc2626', color: '#fff', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}
                >
                  Submit Resignation
                </button>
              </>
            ) : (
              <>
                <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, color: '#111827' }}>Confirm Resignation</h3>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                    Reason (optional)
                  </label>
                  <textarea
                    rows={3}
                    value={reason}
                    onChange={e => setReason(e.target.value)}
                    placeholder="Add a reason for your resignation..."
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }}
                  />
                </div>
                {error && <p style={{ color: '#dc2626', fontSize: 13, margin: '0 0 12px' }}>{error}</p>}
                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    onClick={handleSubmit}
                    disabled={submitting}
                    style={{ padding: '9px 20px', borderRadius: 8, border: 'none', background: '#dc2626', color: '#fff', fontWeight: 600, fontSize: 14, cursor: 'pointer', opacity: submitting ? 0.6 : 1 }}
                  >
                    {submitting ? 'Submitting…' : 'Confirm Resignation'}
                  </button>
                  <button
                    onClick={() => setConfirm(false)}
                    style={{ padding: '9px 20px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', color: '#374151', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: 32 }}>
            {/* Key dates */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 28 }}>
              {[
                { label: 'Submitted On', value: fmtDate(request.submitted_at) },
                { label: 'Notice Period', value: `${request.notice_period_days} days` },
                { label: 'Last Working Day', value: fmtDate(request.last_working_day), highlight: true },
              ].map(({ label, value, highlight }) => (
                <div key={label} style={{ background: highlight ? '#fef3c7' : '#f9fafb', borderRadius: 10, padding: '14px 16px', border: highlight ? '1px solid #fde68a' : '1px solid #f3f4f6' }}>
                  <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</p>
                  <p style={{ margin: '4px 0 0', fontSize: highlight ? 16 : 15, fontWeight: 700, color: highlight ? '#92400e' : '#111827' }}>{value}</p>
                </div>
              ))}
            </div>

            {/* Status stepper */}
            <div style={{ marginBottom: 24 }}>
              <p style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 600, color: '#374151' }}>Approval Status</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
                {STATUS_STEPS.map((step, i) => {
                  const done = i < currentStepIndex || request.status === 'approved';
                  const active = i === currentStepIndex && request.status !== 'approved';
                  return (
                    <div key={step.key} style={{ display: 'flex', alignItems: 'center', flex: i < STATUS_STEPS.length - 1 ? 1 : undefined }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                        <div style={{
                          width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: done ? '#16a34a' : active ? '#6d28d9' : '#e5e7eb',
                          color: (done || active) ? '#fff' : '#9ca3af',
                          fontWeight: 700, fontSize: 12,
                        }}>
                          {done ? '✓' : i + 1}
                        </div>
                        <p style={{ margin: 0, fontSize: 11, fontWeight: active ? 600 : 400, color: active ? '#6d28d9' : done ? '#16a34a' : '#9ca3af', textAlign: 'center', maxWidth: 90 }}>
                          {step.label}
                        </p>
                      </div>
                      {i < STATUS_STEPS.length - 1 && (
                        <div style={{ flex: 1, height: 2, background: done ? '#16a34a' : '#e5e7eb', margin: '0 4px', marginBottom: 28 }} />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Reason */}
            {request.reason && (
              <div style={{ marginBottom: 20, padding: '12px 16px', background: '#f9fafb', borderRadius: 8, border: '1px solid #f3f4f6' }}>
                <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Reason</p>
                <p style={{ margin: '4px 0 0', fontSize: 14, color: '#374151' }}>{request.reason}</p>
              </div>
            )}

            {/* Revoke */}
            {request.status !== 'approved' && (
              <button
                onClick={handleRevoke}
                disabled={revoking}
                style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid #fca5a5', background: '#fff', color: '#dc2626', fontWeight: 600, fontSize: 13, cursor: 'pointer', opacity: revoking ? 0.6 : 1 }}
              >
                {revoking ? 'Revoking…' : 'Revoke Resignation'}
              </button>
            )}
            {request.status === 'approved' && (
              <div style={{ padding: '10px 16px', background: '#dcfce7', borderRadius: 8, border: '1px solid #bbf7d0', display: 'inline-block' }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#15803d' }}>Resignation fully approved. You cannot revoke at this stage.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
