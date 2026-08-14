import { render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { AdminPage } from './AdminPage';

const useAuthMock = vi.fn();

vi.mock('../shared/auth/AuthProvider', () => ({
  useAuth: () => useAuthMock(),
}));

const accountsMock = vi.fn();
const reportsMock = vi.fn();
const appealsMock = vi.fn();
const auditLogsMock = vi.fn();

vi.mock('../shared/api/admin', () => ({
  adminApi: {
    accounts: (...args: unknown[]) => accountsMock(...args),
    reports: (...args: unknown[]) => reportsMock(...args),
    appeals: (...args: unknown[]) => appealsMock(...args),
    auditLogs: (...args: unknown[]) => auditLogsMock(...args),
    resolveReport: vi.fn(),
    resolveAppeal: vi.fn(),
    createAccount: vi.fn(),
    updateAccount: vi.fn(),
    disableAccount: vi.fn(),
    enableAccount: vi.fn(),
    resetPassword: vi.fn(),
    deleteAccount: vi.fn(),
  },
}));

describe('AdminPage', () => {
  beforeEach(() => {
    accountsMock.mockResolvedValue([
      {
        id: 'u-1',
        email: 'testprofile@example.edu',
        studentNo: '20260001',
        role: 'STUDENT',
        status: 'ACTIVE',
        nickname: 'TestProfile',
        college: 'Computer School',
        grade: '2026',
        skills: ['React'],
        availability: [],
      },
    ]);
    reportsMock.mockResolvedValue({
      items: [{ id: 'report-1', targetType: 'TEAM', reason: 'suspected ad', status: 'PENDING' }],
      pagination: { page: 1, pageSize: 10, total: 1, totalPages: 1 },
    });
    appealsMock.mockResolvedValue({ items: [], pagination: { page: 1, pageSize: 10, total: 0, totalPages: 1 } });
    auditLogsMock.mockResolvedValue({ items: [], pagination: { page: 1, pageSize: 10, total: 0, totalPages: 1 } });
  });

  it('shows a permission-denied state for non-admin users', () => {
    useAuthMock.mockReturnValue({ user: { id: 'u-1', email: 'a@b.c', role: 'student' } });
    render(<AdminPage />);
    expect(screen.getByText('权限不足')).toBeInTheDocument();
    expect(accountsMock).not.toHaveBeenCalled();
  });

  it('loads accounts for admin users', async () => {
    useAuthMock.mockReturnValue({ user: { id: 'admin-1', email: 'admin@b.c', role: 'ADMIN' } });
    render(<AdminPage />);
    await waitFor(() => expect(screen.getByText('TestProfile')).toBeInTheDocument());
    expect(accountsMock).toHaveBeenCalled();
  });
});
