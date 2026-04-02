import { useState, useEffect, useCallback } from 'react';
import { listPositions, approvePositionRequest, rejectPositionRequest } from '../../../api/ats-positions';
import type { Position } from '../../../types';

export default function PositionRequestList() {
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'pending' | 'all'>('pending');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listPositions();
      setPositions(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleApprove = async (jobId: string) => {
    await approvePositionRequest(jobId);
    load();
  };

  const handleReject = async (jobId: string) => {
    await rejectPositionRequest(jobId);
    load();
  };

  const filtered =
    filter === 'pending'
      ? positions.filter((p) => p.approval_status === 'pending')
      : positions;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Position Requests</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('pending')}
            className={`px-3 py-1.5 text-sm rounded-lg font-medium ${filter === 'pending' ? 'bg-yellow-100 text-yellow-700' : 'text-gray-600 hover:bg-gray-100'}`}
          >
            Pending
          </button>
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 text-sm rounded-lg font-medium ${filter === 'all' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-600 hover:bg-gray-100'}`}
          >
            All
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : filtered.length === 0 ? (
        <p className="text-gray-500">No position requests found.</p>
      ) : (
        <div className="overflow-x-auto bg-white rounded-xl shadow-sm border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {['Job ID', 'Project', 'Department', 'Role', 'Total Req', 'Level', 'Status', 'Actions'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filtered.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{p.job_id}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{p.project}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{p.department}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{p.role}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{p.total_req}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{p.level}</td>
                  <td className="px-4 py-3 text-sm">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        p.approval_status === 'approved'
                          ? 'bg-green-100 text-green-700'
                          : p.approval_status === 'rejected'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-yellow-100 text-yellow-700'
                      }`}
                    >
                      {p.approval_status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {p.approval_status === 'pending' && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleApprove(p.job_id)}
                          className="text-green-600 hover:text-green-800 font-medium"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleReject(p.job_id)}
                          className="text-red-600 hover:text-red-800 font-medium"
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
