import { useState } from 'react';
import AppLayout from '../../components/shared/AppLayout';
import PositionList from '../../components/ats/admin/PositionList';
import AdminCandidateList from '../../components/ats/admin/AdminCandidateList';
import DeptRolesConfig from '../../components/ats/admin/DeptRolesConfig';

type Tab = 'positions' | 'candidates' | 'config';

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>('positions');

  const tabs: { key: Tab; label: string }[] = [
    { key: 'positions', label: 'Positions' },
    { key: 'candidates', label: 'Candidates / Approvals' },
    { key: 'config', label: 'Dept & Role Config' },
  ];

  return (
    <AppLayout>
      <div className="flex gap-1 mb-4 border-b border-gray-200">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'positions' && <PositionList />}
      {tab === 'candidates' && <AdminCandidateList />}
      {tab === 'config' && <DeptRolesConfig />}
    </AppLayout>
  );
}
