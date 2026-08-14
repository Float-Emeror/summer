import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import { NotificationsPage } from './NotificationsPage';

const listMock = vi.fn();
const markReadMock = vi.fn();
const readAllMock = vi.fn();

vi.mock('../shared/api/notifications', () => ({
  notificationsApi: {
    list: (...args: unknown[]) => listMock(...args),
    markRead: (...args: unknown[]) => markReadMock(...args),
    readAll: (...args: unknown[]) => readAllMock(...args),
  },
}));

describe('NotificationsPage', () => {
  beforeEach(() => {
    listMock.mockResolvedValue([
      {
        id: 'n-1',
        type: 'APPLICATION_APPROVED',
        title: '入队申请已通过',
        body: '欢迎加入',
        read: false,
        createdAt: new Date().toISOString(),
      },
    ]);
    markReadMock.mockResolvedValue(undefined);
    readAllMock.mockResolvedValue(undefined);
  });

  it('renders notifications and marks one as read', async () => {
    render(
      <MemoryRouter>
        <NotificationsPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText('入队申请已通过')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: /标记已读/ }));

    await waitFor(() => expect(markReadMock).toHaveBeenCalledWith('n-1'));
    expect(screen.getByText('已读')).toBeInTheDocument();
  });

  it('opens notification details from a list item', async () => {
    render(
      <MemoryRouter>
        <NotificationsPage />
      </MemoryRouter>,
    );

    await userEvent.click(await screen.findByRole('button', { name: /查看通知详情/ }));

    const dialog = screen.getByRole('dialog', { name: '通知详情' });
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText('欢迎加入')).toBeInTheDocument();
  });
});
