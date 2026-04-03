import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/shared/ProtectedRoute';

import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';
import EmployeesPage from './pages/EmployeesPage';
import PayrollPage from './pages/PayrollPage';
import AttendancePage from './pages/attendance/AttendancePage';
import FeedbackPage from './pages/ats/FeedbackPage';

import AdminPage from './pages/ats/AdminPage';
import HRPage from './pages/ats/HRPage';
import DirectorPage from './pages/ats/DirectorPage';
import ProjectLeadPage from './pages/ats/ProjectLeadPage';
import BusinessHeadPage from './pages/ats/BusinessHeadPage';

import EmployeeDashboard from './pages/lms/EmployeeDashboard';
import WatchPage from './pages/lms/WatchPage';
import QuizPage from './pages/lms/QuizPage';
import LmsAdminDashboard from './pages/lms/admin/AdminDashboard';
import ManageCoursePage from './pages/lms/admin/ManageCoursePage';
import LmsReportPage from './pages/lms/admin/ReportPage';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/dashboard" element={<ProtectedRoute allowedRoles={['admin', 'hr', 'director', 'projectlead', 'businesshead', 'employee']}><Dashboard /></ProtectedRoute>} />
          <Route path="/attendance" element={<ProtectedRoute allowedRoles={['admin', 'hr', 'director', 'projectlead', 'businesshead', 'employee']}><AttendancePage /></ProtectedRoute>} />
          <Route path="/employees" element={<ProtectedRoute allowedRoles={['admin', 'hr']}><EmployeesPage /></ProtectedRoute>} />
          <Route path="/payroll" element={<ProtectedRoute allowedRoles={['admin', 'hr']}><PayrollPage /></ProtectedRoute>} />
          <Route path="/feedback" element={<FeedbackPage />} />

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
      </AuthProvider>
    </BrowserRouter>
  );
}
