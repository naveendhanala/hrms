import { useEffect, useState } from 'react';
import AppLayout from '../components/shared/AppLayout';
import { getTaxComputation, updateTaxRegime } from '../api/taxComputation';
import type { TaxEmployee } from '../api/taxComputation';

const fmt = (n: number) =>
  '₹' + n.toLocaleString('en-IN');

function TaxSheet({ emp, onClose }: { emp: TaxEmployee; onClose: () => void }) {
  const sc = emp.salary_components;
  const isNew = emp.tax_regime === 'new';

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: 12, width: 660, maxHeight: '90vh',
          overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
        }}
      >
        {/* Sheet header */}
        <div style={{ padding: '24px 28px 20px', borderBottom: '1px solid #e5e7eb' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4 }}>
                Tax Computation Sheet · FY 2025-26
              </div>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#111827' }}>{emp.name}</h3>
              <div style={{ marginTop: 4, display: 'flex', gap: 8, alignItems: 'center' }}>
                {emp.emp_id && <span style={{ fontSize: 12, color: '#6b7280' }}>{emp.emp_id}</span>}
                {emp.designation && <span style={{ fontSize: 12, color: '#6b7280' }}>· {emp.designation}</span>}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <span style={{
                padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700,
                background: isNew ? '#ede9fe' : '#fef3c7',
                color: isNew ? '#6d28d9' : '#92400e',
              }}>
                {isNew ? 'New Regime' : 'Old Regime'}
              </span>
              <button
                onClick={onClose}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 20, lineHeight: 1 }}
              >
                ×
              </button>
            </div>
          </div>
        </div>

        <div style={{ padding: '20px 28px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Salary components */}
          <section>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#6366f1', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 10 }}>
              Salary Components (Monthly)
            </div>
            <div style={{ background: '#f9fafb', borderRadius: 8, overflow: 'hidden', border: '1px solid #e5e7eb' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <tbody>
                  {[
                    ['Basic Salary', sc.basic_salary],
                    ['HRA', sc.hra],
                    sc.meal_allowance    > 0 ? ['Meal Allowance',    sc.meal_allowance]    : null,
                    sc.fuel_allowance    > 0 ? ['Fuel Allowance',    sc.fuel_allowance]    : null,
                    sc.driver_allowance  > 0 ? ['Driver Allowance',  sc.driver_allowance]  : null,
                    sc.special_allowance > 0 ? ['Special Allowance', sc.special_allowance] : null,
                  ].filter(Boolean).map(([label, val], i, arr) => (
                    <tr key={i as number} style={{ borderBottom: i < arr.length - 1 ? '1px solid #e5e7eb' : 'none' }}>
                      <td style={{ padding: '8px 14px', color: '#374151' }}>{label as string}</td>
                      <td style={{ padding: '8px 14px', textAlign: 'right', color: '#374151' }}>{fmt(val as number)}</td>
                    </tr>
                  ))}
                  <tr style={{ background: '#ede9fe' }}>
                    <td style={{ padding: '10px 14px', fontWeight: 700, color: '#4c1d95' }}>Gross Monthly Salary</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: '#4c1d95' }}>{fmt(emp.monthly_gross)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* Income computation */}
          <section>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#6366f1', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 10 }}>
              Income Computation
            </div>
            <div style={{ background: '#f9fafb', borderRadius: 8, overflow: 'hidden', border: '1px solid #e5e7eb' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <tbody>
                  <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                    <td style={{ padding: '8px 14px', color: '#374151' }}>Annual Gross Salary (Monthly × 12)</td>
                    <td style={{ padding: '8px 14px', textAlign: 'right', color: '#374151' }}>{fmt(emp.annualGross)}</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                    <td style={{ padding: '8px 14px', color: '#374151' }}>(–) Standard Deduction</td>
                    <td style={{ padding: '8px 14px', textAlign: 'right', color: '#dc2626' }}>({fmt(emp.standardDeduction)})</td>
                  </tr>
                  <tr style={{ background: '#f0fdf4' }}>
                    <td style={{ padding: '10px 14px', fontWeight: 700, color: '#14532d' }}>Gross Taxable Income</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: '#14532d' }}>{fmt(emp.taxableIncome)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* Slab-wise tax */}
          <section>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#6366f1', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 10 }}>
              Tax as per Slab ({isNew ? 'New' : 'Old'} Regime)
            </div>
            <div style={{ background: '#f9fafb', borderRadius: 8, overflow: 'hidden', border: '1px solid #e5e7eb' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f3f4f6', borderBottom: '1px solid #e5e7eb' }}>
                    <th style={{ padding: '8px 14px', textAlign: 'left', fontWeight: 600, color: '#374151' }}>Income Slab</th>
                    <th style={{ padding: '8px 14px', textAlign: 'center', fontWeight: 600, color: '#374151' }}>Rate</th>
                    <th style={{ padding: '8px 14px', textAlign: 'right', fontWeight: 600, color: '#374151' }}>Taxable Amount</th>
                    <th style={{ padding: '8px 14px', textAlign: 'right', fontWeight: 600, color: '#374151' }}>Tax</th>
                  </tr>
                </thead>
                <tbody>
                  {emp.slabBreakdown.map((slab, i) => (
                    <tr key={i} style={{ borderBottom: i < emp.slabBreakdown.length - 1 ? '1px solid #e5e7eb' : 'none', opacity: slab.taxableAmount === 0 ? 0.45 : 1 }}>
                      <td style={{ padding: '8px 14px', color: '#374151' }}>{slab.label}</td>
                      <td style={{ padding: '8px 14px', textAlign: 'center', color: slab.rate === 'Nil' ? '#6b7280' : '#374151', fontWeight: slab.rate !== 'Nil' ? 500 : 400 }}>{slab.rate}</td>
                      <td style={{ padding: '8px 14px', textAlign: 'right', color: '#374151' }}>{slab.taxableAmount > 0 ? fmt(slab.taxableAmount) : '—'}</td>
                      <td style={{ padding: '8px 14px', textAlign: 'right', color: '#374151' }}>{slab.tax > 0 ? fmt(slab.tax) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Tax summary */}
          <section>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#6366f1', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 10 }}>
              Tax Summary
            </div>
            <div style={{ background: '#f9fafb', borderRadius: 8, overflow: 'hidden', border: '1px solid #e5e7eb' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <tbody>
                  <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                    <td style={{ padding: '8px 14px', color: '#374151' }}>Tax Before Rebate</td>
                    <td style={{ padding: '8px 14px', textAlign: 'right', color: '#374151' }}>{fmt(emp.taxBeforeRebate)}</td>
                  </tr>
                  {emp.rebate > 0 && (
                    <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                      <td style={{ padding: '8px 14px', color: '#374151' }}>(–) Rebate {emp.rebateNote}</td>
                      <td style={{ padding: '8px 14px', textAlign: 'right', color: '#dc2626' }}>({fmt(emp.rebate)})</td>
                    </tr>
                  )}
                  <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                    <td style={{ padding: '8px 14px', color: '#374151' }}>Tax After Rebate</td>
                    <td style={{ padding: '8px 14px', textAlign: 'right', color: '#374151' }}>{fmt(emp.taxAfterRebate)}</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #e5e7eb', opacity: emp.surcharge === 0 ? 0.4 : 1 }}>
                    <td style={{ padding: '8px 14px', color: '#374151' }}>
                      (+) Surcharge{emp.surchargeLabel ? ` @ ${emp.surchargeLabel}` : ''}
                      {emp.surcharge === 0 && <span style={{ marginLeft: 6, fontSize: 11, color: '#9ca3af' }}>(taxable income ≤ ₹50L)</span>}
                    </td>
                    <td style={{ padding: '8px 14px', textAlign: 'right', color: '#374151' }}>{emp.surcharge > 0 ? fmt(emp.surcharge) : '—'}</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                    <td style={{ padding: '8px 14px', color: '#374151' }}>(+) Health & Education Cess @ 4%<span style={{ fontSize: 11, color: '#9ca3af', marginLeft: 6 }}>(on tax + surcharge)</span></td>
                    <td style={{ padding: '8px 14px', textAlign: 'right', color: '#374151' }}>{fmt(emp.cess)}</td>
                  </tr>
                  <tr style={{ background: emp.totalAnnualTax > 0 ? '#fef2f2' : '#f0fdf4', borderBottom: '1px solid #e5e7eb' }}>
                    <td style={{ padding: '10px 14px', fontWeight: 700, color: emp.totalAnnualTax > 0 ? '#991b1b' : '#14532d' }}>Total Annual Tax</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: emp.totalAnnualTax > 0 ? '#991b1b' : '#14532d' }}>{fmt(emp.totalAnnualTax)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* Monthly TDS highlight */}
          <div style={{
            background: emp.monthlyTds > 0 ? 'linear-gradient(135deg, #dc2626, #b91c1c)' : 'linear-gradient(135deg, #16a34a, #15803d)',
            borderRadius: 10, padding: '16px 20px',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Monthly TDS Deduction</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>Total Annual Tax ÷ 12</div>
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, color: '#fff' }}>{fmt(emp.monthlyTds)}</div>
          </div>

        </div>
      </div>
    </div>
  );
}

export default function TaxComputationPage() {
  const [employees, setEmployees] = useState<TaxEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmp, setSelectedEmp] = useState<TaxEmployee | null>(null);
  const [savingId, setSavingId] = useState<number | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await getTaxComputation();
      setEmployees(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleRegimeChange = async (employeeId: number, regime: 'old' | 'new') => {
    setSavingId(employeeId);
    await updateTaxRegime(employeeId, regime);
    const data = await getTaxComputation();
    setEmployees(data);
    if (selectedEmp?.employee_id === employeeId) {
      setSelectedEmp(data.find(e => e.employee_id === employeeId) ?? null);
    }
    setSavingId(null);
  };

  const totalMonthlyTds = employees.reduce((s, e) => s + e.monthlyTds, 0);

  return (
    <AppLayout>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>
              FY 2025-26 &nbsp;·&nbsp; Income Tax Deduction at Source (TDS) &nbsp;·&nbsp; Default: New Regime
            </p>
          </div>
          {employees.length > 0 && (
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Monthly TDS</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: totalMonthlyTds > 0 ? '#dc2626' : '#374151' }}>{fmt(totalMonthlyTds)}</div>
            </div>
          )}
        </div>

        {/* Table */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 48, color: '#9ca3af' }}>Loading...</div>
        ) : employees.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 48, color: '#9ca3af' }}>No active employees found.</div>
        ) : (
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                  {['Emp ID', 'Employee', 'Tax Regime', 'Monthly Gross', 'Annual Gross', 'Taxable Income', 'Annual Tax', 'Monthly TDS', ''].map((h, i) => (
                    <th key={i} style={{ padding: '11px 14px', textAlign: i >= 3 && i <= 7 ? 'right' : i === 8 ? 'center' : 'left', fontWeight: 600, color: '#374151', fontSize: 12, whiteSpace: 'nowrap' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {employees.map((emp, i) => (
                  <tr
                    key={emp.employee_id}
                    style={{ borderBottom: i < employees.length - 1 ? '1px solid #f3f4f6' : 'none' }}
                  >
                    <td style={{ padding: '11px 14px', color: '#6b7280', fontFamily: 'monospace', fontSize: 12 }}>
                      {emp.emp_id || '—'}
                    </td>
                    <td style={{ padding: '11px 14px' }}>
                      <div style={{ fontWeight: 500, color: '#111827' }}>{emp.name}</div>
                      {emp.designation && <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>{emp.designation}</div>}
                    </td>
                    <td style={{ padding: '11px 14px' }}>
                      <select
                        value={emp.tax_regime}
                        disabled={savingId === emp.employee_id}
                        onChange={e => handleRegimeChange(emp.employee_id, e.target.value as 'old' | 'new')}
                        style={{
                          padding: '4px 8px', borderRadius: 6, border: '1px solid #d1d5db',
                          fontSize: 12, cursor: savingId === emp.employee_id ? 'wait' : 'pointer',
                          background: emp.tax_regime === 'new' ? '#ede9fe' : '#fef3c7',
                          color:      emp.tax_regime === 'new' ? '#6d28d9' : '#92400e',
                          fontWeight: 600, outline: 'none',
                        }}
                      >
                        <option value="new">New Regime</option>
                        <option value="old">Old Regime</option>
                      </select>
                    </td>
                    <td style={{ padding: '11px 14px', textAlign: 'right', color: '#374151' }}>{fmt(emp.monthly_gross)}</td>
                    <td style={{ padding: '11px 14px', textAlign: 'right', color: '#374151' }}>{fmt(emp.annualGross)}</td>
                    <td style={{ padding: '11px 14px', textAlign: 'right', color: '#374151' }}>{fmt(emp.taxableIncome)}</td>
                    <td style={{ padding: '11px 14px', textAlign: 'right', fontWeight: 600, color: emp.totalAnnualTax > 0 ? '#dc2626' : '#6b7280' }}>
                      {fmt(emp.totalAnnualTax)}
                    </td>
                    <td style={{ padding: '11px 14px', textAlign: 'right', fontWeight: 700, color: emp.monthlyTds > 0 ? '#dc2626' : '#6b7280' }}>
                      {fmt(emp.monthlyTds)}
                    </td>
                    <td style={{ padding: '11px 14px', textAlign: 'center' }}>
                      <button
                        onClick={() => setSelectedEmp(emp)}
                        style={{
                          padding: '4px 12px', borderRadius: 6, border: '1px solid #d1d5db',
                          background: '#fff', fontSize: 12, cursor: 'pointer', color: '#374151',
                          transition: 'background 0.15s',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#f9fafb')}
                        onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
                      >
                        View Sheet
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedEmp && <TaxSheet emp={selectedEmp} onClose={() => setSelectedEmp(null)} />}
    </AppLayout>
  );
}
