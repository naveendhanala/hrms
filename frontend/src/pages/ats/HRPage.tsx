import { useState } from 'react';
import AppLayout from '../../components/shared/AppLayout';
import CandidateList from '../../components/ats/hr/CandidateList';
import PipelineView from '../../components/ats/hr/PipelineView';
import ReportView from '../../components/ats/hr/ReportView';

type Tab = 'candidates' | 'pipeline' | 'reports';

export default function HRPage() {
  const [tab, setTab] = useState<Tab>('candidates');

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-1">HR Dashboard</h1>
        <p className="text-gray-500">Applicant Tracking System</p>
      </div>

      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {(['candidates', 'pipeline', 'reports'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors capitalize ${
              tab === t ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'candidates' && <CandidateList />}
      {tab === 'pipeline' && <PipelineView />}
      {tab === 'reports' && <ReportView />}
    </AppLayout>
  );
}
