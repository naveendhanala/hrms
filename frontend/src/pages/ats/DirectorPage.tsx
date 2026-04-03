import { useState, useEffect, useCallback } from 'react';
import AppLayout from '../../components/shared/AppLayout';
import { listCandidates, approveOffer, rejectOffer } from '../../api/ats-candidates';
import type { Candidate } from '../../types';
import ReportView from '../../components/ats/hr/ReportView';

type Tab = 'approvals' | 'reports';

export default function DirectorPage() {
  const [tab, setTab] = useState<Tab>('approvals');
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);

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

  const pending = candidates.filter((c) => c.offer_approval_status === 'pending');

  const handleApprove = async (id: string) => {
    await approveOffer(id);
    load();
  };

  const handleReject = async (id: string) => {
    await rejectOffer(id);
    load();
  };

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-1">Director Dashboard</h1>
        <p className="text-gray-500">Applicant Tracking System</p>
      </div>

      <div className="flex gap-1 mb-6 border-b border-gray-200">
        <button
          onClick={() => setTab('approvals')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === 'approvals' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Offer Approvals
          {pending.length > 0 && (
            <span className="ml-2 inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-red-500 rounded-full">
              {pending.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab('reports')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === 'reports' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Reports
        </button>
      </div>

      {tab === 'approvals' && (
        <div>
          {loading ? (
            <p className="text-gray-500">Loading...</p>
          ) : pending.length === 0 ? (
            <p className="text-gray-500">No pending offer approvals.</p>
          ) : (
            <div className="overflow-x-auto bg-white rounded-xl shadow-sm border border-gray-200">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {['Name', 'Job ID', 'Stage', 'HR SPOC', 'Actions'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {pending.map((c) => (
                    <tr key={c.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{c.name}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{c.job_id}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{c.stage}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{c.hr_spoc}</td>
                      <td className="px-4 py-3 text-sm">
                        <div className="flex gap-2">
                          <button onClick={() => handleApprove(c.id)} className="text-green-600 hover:text-green-800 font-medium">Approve</button>
                          <button onClick={() => handleReject(c.id)} className="text-red-600 hover:text-red-800 font-medium">Reject</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'reports' && <ReportView />}
    </AppLayout>
  );
}
