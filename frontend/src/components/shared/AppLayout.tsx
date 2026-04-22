import type { ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import type { UserRole } from '../../types';

const MODULE_ROUTES: Record<string, Record<UserRole, string>> = {
  KB: {
    admin: '/kb',
    hr: '/kb',
    director: '/kb',
    projectlead: '/kb',
    businesshead: '/kb',
    employee: '/kb',
  },
  DASHBOARD: {
    admin: '/dashboard',
    hr: '/dashboard',
    director: '/dashboard',
    projectlead: '/dashboard',
    businesshead: '/dashboard',
    employee: '/dashboard',
  },
  EMPLOYEES: {
    admin: '/employees',
    hr: '/employees',
    director: '/employees',
    projectlead: '/employees',
    businesshead: '/employees',
    employee: '/employees',
  },
  ATS: {
    admin: '/ats/admin',
    hr: '/ats/hr',
    director: '/ats/director',
    projectlead: '/ats/project-lead',
    businesshead: '/ats/business-head',
    employee: '/lms',
  },
  LMS: {
    admin: '/lms/admin',
    hr: '/lms/admin',
    director: '/lms',
    projectlead: '/lms',
    businesshead: '/lms',
    employee: '/lms',
  },
  ATTENDANCE: {
    admin: '/attendance',
    hr: '/attendance',
    director: '/attendance',
    projectlead: '/attendance',
    businesshead: '/attendance',
    employee: '/attendance',
  },
  PAYROLL: {
    admin: '/payroll',
    hr: '/payroll',
    director: '/payroll',
    projectlead: '/payroll',
    businesshead: '/payroll',
    employee: '/payroll',
  },
};

const MODULE_ACCESS: Record<string, UserRole[]> = {
  KB:         ['admin', 'hr', 'director', 'projectlead', 'businesshead', 'employee'],
  DASHBOARD:  ['admin', 'hr', 'director', 'projectlead', 'businesshead', 'employee'],
  EMPLOYEES:  ['admin', 'hr'],
  ATS:        ['admin', 'hr', 'director', 'projectlead', 'businesshead'],
  LMS:        ['admin', 'hr', 'director', 'projectlead', 'businesshead', 'employee'],
  ATTENDANCE: ['admin', 'hr', 'director', 'projectlead', 'businesshead', 'employee'],
  PAYROLL:    ['admin', 'hr'],
};

const NAV_ITEMS = [
  { key: 'DASHBOARD',  label: 'Dashboard'       },
  { key: 'EMPLOYEES',  label: 'Employees'       },
  { key: 'ATS',        label: 'ATS'             },
  { key: 'LMS',        label: 'LMS'             },
  { key: 'KB',         label: 'Knowledge Base'  },
  { key: 'ATTENDANCE', label: 'Attendance'      },
  { key: 'PAYROLL',    label: 'Payroll'         },
];

interface Props {
  children: ReactNode;
}

export default function AppLayout({ children }: Props) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  if (!user) return null;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const activeModule = location.pathname === '/dashboard'
    ? 'DASHBOARD'
    : location.pathname.startsWith('/employees')
    ? 'EMPLOYEES'
    : location.pathname.startsWith('/payroll')
    ? 'PAYROLL'
    : location.pathname.startsWith('/attendance')
    ? 'ATTENDANCE'
    : location.pathname.startsWith('/kb')
    ? 'KB'
    : location.pathname.startsWith('/lms')
    ? 'LMS'
    : 'ATS';

  const isSalaryMaster = location.pathname === '/payroll/salary-master';

  const initials = user.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f0f0ec' }}>
      {/* Sidebar */}
      <aside
        style={{
          width: 240,
          minWidth: 240,
          background: '#ffffff',
          borderRight: '1px solid #e5e7eb',
          display: 'flex',
          flexDirection: 'column',
          padding: '24px 0',
          position: 'fixed',
          top: 0,
          left: 0,
          height: '100vh',
        }}
      >
        {/* Logo */}
        <div style={{ padding: '0 20px 28px 20px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 34,
              height: 34,
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="3" width="7" height="7" rx="1" fill="white" />
              <rect x="14" y="3" width="7" height="7" rx="1" fill="white" opacity="0.6" />
              <rect x="3" y="14" width="7" height="7" rx="1" fill="white" opacity="0.6" />
              <rect x="14" y="14" width="7" height="7" rx="1" fill="white" opacity="0.3" />
            </svg>
          </div>
          <span style={{ fontWeight: 700, fontSize: 15, color: '#111827', letterSpacing: '-0.2px' }}>
            PeopleAI HRMS
          </span>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '0 12px' }}>
          <p
            style={{
              fontSize: 10,
              fontWeight: 600,
              color: '#9ca3af',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              margin: '0 8px 8px 8px',
            }}
          >
            Modules
          </p>
          {NAV_ITEMS.filter(({ key }) =>
            MODULE_ACCESS[key]?.includes(user.role)
          ).map(({ key, label }) => {
            const isActive = activeModule === key;
            return (
              <button
                key={key}
                onClick={() => navigate(MODULE_ROUTES[key][user.role])}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: 8,
                  border: 'none',
                  cursor: 'pointer',
                  marginBottom: 2,
                  background: isActive ? '#ede9fe' : 'transparent',
                  color: isActive ? '#6d28d9' : '#4b5563',
                  fontWeight: isActive ? 600 : 500,
                  fontSize: 14,
                  textAlign: 'left',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = '#f9fafb';
                }}
                onMouseLeave={(e) => {
                  if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                }}
              >
                {key === 'DASHBOARD' ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="7" height="7" rx="1" />
                    <rect x="14" y="3" width="7" height="7" rx="1" />
                    <rect x="3" y="14" width="7" height="7" rx="1" />
                    <rect x="14" y="14" width="7" height="7" rx="1" />
                  </svg>
                ) : key === 'EMPLOYEES' ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                ) : key === 'ATTENDANCE' ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                    <polyline points="9 16 11 18 15 14" />
                  </svg>
                ) : key === 'ATS' ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                ) : key === 'PAYROLL' ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="2" y="5" width="20" height="14" rx="2" />
                    <line x1="2" y1="10" x2="22" y2="10" />
                  </svg>
                ) : key === 'KB' ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                    <line x1="8" y1="7" x2="16" y2="7" />
                    <line x1="8" y1="11" x2="16" y2="11" />
                    <line x1="8" y1="15" x2="12" y2="15" />
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
                  </svg>
                )}
                {label}
              </button>
            );
          })}

          {/* Salary Master sub-item — only visible when Payroll section is active */}
          {activeModule === 'PAYROLL' && MODULE_ACCESS['PAYROLL']?.includes(user.role) && (
            <button
              onClick={() => navigate('/payroll/salary-master')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                width: '100%',
                padding: '7px 12px 7px 36px',
                borderRadius: 8,
                border: 'none',
                cursor: 'pointer',
                marginBottom: 2,
                background: isSalaryMaster ? '#ede9fe' : 'transparent',
                color: isSalaryMaster ? '#6d28d9' : '#6b7280',
                fontWeight: isSalaryMaster ? 600 : 400,
                fontSize: 13,
                textAlign: 'left',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => { if (!isSalaryMaster) (e.currentTarget as HTMLButtonElement).style.background = '#f9fafb'; }}
              onMouseLeave={e => { if (!isSalaryMaster) (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="1" x2="12" y2="23" />
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
              Salary Master
            </button>
          )}
        </nav>

        {/* User at bottom */}
        <div
          style={{
            margin: '0 12px',
            padding: '12px',
            borderTop: '1px solid #f3f4f6',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontWeight: 700,
              fontSize: 12,
              flexShrink: 0,
            }}
          >
            {initials}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {user.name}
            </p>
            <p style={{ margin: 0, fontSize: 11, color: '#9ca3af', textTransform: 'capitalize' }}>{user.role}</p>
          </div>
          <button
            onClick={handleLogout}
            title="Sign out"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#9ca3af',
              padding: 4,
              borderRadius: 4,
              display: 'flex',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </div>
      </aside>

      {/* Main area */}
      <div style={{ flex: 1, marginLeft: 240, display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        {/* Top header */}
        <header
          style={{
            height: 60,
            background: '#ffffff',
            borderBottom: '1px solid #e5e7eb',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 28px',
            position: 'sticky',
            top: 0,
            zIndex: 10,
          }}
        >
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: '#111827' }}>
            {activeModule === 'DASHBOARD'   ? 'Dashboard'
            : activeModule === 'EMPLOYEES'  ? 'Employees'
            : activeModule === 'PAYROLL'    ? (isSalaryMaster ? 'Salary Master' : 'Payroll')
            : activeModule === 'ATS'        ? 'Applicant Tracking System'
            : activeModule === 'ATTENDANCE' ? 'Attendance Management'
            : activeModule === 'KB'         ? 'Knowledge Base'
            :                                 'Learning Management System'}
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* Bell */}
            <button
              style={{
                position: 'relative',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: '#6b7280',
                padding: 6,
                borderRadius: 8,
                display: 'flex',
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              <span
                style={{
                  position: 'absolute',
                  top: 4,
                  right: 4,
                  width: 8,
                  height: 8,
                  background: '#ef4444',
                  borderRadius: '50%',
                  border: '2px solid white',
                }}
              />
            </button>
            {/* Avatar */}
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontWeight: 700,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              {initials}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main style={{ flex: 1, padding: 28 }}>{children}</main>
      </div>
    </div>
  );
}
