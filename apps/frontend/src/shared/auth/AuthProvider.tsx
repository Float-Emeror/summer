import { ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authApi, type AuthResponse } from '../api/auth';
import { ApiError } from '../api/client';
import { authCache } from './authCache';

type AuthUser = AuthResponse['user'];

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (studentNo: string, email: string, password: string) => Promise<AuthResponse>;
  refreshMe: () => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthResponse | null>(() => authCache.getSession());

  const commitSession = useCallback((nextSession: AuthResponse) => {
    authCache.saveSession(nextSession);
    setSession(nextSession);
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      commitSession(await authApi.login(email, password));
    },
    [commitSession],
  );

  const register = useCallback(async (studentNo: string, email: string, password: string) => {
    return authApi.register(studentNo, email, password);
  }, []);

  const refreshMe = useCallback(async () => {
    if (!session?.accessToken) {
      return;
    }
    try {
      const current = await authApi.me();
      commitSession({
        ...session,
        user: current.user,
      });
    } catch (error) {
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
        authCache.clearSession();
        setSession(null);
        return;
      }
      throw error;
    }
  }, [commitSession, session]);

  useEffect(() => {
    const accessToken = session?.accessToken;
    if (!accessToken || accessToken.startsWith('demo.')) {
      return;
    }

    let cancelled = false;
    authApi.me()
      .then((current) => {
        if (cancelled) return;
        setSession((previous) => {
          if (!previous || previous.accessToken !== accessToken) return previous;
          const nextSession = { ...previous, user: current.user };
          authCache.saveSession(nextSession);
          return nextSession;
        });
      })
      .catch((error) => {
        if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
          authCache.clearSession();
          setSession(null);
          return;
        }
      });

    return () => {
      cancelled = true;
    };
  }, [session?.accessToken]);

  const logout = useCallback(() => {
    authCache.clearSession();
    setSession(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: session?.user ?? null,
      isAuthenticated: Boolean(session?.accessToken),
      login,
      register,
      refreshMe,
      logout,
    }),
    [login, logout, refreshMe, register, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
