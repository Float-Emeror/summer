const DEFAULT_API_BASE_URL = 'http://localhost:3000/api';

const configuredBaseURL = import.meta.env.VITE_API_BASE_URL;
const baseURL =
  typeof configuredBaseURL === 'string' && configuredBaseURL.trim().length > 0
    ? configuredBaseURL.replace(/\/+$/, '')
    : DEFAULT_API_BASE_URL;

const configuredTimeout = Number(import.meta.env.VITE_API_TIMEOUT_MS);
const requestTimeoutMs = Number.isFinite(configuredTimeout) && configuredTimeout > 0 ? configuredTimeout : 75000;

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('accessToken');
  const requestURL = `${baseURL}${path}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), requestTimeoutMs);

  let response: Response;
  try {
    response = await fetch(`${baseURL}${path}`, {
      ...options,
      signal: options.signal ?? controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ApiError(`请求超时（>${Math.round(requestTimeoutMs / 1000)}s）：${requestURL}`, 408);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const message = await readErrorMessage(response);
    throw new ApiError(message || 'Request failed', response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const payload = await readSuccessPayload(response, requestURL);
  return unwrapPayload<T>(payload);
}

async function readSuccessPayload(response: Response, requestURL: string) {
  const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
  const text = await response.text();
  if (!text) {
    return {};
  }

  if (contentType.includes('application/json')) {
    return JSON.parse(text) as unknown;
  }

  const preview = text.slice(0, 120).trim().toLowerCase();
  if (preview.startsWith('<!doctype') || preview.startsWith('<html')) {
    throw new ApiError(
      `接口返回了 HTML 而不是 JSON（${requestURL}）。请检查 VITE_API_BASE_URL 与后端服务是否正确。`,
      response.status,
    );
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new ApiError(`接口返回了无法解析的数据（${requestURL}）。`, response.status);
  }
}

function unwrapPayload<T>(payload: unknown): T {
  if (
    payload &&
    typeof payload === 'object' &&
    'success' in payload &&
    'data' in payload &&
    (payload as { success?: unknown }).success !== false
  ) {
    return (payload as { data: T }).data;
  }

  return payload as T;
}

async function readErrorMessage(response: Response) {
  const text = await response.text();
  if (!text) {
    return '';
  }

  const preview = text.slice(0, 120).trim().toLowerCase();
  if (preview.startsWith('<!doctype') || preview.startsWith('<html')) {
    return '接口返回了 HTML 页面而不是 JSON，请检查前端 API 地址配置或后端服务状态。';
  }

  try {
    const payload = JSON.parse(text) as {
      message?: string | string[] | { code?: string; message?: string };
      code?: string;
      error?: { message?: string | string[] | { code?: string; message?: string }; code?: string };
    };
    const rawMessage = payload.error?.message ?? payload.message;
    const code =
      payload.error?.code ??
      payload.code ??
      (rawMessage && typeof rawMessage === 'object' && !Array.isArray(rawMessage) ? rawMessage.code : undefined);
    if (code === 'EMAIL_VERIFICATION_REQUIRED') {
      return '请先验证邮箱后再进行该操作。';
    }
    const message = rawMessage && typeof rawMessage === 'object' && !Array.isArray(rawMessage) ? rawMessage.message : rawMessage;
    return Array.isArray(message) ? message.join('；') : message ?? text;
  } catch {
    return text;
  }
}
