import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatPage } from './ChatPage';
import type { ChatMessage } from '../shared/api/chat';

const historyMock = vi.fn();
const connectMock = vi.fn();
const sendMock = vi.fn();
let socketHandlers: {
  onMessage: (message: ChatMessage) => void;
  onError: (message: string) => void;
  onReady?: () => void;
};

vi.mock('../shared/auth/AuthProvider', () => ({
  useAuth: () => ({ user: { id: 'u-1', email: 'me@example.edu' } }),
}));

vi.mock('../shared/api/chat', () => ({
  chatApi: {
    history: (...args: unknown[]) => historyMock(...args),
    connect: (...args: unknown[]) => connectMock(...args),
  },
}));

function renderChatPage() {
  return render(
    <MemoryRouter initialEntries={['/chat/team-1']}>
      <Routes>
        <Route path="/chat/:teamId" element={<ChatPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ChatPage', () => {
  beforeEach(() => {
    sendMock.mockReset();
    historyMock.mockResolvedValue([
      {
        id: 'm-1',
        teamId: 'team-1',
        senderId: 'u-2',
        content: '历史消息',
        createdAt: '2026-06-30T08:00:00.000Z',
        sender: { profile: { nickname: 'Alice' } },
      },
    ]);
    connectMock.mockImplementation((_teamId, _userId, handlers) => {
      socketHandlers = handlers as typeof socketHandlers;
      queueMicrotask(() => socketHandlers.onReady?.());
      return { disconnect: vi.fn(), send: sendMock };
    });
  });

  it('keeps messages in chronological order and latest at the bottom', async () => {
    renderChatPage();

    await waitFor(() => expect(screen.getByText('历史消息')).toBeInTheDocument());

    const bubblesBefore = Array.from(document.querySelectorAll('.chat-bubble')).map((node) => node.textContent);
    expect(bubblesBefore).toEqual(['历史消息']);

    await act(async () => {
      socketHandlers.onMessage({
        id: 'm-2',
        teamId: 'team-1',
        senderId: 'u-1',
        content: '今晚同步接口',
        createdAt: '2026-06-30T08:01:00.000Z',
        sender: { profile: { nickname: '我' } },
      });
    });

    await waitFor(() => expect(screen.getByText('今晚同步接口')).toBeInTheDocument());
    const bubblesAfter = Array.from(document.querySelectorAll('.chat-bubble')).map((node) => node.textContent);
    expect(bubblesAfter).toEqual(['历史消息', '今晚同步接口']);
  });

  it('connects to the team room and sends real-time messages', async () => {
    renderChatPage();

    await waitFor(() => expect(connectMock).toHaveBeenCalledWith('team-1', 'u-1', expect.any(Object)));
    await waitFor(() => expect(screen.getByLabelText('群聊消息')).toBeEnabled());
    expect(screen.queryByText('发送待接入')).not.toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('群聊消息'), '今晚同步接口');
    await userEvent.click(screen.getByRole('button', { name: '发送消息' }));

    expect(sendMock).toHaveBeenCalledWith('今晚同步接口');
    expect(screen.getByLabelText('群聊消息')).toHaveValue('');

    await act(async () => {
      socketHandlers.onMessage({
        id: 'm-2',
        teamId: 'team-1',
        senderId: 'u-1',
        content: '今晚同步接口',
        createdAt: '2026-06-30T08:01:00.000Z',
        sender: { profile: { nickname: '我' } },
      });
    });

    await waitFor(() => expect(screen.getByText('今晚同步接口')).toBeInTheDocument());
  });
});
