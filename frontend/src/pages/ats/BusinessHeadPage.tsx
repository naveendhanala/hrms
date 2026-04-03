import AppLayout from '../../components/shared/AppLayout';
import PositionRequestList from '../../components/ats/businesshead/PositionRequestList';

export default function BusinessHeadPage() {
  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-1">Business Head Dashboard</h1>
        <p className="text-gray-500">Applicant Tracking System</p>
      </div>
      <PositionRequestList />
    </AppLayout>
  );
}
