import { beforeEach, describe, expect, it } from 'vitest';
import { authCache } from './authCache';

const session = {
  accessToken: 'jwt.token',
  user: { id: 'u-1', email: 'user@example.edu', role: 'STUDENT' },
};

describe('authCache', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('saves, reads and clears backend sessions', () => {
    authCache.saveSession(session);

    expect(authCache.getSession()).toEqual(session);
    expect(localStorage.getItem('accessToken')).toBe('jwt.token');

    authCache.clearSession();

    expect(authCache.getSession()).toBeNull();
    expect(localStorage.getItem('accessToken')).toBeNull();
  });

  it('drops legacy demo sessions instead of returning them', () => {
    localStorage.setItem('campus.auth.session', JSON.stringify({ ...session, accessToken: 'demo.legacy' }));
    localStorage.setItem('accessToken', 'demo.legacy');

    expect(authCache.getSession()).toBeNull();
    expect(localStorage.getItem('accessToken')).toBeNull();
  });

  it('synchronizes a stale standalone access token with the session', () => {
    localStorage.setItem('campus.auth.session', JSON.stringify(session));
    localStorage.setItem('accessToken', 'expired-or-other-session-token');

    expect(authCache.getSession()).toEqual(session);
    expect(localStorage.getItem('accessToken')).toBe(session.accessToken);
  });

  it('clears a standalone token when no session exists', () => {
    localStorage.setItem('accessToken', 'expired-token');

    expect(authCache.getSession()).toBeNull();
    expect(localStorage.getItem('accessToken')).toBeNull();
  });
});
