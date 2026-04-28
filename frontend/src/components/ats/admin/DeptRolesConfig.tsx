import { useState, useEffect } from 'react';
import { getDeptRoles, saveDeptRoles } from '../../../api/ats-config';
import type { DeptRole, RoleEntry } from '../../../api/ats-config';
import { LEVEL_OPTIONS } from '../../../types';

export default function DeptRolesConfig() {
  const [entries, setEntries] = useState<DeptRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getDeptRoles()
      .then(setEntries)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const updateDept = (i: number, value: string) =>
    setEntries((prev) => prev.map((e, idx) => idx === i ? { ...e, department: value } : e));

  const updateRole = (deptIdx: number, roleIdx: number, field: keyof RoleEntry, value: string) =>
    setEntries((prev) => prev.map((e, i) => {
      if (i !== deptIdx) return e;
      const roles = e.roles.map((r, j) => j === roleIdx ? { ...r, [field]: value } : r);
      return { ...e, roles };
    }));

  const addRole = (deptIdx: number) =>
    setEntries((prev) => prev.map((e, i) =>
      i === deptIdx ? { ...e, roles: [...e.roles, { name: '', level: LEVEL_OPTIONS[0] }] } : e,
    ));

  const removeRole = (deptIdx: number, roleIdx: number) =>
    setEntries((prev) => prev.map((e, i) =>
      i === deptIdx ? { ...e, roles: e.roles.filter((_, j) => j !== roleIdx) } : e,
    ));

  const addDept = () =>
    setEntries((prev) => [...prev, { department: '', roles: [] }]);

  const removeDept = (i: number) =>
    setEntries((prev) => prev.filter((_, idx) => idx !== i));

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await saveDeptRoles(entries.filter((e) => e.department.trim()));
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-gray-500">Loading...</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Department & Role Config</h2>
          <p className="text-sm text-gray-500 mt-0.5">Define departments, roles, and the level assigned to each role.</p>
        </div>
        <div className="flex gap-2 items-center">
          {saved && <span className="text-sm text-green-600 font-medium">Saved!</span>}
          <button
            onClick={addDept}
            className="px-3 py-1.5 text-sm font-medium text-indigo-600 border border-indigo-300 rounded-lg hover:bg-indigo-50"
          >
            + Add Department
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-1.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {entries.map((entry, deptIdx) => (
          <div key={deptIdx} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <div className="flex items-center gap-3 mb-3">
              <input
                value={entry.department}
                onChange={(e) => updateDept(deptIdx, e.target.value)}
                placeholder="Department name"
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
              <button
                onClick={() => removeDept(deptIdx)}
                className="text-gray-400 hover:text-red-500 text-lg font-bold px-1"
                title="Remove department"
              >
                &times;
              </button>
            </div>

            <div className="ml-2 space-y-2">
              <div className="grid grid-cols-[1fr_180px_32px] gap-2 px-1">
                <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Role</span>
                <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Level</span>
                <span />
              </div>
              {entry.roles.map((role, roleIdx) => (
                <div key={roleIdx} className="grid grid-cols-[1fr_180px_32px] gap-2 items-center">
                  <input
                    value={role.name}
                    onChange={(e) => updateRole(deptIdx, roleIdx, 'name', e.target.value)}
                    placeholder="Role name"
                    className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                  <select
                    value={role.level}
                    onChange={(e) => updateRole(deptIdx, roleIdx, 'level', e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="">Select level</option>
                    {LEVEL_OPTIONS.map((l) => <option key={l} value={l}>{l}</option>)}
                  </select>
                  <button
                    onClick={() => removeRole(deptIdx, roleIdx)}
                    className="text-gray-400 hover:text-red-500 text-lg font-bold"
                    title="Remove role"
                  >
                    &times;
                  </button>
                </div>
              ))}
              <button
                onClick={() => addRole(deptIdx)}
                className="mt-1 text-sm text-indigo-600 hover:text-indigo-800 font-medium"
              >
                + Add Role
              </button>
            </div>
          </div>
        ))}

        {entries.length === 0 && (
          <p className="text-gray-400 text-sm text-center py-8">No departments configured. Click "+ Add Department" to start.</p>
        )}
      </div>
    </div>
  );
}
