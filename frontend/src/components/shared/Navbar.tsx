import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth, ROLE_ROUTES } from '../../context/AuthContext';
import type { UserRole } from '../../types';

const MODULE_ACCESS: Record<string, UserRole[]> = {
  ATS: ['admin', 'hr', 'director', 'projectlead', 'businesshead'],
  LMS: ['admin', 'hr', 'director', 'projectlead', 'businesshead', 'employee'],
};

const MODULE_ROUTES: Record<string, Record<UserRole, string>> = {
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
    hr: '/lms',
    director: '/lms',
    projectlead: '/lms',
    businesshead: '/lms',
    employee: '/lms',
  } as Record<UserRole, string>,
};

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  if (!user) return null;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const activeModule = location.pathname.startsWith('/lms') ? 'LMS' : 'ATS';

  const visibleModules = Object.entries(MODULE_ACCESS)
    .filter(([, roles]) => roles.includes(user.role))
    .map(([mod]) => mod);

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">HR</span>
              </div>
              <span className="font-bold text-xl text-gray-900">HRMS</span>
            </div>

            <div className="flex gap-1">
              {visibleModules.map((mod) => (
                <button
                  key={mod}
                  onClick={() => navigate(MODULE_ROUTES[mod][user.role])}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    activeModule === mod
                      ? 'bg-indigo-100 text-indigo-700'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  {mod}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800 capitalize">
              {user.role}
            </span>
            <span className="text-sm text-gray-700">{user.name}</span>
            <button
              onClick={handleLogout}
              className="text-sm text-gray-500 hover:text-gray-700 font-medium"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
