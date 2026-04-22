import React, { useState, useEffect, useCallback } from 'react';
import AppLayout from '../components/shared/AppLayout';
import {
  getSalaryMaster, updateSalaryMaster, type SalaryMasterEntry,
} from '../api/payroll';

function fmt(n: number) {
  return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const inputStyle: React.CSSProperties = {
  width: '90px', padding: '4px 6px', border: '1px solid #d1d5db',
  borderRadius: 6, fontSize: 13, textAlign: 'right' as const,
};

type SMEditMap = Record<number, {
  basic_salary: string; hra: string; meal_allowance: string;
  fuel_allowance: string; driver_allowance: string; special_allowance: string;
}>;

export default function SalaryMasterPage() {
  const [salaryMaster, setSalaryMaster] = useState<SalaryMasterEntry[]>([]);
  const [smEdits, setSmEdits] = useState<SMEditMap>({});
  const [smEditingRow, setSmEditingRow] = useState<number | null>(null);
  const [smSaving, setSmSaving] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');

  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 3000); };

  const loadSalaryMaster = useCallback(async () => {
    setLoading(true);
    try { setSalaryMaster(await getSalaryMaster()); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadSalaryMaster(); }, [loadSalaryMaster]);

  const startSmEdit = (entry: SalaryMasterEntry) => {
    setSmEditingRow(entry.employee_id);
    setSmEdits(prev => ({
      ...prev,
      [entry.employee_id]: {
        basic_salary:     String(entry.basic_salary),
        hra:              String(entry.hra),
        meal_allowance:   String(entry.meal_allowance),
        fuel_allowance:   String(entry.fuel_allowance),
        driver_allowance: String(entry.driver_allowance),
        special_allowance:String(entry.special_allowance),
      },
    }));
  };

  const handleSmSave = async (employeeId: number) => {
    const e = smEdits[employeeId];
    if (!e) return;
    setSmSaving(employeeId);
    try {
      await updateSalaryMaster(employeeId, {
        basic_salary:      Number(e.basic_salary)      || 0,
        hra:               Number(e.hra)                || 0,
        meal_allowance:    Number(e.meal_allowance)    || 0,
        fuel_allowance:    Number(e.fuel_allowance)    || 0,
        driver_allowance:  Number(e.driver_allowance)  || 0,
        special_allowance: Number(e.special_allowance) || 0,
        deductions:        0,
      });
      setSmEditingRow(null);
      loadSalaryMaster();
      flash('Salary saved');
    } catch (err: any) {
      flash(err.message || 'Save failed');
    } finally { setSmSaving(null); }
  };

  const tdNum = (
    val: number,
    isEditing: boolean,
    field: keyof SMEditMap[number],
    employeeId: number,
    e: SMEditMap[number] | undefined,
  ) => isEditing && e ? (
    <td style={{ padding: '8px 14px' }}>
      <input style={inputStyle} type="number" min="0" value={e[field]}
        onChange={ev => setSmEdits(p => ({ ...p, [employeeId]: { ...p[employeeId], [field]: ev.target.value } }))} />
    </td>
  ) : (
    <td style={{ padding: '12px 14px', fontSize: 13, color: val > 0 ? '#374151' : '#d1d5db', textAlign: 'right' }}>
      {val > 0 ? fmt(val) : '—'}
    </td>
  );

  return (
    <AppLayout>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#111827' }}>Salary Master</h2>
          <p style={{ margin: '2px 0 0', fontSize: 13, color: '#6b7280' }}>
            Set each employee's base salary components. These values are used to pre-fill payroll runs.
          </p>
        </div>
      </div>

      {msg && (
        <div style={{ marginBottom: 14, padding: '10px 16px', borderRadius: 8, background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', fontSize: 13 }}>
          {msg}
        </div>
      )}

      {loading ? (
        <p style={{ color: '#9ca3af', fontSize: 14 }}>Loading…</p>
      ) : (
        <div style={{ background: '#fff', borderRadius: 14, overflow: 'auto', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1100 }}>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                {['Emp ID', 'Employee', 'Role', 'Gross Salary', 'Basic Salary', 'HRA', 'Meal Allowance', 'Fuel Allowance', 'Driver Allowance', 'Special Allowance', 'Last Updated', ''].map(h => (
                  <th key={h} style={{ padding: '11px 14px', textAlign: h === '' ? 'center' : 'left', fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {salaryMaster.map(entry => {
                const isEditing = smEditingRow === entry.employee_id;
                const e = smEdits[entry.employee_id];
                const gross = isEditing && e
                  ? (Number(e.basic_salary) || 0) + (Number(e.hra) || 0) + (Number(e.meal_allowance) || 0) + (Number(e.fuel_allowance) || 0) + (Number(e.driver_allowance) || 0) + (Number(e.special_allowance) || 0)
                  : entry.basic_salary + entry.hra + entry.meal_allowance + entry.fuel_allowance + entry.driver_allowance + entry.special_allowance;

                return (
                  <tr key={entry.employee_id} style={{ borderTop: '1px solid #f3f4f6', background: isEditing ? '#faf5ff' : 'transparent' }}>
                    <td style={{ padding: '12px 14px', fontSize: 13, color: '#6b7280', fontFamily: 'monospace' }}>
                      {entry.emp_id ?? <span style={{ color: '#d1d5db' }}>—</span>}
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 600, color: '#111827', whiteSpace: 'nowrap' }}>{entry.employee_name}</td>
                    <td style={{ padding: '12px 14px', fontSize: 12, color: '#6b7280', textTransform: 'capitalize', whiteSpace: 'nowrap' }}>{entry.employee_role}</td>
                    <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 600, color: gross > 0 ? '#1e40af' : '#d1d5db', textAlign: 'right' }}>
                      {gross > 0 ? fmt(gross) : '—'}
                    </td>
                    {tdNum(entry.basic_salary,      isEditing, 'basic_salary',      entry.employee_id, e)}
                    {tdNum(entry.hra,               isEditing, 'hra',               entry.employee_id, e)}
                    {tdNum(entry.meal_allowance,    isEditing, 'meal_allowance',    entry.employee_id, e)}
                    {tdNum(entry.fuel_allowance,    isEditing, 'fuel_allowance',    entry.employee_id, e)}
                    {tdNum(entry.driver_allowance,  isEditing, 'driver_allowance',  entry.employee_id, e)}
                    {tdNum(entry.special_allowance, isEditing, 'special_allowance', entry.employee_id, e)}
                    <td style={{ padding: '12px 14px', fontSize: 12, color: '#9ca3af', whiteSpace: 'nowrap' }}>
                      {entry.updated_at
                        ? new Date(entry.updated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                        : 'Not set'}
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                      {isEditing ? (
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                          <button onClick={() => handleSmSave(entry.employee_id)} disabled={smSaving === entry.employee_id} style={{
                            padding: '4px 12px', borderRadius: 6, border: 'none', cursor: 'pointer',
                            background: '#dcfce7', color: '#166534', fontWeight: 600, fontSize: 12,
                          }}>{smSaving === entry.employee_id ? '…' : 'Save'}</button>
                          <button onClick={() => setSmEditingRow(null)} style={{
                            padding: '4px 10px', borderRadius: 6, border: '1px solid #e5e7eb', cursor: 'pointer',
                            background: '#fff', color: '#6b7280', fontSize: 12,
                          }}>Cancel</button>
                        </div>
                      ) : (
                        <button onClick={() => startSmEdit(entry)} style={{
                          padding: '4px 12px', borderRadius: 6, border: 'none', cursor: 'pointer',
                          background: '#ede9fe', color: '#6d28d9', fontWeight: 600, fontSize: 12,
                        }}>Edit</button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </AppLayout>
  );
}
