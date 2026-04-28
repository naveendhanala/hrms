import { lazy, Suspense, Component, type ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/shared/ProtectedRoute';

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 40, fontFamily: 'monospace' }}>
          <h2 style={{ color: '#dc2626' }}>Runtime Error</h2>
          <pre style={{ whiteSpace: 'pre-wrap', color: '#374151' }}>{(this.state.error as Error).message}</pre>
          <pre style={{ whiteSpace: 'pre-wrap', color: '#9ca3af', fontSize: 12 }}>{(this.state.error as Error).stack}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

const LoginPage          = lazy(() => import('./pages/LoginPage'));
const Dashboard          = lazy(() => import('./pages/Dashboard'));
const EmployeesPage      = lazy(() => import('./pages/EmployeesPage'));
const PayrollPage        = lazy(() => import('./pages/PayrollPage'));
const SalaryMasterPage   = lazy(() => import('./pages/SalaryMasterPage'));
const ConfigurationsPage = lazy(() => import('./pages/ConfigurationsPage'));
const AdvancesPage       = lazy(() => import('./pages/AdvancesPage'));
const TaxComputationPage = lazy(() => import('./pages/TaxComputationPage'));
const AttendancePage     = lazy(() => import('./pages/attendance/AttendancePage'));
const FeedbackPage       = lazy(() => import('./pages/ats/FeedbackPage'));
const AdminPage          = lazy(() => import('./pages/ats/AdminPage'));
const HRPage             = lazy(() => import('./pages/ats/HRPage'));
const DirectorPage       = lazy(() => import('./pages/ats/DirectorPage'));
const ProjectLeadPage    = lazy(() => import('./pages/ats/ProjectLeadPage'));
const BusinessHeadPage   = lazy(() => import('./pages/ats/BusinessHeadPage'));
const KnowledgeBasePage  = lazy(() => import('./pages/kb/KnowledgeBasePage'));
const EmployeeDashboard  = lazy(() => import('./pages/lms/EmployeeDashboard'));
const WatchPage          = lazy(() => import('./pages/lms/WatchPage'));
const QuizPage           = lazy(() => import('./pages/lms/QuizPage'));
const LmsAdminDashboard  = lazy(() => import('./pages/lms/admin/AdminDashboard'));
const ManageCoursePage   = lazy(() => import('./pages/lms/admin/ManageCoursePage'));
const LmsReportPage      = lazy(() => import('./pages/lms/admin/ReportPage'));

function PageLoader() {
  return <div style={{ padding: 40, color: '#9ca3af', fontSize: 14 }}>Loading…</div>;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ErrorBoundary>
        <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/dashboard" element={<ProtectedRoute allowedRoles={['admin', 'hr', 'director', 'projectlead', 'businesshead', 'employee']}><Dashboard /></ProtectedRoute>} />
          <Route path="/attendance" element={<ProtectedRoute allowedRoles={['admin', 'hr', 'director', 'projectlead', 'businesshead', 'employee']}><AttendancePage /></ProtectedRoute>} />
          <Route path="/employees" element={<ProtectedRoute allowedRoles={['admin', 'hr']}><EmployeesPage /></ProtectedRoute>} />
          <Route path="/payroll" element={<ProtectedRoute allowedRoles={['admin', 'hr']}><PayrollPage /></ProtectedRoute>} />
          <Route path="/payroll/salary-master" element={<ProtectedRoute allowedRoles={['admin', 'hr']}><SalaryMasterPage /></ProtectedRoute>} />
          <Route path="/payroll/advances" element={<ProtectedRoute allowedRoles={['admin', 'hr']}><AdvancesPage /></ProtectedRoute>} />
          <Route path="/payroll/tax-computation" element={<ProtectedRoute allowedRoles={['admin', 'hr']}><TaxComputationPage /></ProtectedRoute>} />
          <Route path="/payroll/configurations" element={<ProtectedRoute allowedRoles={['admin', 'hr']}><ConfigurationsPage /></ProtectedRoute>} />
          <Route path="/feedback" element={<FeedbackPage />} />

          {/* Knowledge Base */}
          <Route path="/kb" element={<ProtectedRoute allowedRoles={['admin', 'hr', 'director', 'projectlead', 'businesshead', 'employee']}><KnowledgeBasePage /></ProtectedRoute>} />

          {/* ATS routes */}
          <Route path="/ats/admin" element={<ProtectedRoute allowedRoles={['admin']}><AdminPage /></ProtectedRoute>} />
          <Route path="/ats/hr" element={<ProtectedRoute allowedRoles={['hr']}><HRPage /></ProtectedRoute>} />
          <Route path="/ats/director" element={<ProtectedRoute allowedRoles={['director']}><DirectorPage /></ProtectedRoute>} />
          <Route path="/ats/project-lead" element={<ProtectedRoute allowedRoles={['projectlead']}><ProjectLeadPage /></ProtectedRoute>} />
          <Route path="/ats/business-head" element={<ProtectedRoute allowedRoles={['businesshead']}><BusinessHeadPage /></ProtectedRoute>} />

          {/* LMS routes */}
          <Route path="/lms" element={<ProtectedRoute allowedRoles={['admin', 'hr', 'director', 'projectlead', 'businesshead', 'employee']}><EmployeeDashboard /></ProtectedRoute>} />
          <Route path="/lms/courses/:id/watch" element={<ProtectedRoute allowedRoles={['admin', 'hr', 'director', 'projectlead', 'businesshead', 'employee']}><WatchPage /></ProtectedRoute>} />
          <Route path="/lms/courses/:id/quiz" element={<ProtectedRoute allowedRoles={['admin', 'hr', 'director', 'projectlead', 'businesshead', 'employee']}><QuizPage /></ProtectedRoute>} />
          <Route path="/lms/admin" element={<ProtectedRoute allowedRoles={['admin', 'hr']}><LmsAdminDashboard /></ProtectedRoute>} />
          <Route path="/lms/admin/courses/:id" element={<ProtectedRoute allowedRoles={['admin', 'hr']}><ManageCoursePage /></ProtectedRoute>} />
          <Route path="/lms/admin/reports" element={<ProtectedRoute allowedRoles={['admin', 'hr']}><LmsReportPage /></ProtectedRoute>} />

          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
        </Suspense>
        </ErrorBoundary>
      </AuthProvider>
    </BrowserRouter>
  );
}
