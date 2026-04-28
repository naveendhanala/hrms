import { useState, useEffect } from 'react';
import AppLayout from '../../components/shared/AppLayout';
import PositionRequestList from '../../components/ats/businesshead/PositionRequestList';
import BusinessHeadRequestForm from '../../components/ats/businesshead/BusinessHeadRequestForm';
import InterviewerFeedbackTab from '../../components/ats/shared/InterviewerFeedbackTab';
import { apiFetch } from '../../api/client';

type Tab = 'requests' | 'new' | 'feedback';

export default function BusinessHeadPage() {
  const [tab, setTab] = useState<Tab>('requests');
  const [pendingFeedbackCount, setPendingFeedbackCount] = useState(0);

  useEffect(() => {
    apiFetch<{ stage: string }[]>('/api/ats/feedback/my-candidates')
      .then((data) => setPendingFeedbackCount(data.filter((c) => c.stage === 'Interview').length))
      .catch(() => {});
  }, []);

  const tabs: [Tab, string][] = [
    ['requests', 'Position Requests'],
    ['new', 'New Position'],
    ['feedback', pendingFeedbackCount > 0 ? `My Interviews (${pendingFeedbackCount})` : 'My Interviews'],
  ];

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-1">Business Head Dashboard</h1>
        <p className="text-gray-500">Applicant Tracking System</p>
      </div>

      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {tabs.map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === key ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'requests' && <PositionRequestList />}
      {tab === 'new' && <BusinessHeadRequestForm onSuccess={() => setTab('requests')} />}
      {tab === 'feedback' && <InterviewerFeedbackTab onPendingCount={setPendingFeedbackCount} />}
    </AppLayout>
  );
}
