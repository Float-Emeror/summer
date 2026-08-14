import type { AuthResponse } from '../api/auth';

const sessionKey = 'campus.auth.session';

function readJson<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

export const authCache = {
  getSession() {
    const session = readJson<AuthResponse | null>(sessionKey, null);
    if (!session?.accessToken) {
      if (session) {
        authCache.clearSession();
      }
      return null;
    }
    if (session.accessToken.startsWith('demo.')) {
      authCache.clearSession();
      return null;
    }
    return session;
  },

  saveSession(session: AuthResponse) {
    localStorage.setItem(sessionKey, JSON.stringify(session));
    localStorage.setItem('accessToken', session.accessToken);
  },

  clearSession() {
    localStorage.removeItem(sessionKey);
    localStorage.removeItem('accessToken');
  },
};
