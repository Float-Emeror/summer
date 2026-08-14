import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Check,
  Edit3,
  Heart,
  Loader2,
  MessageCircle,
  PauseCircle,
  Star,
  UserPlus,
  UsersRound,
  X,
} from 'lucide-react';
import { teamsApi } from '../shared/api/teams';
import { applicationsApi } from '../shared/api/applications';
import { usersApi } from '../shared/api/users';
import { creditApi } from '../shared/api/credit';
import { ApiError } from '../shared/api/client';
import { isDemoSession } from '../shared/api/session';
import { DataState } from '../shared/components/DataState';
import { FormField } from '../shared/components/FormField';
import { AppModal } from '../shared/components/AppModal';
import { useAuth } from '../shared/auth/AuthProvider';
import { teamTypeLabels } from '../shared/constants/team';
import { mockTeams } from '../shared/data/mockTeams';
import { Team, TeamApplication, TeamType } from '../shared/types/domain';
import { parseSkills } from '../shared/utils/skills';
import { formatDeadline } from '../shared/utils/format';

type ApplicationSort = 'createdAt' | 'reasonLength' | 'credit';
type TeamDetailRouteState = {
  from?: string;
  source?: 'hall' | 'code' | 'mine';
};

export function TeamDetailPage() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const routeState = location.state as TeamDetailRouteState | null;
  const fallbackTeam = mockTeams.find((item) => item.id === id);
  const [team, setTeam] = useState<Team | null>(null);
  const [sourceLabel, setSourceLabel] = useState('正在加载');
  const [isLoadingTeam, setIsLoadingTeam] = useState(true);
  const [teamError, setTeamError] = useState('');
  const [demo] = useState(() => isDemoSession());
  const [actionMessage, setActionMessage] = useState('');
  const [actionTone, setActionTone] = useState<'success' | 'error' | 'info'>('info');
  const [isClosingTeam, setIsClosingTeam] = useState(false);
  const [favoriteBusy, setFavoriteBusy] = useState(false);
  const [favoriteHint, setFavoriteHint] = useState('');
  const [inviteHint, setInviteHint] = useState('');
  const [isFavorited, setIsFavorited] = useState(false);
  const [favoriteLoaded, setFavoriteLoaded] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editDraft, setEditDraft] = useState({
    title: '',
    description: '',
    type: 'COURSE' as TeamType,
    maxMembers: 2,
    requiredSkillsText: '',
    deadline: '',
    bountyAmount: '',
    teamCode: '',
  });
  const [reviewTarget, setReviewTarget] = useState<NonNullable<Team['members']>[number] | null>(null);
  const [reviewDraft, setReviewDraft] = useState({ rating: 5, tagsText: '', comment: '' });
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  const [applications, setApplications] = useState<TeamApplication[]>([]);
  const [applicationSort, setApplicationSort] = useState<ApplicationSort>('createdAt');
  const [appsLoading, setAppsLoading] = useState(false);
  const [appsError, setAppsError] = useState('');
  const [busyAppId, setBusyAppId] = useState('');

  const isOwner = Boolean(user?.id && team?.ownerId && user.id === team.ownerId);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setIsLoadingTeam(true);
    setTeamError('');

    teamsApi
      .detail(id)
      .then((nextTeam) => {
        if (!cancelled) {
          setTeam(nextTeam);
          setSourceLabel('实时数据');
        }
      })
      .catch(() => {
        if (cancelled) return;
        if (demo && fallbackTeam) {
          setTeam(fallbackTeam);
          setSourceLabel('示例数据');
          setTeamError('后端暂时不可用，当前显示本地示例队伍。');
        } else {
          setTeam(null);
          setSourceLabel('读取失败');
          setTeamError('没有找到这支队伍，或后端暂时不可用。');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingTeam(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [demo, fallbackTeam, id]);

  const loadApplications = useCallback(async () => {
    if (!id || demo || !isOwner) return;
    setAppsLoading(true);
    setAppsError('');
    try {
      setApplications(await applicationsApi.list(id));
    } catch (error) {
      const reason = error instanceof ApiError ? error.message : '读取申请失败';
      setAppsError(reason);
      setApplications([]);
    } finally {
      setAppsLoading(false);
    }
  }, [demo, id, isOwner]);

  useEffect(() => {
    void loadApplications();
  }, [loadApplications]);

  useEffect(() => {
    if (!team) return;
    setEditDraft({
      title: team.title,
      description: team.description,
      type: team.type,
      maxMembers: team.maxMembers,
      requiredSkillsText: team.requiredSkills.join(', '),
      deadline: team.deadline ? team.deadline.slice(0, 10) : '',
      bountyAmount: team.bountyAmount == null ? '' : String(team.bountyAmount),
      teamCode: team.teamCode ?? '',
    });
  }, [team]);

  useEffect(() => {
    if (!team || demo) return;
    let cancelled = false;
    setFavoriteLoaded(false);
    usersApi
      .favoriteTeams()
      .then((items) => {
        if (!cancelled) {
          setIsFavorited(items.some((item) => item.id === team.id));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setIsFavorited(false);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setFavoriteLoaded(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [demo, team]);

  async function reviewApplication(appId: string, action: 'approve' | 'reject') {
    setBusyAppId(appId);
    setAppsError('');
    try {
      if (action === 'approve') {
        await applicationsApi.approve(appId);
      } else {
        await applicationsApi.reject(appId);
      }
      setApplications((current) =>
        current.map((app) =>
          app.id === appId ? { ...app, status: action === 'approve' ? 'APPROVED' : 'REJECTED' } : app,
        ),
      );
    } catch (error) {
      const reason = error instanceof ApiError ? error.message : '操作失败';
      setAppsError(reason);
      void loadApplications();
    } finally {
      setBusyAppId('');
    }
  }

  async function closeRecruitment() {
    if (!team || demo) {
      setActionTone('error');
      setActionMessage('演示模式下无法关闭真实队伍招募。');
      return;
    }
    setIsClosingTeam(true);
    setActionMessage('');
    try {
      const nextTeam = await teamsApi.close(team.id);
      setTeam(nextTeam);
      setActionTone('success');
      setActionMessage('已关闭招募，队伍不会继续出现在开放招募列表中。');
    } catch (error) {
      const reason = error instanceof ApiError ? error.message : '关闭招募失败';
      setActionTone('error');
      setActionMessage(`关闭招募失败：${reason}`);
    } finally {
      setIsClosingTeam(false);
    }
  }

  async function favoriteTeam() {
    if (!team || demo) {
      setFavoriteHint('演示模式下无法收藏真实队伍。');
      return;
    }
    setFavoriteBusy(true);
    setFavoriteHint('');
    try {
      if (isFavorited) {
        await usersApi.unfavoriteTeam(team.id);
        setIsFavorited(false);
        setFavoriteHint('已取消收藏。');
      } else {
        await usersApi.favoriteTeam(team.id);
        setIsFavorited(true);
        setFavoriteHint('已收藏，可在大厅的“我的收藏”查看。');
      }
    } catch (error) {
      const reason = error instanceof ApiError ? error.message : '收藏操作失败';
      setFavoriteHint(`收藏操作失败：${reason}`);
    } finally {
      setFavoriteBusy(false);
    }
  }

  async function saveTeamEdit(event: FormEvent) {
    event.preventDefault();
    if (!team || demo) return;
    setIsSavingEdit(true);
    setActionMessage('');
    try {
      const nextTeam = await teamsApi.update(team.id, {
        title: editDraft.title.trim(),
        description: editDraft.description.trim(),
        type: editDraft.type,
        maxMembers: Number(editDraft.maxMembers),
        requiredSkills: parseSkills(editDraft.requiredSkillsText),
        deadline: editDraft.deadline ? new Date(`${editDraft.deadline}T23:59:59`).toISOString() : undefined,
        bountyAmount: editDraft.bountyAmount ? Number(editDraft.bountyAmount) : undefined,
        ...(editDraft.teamCode ? { teamCode: editDraft.teamCode.trim().toUpperCase() } : {}),
      });
      setTeam(nextTeam);
      setIsEditOpen(false);
      setActionTone('success');
      setActionMessage('队伍信息已更新。');
    } catch (error) {
      const reason = error instanceof ApiError ? error.message : '更新队伍失败';
      setActionTone('error');
      setActionMessage(`更新队伍失败：${reason}`);
    } finally {
      setIsSavingEdit(false);
    }
  }

  async function submitReview(event: FormEvent) {
    event.preventDefault();
    if (!team || !reviewTarget || demo) return;
    const comment = reviewDraft.comment.trim();
    if (!comment) {
      setActionTone('error');
      setActionMessage('请填写评价内容。');
      return;
    }
    setIsSubmittingReview(true);
    setActionMessage('');
    try {
      await creditApi.createReview(team.id, {
        revieweeId: reviewTarget.userId,
        rating: Number(reviewDraft.rating),
        tags: parseSkills(reviewDraft.tagsText),
        comment,
      });
      setReviewTarget(null);
      setReviewDraft({ rating: 5, tagsText: '', comment: '' });
      setActionTone('success');
      setActionMessage('评价已提交。');
    } catch (error) {
      const reason = error instanceof ApiError ? error.message : '提交评价失败';
      setActionTone('error');
      setActionMessage(`提交评价失败：${reason}`);
    } finally {
      setIsSubmittingReview(false);
    }
  }

  if (isLoadingTeam) {
    return (
      <section className="team-detail-page">
        <DataState tone="loading">正在读取队伍详情...</DataState>
      </section>
    );
  }

  if (!team) {
    return (
      <section className="team-detail-page">
        <DataState tone="error">{teamError || '队伍不存在'}</DataState>
        <Link className="button-link secondary" to="/teams">
          返回大厅
        </Link>
      </section>
    );
  }

  const currentMembers = team.currentMembers ?? team.members?.length ?? 0;
  const progress = team.maxMembers > 0 ? Math.round((currentMembers / team.maxMembers) * 100) : 0;
  const remainingSlots = Math.max(team.maxMembers - currentMembers, 0);
  const pendingApps = applications.filter((app) => app.status === 'PENDING');
  const ownerName = team.ownerNickname ?? team.owner?.profile?.nickname ?? team.owner?.nickname ?? '未填写';
  const statusTextMap: Record<Team['status'], string> = {
    OPEN: '招募中',
    FULL: '已满员',
    CLOSED: '已关闭',
    COMPLETED: '已完成',
  };
  const teamTypeText = teamTypeLabels[team.type];
  const visibleApplications = [...applications].sort((left, right) => {
    if (applicationSort === 'reasonLength') {
      return right.reason.length - left.reason.length;
    }
    if (applicationSort === 'credit') {
      return (right.creditScore ?? 0) - (left.creditScore ?? 0);
    }
    return new Date(right.createdAt ?? 0).getTime() - new Date(left.createdAt ?? 0).getTime();
  });
  const backLabel = routeState?.source === 'code'
    ? '返回队伍列表'
    : routeState?.source === 'mine'
      ? '返回我的队伍'
    : routeState?.source === 'hall'
      ? '返回组队大厅'
      : '返回上一级';

  function goBack() {
    if (routeState?.from) {
      navigate(routeState.from);
      return;
    }
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate('/teams');
  }

  return (
    <section className="team-detail-page">
      <header className="panel team-detail-hero">
        <div className="team-detail-hero-copy">
          <div className="team-detail-hero-eyebrow">
            <UsersRound size={16} />
            <span>{teamTypeText}</span>
            <span>·</span>
            <span>{sourceLabel}</span>
          </div>

          <h1>{team.title}</h1>
        </div>

        <button className="icon-button team-detail-back" type="button" onClick={goBack} aria-label={backLabel} title={backLabel}>
          <ArrowLeft size={18} />
        </button>
      </header>

      {teamError && <DataState tone="info">{teamError}</DataState>}
      {actionMessage && <DataState tone={actionTone}>{actionMessage}</DataState>}

      <div className="team-detail-layout">
        <article className="panel team-detail-main">
          <section className="team-detail-section">
            <div className="team-detail-section-head">
              <h2>队伍说明</h2>
            </div>
            <div className="team-detail-copybox">
              <p>{team.description || '队长暂未填写队伍说明。'}</p>
            </div>
            {team.requiredSkills.length === 0 && <DataState tone="empty">队长暂未填写队伍说明关键词。</DataState>}
          </section>

          <section className="team-detail-section">
            <div className="team-detail-section-head">
              <h2>招募需求</h2>
              <p>{remainingSlots > 0 ? `还差 ${remainingSlots} 位成员补位。` : '当前队伍已经满员。'}</p>
            </div>
            <div className="team-detail-callout">
              <strong>希望招募的成员</strong>
              <p>
                {team.requiredSkills.length > 0
                  ? `需要熟悉 ${team.requiredSkills.join('、')} 的同学一起协作。`
                  : '队长还没有写明具体招募要求。'}
              </p>
            </div>
          </section>

          <section className="team-detail-section">
            <div className="team-detail-section-head">
              <h2>成员与评价</h2>
            </div>
            {team.members && team.members.length > 0 ? (
              <div className="team-member-review-list">
                <div className="team-member-list">
                  {team.members.map((member) => {
                    const nickname = member.nickname ?? member.user?.profile?.nickname ?? '匿名同学';
                    const isSelf = member.userId === user?.id;
                    const roleLabel = member.role === 'OWNER' ? '队长' : member.role;
                    return (
                      <div className="team-member-row" key={member.userId}>
                        <div className="team-member-avatar" aria-hidden="true">
                          {nickname.slice(0, 1)}
                        </div>
                        <div className="team-member-copy">
                          <strong>
                            <Link to={`/users/${member.userId}`}>{nickname}</Link>
                          </strong>
                          <span>{roleLabel}</span>
                        </div>
                      <button
                        type="button"
                        className="team-member-review-btn"
                        disabled={demo || isSelf}
                        aria-label={`评价 ${nickname}`}
                        title={isSelf ? '不能评价自己' : demo ? '演示模式不能提交评价' : `评价 ${nickname}`}
                        onClick={() => setReviewTarget(member)}
                      >
                        <Star size={14} />
                      </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <DataState tone="empty">暂无成员评价。</DataState>
            )}
          </section>

          <section className="team-detail-section">
            <div className="team-detail-section-head">
              <h2>{isOwner ? `入队申请${pendingApps.length > 0 ? `（待审批 ${pendingApps.length}）` : ''}` : '入队方式'}</h2>
              <p>{isOwner ? '队长可在这里统一处理申请。' : '当前仅支持通过队伍码加入队伍。'}</p>
            </div>
            {isOwner ? (
              <div className="team-detail-applications">
                {demo ? (
                  <DataState tone="info">演示模式下无法读取真实申请列表。</DataState>
                ) : appsLoading ? (
                  <DataState tone="loading">正在读取申请...</DataState>
                ) : appsError ? (
                  <DataState tone="error">{appsError}</DataState>
                ) : applications.length === 0 ? (
                  <DataState tone="empty">暂无入队申请</DataState>
                ) : (
                  <>
                    <div className="application-toolbar team-detail-toolbar">
                      <label>
                        排序
                        <select value={applicationSort} onChange={(event) => setApplicationSort(event.target.value as ApplicationSort)}>
                          <option value="createdAt">最新申请</option>
                          <option value="reasonLength">自荐更完整</option>
                          <option value="credit">信用分优先</option>
                        </select>
                      </label>
                      <button type="button" className="task-mini-btn icon-only" onClick={() => void loadApplications()} aria-label="刷新申请" title="刷新申请">
                        <Loader2 size={14} className={appsLoading ? 'spin-icon' : undefined} />
                      </button>
                    </div>
                    <div className="application-list">
                      {visibleApplications.map((app) => (
                        <div className="application-row team-application-row" key={app.id}>
                          <div className="application-info">
                            <strong>
                              <Link to={`/users/${app.applicantId}`}>{app.applicantNickname ?? '匿名同学'}</Link>
                            </strong>
                            <p>{app.reason || '（未填写理由）'}</p>
                          </div>
                          {app.status === 'PENDING' ? (
                            <div className="application-actions">
                              <button
                                type="button"
                                className="app-approve"
                                disabled={busyAppId === app.id}
                                onClick={() => reviewApplication(app.id, 'approve')}
                              >
                                {busyAppId === app.id ? <Loader2 size={14} className="spin-icon" /> : <Check size={14} />}
                                通过
                              </button>
                              <button
                                type="button"
                                className="app-reject"
                                disabled={busyAppId === app.id}
                                onClick={() => reviewApplication(app.id, 'reject')}
                              >
                                <X size={14} />
                                拒绝
                              </button>
                            </div>
                          ) : (
                            <span className={app.status === 'APPROVED' ? 'team-status' : 'team-highlight'}>
                              {app.status === 'APPROVED' ? '已通过' : app.status === 'REJECTED' ? '已拒绝' : app.status}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="team-detail-apply">
                <DataState tone="info">
                  请在队伍列表页输入队伍码加入。该队伍队伍码：
                  <strong>{team.teamCode || '暂未生成'}</strong>
                </DataState>
              </div>
            )}
          </section>
        </article>

        <aside className="panel team-detail-side team-detail-side--sticky">
          <section className="team-detail-side-section">
            <h2>招募进度</h2>
            <strong>
              {currentMembers}/{team.maxMembers} 人
            </strong>
            <div
              className="team-progress"
              aria-label={`队伍成员进度 ${progress}%`}
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress}
            >
              <span style={{ width: `${progress}%` }} />
            </div>
          </section>

          <section className="team-detail-side-section">
            <h3>关键信息</h3>
            <div className="team-detail-keyinfo">
              <div>
                <span>队伍码</span>
                <strong>{team.teamCode ?? '暂未生成'}</strong>
              </div>
              <div>
                <span>截止时间</span>
                <strong>{formatDeadline(team.deadline)}</strong>
              </div>
              <div>
                <span>队长</span>
                <strong>{ownerName}</strong>
              </div>
              <div>
                <span>队伍类型</span>
                <strong>{teamTypeText}</strong>
              </div>
              <div>
                <span>招募状态</span>
                <strong>{statusTextMap[team.status]}</strong>
              </div>
            </div>
          </section>

          <section className="team-detail-side-section">
            <div className="team-detail-action-list">
              <Link
                className="team-detail-side-action team-detail-side-action--primary icon-only"
                to={`/chat/${team.id}`}
                aria-label="进入群聊"
                title="进入群聊"
              >
                <MessageCircle size={18} />
              </Link>
              {isOwner && (
                <button
                  type="button"
                  className="team-detail-side-action icon-only"
                  disabled={demo}
                  onClick={() => setIsEditOpen(true)}
                  aria-label="编辑队伍"
                  title="编辑队伍"
                >
                  <Edit3 size={18} />
                </button>
              )}
              <button
                type="button"
                className="team-detail-side-action icon-only"
                disabled={favoriteBusy || demo}
                onClick={favoriteTeam}
                aria-label={favoriteLoaded && isFavorited ? '取消收藏' : '收藏队伍'}
                title={favoriteLoaded && isFavorited ? '取消收藏' : '收藏队伍'}
              >
                {favoriteBusy ? <Loader2 size={18} className="spin-icon" /> : <Heart size={18} />}
              </button>
              {isOwner ? (
                <button
                  type="button"
                  className="team-detail-danger-action icon-only"
                  disabled={isClosingTeam || team.status !== 'OPEN'}
                  onClick={closeRecruitment}
                  aria-label={team.status === 'OPEN' ? '关闭招募' : '招募已关闭'}
                  title={team.status === 'OPEN' ? '关闭招募' : '招募已关闭'}
                >
                  {isClosingTeam ? <Loader2 size={18} className="spin-icon" /> : <PauseCircle size={18} />}
                </button>
              ) : (
                <button
                  type="button"
                  className="team-detail-side-action team-detail-side-action--ghost icon-only"
                  onClick={() => setInviteHint('目前未接入邀请接口')}
                  aria-label="邀请队友"
                  title="邀请队友"
                >
                  <UserPlus size={18} />
                </button>
              )}
            </div>
            {favoriteHint && <DataState tone={favoriteHint.includes('失败') ? 'error' : 'info'}>{favoriteHint}</DataState>}
            {inviteHint && <DataState tone="info">{inviteHint}</DataState>}
          </section>
        </aside>
      </div>

      <AppModal
        open={isEditOpen}
        title="编辑队伍"
        description="更新队伍标题、说明、技能和招募信息，提交后会同步到队伍详情。"
        className="team-edit-modal"
        onClose={() => {
          if (!isSavingEdit) setIsEditOpen(false);
        }}
        footer={
          <>
            <button type="button" className="task-modal-btn" disabled={isSavingEdit} onClick={() => setIsEditOpen(false)}>
              取消
            </button>
            <button type="submit" form="team-edit-form" className="task-modal-btn primary" disabled={isSavingEdit || !editDraft.title.trim()}>
              {isSavingEdit ? <Loader2 size={14} className="spin-icon" /> : <Check size={14} />}
              保存
            </button>
          </>
        }
      >
        <form id="team-edit-form" className="modal-form team-edit-form" onSubmit={saveTeamEdit}>
          <FormField label="队伍标题">
            <input value={editDraft.title} onChange={(event) => setEditDraft({ ...editDraft, title: event.target.value })} />
          </FormField>
          <FormField label="队伍码">
            <input
              value={editDraft.teamCode}
              maxLength={8}
              placeholder="8 位大写字母数字"
              onChange={(event) => setEditDraft({ ...editDraft, teamCode: event.target.value.toUpperCase() })}
            />
            <p className="form-hint">队长可以修改队伍码，不能与其他队重复。</p>
          </FormField>
          <FormField label="队伍说明">
            <textarea value={editDraft.description} onChange={(event) => setEditDraft({ ...editDraft, description: event.target.value })} />
          </FormField>
          <div className="team-edit-grid">
            <FormField label="类型">
              <select value={editDraft.type} onChange={(event) => setEditDraft({ ...editDraft, type: event.target.value as TeamType })}>
                {Object.entries(teamTypeLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="人数上限">
              <input
                min={1}
                type="number"
                value={editDraft.maxMembers}
                onChange={(event) => setEditDraft({ ...editDraft, maxMembers: Number(event.target.value) })}
              />
            </FormField>
            <FormField label="截止日期">
              <input value={editDraft.deadline} type="date" onChange={(event) => setEditDraft({ ...editDraft, deadline: event.target.value })} />
            </FormField>
            <FormField label="悬赏金额">
              <input
                min={0}
                type="number"
                value={editDraft.bountyAmount}
                onChange={(event) => setEditDraft({ ...editDraft, bountyAmount: event.target.value })}
              />
            </FormField>
          </div>
          <FormField label="技能标签">
            <input
              value={editDraft.requiredSkillsText}
              onChange={(event) => setEditDraft({ ...editDraft, requiredSkillsText: event.target.value })}
              placeholder="React, 测试, 文档"
            />
          </FormField>
        </form>
      </AppModal>

      <AppModal
        open={Boolean(reviewTarget)}
        title="评价队友"
        description={reviewTarget ? `给 ${reviewTarget.nickname ?? reviewTarget.user?.profile?.nickname ?? '这位同学'} 留下一条真实协作反馈。` : ''}
        className="team-review-modal"
        onClose={() => {
          if (!isSubmittingReview) setReviewTarget(null);
        }}
        footer={
          <>
            <button type="button" className="task-modal-btn" disabled={isSubmittingReview} onClick={() => setReviewTarget(null)}>
              取消
            </button>
            <button type="submit" form="team-review-form" className="task-modal-btn primary" disabled={isSubmittingReview || !reviewDraft.comment.trim()}>
              {isSubmittingReview ? <Loader2 size={14} className="spin-icon" /> : <Star size={14} />}
              提交评价
            </button>
          </>
        }
      >
        <form id="team-review-form" className="modal-form team-review-form" onSubmit={submitReview}>
          <FormField label="评分">
            <input
              min={1}
              max={5}
              type="number"
              value={reviewDraft.rating}
              onChange={(event) => setReviewDraft({ ...reviewDraft, rating: Number(event.target.value) })}
            />
          </FormField>
          <FormField label="标签">
            <input
              value={reviewDraft.tagsText}
              onChange={(event) => setReviewDraft({ ...reviewDraft, tagsText: event.target.value })}
              placeholder="负责, 沟通顺畅"
            />
          </FormField>
          <FormField label="评价内容">
            <textarea value={reviewDraft.comment} onChange={(event) => setReviewDraft({ ...reviewDraft, comment: event.target.value })} />
          </FormField>
        </form>
      </AppModal>
    </section>
  );
}
