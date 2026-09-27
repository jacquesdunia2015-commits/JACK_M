import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, getToken, setToken, setUnauthorizedHandler } from './api';

export interface User {
  id: number;
  email: string;
  fullName: string;
  phone: string | null;
  role: 'bailleur' | 'locataire' | 'admin';
  plan: 'starter' | 'pro' | 'enterprise';
  locale: string;
  country: string | null;
  currency: string;
  planInfo: { label: string; maxProperties: number | null; maxTenants: number | null; price: string };
}

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (data: { email: string; password: string; fullName: string; phone?: string; locale?: string; country?: string | null; currency?: string }) => Promise<User>;
  logout: () => void;
  setUser: (u: User) => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(!!getToken());

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(logout);
    if (!getToken()) return;
    api<{ user: User }>('/auth/me')
      .then((r) => setUser(r.user))
      .catch(logout)
      .finally(() => setLoading(false));
  }, [logout]);

  const login = async (email: string, password: string) => {
    const r = await api<{ token: string; user: User }>('/auth/login', { method: 'POST', body: { email, password } });
    setToken(r.token);
    setUser(r.user);
    return r.user;
  };
  const register = async (data: { email: string; password: string; fullName: string; phone?: string; locale?: string; country?: string | null; currency?: string }) => {
    const r = await api<{ token: string; user: User }>('/auth/register', { method: 'POST', body: data });
    setToken(r.token);
    setUser(r.user);
    return r.user;
  };

  return <AuthContext.Provider value={{ user, loading, login, register, logout, setUser }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth hors de AuthProvider');
  return ctx;
}
