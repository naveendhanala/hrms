import { useState, useEffect, useCallback } from 'react';
import { listCandidates, approveOffer, rejectOffer } from '../../../api/ats-candidates';
import type { Candidate } from '../../../types';

export default function AdminCandidateList() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending'>('all');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listCandidates();
      setCandidates(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleApprove = async (id: string) => {
    await approveOffer(id);
    load();
  };

  const handleReject = async (id: string) => {
    await rejectOffer(id);
    load();
  };

  const filtered =
    filter === 'pending'
      ? candidates.filter((c) => c.offer_approval_status === 'pending')
      : candidates;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">All Candidates</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 text-sm rounded-lg font-medium ${filter === 'all' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-600 hover:bg-gray-100'}`}
          >
            All
          </button>
          <button
            onClick={() => setFilter('pending')}
            className={`px-3 py-1.5 text-sm rounded-lg font-medium ${filter === 'pending' ? 'bg-yellow-100 text-yellow-700' : 'text-gray-600 hover:bg-gray-100'}`}
          >
            Pending Approval
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : filtered.length === 0 ? (
        <p className="text-gray-500">No candidates found.</p>
      ) : (
        <div className="overflow-x-auto bg-white rounded-xl shadow-sm border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {['Name', 'Job ID', 'Stage', 'Offer Status', 'HR SPOC', 'Actions'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filtered.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{c.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{c.job_id}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{c.stage}</td>
                  <td className="px-4 py-3 text-sm">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        c.offer_approval_status === 'approved'
                          ? 'bg-green-100 text-green-700'
                          : c.offer_approval_status === 'rejected'
                            ? 'bg-red-100 text-red-700'
                            : c.offer_approval_status === 'pending'
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {c.offer_approval_status || 'N/A'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{c.hr_spoc}</td>
                  <td className="px-4 py-3 text-sm">
                    {c.offer_approval_status === 'pending' && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleApprove(c.id)}
                          className="text-green-600 hover:text-green-800 font-medium"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleReject(c.id)}
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
