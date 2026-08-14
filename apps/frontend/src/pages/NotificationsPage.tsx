import { KeyboardEvent, ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bell,
  CheckCheck,
  ClipboardCheck,
  Coins,
  Loader2,
  MessageSquare,
  ShieldCheck,
  Sparkles,
  Star,
  UsersRound,
} from 'lucide-react';
import { PageHero } from '../shared/components/PageHero';
import { DataState } from '../shared/components/DataState';
import { SegmentedTab, SegmentedTabs } from '../shared/components/SegmentedTabs';
import { EmptyState } from '../shared/components/EmptyState';
import { AppModal } from '../shared/components/AppModal';
import { notificationsApi } from '../shared/api/notifications';
import { ApiError } from '../shared/api/client';
import { isDemoSession } from '../shared/api/session';
import { NotificationItem } from '../shared/types/domain';

type NotificationFilter = 'ALL' | 'UNREAD';

const filterTabs: SegmentedTab<NotificationFilter>[] = [
  { value: 'ALL', label: '全部' },
  { value: 'UNREAD', label: '未读' },
];

const typeIcons: Record<string, ReactNode> = {
  APPLICATION_APPROVED: <UsersRound size={20} />,
  TASK_ASSIGNED: <ClipboardCheck size={20} />,
  TASK_COMPLETED: <CheckCheck size={20} />,
  REVIEW_CREATED: <Star size={20} />,
  CREDIT_UPDATED: <Coins size={20} />,
  BOUNTY_ACCEPTED: <Sparkles size={20} />,
  MESSAGE_MENTIONED: <MessageSquare size={20} />,
  SYSTEM: <ShieldCheck size={20} />,
};

const typeLabels: Record<string, string> = {
  APPLICATION_APPROVED: '入队通过',
  TASK_ASSIGNED: '任务分配',
  TASK_COMPLETED: '任务完成',
  REVIEW_CREATED: '新评价',
  CREDIT_UPDATED: '信用变动',
  BOUNTY_ACCEPTED: '悬赏接单',
  MESSAGE_MENTIONED: '提及消息',
};

const demoNotifications: NotificationItem[] = [
  {
    id: 'demo-n-1',
    type: 'APPLICATION_APPROVED',
    title: '你的入队申请已通过',
    body: '软件工程课程项目组队欢迎你加入',
    read: false,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'demo-n-2',
    type: 'TASK_ASSIGNED',
    title: '你被分配了新任务',
    body: '需求评审需要在今晚前完成',
    read: true,
    createdAt: new Date(Date.now() - 3600_000).toISOString(),
  },
];

function formatTime(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const now = Date.now();
  const diff = now - date.getTime();
  if (diff < 60_000) return '刚刚';
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3600_000)} 小时前`;
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

export function NotificationsPage() {
  const [filter, setFilter] = useState<NotificationFilter>('ALL');
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [message, setMessage] = useState('');
  const [demo] = useState(() => isDemoSession());
  const [busyId, setBusyId] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [detailItem, setDetailItem] = useState<NotificationItem | null>(null);

  const load = useCallback(async (targetPage = 1, append = false) => {
    if (append) {
      setIsLoadingMore(true);
    } else {
      setIsLoading(true);
    }
    setMessage('');
    if (demo) {
      setItems(demoNotifications);
      setPage(1);
      setHasMore(false);
      setIsLoading(false);
      setIsLoadingMore(false);
      return;
    }
    try {
      const nextItems = await notificationsApi.list({ page: targetPage });
      setItems((current) => (append ? [...current, ...nextItems.filter((item) => !current.some((existing) => existing.id === item.id))] : nextItems));
      setPage(targetPage);
      setHasMore(nextItems.length > 0);
    } catch (error) {
      const reason = error instanceof ApiError
        ? (error.status === 401 ? '登录状态已失效，请重新登录后再读取通知。' : error.message)
        : '无法读取通知';
      setMessage(`读取通知失败：${reason}`);
      if (!append) {
        setItems([]);
      }
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [demo]);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(
    () => (filter === 'UNREAD' ? items.filter((item) => !item.read) : items),
    [filter, items],
  );
  const unreadCount = useMemo(() => items.filter((item) => !item.read).length, [items]);

  function guardWrite() {
    if (demo) {
      setMessage('检测到旧演示会话，标记已读需要重新使用真实后端账号登录。');
      return false;
    }
    return true;
  }

  async function markRead(item: NotificationItem) {
    if (item.read) return;
    if (!guardWrite()) return;
    setBusyId(item.id);
    try {
      await notificationsApi.markRead(item.id);
      setItems((current) => current.map((it) => (it.id === item.id ? { ...it, read: true } : it)));
    } catch (error) {
      const reason = error instanceof ApiError ? error.message : '操作失败';
      setMessage(`标记已读失败：${reason}`);
    } finally {
      setBusyId('');
    }
  }

  function openDetail(item: NotificationItem) {
    setDetailItem(item);
  }

  function handleCardKeyDown(event: KeyboardEvent<HTMLElement>, item: NotificationItem) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    openDetail(item);
  }

  async function markAll() {
    if (!guardWrite()) return;
    if (unreadCount === 0) return;
    setMessage('');
    try {
      await notificationsApi.readAll();
      setItems((current) => current.map((it) => ({ ...it, read: true })));
    } catch (error) {
      const reason = error instanceof ApiError ? error.message : '操作失败';
      setMessage(`全部已读失败：${reason}`);
    }
  }

  return (
    <section className="notification-page market-page">
      <PageHero
        icon={<Bell size={16} />}
        eyebrow="通知中心"
        title="最近动态"
        description="队伍申请、任务分配和系统提醒都会集中显示在这里。"
        actions={(
          <button onClick={markAll} disabled={unreadCount === 0} type="button" aria-label="全部已读" title="全部已读">
            <CheckCheck size={18} />
            {unreadCount > 0 ? unreadCount : null}
          </button>
        )}
      />

      <SegmentedTabs activeValue={filter} ariaLabel="通知筛选" onChange={setFilter} tabs={filterTabs} />

      {message && <DataState tone="error">{message}</DataState>}
      {demo && !message && <DataState tone="info">检测到旧演示会话，通知仅展示示例数据。</DataState>}

      {isLoading ? (
        <DataState tone="loading">正在读取通知...</DataState>
      ) : visible.length === 0 ? (
        <EmptyState
          compact
          icon={<Bell size={24} />}
          title={filter === 'UNREAD' ? '没有未读通知' : '还没有通知'}
          description="队伍申请、任务分配和系统提醒会集中出现在这里。"
          primaryAction={
            <button type="button" className="button-link secondary icon-only" onClick={() => void load()} aria-label="刷新通知" title="刷新通知">
              <Loader2 size={16} />
            </button>
          }
        />
      ) : (
        <div className="notification-list">
          {visible.map((item) => (
            <article
              className={item.read ? 'notification-card read' : 'notification-card'}
              key={item.id}
              role="button"
              tabIndex={0}
              aria-label={`查看通知详情：${item.title}`}
              onClick={() => openDetail(item)}
              onKeyDown={(event) => handleCardKeyDown(event, item)}
            >
              {!item.read && <span className="notification-unread-bar" aria-hidden="true" />}
              <div className="notification-icon">{typeIcons[item.type] ?? typeIcons.SYSTEM}</div>
              <div className="notification-main">
                <div className="notification-head">
                  <h2>{item.title}</h2>
                  {typeLabels[item.type] && <span className="team-type">{typeLabels[item.type]}</span>}
                </div>
                {item.body && <p>{item.body}</p>}
              </div>
              <div className="notification-aside">
                <small>{formatTime(item.createdAt)}</small>
                {item.read ? (
                  <span className="muted">已读</span>
                ) : (
                  <button
                    type="button"
                    className="notification-read-btn"
                    disabled={busyId === item.id}
                    aria-label={`标记已读：${item.title}`}
                    title="标记已读"
                    onClick={(event) => {
                      event.stopPropagation();
                      void markRead(item);
                    }}
                  >
                    {busyId === item.id ? <Loader2 size={14} className="spin-icon" /> : <CheckCheck size={14} />}
                  </button>
                )}
              </div>
            </article>
          ))}
          {hasMore && filter === 'ALL' && (
            <button
              type="button"
              className="notification-load-more button-link secondary"
              disabled={isLoadingMore}
              onClick={() => void load(page + 1, true)}
              aria-label="加载更多通知"
              title="加载更多通知"
            >
              {isLoadingMore ? <Loader2 size={16} className="spin-icon" /> : null}
              {isLoadingMore ? '加载中' : '加载更多通知'}
            </button>
          )}
        </div>
      )}

      <AppModal
        open={Boolean(detailItem)}
        title="通知详情"
        className="notification-detail-modal"
        onClose={() => setDetailItem(null)}
        footer={
          detailItem && !detailItem.read ? (
            <button
              type="button"
              className="match-primary-btn"
              disabled={busyId === detailItem.id}
              onClick={() => void markRead(detailItem)}
            >
              {busyId === detailItem.id ? <Loader2 size={15} className="spin-icon" /> : <CheckCheck size={15} />}
              标记已读
            </button>
          ) : null
        }
      >
        {detailItem && (
          <div className="notification-detail">
            <div className="notification-detail-top">
              <span className="notification-detail-icon">{typeIcons[detailItem.type] ?? typeIcons.SYSTEM}</span>
              <div>
                <h3>{detailItem.title}</h3>
                <p>
                  <span>{typeLabels[detailItem.type] ?? '系统通知'}</span>
                  {detailItem.createdAt && <span>{formatTime(detailItem.createdAt)}</span>}
                  <span>{detailItem.read ? '已读' : '未读'}</span>
                </p>
              </div>
            </div>
            <div className="notification-detail-body">
              {detailItem.body || '这条通知暂时没有更多正文内容。'}
            </div>
            {detailItem.metadata && Object.keys(detailItem.metadata).length > 0 && (
              <dl className="notification-detail-meta">
                {Object.entries(detailItem.metadata).map(([key, value]) => (
                  <div key={key}>
                    <dt>{key}</dt>
                    <dd>{typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' ? String(value) : JSON.stringify(value)}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        )}
      </AppModal>
    </section>
  );
}
