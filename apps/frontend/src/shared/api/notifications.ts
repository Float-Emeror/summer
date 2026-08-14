import { NotificationItem } from '../types/domain';
import { apiRequest } from './client';

export type NotificationQuery = {
  page?: number;
  unreadOnly?: boolean;
};

function normalize(item: any): NotificationItem {
  return {
    id: item.id ?? '',
    type: item.type ?? 'SYSTEM',
    title: item.title ?? '系统通知',
    body: item.body ?? item.content ?? null,
    read: typeof item.read === 'boolean' ? item.read : item.readAt != null,
    metadata: item.metadata ?? null,
    createdAt: item.createdAt,
  };
}

// 后端 GET /notifications 可能返回数组，也可能返回 { data: [], ... } 分页对象。
function extractList(payload: any): any[] {
  if (Array.isArray(payload)) {
    return payload;
  }
  if (payload && Array.isArray(payload.data)) {
    return payload.data;
  }
  if (payload && Array.isArray(payload.items)) {
    return payload.items;
  }
  return [];
}

export const notificationsApi = {
  list: (query: NotificationQuery = {}) => {
    const search = new URLSearchParams();
    if (query.page) {
      search.set('page', String(query.page));
    }
    if (query.unreadOnly) {
      search.set('unreadOnly', 'true');
    }
    const suffix = search.size > 0 ? `?${search.toString()}` : '';
    return apiRequest<any>(`/notifications${suffix}`).then((payload) => extractList(payload).map(normalize));
  },
  markRead: (id: string) => apiRequest(`/notifications/${id}/read`, { method: 'PATCH' }),
  readAll: () => apiRequest('/notifications/read-all', { method: 'PATCH' }),
};
