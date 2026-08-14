import { AdminAccount, AdminAppeal, AdminAuditLog, AdminReport } from '../types/domain';
import { apiRequest } from './client';

export type Pagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type PagedResult<T> = {
  items: T[];
  pagination: Pagination;
};

type AdminListQuery = {
  page?: number;
  pageSize?: number;
  status?: string;
};

export type AccountPayload = {
  email: string;
  studentNo: string;
  password?: string;
  role: 'STUDENT' | 'ADMIN';
  status?: 'ACTIVE' | 'DISABLED';
  nickname: string;
  college?: string;
  grade?: string;
  skills?: string[];
  availability?: Array<{ weekday: number; startTime: string; endTime: string }>;
};

export const adminApi = {
  reports: (query: AdminListQuery = {}) => apiRequest<PagedResult<AdminReport>>(`/admin/reports${queryString(query)}`).then(normalizePaged),
  resolveReport: (id: string, resolution: string) =>
    apiRequest<{ id: string; status: string; resolution: string }>(`/admin/reports/${id}/resolve`, {
      method: 'POST',
      body: JSON.stringify({ resolution }),
    }),
  appeals: (query: AdminListQuery = {}) => apiRequest<PagedResult<AdminAppeal>>(`/admin/appeals${queryString(query)}`).then(normalizePaged),
  resolveAppeal: (id: string, decision: string) =>
    apiRequest<{ id: string; status: string; decision: string }>(`/admin/appeals/${id}/resolve`, {
      method: 'POST',
      body: JSON.stringify({ decision }),
    }),
  auditLogs: (query: AdminListQuery = {}) => apiRequest<PagedResult<AdminAuditLog>>(`/admin/audit-logs${queryString(query)}`).then(normalizePaged),
  accounts: () => apiRequest<AdminAccount[]>('/admin/accounts'),
  createAccount: (payload: AccountPayload & { password: string }) =>
    apiRequest<AdminAccount>('/admin/accounts', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateAccount: (id: string, payload: AccountPayload) =>
    apiRequest<AdminAccount>(`/admin/accounts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  disableAccount: (id: string, reason: string) =>
    apiRequest<AdminAccount>(`/admin/accounts/${id}/disable`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),
  enableAccount: (id: string) => apiRequest<AdminAccount>(`/admin/accounts/${id}/enable`, { method: 'POST' }),
  resetPassword: (id: string, password: string) =>
    apiRequest<AdminAccount>(`/admin/accounts/${id}/reset-password`, {
      method: 'POST',
      body: JSON.stringify({ password }),
    }),
  deleteAccount: (id: string) => apiRequest<{ success: boolean }>(`/admin/accounts/${id}`, { method: 'DELETE' }),
};

function queryString(query: AdminListQuery) {
  const search = new URLSearchParams();
  if (query.page) search.set('page', String(query.page));
  if (query.pageSize) search.set('pageSize', String(query.pageSize));
  if (query.status) search.set('status', query.status);
  return search.size > 0 ? `?${search.toString()}` : '';
}

function normalizePaged<T>(response: PagedResult<T> | T[]): PagedResult<T> {
  if (Array.isArray(response)) {
    return {
      items: response,
      pagination: { page: 1, pageSize: response.length || 20, total: response.length, totalPages: 1 },
    };
  }
  return response;
}
