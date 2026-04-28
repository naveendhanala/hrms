import { useState, useEffect, useCallback } from 'react';
import { listCandidates } from '../../../api/ats-candidates';
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

  const filtered =
    filter === 'pending'
      ? candidates.filter((c) => c.stage === 'Offer Approval Pending')
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
                {['Name', 'Job ID', 'Stage', 'HR SPOC'].map((h) => (
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
                  <td className="px-4 py-3 text-sm text-gray-600">{c.hr_spoc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
