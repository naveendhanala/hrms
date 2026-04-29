import { useState, useEffect, useMemo } from 'react';
import { getReport, type ReportRow } from '../../../api/ats-report';

const COLS = ['Project', 'Level', 'Department', 'Role', 'Total Req', 'Total Joined', 'Offer Released', 'Open'] as const;

export default function ReportView() {
  const [data, setData] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterProject, setFilterProject] = useState('');
  const [filterDept, setFilterDept] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    getReport()
      .then(setData)
      .catch((err: any) => setError(err?.message || 'Failed to load report.'))
      .finally(() => setLoading(false));
  }, []);

  const projects    = useMemo(() => [...new Set(data.map((r) => r.project))].sort(), [data]);
  const departments = useMemo(() => [...new Set(data.map((r) => r.department))].sort(), [data]);

  const filtered = useMemo(() => {
    return data.filter((r) =>
      (!filterProject || r.project    === filterProject) &&
      (!filterDept    || r.department === filterDept),
    );
  }, [data, filterProject, filterDept]);

  const totals = useMemo(() => ({
    total_req:           filtered.reduce((s, r) => s + r.total_req,           0),
    total_joined:        filtered.reduce((s, r) => s + r.total_joined,        0),
    total_offer_released:filtered.reduce((s, r) => s + r.total_offer_released,0),
    open:                filtered.reduce((s, r) => s + r.open,                0),
  }), [filtered]);

  const exportCSV = () => {
    if (filtered.length === 0) return;
    const headers = ['Project', 'Level', 'Department', 'Role', 'Total Req', 'Total Joined', 'Offer Released', 'Open'];
    const rows = filtered.map((r) => [r.project, r.level, r.department, r.role, r.total_req, r.total_joined, r.total_offer_released, r.open]);
    const csv = [headers.join(','), ...rows.map((r) => r.map((v) => `"${v ?? ''}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ats-report.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Reports</h2>
        <button
          onClick={exportCSV}
          disabled={filtered.length === 0}
          className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50"
        >
          Export CSV
        </button>
      </div>

      <div className="flex flex-wrap gap-3 mb-6">
        <select
          value={filterProject}
          onChange={(e) => setFilterProject(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-600"
        >
          <option value="">All Projects</option>
          {projects.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select
          value={filterDept}
          onChange={(e) => setFilterDept(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-600"
        >
          <option value="">All Departments</option>
          {departments.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>

      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : error ? (
        <p className="text-red-600 text-sm">{error}</p>
      ) : filtered.length === 0 ? (
        <p className="text-gray-500">No data found.</p>
      ) : (
        <div className="overflow-x-auto bg-white rounded-xl shadow-sm border border-gray-200">
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
              {filtered.map((r, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{r.project}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{r.level || '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{r.department}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{r.role}</td>
                  <td className="px-4 py-3 text-sm text-center font-medium text-gray-800">{r.total_req}</td>
                  <td className="px-4 py-3 text-sm text-center font-medium text-green-700">{r.total_joined}</td>
                  <td className="px-4 py-3 text-sm text-center font-medium text-blue-700">{r.total_offer_released}</td>
                  <td className="px-4 py-3 text-sm text-center font-medium text-amber-700">{r.open}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-100 border-t-2 border-gray-300">
              <tr>
                <td colSpan={4} className="px-4 py-3 text-sm font-bold text-gray-700 uppercase tracking-wide">Grand Total</td>
                <td className="px-4 py-3 text-sm text-center font-bold text-gray-900">{totals.total_req}</td>
                <td className="px-4 py-3 text-sm text-center font-bold text-green-800">{totals.total_joined}</td>
                <td className="px-4 py-3 text-sm text-center font-bold text-blue-800">{totals.total_offer_released}</td>
                <td className="px-4 py-3 text-sm text-center font-bold text-amber-800">{totals.open}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
