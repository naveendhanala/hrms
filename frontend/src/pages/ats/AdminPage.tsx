import { useState } from 'react';
import HRMSLayout from '../../components/shared/HRMSLayout';
import PositionList from '../../components/ats/admin/PositionList';
import AdminCandidateList from '../../components/ats/admin/AdminCandidateList';

type Tab = 'positions' | 'candidates';

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>('positions');

  return (
    <HRMSLayout>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-1">Admin Dashboard</h1>
        <p className="text-gray-500">Applicant Tracking System</p>
      </div>

      <div className="flex gap-1 mb-6 border-b border-gray-200">
        <button
          onClick={() => setTab('positions')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === 'positions' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Positions
        </button>
        <button
          onClick={() => setTab('candidates')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === 'candidates' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Candidates / Approvals
        </button>
      </div>

      {tab === 'positions' && <PositionList />}
      {tab === 'candidates' && <AdminCandidateList />}
    </HRMSLayout>
  );
}
