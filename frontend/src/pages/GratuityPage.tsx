import { useState, useEffect, useCallback } from 'react';
import AppLayout from '../components/shared/AppLayout';
import {
  getGratuityAccruals,
  getGratuityDisbursements,
  recordGratuityDisbursement,
  type GratuityAccrual,
  type GratuityDisbursement,
} from '../api/gratuity';

function fmt(n: number) {
  return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(s: string | null) {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

const TH_STYLE: React.CSSProperties = {
  padding: '11px 16px',
  textAlign: 'left',
  fontSize: 11,
  fontWeight: 600,
  color: '#9ca3af',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};

const TD_STYLE: React.CSSProperties = {
  padding: '13px 16px',
  fontSize: 13,
  color: '#374151',
};

const INPUT_STYLE: React.CSSProperties = {
  padding: '8px 12px',
  borderRadius: 8,
  border: '1px solid #e5e7eb',
  fontSize: 13,
  width: '100%',
  boxSizing: 'border-box',
};

const LABEL_STYLE: React.CSSProperties = {
  fontSize: 12,
  color: '#374151',
  fontWeight: 500,
  marginBottom: 4,
  display: 'block',
};

interface FormState {
  employee_id: string;
  exit_date: string;
  years_of_service: string;
  accrued_amount: string;
  paid_amount: string;
  payment_date: string;
  notes: string;
}

const EMPTY_FORM: FormState = {
  employee_id: '',
  exit_date: '',
  years_of_service: '',
  accrued_amount: '',
  paid_amount: '',
  payment_date: '',
  notes: '',
};

export default function GratuityPage() {
  const [tab, setTab] = useState<'accruals' | 'disbursements'>('accruals');

  // Accruals
  const [accruals, setAccruals] = useState<GratuityAccrual[]>([]);
  const [accrualLoading, setAccrualLoading] = useState(true);
  const [accrualError, setAccrualError] = useState('');

  // Disbursements
  const [disbursements, setDisbursements] = useState<GratuityDisbursement[]>([]);
  const [disbLoading, setDisbLoading] = useState(true);
  const [disbError, setDisbError] = useState('');

  // Form
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const loadAccruals = useCallback(async () => {
    setAccrualLoading(true);
    setAccrualError('');
    try {
      setAccruals(await getGratuityAccruals());
    } catch (e) {
      setAccrualError(e instanceof Error ? e.message : 'Failed to load accruals');
    } finally {
      setAccrualLoading(false);
    }
  }, []);

  const loadDisbursements = useCallback(async () => {
    setDisbLoading(true);
    setDisbError('');
    try {
      setDisbursements(await getGratuityDisbursements());
    } catch (e) {
      setDisbError(e instanceof Error ? e.message : 'Failed to load disbursements');
    } finally {
      setDisbLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === 'accruals') loadAccruals();
  }, [tab, loadAccruals]);

  useEffect(() => {
    if (tab === 'disbursements') loadDisbursements();
  }, [tab, loadDisbursements]);

  const selectedAccrual = accruals.find(a => a.employee_id === Number(form.employee_id));

  const handleEmployeeChange = (employee_id: string) => {
    const accrual = accruals.find(a => a.employee_id === Number(employee_id));
    setForm(f => ({
      ...f,
      employee_id,
      accrued_amount: accrual ? String(accrual.cumulative_amount) : '',
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');
    if (!form.employee_id || !form.exit_date || !form.years_of_service || !form.accrued_amount || !form.paid_amount || !form.payment_date) {
      setSubmitError('Please fill in all required fields.');
      return;
    }
    const yos = Number(form.years_of_service);
    if (isNaN(yos) || yos < 5) {
      setSubmitError('Years of service must be at least 5 (gratuity eligibility threshold).');
      return;
    }
    const paidAmt = Number(form.paid_amount);
    const accruedAmt = Number(form.accrued_amount);
    if (paidAmt > accruedAmt) {
      setSubmitError('Paid amount cannot exceed accrued amount.');
      return;
    }
    setSubmitting(true);
    try {
      await recordGratuityDisbursement({
        employee_id: Number(form.employee_id),
        exit_date: form.exit_date,
        years_of_service: yos,
        accrued_amount: accruedAmt,
        paid_amount: paidAmt,
        payment_date: form.payment_date,
        notes: form.notes || undefined,
      });
      setShowForm(false);
      setForm(EMPTY_FORM);
      setSuccessMsg('Disbursement recorded successfully.');
      setTimeout(() => setSuccessMsg(''), 4000);
      await loadDisbursements();
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Failed to record disbursement');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setForm(EMPTY_FORM);
    setSubmitError('');
  };

  return (
    <AppLayout>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#111827' }}>Gratuity</h2>
          <p style={{ margin: '2px 0 0', fontSize: 13, color: '#6b7280' }}>Gratuity accruals and disbursements</p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid #e5e7eb', marginBottom: 20 }}>
        {([['accruals', 'Accruals'], ['disbursements', 'Disbursements']] as const).map(([key, label]) => (
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
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── ACCRUALS TAB ── */}
      {tab === 'accruals' && (
        <div>
          {accrualError && (
            <div style={{ marginBottom: 14, padding: '10px 16px', borderRadius: 8, background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', fontSize: 13 }}>
              {accrualError}
            </div>
          )}
          <div style={{ background: '#fff', borderRadius: 14, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            {accrualLoading ? (
              <p style={{ padding: 32, color: '#9ca3af', fontSize: 14 }}>Loading…</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f9fafb' }}>
                    {['Emp ID', 'Employee Name', 'Date of Joining', 'Monthly Provision', 'Months Accrued', 'Cumulative Amount'].map(h => (
                      <th key={h} style={TH_STYLE}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {accruals.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ padding: 32, textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>
                        No accrual data available
                      </td>
                    </tr>
                  ) : accruals.map(a => (
                    <tr key={a.employee_id} style={{ borderTop: '1px solid #f3f4f6' }}>
                      <td style={{ ...TD_STYLE, fontFamily: 'monospace', color: '#9ca3af' }}>
                        {a.emp_id ?? '—'}
                      </td>
                      <td style={{ ...TD_STYLE, fontWeight: 600, color: '#111827' }}>
                        {a.employee_name}
                      </td>
                      <td style={TD_STYLE}>{fmtDate(a.date_of_joining)}</td>
                      <td style={TD_STYLE}>{fmt(a.last_monthly_provision)}</td>
                      <td style={TD_STYLE}>{Math.floor(a.total_accrued)}</td>
                      <td style={{ ...TD_STYLE, fontWeight: 600, color: '#16a34a' }}>
                        {fmt(a.cumulative_amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ── DISBURSEMENTS TAB ── */}
      {tab === 'disbursements' && (
        <div>
          {/* Success message */}
          {successMsg && (
            <div style={{ marginBottom: 14, padding: '10px 16px', borderRadius: 8, background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', fontSize: 13 }}>
              {successMsg}
            </div>
          )}

          {/* Record Disbursement button */}
          {!showForm && (
            <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => { setShowForm(true); setSubmitError(''); }}
                style={{
                  background: '#6d28d9',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  padding: '9px 18px',
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                + Record Disbursement
              </button>
            </div>
          )}

          {/* Inline disbursement form */}
          {showForm && (
            <div style={{
              background: '#fff',
              borderRadius: 14,
              padding: 24,
              boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
              marginBottom: 20,
            }}>
              <h3 style={{ margin: '0 0 20px', fontSize: 15, fontWeight: 700, color: '#111827' }}>
                Record Disbursement
              </h3>

              {submitError && (
                <div style={{ marginBottom: 14, padding: '10px 16px', borderRadius: 8, background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', fontSize: 13 }}>
                  {submitError}
                </div>
              )}

              <form onSubmit={handleSubmit}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  {/* Employee selector */}
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={LABEL_STYLE}>Employee *</label>
                    <select
                      value={form.employee_id}
                      onChange={e => handleEmployeeChange(e.target.value)}
                      style={{ ...INPUT_STYLE, background: '#fff' }}
                      required
                    >
                      <option value="">Select employee…</option>
                      {accruals.map(a => (
                        <option key={a.employee_id} value={a.employee_id}>
                          {a.emp_id ? `${a.emp_id} - ${a.employee_name}` : a.employee_name}
                        </option>
                      ))}
                    </select>
                    {selectedAccrual && (
                      <p style={{ margin: '4px 0 0', fontSize: 11, color: '#6b7280' }}>
                        Cumulative accrual: <strong>{fmt(selectedAccrual.cumulative_amount)}</strong>
                      </p>
                    )}
                  </div>

                  {/* Exit Date */}
                  <div>
                    <label style={LABEL_STYLE}>Exit Date *</label>
                    <input
                      type="date"
                      value={form.exit_date}
                      onChange={e => setForm(f => ({ ...f, exit_date: e.target.value }))}
                      style={INPUT_STYLE}
                      required
                    />
                  </div>

                  {/* Years of Service */}
                  <div>
                    <label style={LABEL_STYLE}>Years of Service * (min 5)</label>
                    <input
                      type="number"
                      min={5}
                      step="0.01"
                      value={form.years_of_service}
                      onChange={e => setForm(f => ({ ...f, years_of_service: e.target.value }))}
                      style={INPUT_STYLE}
                      placeholder="e.g. 7.5"
                      required
                    />
                  </div>

                  {/* Accrued Amount */}
                  <div>
                    <label style={LABEL_STYLE}>Accrued Amount (₹) *</label>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={form.accrued_amount}
                      onChange={e => setForm(f => ({ ...f, accrued_amount: e.target.value }))}
                      style={INPUT_STYLE}
                      placeholder="Auto-filled from accrual"
                      required
                    />
                  </div>

                  {/* Paid Amount */}
                  <div>
                    <label style={LABEL_STYLE}>Paid Amount (₹) *</label>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={form.paid_amount}
                      onChange={e => setForm(f => ({ ...f, paid_amount: e.target.value }))}
                      style={INPUT_STYLE}
                      placeholder="Actual amount paid"
                      required
                    />
                  </div>

                  {/* Payment Date */}
                  <div>
                    <label style={LABEL_STYLE}>Payment Date *</label>
                    <input
                      type="date"
                      value={form.payment_date}
                      onChange={e => setForm(f => ({ ...f, payment_date: e.target.value }))}
                      style={INPUT_STYLE}
                      required
                    />
                  </div>

                  {/* Notes */}
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={LABEL_STYLE}>Notes (optional)</label>
                    <textarea
                      value={form.notes}
                      onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                      rows={3}
                      style={{ ...INPUT_STYLE, resize: 'vertical' }}
                      placeholder="Any additional notes…"
                    />
                  </div>
                </div>

                {/* Buttons */}
                <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                  <button
                    type="submit"
                    disabled={submitting}
                    style={{
                      background: '#6d28d9',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 8,
                      padding: '9px 18px',
                      fontWeight: 600,
                      fontSize: 13,
                      cursor: submitting ? 'not-allowed' : 'pointer',
                      opacity: submitting ? 0.6 : 1,
                    }}
                  >
                    {submitting ? 'Recording…' : 'Record Disbursement'}
                  </button>
                  <button
                    type="button"
                    onClick={handleCancel}
                    disabled={submitting}
                    style={{
                      background: '#fff',
                      border: '1px solid #d1d5db',
                      color: '#6b7280',
                      borderRadius: 8,
                      padding: '9px 18px',
                      fontWeight: 500,
                      fontSize: 13,
                      cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Disbursements error */}
          {disbError && (
            <div style={{ marginBottom: 14, padding: '10px 16px', borderRadius: 8, background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', fontSize: 13 }}>
              {disbError}
            </div>
          )}

          {/* Disbursements table */}
          <div style={{ background: '#fff', borderRadius: 14, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            {disbLoading ? (
              <p style={{ padding: 32, color: '#9ca3af', fontSize: 14 }}>Loading…</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f9fafb' }}>
                    {['Emp ID / Name', 'Exit Date', 'Years of Service', 'Accrued Amount', 'Paid Amount', 'Payment Date', 'Notes', 'Recorded By'].map(h => (
                      <th key={h} style={TH_STYLE}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {disbursements.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ padding: 32, textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>
                        No disbursements recorded yet
                      </td>
                    </tr>
                  ) : disbursements.map(d => (
                    <tr key={d.id} style={{ borderTop: '1px solid #f3f4f6' }}>
                      <td style={TD_STYLE}>
                        {d.emp_id && (
                          <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#9ca3af', display: 'block' }}>
                            {d.emp_id}
                          </span>
                        )}
                        <span style={{ fontWeight: 600, color: '#111827' }}>{d.employee_name}</span>
                      </td>
                      <td style={TD_STYLE}>{fmtDate(d.exit_date)}</td>
                      <td style={TD_STYLE}>{d.years_of_service}</td>
                      <td style={TD_STYLE}>{fmt(d.accrued_amount)}</td>
                      <td style={{ ...TD_STYLE, fontWeight: 600 }}>{fmt(d.paid_amount)}</td>
                      <td style={TD_STYLE}>{fmtDate(d.payment_date)}</td>
                      <td style={{ ...TD_STYLE, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {d.notes ? d.notes : '—'}
                      </td>
                      <td style={{ ...TD_STYLE, color: '#6b7280' }}>{d.recorded_by_name ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </AppLayout>
  );
}
