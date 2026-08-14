import { apiRequest } from './client';

export interface AuthResponse {
  user: { id: string; email: string; role: string; emailVerified?: boolean; emailVerifiedAt?: string | null };
  accessToken: string;
  verificationEmailSent?: boolean;
  verificationEmailError?: string;
  expiresAt?: string;
}

type BackendTokenResponse = {
  access_token?: string;
  accessToken?: string;
  userId: string;
  email?: string;
  role?: string;
  user?: AuthResponse['user'];
  verificationEmailSent?: boolean;
  verificationEmailError?: string;
  expiresAt?: string;
};

type BackendAuthResponse = AuthResponse | BackendTokenResponse;

function isBackendTokenResponse(response: BackendAuthResponse): response is BackendTokenResponse {
  return 'userId' in response || 'access_token' in response;
}

function normalizeAuthResponse(response: BackendAuthResponse, email: string): AuthResponse {
  if (!isBackendTokenResponse(response)) {
    return response;
  }

  const accessToken = response.accessToken ?? response.access_token;
  if (!accessToken) {
    throw new Error('Invalid auth response');
  }

  return {
    accessToken,
    user: {
      id: response.user?.id ?? response.userId,
      email: response.email ?? email,
      role: response.role ?? 'student',
      emailVerified: response.user?.emailVerified ?? false,
      emailVerifiedAt: response.user?.emailVerifiedAt ?? null,
    },
    verificationEmailSent: response.verificationEmailSent,
    verificationEmailError: response.verificationEmailError,
    expiresAt: response.expiresAt,
  };
}

export const authApi = {
  login: (email: string, password: string) =>
    apiRequest<BackendAuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }).then((response) => normalizeAuthResponse(response, email)),
  register: (studentNo: string, email: string, password: string) =>
    apiRequest<BackendAuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ studentNo, email, password }),
    }).then((response) => normalizeAuthResponse(response, email)),
  me: () => apiRequest<{ user: AuthResponse['user'] }>('/auth/me'),
  verifyEmail: (token: string) =>
    apiRequest<{ verified: boolean; emailVerifiedAt: string }>('/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({ token }),
    }),
  resendVerificationEmail: () =>
    apiRequest<{ sent?: boolean; alreadyVerified?: boolean; expiresAt?: string }>('/auth/resend-verification-email', {
      method: 'POST',
    }),
};
