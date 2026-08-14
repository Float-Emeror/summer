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
});
