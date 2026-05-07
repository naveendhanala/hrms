import { useState, useEffect, useCallback } from 'react';
import AppLayout from '../components/shared/AppLayout';
import {
  getProfTaxByState, updateProfTaxForState, getTdsSlabs,
  getCompanyInfo, updateCompanyInfo,
  type ProfTaxByState, type TdsSlab, type CompanyInfo,
} from '../api/payroll';
import {
  getStatutoryConfig, updateStatutoryConfig, getLwfStates, updateLwfState,
  type EmployeeStatutoryConfig, type LwfState,
} from '../api/statutoryConfig';

function fmt(n: number) {
  return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const TH: React.CSSProperties = {
  padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600,
  color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em',
  whiteSpace: 'nowrap', borderBottom: '1px solid #f3f4f6', background: '#f9fafb',
};

const INPUT_STYLE: React.CSSProperties = {
  padding: '8px 12px', border: '1px solid #e5e7eb', borderRadius: 8,
  fontSize: 13, width: '100%', boxSizing: 'border-box',
};

function rateColor(rate: string): string {
  if (!rate || rate.toLowerCase() === 'nil' || rate === '0%') return '#6b7280';
  const n = parseFloat(rate);
  if (isNaN(n)) return '#374151';
  if (n <= 5)  return '#16a34a';
  if (n <= 10) return '#65a30d';
  if (n <= 15) return '#ca8a04';
  if (n <= 20) return '#ea580c';
  if (n <= 25) return '#dc2626';
  return '#9f1239';
}

const DEFAULT_NEW: TdsSlab[] = [
  { id: 'n1', range: 'Up to ₹4,00,000',         rate: 'Nil' },
  { id: 'n2', range: '₹4,00,001 – ₹8,00,000',   rate: '5%'  },
  { id: 'n3', range: '₹8,00,001 – ₹12,00,000',  rate: '10%' },
  { id: 'n4', range: '₹12,00,001 – ₹16,00,000', rate: '15%' },
  { id: 'n5', range: '₹16,00,001 – ₹20,00,000', rate: '20%' },
  { id: 'n6', range: '₹20,00,001 – ₹24,00,000', rate: '25%' },
  { id: 'n7', range: 'Above ₹24,00,000',         rate: '30%' },
];

const DEFAULT_OLD: TdsSlab[] = [
  { id: 'o1', range: 'Up to ₹2,50,000',        rate: 'Nil' },
  { id: 'o2', range: '₹2,50,001 – ₹5,00,000',  rate: '5%'  },
  { id: 'o3', range: '₹5,00,001 – ₹10,00,000', rate: '20%' },
  { id: 'o4', range: 'Above ₹10,00,000',        rate: '30%' },
];

const SURCHARGE_ROWS = [
  { range: '₹50L – ₹1 Cr',  old: '10%', new_: '10%' },
  { range: '₹1 Cr – ₹2 Cr', old: '15%', new_: '15%' },
  { range: '₹2 Cr – ₹5 Cr', old: '25%', new_: '25%' },
  { range: 'Above ₹5 Cr',   old: '37%', new_: '25%' },
];

function RuleCard({ label, value, note, accent }: { label: string; value: string; note: string; accent: string }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '12px 14px' }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>{label}</div>
      <div style={{ fontSize: 17, fontWeight: 800, color: accent, marginBottom: 3 }}>{value}</div>
      <div style={{ fontSize: 11, color: '#9ca3af', lineHeight: '15px' }}>{note}</div>
    </div>
  );
}

function renderRegime(
  label: string,
  badge: string,
  accent: string,
  slabs: TdsSlab[],
  stdDeductionAmt: string,
  rebateMaxAmt: string,
  rebateLimitStr: string,
) {
  return (
    <div style={{
      background: '#fff', borderRadius: 12, overflow: 'hidden',
      border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
    }}>
      {/* Header */}
      <div style={{
        padding: '15px 20px', borderBottom: '1px solid #f3f4f6',
        background: `${accent}07`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#111827' }}>{label}</p>
          <p style={{ margin: '2px 0 0', fontSize: 12, color: '#9ca3af' }}>FY 2025-26 · Annual income slabs</p>
        </div>
        <span style={{
          padding: '3px 11px', borderRadius: 20, fontSize: 11, fontWeight: 700,
          background: `${accent}1a`, color: accent, letterSpacing: '0.04em',
        }}>{badge}</span>
      </div>

      {/* Slab table — read-only */}
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={TH}>Annual Income Range</th>
            <th style={{ ...TH, width: 110 }}>Tax Rate</th>
          </tr>
        </thead>
        <tbody>
          {slabs.map((slab, i) => (
            <tr key={slab.id} style={{ borderTop: i > 0 ? '1px solid #f3f4f6' : undefined }}>
              <td style={{ padding: '11px 16px', fontSize: 13, color: '#374151' }}>{slab.range}</td>
              <td style={{ padding: '11px 16px' }}>
                <span style={{
                  display: 'inline-block', padding: '2px 10px', borderRadius: 12,
                  fontSize: 12, fontWeight: 700,
                  color: rateColor(slab.rate),
                  background: `${rateColor(slab.rate)}16`,
                }}>{slab.rate}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Computation Rules */}
      <div style={{ padding: '14px 20px', borderTop: '1px solid #f3f4f6', background: '#fafafa' }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 10 }}>
          Computation Rules
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          <RuleCard
            label="Standard Deduction"
            value={stdDeductionAmt}
            note="Deducted from annual gross salary before applying slabs"
            accent={accent}
          />
          <RuleCard
            label="Section 87A Rebate (max)"
            value={rebateMaxAmt}
            note={`Applicable when taxable income ≤ ${rebateLimitStr}`}
            accent={accent}
          />
          <RuleCard
            label="Health & Education Cess"
            value="4%"
            note="On (tax after rebate + surcharge)"
            accent={accent}
          />
        </div>
      </div>
    </div>
  );
}

const FREQ_LABELS: Record<LwfState['frequency'], string> = {
  monthly: 'Monthly',
  half_yearly: 'Half-Yearly',
  annually: 'Annually',
};

export default function ConfigurationsPage() {
  const [tab, setTab] = useState<'prof-tax' | 'tds' | 'lwf' | 'statutory' | 'company'>('prof-tax');
  const [msg, setMsg] = useState('');

  // ── Prof Tax ──────────────────────────────────────────────────────────────────
  const [stateTaxes, setStateTaxes] = useState<ProfTaxByState[]>([]);
  const [editingState, setEditingState] = useState<string | null>(null);
  const [editStateInput, setEditStateInput] = useState('');
  const [profSaving, setProfSaving] = useState(false);

  // ── TDS Slabs (display only) ──────────────────────────────────────────────────
  const [newSlabs, setNewSlabs] = useState<TdsSlab[]>(DEFAULT_NEW);
  const [oldSlabs, setOldSlabs] = useState<TdsSlab[]>(DEFAULT_OLD);

  // ── LWF by State ──────────────────────────────────────────────────────────────
  const [lwfStates, setLwfStates] = useState<LwfState[]>([]);
  const [editingLwf, setEditingLwf] = useState<string | null>(null);
  const [editLwfInput, setEditLwfInput] = useState<{ employee_amount: number; employer_amount: number; frequency: LwfState['frequency'] }>({
    employee_amount: 0, employer_amount: 0, frequency: 'monthly',
  });
  const [lwfSaving, setLwfSaving] = useState(false);

  // ── Employee Statutory Config ─────────────────────────────────────────────────
  const [statutoryConfigs, setStatutoryConfigs] = useState<EmployeeStatutoryConfig[]>([]);
  const [editingStatutory, setEditingStatutory] = useState<number | null>(null);
  const [editStatutoryInput, setEditStatutoryInput] = useState<Partial<EmployeeStatutoryConfig>>({});
  const [statutorySaving, setStatutorySaving] = useState(false);

  // ── Company Info ──────────────────────────────────────────────────────────────
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo>({
    company_name: '', company_address: '', pf_registration_number: '',
    esic_registration_number: '', hr_email: '',
  });
  const [companySaving, setCompanySaving] = useState(false);
  const [companyLoading, setCompanyLoading] = useState(true);

  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 3000); };

  const loadStateTaxes = useCallback(async () => {
    try { setStateTaxes(await getProfTaxByState()); } catch {}
  }, []);

  const loadSlabs = useCallback(async () => {
    try {
      const data = await getTdsSlabs();
      if (data.new?.length) setNewSlabs(data.new);
      if (data.old?.length) setOldSlabs(data.old);
    } catch {}
  }, []);

  const loadLwfStates = useCallback(async () => {
    try { setLwfStates(await getLwfStates()); } catch {}
  }, []);

  const loadStatutoryConfigs = useCallback(async () => {
    try { setStatutoryConfigs(await getStatutoryConfig()); } catch {}
  }, []);

  const loadCompanyInfo = useCallback(async () => {
    setCompanyLoading(true);
    try { setCompanyInfo(await getCompanyInfo()); } catch {}
    finally { setCompanyLoading(false); }
  }, []);

  useEffect(() => {
    loadStateTaxes();
    loadSlabs();
    loadLwfStates();
    loadStatutoryConfigs();
    loadCompanyInfo();
  }, [loadStateTaxes, loadSlabs, loadLwfStates, loadStatutoryConfigs, loadCompanyInfo]);

  // ── Prof Tax handlers ─────────────────────────────────────────────────────────
  const saveStateTax = async (state: string) => {
    const val = Number(editStateInput);
    if (isNaN(val) || val < 0) return;
    setProfSaving(true);
    try {
      await updateProfTaxForState(state, val);
      await loadStateTaxes();
      setEditingState(null);
      flash(`Professional Tax for ${state} updated`);
    } catch { flash('Save failed'); }
    finally { setProfSaving(false); }
  };

  // ── LWF handlers ─────────────────────────────────────────────────────────────
  const saveLwfState = async (state: string) => {
    setLwfSaving(true);
    try {
      await updateLwfState({ state, ...editLwfInput });
      await loadLwfStates();
      setEditingLwf(null);
      flash(`LWF for ${state} updated`);
    } catch (e) { flash(e instanceof Error ? e.message : 'Save failed'); }
    finally { setLwfSaving(false); }
  };

  // ── Statutory handlers ────────────────────────────────────────────────────────
  const saveStatutory = async (employeeId: number) => {
    setStatutorySaving(true);
    try {
      await updateStatutoryConfig(employeeId, editStatutoryInput);
      await loadStatutoryConfigs();
      setEditingStatutory(null);
      flash('Statutory config updated');
    } catch (e) { flash(e instanceof Error ? e.message : 'Save failed'); }
    finally { setStatutorySaving(false); }
  };

  // ── Company Info handlers ─────────────────────────────────────────────────────
  const saveCompanyInfo = async () => {
    setCompanySaving(true);
    try {
      await updateCompanyInfo(companyInfo);
      flash('Company info saved');
    } catch (e) { flash(e instanceof Error ? e.message : 'Save failed'); }
    finally { setCompanySaving(false); }
  };

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <AppLayout>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#111827' }}>Configurations</h2>
        <p style={{ margin: '2px 0 0', fontSize: 13, color: '#6b7280' }}>
          Manage payroll deduction parameters applied during salary processing.
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid #e5e7eb', marginBottom: 20 }}>
        {([
          ['prof-tax', 'Professional Tax'],
          ['tds', 'TDS'],
          ['lwf', 'LWF by State'],
          ['statutory', 'Employee Statutory'],
          ['company', 'Company Info'],
        ] as const).map(([key, label]) => (
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
        <div style={{ marginBottom: 16, padding: '10px 16px', borderRadius: 8, background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', fontSize: 13 }}>
          {msg}
        </div>
      )}

      {/* ── PROFESSIONAL TAX ─────────────────────────────────────────────────────── */}
      {tab === 'prof-tax' && (
        <div style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6' }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#374151' }}>Professional Tax by State</p>
            <p style={{ margin: '3px 0 0', fontSize: 12, color: '#9ca3af' }}>
              States are pulled from employee records. Set the applicable monthly tax for each state.
            </p>
          </div>
          {stateTaxes.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
              No employees with a State assigned yet. Add states under the Employees tab.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={TH}>State</th>
                  <th style={{ ...TH, textAlign: 'right' }}>Prof Tax / Month</th>
                  <th style={{ ...TH, textAlign: 'right', paddingRight: 20 }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {stateTaxes.map(st => (
                  <tr key={st.state} style={{ borderTop: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '13px 16px', fontSize: 13, fontWeight: 600, color: '#374151' }}>{st.state}</td>
                    <td style={{ padding: '13px 16px', textAlign: 'right' }}>
                      {editingState === st.state ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
                          <span style={{ fontSize: 14, color: '#374151', fontWeight: 600 }}>₹</span>
                          <input
                            type="number" min={0} value={editStateInput}
                            onChange={e => setEditStateInput(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') saveStateTax(st.state); if (e.key === 'Escape') setEditingState(null); }}
                            style={{ width: 110, padding: '6px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 14, fontWeight: 600, textAlign: 'right' }}
                            autoFocus
                          />
                          <span style={{ fontSize: 12, color: '#9ca3af' }}>per emp / month</span>
                        </div>
                      ) : (
                        <span style={{ fontSize: 14, fontWeight: 700, color: st.amount > 0 ? '#1e40af' : '#9ca3af' }}>
                          {st.amount > 0 ? fmt(st.amount) : <span style={{ fontWeight: 500 }}>Not set</span>}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '13px 16px', textAlign: 'right', paddingRight: 20 }}>
                      {editingState === st.state ? (
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          <button onClick={() => setEditingState(null)} style={{
                            padding: '6px 14px', borderRadius: 7, border: '1px solid #d1d5db', cursor: 'pointer',
                            background: '#fff', color: '#6b7280', fontSize: 12, fontWeight: 600,
                          }}>Cancel</button>
                          <button onClick={() => saveStateTax(st.state)} disabled={profSaving} style={{
                            padding: '6px 14px', borderRadius: 7, border: 'none', cursor: 'pointer',
                            background: '#6d28d9', color: '#fff', fontSize: 12, fontWeight: 600,
                            opacity: profSaving ? 0.6 : 1,
                          }}>{profSaving ? 'Saving…' : 'Save'}</button>
                        </div>
                      ) : (
                        <button onClick={() => { setEditStateInput(String(st.amount)); setEditingState(st.state); }} style={{
                          padding: '6px 14px', borderRadius: 7, border: '1px solid #d1d5db', cursor: 'pointer',
                          background: '#fff', color: '#374151', fontSize: 12, fontWeight: 600,
                        }}>Edit</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── TDS ──────────────────────────────────────────────────────────────────── */}
      {tab === 'tds' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          <div>
            <p style={{ margin: '0 0 3px', fontSize: 14, fontWeight: 600, color: '#374151' }}>
              Indian Income Tax Structures
            </p>
            <p style={{ margin: 0, fontSize: 12, color: '#9ca3af' }}>
              FY 2025-26 · Employees are assigned a regime in Tax Computation; TDS is calculated from these slabs.
            </p>
          </div>

          {renderRegime(
            'New Regime', 'Default · FY 2025-26', '#7c3aed',
            newSlabs, '₹75,000', '₹25,000', '₹7,00,000',
          )}

          {renderRegime(
            'Old Regime', 'Traditional', '#d97706',
            oldSlabs, '₹50,000', '₹12,500', '₹5,00,000',
          )}

          {/* Surcharge table */}
          <div style={{
            background: '#fff', borderRadius: 12, overflow: 'hidden',
            border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
          }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid #f3f4f6' }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#374151' }}>Surcharge on Income Tax</p>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: '#9ca3af' }}>
                Applicable when taxable income exceeds ₹50 lakh. Levied on the base income-tax after rebate.
              </p>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={TH}>Annual Taxable Income</th>
                  <th style={{ ...TH, textAlign: 'center' }}>Old Regime</th>
                  <th style={{ ...TH, textAlign: 'center', paddingRight: 20 }}>New Regime</th>
                </tr>
              </thead>
              <tbody>
                {SURCHARGE_ROWS.map((r, i) => (
                  <tr key={i} style={{ borderTop: i > 0 ? '1px solid #f3f4f6' : undefined }}>
                    <td style={{ padding: '10px 16px', fontSize: 13, color: '#374151' }}>{r.range}</td>
                    <td style={{ padding: '10px 16px', textAlign: 'center', fontSize: 13, fontWeight: 700, color: '#d97706' }}>{r.old}</td>
                    <td style={{ padding: '10px 16px', paddingRight: 20, textAlign: 'center' }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#7c3aed' }}>{r.new_}</span>
                      {r.old !== r.new_ && (
                        <span style={{ marginLeft: 5, fontSize: 10, fontWeight: 500, color: '#9ca3af' }}>capped</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Marginal Relief */}
          <div style={{
            background: '#fff', borderRadius: 12, overflow: 'hidden',
            border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
          }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#374151' }}>Marginal Relief on Surcharge</p>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: '#9ca3af' }}>
                  Prevents a disproportionate jump in total tax when income just crosses a surcharge threshold.
                </p>
              </div>
              <span style={{ marginLeft: 'auto', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: '#f0fdf4', color: '#16a34a', whiteSpace: 'nowrap' }}>
                Auto-applied
              </span>
            </div>

            {/* Rule explanation */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
                The Rule
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                  <span style={{ fontSize: 16, marginTop: 1 }}>📐</span>
                  <div style={{ fontSize: 13, color: '#374151', lineHeight: '20px' }}>
                    <strong>Total tax (including surcharge + cess) on actual income</strong> must not exceed
                    {' '}<strong>total tax at the surcharge threshold + the income that exceeds the threshold.</strong>
                  </div>
                </div>
                <div style={{
                  padding: '10px 14px', borderRadius: 8,
                  background: '#fefce8', border: '1px solid #fde68a',
                  fontFamily: 'monospace', fontSize: 12, color: '#78350f', lineHeight: '20px',
                }}>
                  Marginal Relief = max(0, Total Tax at actual income − (Total Tax at threshold + Excess income above threshold))
                </div>
              </div>
            </div>

            {/* Threshold table */}
            <div style={{ padding: '0 0 4px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={TH}>Surcharge threshold crossed</th>
                    <th style={{ ...TH, textAlign: 'center' }}>Surcharge rate jump</th>
                    <th style={{ ...TH }}>Relief kicks in when…</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { threshold: '₹50 Lakh',  from: 'Nil',  to: '10%', condition: 'Taxable income is slightly above ₹50L' },
                    { threshold: '₹1 Crore',  from: '10%',  to: '15%', condition: 'Taxable income is slightly above ₹1 Cr' },
                    { threshold: '₹2 Crore',  from: '15%',  to: '25%', condition: 'Taxable income is slightly above ₹2 Cr' },
                    { threshold: '₹5 Crore',  from: '25%',  to: '37% / 25%', condition: 'Taxable income is slightly above ₹5 Cr' },
                  ].map((row, i) => (
                    <tr key={i} style={{ borderTop: i > 0 ? '1px solid #f3f4f6' : undefined }}>
                      <td style={{ padding: '10px 16px', fontSize: 13, fontWeight: 600, color: '#374151' }}>{row.threshold}</td>
                      <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                        <span style={{ fontSize: 12, color: '#6b7280' }}>{row.from}</span>
                        <span style={{ margin: '0 6px', color: '#d1d5db' }}>→</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#dc2626' }}>{row.to}</span>
                      </td>
                      <td style={{ padding: '10px 16px', fontSize: 12, color: '#6b7280' }}>{row.condition}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Example */}
            <div style={{ padding: '14px 20px', borderTop: '1px solid #f3f4f6', background: '#fafafa' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
                Example — New Regime, Annual Salary ₹50,10,000
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                <div style={{ background: '#fff', border: '1px solid #fee2e2', borderRadius: 8, padding: '12px 14px' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>Without relief</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#dc2626', marginBottom: 3 }}>₹12,13,212</div>
                  <div style={{ fontSize: 11, color: '#9ca3af' }}>Tax + 10% surcharge + 4% cess on taxable ₹49,35,000</div>
                </div>
                <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '12px 14px' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>Tax at ₹50L salary exactly</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#374151', marginBottom: 3 }}>₹10,99,800</div>
                  <div style={{ fontSize: 11, color: '#9ca3af' }}>Taxable ₹49,25,000 · no surcharge + 4% cess</div>
                </div>
                <div style={{ background: '#fff', border: '1px solid #bbf7d0', borderRadius: 8, padding: '12px 14px' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>After marginal relief</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#16a34a', marginBottom: 3 }}>₹11,09,800</div>
                  <div style={{ fontSize: 11, color: '#9ca3af' }}>= Tax at ₹50L + ₹10,000 excess. Relief of ₹1,03,412.</div>
                </div>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* ── LWF BY STATE ─────────────────────────────────────────────────────────── */}
      {tab === 'lwf' && (
        <div style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6' }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#374151' }}>Labour Welfare Fund by State</p>
            <p style={{ margin: '3px 0 0', fontSize: 12, color: '#9ca3af' }}>
              Configure LWF employee and employer contribution amounts and deduction frequency per state.
            </p>
          </div>
          {lwfStates.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
              No LWF states configured yet.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={TH}>State</th>
                  <th style={{ ...TH, textAlign: 'right' }}>Employee ₹</th>
                  <th style={{ ...TH, textAlign: 'right' }}>Employer ₹</th>
                  <th style={TH}>Frequency</th>
                  <th style={{ ...TH, textAlign: 'right', paddingRight: 20 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {lwfStates.map(lw => (
                  <tr key={lw.state} style={{ borderTop: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '13px 16px', fontSize: 13, fontWeight: 600, color: '#374151' }}>{lw.state}</td>
                    {editingLwf === lw.state ? (
                      <>
                        <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                          <input
                            type="number" min={0}
                            value={editLwfInput.employee_amount}
                            onChange={e => setEditLwfInput(prev => ({ ...prev, employee_amount: Number(e.target.value) }))}
                            style={{ width: 100, padding: '6px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13, textAlign: 'right' }}
                          />
                        </td>
                        <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                          <input
                            type="number" min={0}
                            value={editLwfInput.employer_amount}
                            onChange={e => setEditLwfInput(prev => ({ ...prev, employer_amount: Number(e.target.value) }))}
                            style={{ width: 100, padding: '6px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13, textAlign: 'right' }}
                          />
                        </td>
                        <td style={{ padding: '10px 16px' }}>
                          <select
                            value={editLwfInput.frequency}
                            onChange={e => setEditLwfInput(prev => ({ ...prev, frequency: e.target.value as LwfState['frequency'] }))}
                            style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13 }}
                          >
                            <option value="monthly">Monthly</option>
                            <option value="half_yearly">Half-Yearly</option>
                            <option value="annually">Annually</option>
                          </select>
                        </td>
                        <td style={{ padding: '10px 16px', textAlign: 'right', paddingRight: 20 }}>
                          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                            <button
                              onClick={() => { setEditingLwf(null); setEditLwfInput({ employee_amount: 0, employer_amount: 0, frequency: 'monthly' }); }}
                              style={{ fontSize: 12, padding: '4px 12px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', color: '#6b7280', fontWeight: 600 }}
                            >Cancel</button>
                            <button
                              onClick={() => saveLwfState(lw.state)}
                              disabled={lwfSaving}
                              style={{ fontSize: 12, padding: '4px 12px', borderRadius: 6, border: 'none', background: '#6d28d9', color: '#fff', cursor: 'pointer', fontWeight: 600, opacity: lwfSaving ? 0.6 : 1 }}
                            >{lwfSaving ? 'Saving…' : 'Save'}</button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td style={{ padding: '13px 16px', textAlign: 'right', fontSize: 13, color: '#374151' }}>{fmt(lw.employee_amount)}</td>
                        <td style={{ padding: '13px 16px', textAlign: 'right', fontSize: 13, color: '#374151' }}>{fmt(lw.employer_amount)}</td>
                        <td style={{ padding: '13px 16px', fontSize: 13, color: '#374151' }}>{FREQ_LABELS[lw.frequency]}</td>
                        <td style={{ padding: '13px 16px', textAlign: 'right', paddingRight: 20 }}>
                          <button
                            onClick={() => {
                              setEditLwfInput({ employee_amount: lw.employee_amount, employer_amount: lw.employer_amount, frequency: lw.frequency });
                              setEditingLwf(lw.state);
                            }}
                            style={{ fontSize: 12, padding: '4px 12px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', color: '#374151', fontWeight: 600 }}
                          >Edit</button>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── EMPLOYEE STATUTORY CONFIG ─────────────────────────────────────────────── */}
      {tab === 'statutory' && (
        <div style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6' }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#374151' }}>Employee Statutory Configuration</p>
            <p style={{ margin: '3px 0 0', fontSize: 12, color: '#9ca3af' }}>
              Manage UAN, ESIC, PAN numbers and statutory exemptions per employee.
            </p>
          </div>
          {statutoryConfigs.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
              No employee statutory records found.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
                <thead>
                  <tr>
                    <th style={TH}>Emp ID</th>
                    <th style={TH}>Employee</th>
                    <th style={TH}>UAN Number</th>
                    <th style={TH}>ESIC Number</th>
                    <th style={TH}>PAN Number</th>
                    <th style={{ ...TH, textAlign: 'center' }}>EPF Exempt</th>
                    <th style={{ ...TH, textAlign: 'center' }}>ESIC Exempt</th>
                    <th style={{ ...TH, textAlign: 'center' }}>LWF Exempt</th>
                    <th style={{ ...TH, textAlign: 'right', paddingRight: 20 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {statutoryConfigs.map(sc => (
                    <tr key={sc.employee_id} style={{ borderTop: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '12px 16px', fontSize: 13, color: '#6b7280' }}>{sc.emp_id ?? '—'}</td>
                      <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600, color: '#374151' }}>{sc.employee_name}</td>
                      {editingStatutory === sc.employee_id ? (
                        <>
                          <td style={{ padding: '8px 16px' }}>
                            <input
                              type="text"
                              value={editStatutoryInput.uan_number ?? ''}
                              onChange={e => setEditStatutoryInput(prev => ({ ...prev, uan_number: e.target.value }))}
                              style={{ ...INPUT_STYLE, width: 130 }}
                              placeholder="UAN"
                            />
                          </td>
                          <td style={{ padding: '8px 16px' }}>
                            <input
                              type="text"
                              value={editStatutoryInput.esic_number ?? ''}
                              onChange={e => setEditStatutoryInput(prev => ({ ...prev, esic_number: e.target.value }))}
                              style={{ ...INPUT_STYLE, width: 130 }}
                              placeholder="ESIC"
                            />
                          </td>
                          <td style={{ padding: '8px 16px' }}>
                            <input
                              type="text"
                              value={editStatutoryInput.pan_number ?? ''}
                              onChange={e => setEditStatutoryInput(prev => ({ ...prev, pan_number: e.target.value }))}
                              style={{ ...INPUT_STYLE, width: 120 }}
                              placeholder="PAN"
                            />
                          </td>
                          <td style={{ padding: '8px 16px', textAlign: 'center' }}>
                            <input
                              type="checkbox"
                              checked={!!editStatutoryInput.epf_exempt}
                              onChange={e => setEditStatutoryInput(prev => ({ ...prev, epf_exempt: e.target.checked }))}
                            />
                          </td>
                          <td style={{ padding: '8px 16px', textAlign: 'center' }}>
                            <input
                              type="checkbox"
                              checked={!!editStatutoryInput.esic_exempt}
                              onChange={e => setEditStatutoryInput(prev => ({ ...prev, esic_exempt: e.target.checked }))}
                            />
                          </td>
                          <td style={{ padding: '8px 16px', textAlign: 'center' }}>
                            <input
                              type="checkbox"
                              checked={!!editStatutoryInput.lwf_exempt}
                              onChange={e => setEditStatutoryInput(prev => ({ ...prev, lwf_exempt: e.target.checked }))}
                            />
                          </td>
                          <td style={{ padding: '8px 16px', textAlign: 'right', paddingRight: 20 }}>
                            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                              <button
                                onClick={() => { setEditingStatutory(null); setEditStatutoryInput({}); }}
                                style={{ fontSize: 12, padding: '4px 12px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', color: '#6b7280', fontWeight: 600 }}
                              >Cancel</button>
                              <button
                                onClick={() => saveStatutory(sc.employee_id)}
                                disabled={statutorySaving}
                                style={{ fontSize: 12, padding: '4px 12px', borderRadius: 6, border: 'none', background: '#6d28d9', color: '#fff', cursor: 'pointer', fontWeight: 600, opacity: statutorySaving ? 0.6 : 1 }}
                              >{statutorySaving ? 'Saving…' : 'Save'}</button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td style={{ padding: '12px 16px', fontSize: 13, color: '#374151' }}>{sc.uan_number || <span style={{ color: '#9ca3af' }}>—</span>}</td>
                          <td style={{ padding: '12px 16px', fontSize: 13, color: '#374151' }}>{sc.esic_number || <span style={{ color: '#9ca3af' }}>—</span>}</td>
                          <td style={{ padding: '12px 16px', fontSize: 13, color: '#374151', fontFamily: 'monospace' }}>{sc.pan_number || <span style={{ color: '#9ca3af', fontFamily: 'inherit' }}>—</span>}</td>
                          <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                            <span style={{ color: sc.epf_exempt ? '#dc2626' : '#16a34a', fontSize: 16 }}>●</span>
                          </td>
                          <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                            <span style={{ color: sc.esic_exempt ? '#dc2626' : '#16a34a', fontSize: 16 }}>●</span>
                          </td>
                          <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                            <span style={{ color: sc.lwf_exempt ? '#dc2626' : '#16a34a', fontSize: 16 }}>●</span>
                          </td>
                          <td style={{ padding: '12px 16px', textAlign: 'right', paddingRight: 20 }}>
                            <button
                              onClick={() => {
                                setEditStatutoryInput({
                                  uan_number: sc.uan_number,
                                  esic_number: sc.esic_number,
                                  pan_number: sc.pan_number,
                                  epf_exempt: sc.epf_exempt,
                                  esic_exempt: sc.esic_exempt,
                                  lwf_exempt: sc.lwf_exempt,
                                });
                                setEditingStatutory(sc.employee_id);
                              }}
                              style={{ fontSize: 12, padding: '4px 12px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', color: '#374151', fontWeight: 600 }}
                            >Edit</button>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── COMPANY INFO ─────────────────────────────────────────────────────────── */}
      {tab === 'company' && (
        <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6' }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#374151' }}>Company Information</p>
            <p style={{ margin: '3px 0 0', fontSize: 12, color: '#9ca3af' }}>
              Company details used in payroll processing and statutory registrations.
            </p>
          </div>
          <div style={{ padding: '24px 28px' }}>
            {companyLoading && <p style={{ color: '#9ca3af', fontSize: 13, margin: '0 0 16px' }}>Loading…</p>}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 24px', opacity: companyLoading ? 0.4 : 1, pointerEvents: companyLoading ? 'none' : 'auto' }}>
              {/* Company Name */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Company Name</label>
                <input
                  type="text"
                  value={companyInfo.company_name}
                  onChange={e => setCompanyInfo(prev => ({ ...prev, company_name: e.target.value }))}
                  style={INPUT_STYLE}
                  placeholder="e.g. Acme Pvt Ltd"
                />
              </div>

              {/* HR Email */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>HR Email</label>
                <input
                  type="email"
                  value={companyInfo.hr_email}
                  onChange={e => setCompanyInfo(prev => ({ ...prev, hr_email: e.target.value }))}
                  style={INPUT_STYLE}
                  placeholder="hr@company.com"
                />
              </div>

              {/* Company Address — full width */}
              <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Company Address</label>
                <textarea
                  value={companyInfo.company_address}
                  onChange={e => setCompanyInfo(prev => ({ ...prev, company_address: e.target.value }))}
                  rows={3}
                  style={{ ...INPUT_STYLE, resize: 'vertical' }}
                  placeholder="Full registered address"
                />
              </div>

              {/* PF Registration Number */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>PF Registration Number</label>
                <input
                  type="text"
                  value={companyInfo.pf_registration_number}
                  onChange={e => setCompanyInfo(prev => ({ ...prev, pf_registration_number: e.target.value }))}
                  style={INPUT_STYLE}
                  placeholder="e.g. MHBAN00xxxxx"
                />
              </div>

              {/* ESIC Registration Number */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>ESIC Registration Number</label>
                <input
                  type="text"
                  value={companyInfo.esic_registration_number}
                  onChange={e => setCompanyInfo(prev => ({ ...prev, esic_registration_number: e.target.value }))}
                  style={INPUT_STYLE}
                  placeholder="e.g. 53000xxxxxxxxx"
                />
              </div>

              {/* Save button row — full width */}
              <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', paddingTop: 8 }}>
                <button
                  onClick={saveCompanyInfo}
                  disabled={companySaving}
                  style={{
                    padding: '8px 24px', borderRadius: 8, border: 'none', cursor: 'pointer',
                    background: '#6d28d9', color: '#fff', fontSize: 13, fontWeight: 600,
                    opacity: companySaving ? 0.6 : 1,
                  }}
                >{companySaving ? 'Saving…' : 'Save Company Info'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
