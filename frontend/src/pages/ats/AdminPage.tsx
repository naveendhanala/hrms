import { useState } from 'react';
import AppLayout from '../../components/shared/AppLayout';
import PositionList from '../../components/ats/admin/PositionList';
import AdminCandidateList from '../../components/ats/admin/AdminCandidateList';

type Tab = 'positions' | 'candidates';

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>('positions');

  return (
    <AppLayout>
      <div className="flex gap-1 mb-4 border-b border-gray-200">
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
    </AppLayout>
  );
}
