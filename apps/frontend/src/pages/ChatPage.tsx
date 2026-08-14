import { FormEvent, useEffect, useRef, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { Send, UsersRound } from 'lucide-react';
import { DataState } from '../shared/components/DataState';
import { chatApi, ChatMessage } from '../shared/api/chat';
import { ApiError } from '../shared/api/client';
import { useAuth } from '../shared/auth/AuthProvider';
import type { TeamDisplay } from '../shared/data/mockTeams';

function sortMessagesAscending(messages: ChatMessage[]) {
  return [...messages].sort((left, right) => {
    const leftTime = left.createdAt ? new Date(left.createdAt).getTime() : 0;
    const rightTime = right.createdAt ? new Date(right.createdAt).getTime() : 0;
    return leftTime - rightTime;
  });
}

function mergeMessages(current: ChatMessage[], incoming: ChatMessage[]) {
  const byId = new Map<string, ChatMessage>();
  for (const message of [...current, ...incoming]) {
    byId.set(message.id, message);
  }
  return sortMessagesAscending(Array.from(byId.values()));
}

export function ChatPage() {
  const { teamId } = useParams();
  const [teams, setTeams] = useState<TeamDisplay[]>([]);
  const [teamsLoading, setTeamsLoading] = useState(true);
  const { user } = useAuth();
  const navigate = useNavigate();
  const chatSocketRef = useRef<ReturnType<typeof chatApi.connect> | null>(null);
  const chatPanelRef = useRef<HTMLDivElement | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(Boolean(teamId));
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
  const activeTeam = teams.find((item) => item.id === teamId) ?? null;
  const canSend = Boolean(teamId && isConnected && chatSocketRef.current);
  const emptyDemoMembers = [
    { name: 'TestAdmin', initial: 'T', tone: 'light', self: false },
    { name: 'TestAdmin', initial: 'T', tone: 'light', self: false },
    { name: '111111', initial: 'T', tone: 'dark', self: true },
  ];

  useEffect(() => {
    let cancelled = false;
    setTeamsLoading(true);
    import('../shared/api/teams').then(({ teamsApi }) =>
      teamsApi
        .mine()
        .then((items) => {
          if (!cancelled) {
            setTeams(items as any);
            // 若当前未选中队伍，自动选中第一项以直接进入聊天
            if (!teamId && items && items.length > 0) {
              navigate(`/chat/${items[0].id}`);
            }
          }
        })
        .catch(() => {
          if (!cancelled) setTeams([]);
        })
        .finally(() => {
          if (!cancelled) setTeamsLoading(false);
        })
    );

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const panel = chatPanelRef.current;
    if (!panel) return;
    panel.scrollTop = panel.scrollHeight;
  }, [teamId, messages.length]);

  useEffect(() => {
    chatSocketRef.current?.disconnect();
    chatSocketRef.current = null;
    setIsConnected(false);
    setAccessDenied(false);

    if (!teamId) {
      setIsLoading(false);
      setMessages([]);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError('');
    setPage(1);
    setHasMore(false);
    chatApi
      .history(teamId, 1)
      .then((items) => {
        if (!cancelled) {
          const ordered = sortMessagesAscending(items);
          setMessages(ordered);
          setHasMore(items.length > 0);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          const reason = err instanceof ApiError ? err.message : '无法读取聊天记录';
          setError(reason);
          setAccessDenied(reason.includes('成员') || reason.includes('无权'));
          setMessages([]);
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
      chatSocketRef.current?.disconnect();
      chatSocketRef.current = null;
    };
  }, [teamId]);

  useEffect(() => {
    chatSocketRef.current?.disconnect();
    chatSocketRef.current = null;
    setIsConnected(false);

    if (!teamId || !user?.id || isLoading || accessDenied || error) return;

    let cancelled = false;
    chatSocketRef.current = chatApi.connect(teamId, user.id, {
      onReady: () => {
        if (!cancelled) setIsConnected(true);
      },
      onMessage: (message) => {
        if (!cancelled) setMessages((current) => mergeMessages(current, [message]));
      },
      onError: (message) => {
        if (!cancelled) {
          setIsConnected(false);
          setError(message);
          setAccessDenied(message.includes('成员') || message.includes('无权'));
        }
      },
    });

    return () => {
      cancelled = true;
      chatSocketRef.current?.disconnect();
      chatSocketRef.current = null;
    };
  }, [accessDenied, error, isLoading, teamId, user?.id]);

  async function loadEarlierMessages() {
    if (!teamId || isLoadingMore) return;
    setIsLoadingMore(true);
    setError('');
    try {
      const nextPage = page + 1;
      const earlier = sortMessagesAscending(await chatApi.history(teamId, nextPage));
      setMessages((current) => mergeMessages(earlier, current));
      setPage(nextPage);
      setHasMore(earlier.length > 0);
    } catch (err) {
      const reason = err instanceof ApiError ? err.message : '无法读取更早的聊天记录';
      setError(reason);
    } finally {
      setIsLoadingMore(false);
    }
  }

  function sendMessage(event: FormEvent) {
    event.preventDefault();
    const content = draft.trim();
    if (!teamId || !content || !isConnected || !chatSocketRef.current) return;
    setError('');
    chatSocketRef.current.send(content);
    setDraft('');
  }

  return (
    <section className="chat-page">
      <div className="chat-layout">
        <aside className="team-sidebar polished">
          <div className="team-sidebar-header">
            <strong>我的队伍</strong>
            <small>选择一支队伍进入群聊</small>
          </div>
          <div className="team-list">
            {teamsLoading ? (
              <div className="team-list-loading">正在加载队伍…</div>
            ) : teams.length === 0 ? (
              <div className="team-list-empty">暂无队伍，先去发布一个吧</div>
            ) : (
              teams.map((t) => (
                <Link
                  key={t.id}
                  to={`/chat/${t.id}`}
                  className={`team-list-item ${teamId === t.id ? 'active' : ''}`}
                >
                  <div className="avatar">
                    <UsersRound size={22} />
                  </div>
                  <div className="meta">
                    <div className="title">{t.title}</div>
                    <div className="sub">{t.highlight ?? t.description?.slice(0, 40)}</div>
                  </div>
                  <div className="badge">{t.currentMembers}/{t.maxMembers}</div>
                </Link>
              ))
            )}
          </div>
          </aside>

          <div className="chat-main">
            <header className="chat-topbar">
              <div className="chat-topbar-title">
                <span className="chat-topbar-badge">队伍群聊</span>
                <h2>{activeTeam?.title ?? '请选择队伍'}</h2>
              </div>
              <button type="button" className="chat-topbar-action" aria-label="返回">
                <span>←</span>
              </button>
            </header>

            {error && !accessDenied && <DataState tone="error">{error}</DataState>}

            <div className="chat-panel polished" ref={chatPanelRef}>
              {!teamId ? (
                <DataState tone="info">群聊需要明确的队伍入口。</DataState>
              ) : isLoading ? (
                <DataState tone="loading">正在读取聊天记录...</DataState>
              ) : accessDenied ? (
                <DataState tone="error">你还不是该队伍成员，先加入队伍再打开群聊。</DataState>
              ) : messages.length === 0 ? (
                <div className="chat-empty-visual" aria-label="空聊天状态">
                  <div className="chat-empty-people">
                    {emptyDemoMembers.map((member) => (
                      <div
                        key={`${member.name}-${member.initial}-${member.self ? 'self' : 'other'}`}
                        className={`chat-empty-person ${member.self ? 'is-self' : ''}`}
                      >
                        {!member.self && (
                          <div className={`chat-empty-avatar ${member.tone === 'dark' ? 'dark' : ''}`}>{member.initial}</div>
                        )}
                        <span className={`chat-empty-number ${member.self ? 'is-self-number' : ''}`}>{member.self ? '111111' : member.name}</span>
                        {member.self && (
                          <div className={`chat-empty-avatar ${member.tone === 'dark' ? 'dark' : ''}`}>{member.initial}</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  {hasMore && (
                    <button type="button" className="chat-load-more button-link secondary" disabled={isLoadingMore} onClick={loadEarlierMessages} aria-label="加载更早消息">
                      {isLoadingMore ? '加载中' : '加载更早消息'}
                    </button>
                  )}
                  {messages.map((message) => {
                    const senderId = message.senderId ? String(message.senderId).trim() : '';
                    const currentUserId = user?.id ? String(user.id).trim() : '';
                    const currentUserEmail = user?.email ? String(user.email).trim().toLowerCase() : '';
                    const senderEmail = message.sender?.email ? String(message.sender.email).trim().toLowerCase() : '';
                    const normalizedSenderId = senderId.replace(/^user:/i, '');
                    const normalizedCurrentUserId = currentUserId.replace(/^user:/i, '');
                    const mine = Boolean(
                      currentUserId &&
                        (senderId === currentUserId ||
                          normalizedSenderId === normalizedCurrentUserId ||
                          senderEmail === currentUserEmail ||
                          message.sender?.email === user?.email)
                    );
                    const senderName = message.sender?.profile?.nickname ?? message.sender?.email ?? '匿名同学';
                    const initial = senderName.charAt(0) || 'U';
                    return (
                      <div className={`chat-row ${mine ? 'mine' : ''}`} key={message.id}>
                        {mine ? (
                          <>
                            <div className="chat-message-stack">
                              <div className={mine ? 'chat-bubble mine' : 'chat-bubble'}>
                                {message.content}
                              </div>
                            </div>
                            <div className="chat-avatar mine">{initial}</div>
                          </>
                        ) : (
                          <>
                            <div className="chat-avatar">{initial}</div>
                            <div className="chat-message-stack">
                              <div className="chat-sender">{senderName}</div>
                              <div className="chat-bubble">{message.content}</div>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </>
              )}
            </div>

            <div className="chat-tools">
              <button type="button" aria-label="表情">☺</button>
              <button type="button" aria-label="图片">◌</button>
              <button type="button" aria-label="文件">▣</button>
              <button type="button" aria-label="语音">◔</button>
              <button type="button" aria-label="更多">⋯</button>
            </div>

            <form className="message-box chat-compose" onSubmit={sendMessage}>
              <input
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder={teamId ? (isConnected ? '输入消息，按 Enter 发送' : '正在连接队伍聊天室') : '请先选择队伍'}
                disabled={!canSend || accessDenied}
                aria-label="群聊消息"
              />
              <button type="submit" disabled={!canSend || !draft.trim() || accessDenied} aria-label="发送消息">
                <Send size={18} />
                发送
              </button>
            </form>
            {teamId && !isConnected && !error && !accessDenied && <DataState tone="loading">正在连接队伍聊天室...</DataState>}
          </div>
        </div>
      </section>
  );
}
