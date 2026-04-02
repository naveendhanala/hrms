import { Navigate } from 'react-router-dom';
import { useAuth, ROLE_ROUTES } from '../../context/AuthContext';
import type { UserRole } from '../../types';

interface Props {
  allowedRoles: UserRole[];
  children: React.ReactNode;
}

export default function ProtectedRoute({ allowedRoles, children }: Props) {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!allowedRoles.includes(user.role)) {
    return <Navigate to={ROLE_ROUTES[user.role]} replace />;
  }

  return <>{children}</>;
}
