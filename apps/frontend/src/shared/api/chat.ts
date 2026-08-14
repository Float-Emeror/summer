import { apiRequest } from './client';
import { getAccessToken } from './session';

export type ChatMessage = {
  id: string;
  teamId?: string;
  senderId?: string;
  content: string;
  createdAt?: string;
  sender?: {
    email?: string;
    profile?: {
      nickname?: string;
    };
  };
};

export type ChatSocket = {
  disconnect: () => void;
  send: (content: string) => void;
};

type SocketLike = {
  id?: string;
  disconnect: () => void;
  emit: (event: string, payload: Record<string, unknown>) => void;
  on: (event: string, handler: (...args: any[]) => void) => void;
};

type SocketIOGlobal = {
  io?: (url: string, options: Record<string, unknown>) => SocketLike;
};

type SocketIOFactory = NonNullable<SocketIOGlobal['io']>;

declare global {
  interface Window {
    io?: SocketIOGlobal['io'];
  }
}

let socketClientPromise: Promise<SocketIOFactory> | null = null;

function normalizeMessage(message: any): ChatMessage {
  return {
    id: message.id ?? `${message.senderId ?? 'unknown'}-${message.createdAt ?? message.content}`,
    teamId: message.teamId,
    senderId: message.senderId,
    content: message.content ?? '',
    createdAt: message.createdAt,
    sender: message.sender,
  };
}

function socketBaseURL() {
  const DEFAULT_WS_BASE_URL = 'ws://localhost:3000';
  const configured = import.meta.env.VITE_WS_BASE_URL ?? import.meta.env.VITE_API_BASE_URL ?? DEFAULT_WS_BASE_URL;
  return configured
    .replace(/^ws:\/\//, 'http://')
    .replace(/^wss:\/\//, 'https://')
    .replace(/\/api\/?$/, '')
    .replace(/\/$/, '');
}

function isSocketIOFactory(value: unknown): value is SocketIOFactory {
  return typeof value === 'function';
}

function loadSocketClient(): Promise<SocketIOFactory> {
  if (window.io) return Promise.resolve(window.io);
  if (socketClientPromise) return socketClientPromise;

  socketClientPromise = new Promise<SocketIOFactory>((resolve, reject) => {
    const resolveClient = () => {
      if (isSocketIOFactory(window.io)) {
        resolve(window.io);
        return;
      }
      reject(new Error('聊天服务连接失败'));
    };
    const existing = document.querySelector<HTMLScriptElement>('script[data-socket-io-client]');
    if (existing) {
      existing.addEventListener('load', resolveClient, { once: true });
      existing.addEventListener('error', () => reject(new Error('聊天服务连接失败')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = '/node_modules/socket.io-client/dist/socket.io.js';
    script.async = true;
    script.dataset.socketIoClient = 'true';
    script.onload = resolveClient;
    script.onerror = () => reject(new Error('聊天服务连接失败'));
    document.head.appendChild(script);
  });

  return socketClientPromise;
}

export const chatApi = {
  history: (teamId: string, page = 1) =>
    apiRequest<any[]>(`/teams/${teamId}/messages?page=${page}`).then((items) => (items ?? []).map(normalizeMessage)),

  connect: (
    teamId: string,
    userId: string,
    handlers: { onMessage: (message: ChatMessage) => void; onError: (message: string) => void; onReady?: () => void },
  ): ChatSocket => {
    const token = getAccessToken();
    if (!token) {
      window.queueMicrotask(() => handlers.onError('尚未登录或 Token 已过期，请重新登录'));
      return {
        disconnect: () => undefined,
        send: () => undefined,
      };
    }

    let socket: SocketLike | null = null;
    let cancelled = false;

    void loadSocketClient()
      .then((io) => {
        if (cancelled) return;

        socket = io(`${socketBaseURL()}/chat`, {
          query: { userId },
          transports: ['websocket', 'polling'],
          auth: { token },
        }) as SocketLike;

        socket.on('connect', () => {
          socket?.emit('join_room', { teamId });
        });

        socket.on('room_joined', (payload: { teamId?: string }) => {
          if (!payload.teamId || payload.teamId === teamId) {
            handlers.onReady?.();
          }
        });

        socket.on('receive_message', (message) => {
          handlers.onMessage(normalizeMessage(message));
        });

        socket.on('connect_error', (error) => {
          handlers.onError(error.message || '聊天服务连接失败');
        });

        socket.on('error', (payload: { message?: string } | string) => {
          handlers.onError(typeof payload === 'string' ? payload : payload.message ?? '聊天服务暂时不可用');
        });
      })
      .catch((error) => {
        if (cancelled) return;
        handlers.onError(error instanceof Error ? error.message : '聊天服务连接失败');
      });

    return {
      disconnect: () => {
        cancelled = true;
        socket?.disconnect();
        socket = null;
      },
      send: (content: string) => socket?.emit('send_message', { teamId, content }),
    };
  },
};
