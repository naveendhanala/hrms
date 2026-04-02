import { useState, useEffect } from 'react';
import HRMSLayout from '../../components/shared/HRMSLayout';
import PositionRequestForm from '../../components/ats/projectlead/PositionRequestForm';
import { listPositions } from '../../api/ats-positions';
import type { Position } from '../../types';

type Tab = 'new' | 'requests';

export default function ProjectLeadPage() {
  const [tab, setTab] = useState<Tab>('new');
  const [requests, setRequests] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listPositions({ approval_status: 'requests' })
      .then(setRequests)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <HRMSLayout>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-1">Project Lead Dashboard</h1>
        <p className="text-gray-500">Applicant Tracking System</p>
      </div>

      <div className="flex gap-1 mb-6 border-b border-gray-200">
        <button
          onClick={() => setTab('new')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === 'new' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          New Request
        </button>
        <button
          onClick={() => setTab('requests')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === 'requests' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          My Requests
        </button>
      </div>

      {tab === 'new' && <PositionRequestForm />}

      {tab === 'requests' && (
        <div>
          {loading ? (
            <p className="text-gray-500">Loading...</p>
          ) : requests.length === 0 ? (
            <p className="text-gray-500">No requests submitted yet.</p>
          ) : (
            <div className="overflow-x-auto bg-white rounded-xl shadow-sm border border-gray-200">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {['Job ID', 'Project', 'Role', 'Department', 'Total Req', 'Status'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {requests.map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{p.job_id}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{p.project}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{p.role}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{p.department}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{p.total_req}</td>
                      <td className="px-4 py-3 text-sm">
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            p.approval_status === 'approved' ? 'bg-green-100 text-green-700'
                              : p.approval_status === 'rejected' ? 'bg-red-100 text-red-700'
                                : 'bg-yellow-100 text-yellow-700'
                          }`}
                        >
                          {p.approval_status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </HRMSLayout>
  );
}
