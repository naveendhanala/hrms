import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { AuthUser, UserRole } from '../types';

export const ROLE_ROUTES: Record<UserRole, string> = {
  admin: '/dashboard',
  hr: '/dashboard',
  director: '/dashboard',
  projectlead: '/dashboard',
  businesshead: '/dashboard',
  employee: '/dashboard',
  vp_hr: '/employees',
};

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  login: (token: string, user: AuthUser) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('hrms_token'));
  const [user, setUser] = useState<AuthUser | null>(() => {
    const stored = localStorage.getItem('hrms_user');
    return stored ? JSON.parse(stored) : null;
  });

  useEffect(() => {
    if (token) {
      localStorage.setItem('hrms_token', token);
    } else {
      localStorage.removeItem('hrms_token');
    }
  }, [token]);

  useEffect(() => {
    if (user) {
      localStorage.setItem('hrms_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('hrms_user');
    }
  }, [user]);

  const login = (newToken: string, newUser: AuthUser) => {
    setToken(newToken);
    setUser(newUser);
  };

  const logout = () => {
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
