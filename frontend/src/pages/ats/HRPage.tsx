import { useState } from 'react';
import AppLayout from '../../components/shared/AppLayout';
import CandidateList from '../../components/ats/hr/CandidateList';
import PipelineView from '../../components/ats/hr/PipelineView';
import ReportView from '../../components/ats/hr/ReportView';
import HRPositionList from '../../components/ats/hr/HRPositionList';
import YetToJoin from '../../components/ats/hr/YetToJoin';

type Tab = 'candidates' | 'pipeline' | 'positions' | 'yettojoin' | 'reports';

const TAB_LABELS: Record<Tab, string> = {
  candidates: 'Profile Tracker',
  pipeline: 'Requirement List',
  positions: 'Positions',
  yettojoin: 'Yet to Join',
  reports: 'Reports',
};

export default function HRPage() {
  const [tab, setTab] = useState<Tab>('candidates');

  return (
    <AppLayout>
      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {(Object.keys(TAB_LABELS) as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {tab === 'candidates' && <CandidateList />}
      {tab === 'pipeline' && <PipelineView />}
      {tab === 'positions' && <HRPositionList />}
      {tab === 'yettojoin' && <YetToJoin />}
      {tab === 'reports' && <ReportView />}
    </AppLayout>
  );
}
