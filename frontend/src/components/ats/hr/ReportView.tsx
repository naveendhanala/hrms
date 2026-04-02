import { useState, useEffect } from 'react';
import { getReport } from '../../../api/ats-report';
import type { Candidate } from '../../../types';

export default function ReportView() {
  const [data, setData] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Record<string, string>>({});

  useEffect(() => {
    setLoading(true);
    const activeFilters: Record<string, string> = {};
    Object.entries(filters).forEach(([k, v]) => {
      if (v) activeFilters[k] = v;
    });
    getReport(Object.keys(activeFilters).length > 0 ? activeFilters : undefined)
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [filters]);

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const exportCSV = () => {
    if (data.length === 0) return;
    const headers = ['Name', 'Mobile', 'Job ID', 'Stage', 'Interviewer', 'HR SPOC', 'Sourcing Date', 'Joined Date'];
    const rows = data.map((c) => [c.name, c.mobile, c.job_id, c.stage, c.interviewer, c.hr_spoc, c.sourcing_date, c.joined_date]);
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
          disabled={data.length === 0}
          className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50"
        >
          Export CSV
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <input
          name="job_id"
          placeholder="Filter by Job ID"
          value={filters.job_id ?? ''}
          onChange={handleFilterChange}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        />
        <input
          name="hr_spoc"
          placeholder="Filter by HR SPOC"
          value={filters.hr_spoc ?? ''}
          onChange={handleFilterChange}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        />
        <input
          name="stage"
          placeholder="Filter by Stage"
          value={filters.stage ?? ''}
          onChange={handleFilterChange}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        />
        <input
          name="from_date"
          type="date"
          value={filters.from_date ?? ''}
          onChange={handleFilterChange}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        />
      </div>

      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : data.length === 0 ? (
        <p className="text-gray-500">No data found.</p>
      ) : (
        <div className="overflow-x-auto bg-white rounded-xl shadow-sm border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {['Name', 'Mobile', 'Job ID', 'Stage', 'Interviewer', 'HR SPOC', 'Sourcing Date', 'Joined Date'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {data.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{c.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{c.mobile}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{c.job_id}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{c.stage}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{c.interviewer}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{c.hr_spoc}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{c.sourcing_date?.slice(0, 10)}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{c.joined_date?.slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
