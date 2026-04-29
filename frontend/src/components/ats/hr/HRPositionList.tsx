import { useState, useEffect, useCallback, useMemo } from 'react';
import { listPositions, updatePosition } from '../../../api/ats-positions';
import type { Position } from '../../../types';
import { HR_SPOC_OPTIONS } from '../../../types';

const COLS = ['Job ID', 'Project', 'Department', 'Role', 'Level', 'Required By', 'HR SPOC', ''];

export default function HRPositionList() {
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [showAll, setShowAll] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listPositions(showAll ? undefined : { status: 'Active' });
      setPositions(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [showAll]);

  useEffect(() => { load(); }, [load]);

  const handleSpocChange = (jobId: string, value: string) => {
    setEditing((prev) => ({ ...prev, [jobId]: value }));
  };

  const handleSave = async (jobId: string) => {
    const spoc = editing[jobId];
    if (!spoc) return;
    setSaving(jobId);
    try {
      await updatePosition(jobId, { hr_spoc: spoc });
      setPositions((prev) => prev.map((p) => p.job_id === jobId ? { ...p, hr_spoc: spoc } : p));
      setEditing((prev) => { const next = { ...prev }; delete next[jobId]; return next; });
    } finally {
      setSaving(null);
    }
  };

  const currentSpoc = (p: Position) => editing[p.job_id] ?? p.hr_spoc;
  const isDirty = (p: Position) => editing[p.job_id] !== undefined && editing[p.job_id] !== p.hr_spoc;

  // Summary: group by saved hr_spoc, count Active positions
  const summary = useMemo(() => {
    const map: Record<string, { total: number; open: number }> = {};
    for (const p of positions) {
      const spoc = p.hr_spoc || 'Unassigned';
      if (!map[spoc]) map[spoc] = { total: 0, open: 0 };
      map[spoc].total += 1;
      if (p.status === 'Active') map[spoc].open += 1;
    }
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [positions]);

  // Group by saved hr_spoc for table sections
  const grouped = useMemo(() => {
    const map: Record<string, Position[]> = {};
    for (const p of positions) {
      const spoc = p.hr_spoc || 'Unassigned';
      if (!map[spoc]) map[spoc] = [];
      map[spoc].push(p);
    }
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [positions]);

  const toggleCollapse = (spoc: string) =>
    setCollapsed((prev) => ({ ...prev, [spoc]: !prev[spoc] }));

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-gray-900">Positions</h2>
        <div className="flex rounded-lg border border-gray-300 overflow-hidden text-sm font-medium">
          <button
            onClick={() => setShowAll(false)}
            className={`px-3 py-1.5 transition-colors ${!showAll ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
          >
            Active
          </button>
          <button
            onClick={() => setShowAll(true)}
            className={`px-3 py-1.5 transition-colors border-l border-gray-300 ${showAll ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
          >
            All
          </button>
        </div>
      </div>

      {/* HR SPOC Summary Bar */}
      {!loading && positions.length > 0 && (
        <div className="flex flex-wrap gap-3 mb-5">
          {summary.map(([spoc, counts]) => (
            <div key={spoc} className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-4 py-2.5 shadow-sm">
              <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 text-xs font-bold">
                {spoc.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-800 leading-tight">{spoc}</p>
                <p className="text-xs text-gray-500 leading-tight">
                  <span className="font-medium text-green-600">{counts.open} open</span>
                  {' / '}
                  <span>{counts.total} total</span>
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : positions.length === 0 ? (
        <p className="text-gray-500">{showAll ? 'No positions found.' : 'No active positions found.'}</p>
      ) : (
        <div className="space-y-4">
          {grouped.map(([spoc, rows]) => {
            const openCount = rows.filter((p) => p.status === 'Active').length;
            const isCollapsed = collapsed[spoc];
            return (
              <div key={spoc} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <button
                  onClick={() => toggleCollapse(spoc)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors border-b border-gray-200"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 text-xs font-bold">
                      {spoc.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-sm font-semibold text-gray-800">{spoc}</span>
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                      {openCount} open
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                      {rows.length} total
                    </span>
                  </div>
                  <span className="text-gray-400 text-sm">{isCollapsed ? '▶' : '▼'}</span>
                </button>

                {!isCollapsed && (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          {COLS.map((h) => (
                            <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {rows.map((p) => {
                          const isClosed = p.status !== 'Active';
                          return (
                          <tr key={p.job_id} className={isClosed ? 'bg-gray-50 opacity-60' : 'hover:bg-gray-50'}>
                            <td className="px-4 py-3 text-sm font-medium text-gray-900">
                              <span>{p.job_id}</span>
                              {isClosed && (
                                <span className="ml-2 px-1.5 py-0.5 rounded text-xs font-semibold bg-gray-200 text-gray-500">Closed</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600">{p.project}</td>
                            <td className="px-4 py-3 text-sm text-gray-600">{p.department}</td>
                            <td className="px-4 py-3 text-sm text-gray-600">{p.role}</td>
                            <td className="px-4 py-3 text-sm text-gray-600">{p.level}</td>
                            <td className="px-4 py-3 text-sm text-gray-600">{p.required_by_date?.slice(0, 10) || '—'}</td>
                            <td className="px-4 py-3 text-sm">
                              {isClosed ? (
                                <span className="text-gray-500">{p.hr_spoc || '—'}</span>
                              ) : (
                                <select
                                  value={currentSpoc(p)}
                                  onChange={(e) => handleSpocChange(p.job_id, e.target.value)}
                                  className="border border-gray-300 rounded-lg px-2 py-1 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                >
                                  {HR_SPOC_OPTIONS.map((h) => <option key={h} value={h}>{h}</option>)}
                                </select>
                              )}
                            </td>
                            <td className="px-4 py-3 text-sm">
                              {!isClosed && isDirty(p) && (
                                <button
                                  onClick={() => handleSave(p.job_id)}
                                  disabled={saving === p.job_id}
                                  className="px-3 py-1 text-xs font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                                >
                                  {saving === p.job_id ? 'Saving…' : 'Save'}
                                </button>
                              )}
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
          })}
        </div>
      )}
    </div>
  );
}
