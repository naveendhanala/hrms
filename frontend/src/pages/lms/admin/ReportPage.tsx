import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import HRMSLayout from '../../../components/shared/HRMSLayout';
import { getCompletionReport } from '../../../api/lms-reports';
import type { CompletionReport } from '../../../types';

export default function LmsReportPage() {
  const [data, setData] = useState<CompletionReport[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    getCompletionReport()
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const totalEntries = data.length;
  const completed = data.filter((d) => d.submitted_at).length;
  const watched = data.filter((d) => d.watched && !d.submitted_at).length;

  const getStatus = (row: CompletionReport) => {
    if (row.submitted_at) return 'Completed';
    if (row.watched) return 'Watched';
    return 'Not Started';
  };

  const getStatusColor = (status: string) => {
    if (status === 'Completed') return 'bg-green-100 text-green-700';
    if (status === 'Watched') return 'bg-blue-100 text-blue-700';
    return 'bg-gray-100 text-gray-500';
  };

  return (
    <HRMSLayout>
      <button onClick={() => navigate('/lms/admin')} className="text-sm text-indigo-600 hover:text-indigo-800 font-medium mb-4 inline-block">
        &larr; Back to Dashboard
      </button>

      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-1">LMS Reports</h1>
        <p className="text-gray-500">Employee course completion status</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <p className="text-sm text-gray-500 mb-1">Total Assignments</p>
          <p className="text-3xl font-bold text-gray-900">{totalEntries}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <p className="text-sm text-gray-500 mb-1">Completed</p>
          <p className="text-3xl font-bold text-green-600">{completed}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <p className="text-sm text-gray-500 mb-1">Watched Only</p>
          <p className="text-3xl font-bold text-blue-600">{watched}</p>
        </div>
      </div>

      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : data.length === 0 ? (
        <p className="text-gray-500">No data available.</p>
      ) : (
        <div className="overflow-x-auto bg-white rounded-xl shadow-sm border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {['Employee', 'Email', 'Course', 'Status', 'Score', 'Completed'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {data.map((row, i) => {
                const status = getStatus(row);
                return (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{row.user_name}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{row.user_email}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{row.course_title}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(status)}`}>
                        {status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {row.score != null && row.total != null ? `${row.score}/${row.total}` : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {row.submitted_at ? new Date(row.submitted_at).toLocaleDateString() : '-'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </HRMSLayout>
  );
}
