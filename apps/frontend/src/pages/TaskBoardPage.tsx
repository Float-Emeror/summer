import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CheckCheck,
  ChevronRight,
  Circle,
  ClipboardList,
  Clock3,
  Edit3,
  Loader2,
  MessageCircle,
  PlayCircle,
  Plus,
  RotateCcw,
  Trash2,
  UsersRound,
} from 'lucide-react';
import { PageHero } from '../shared/components/PageHero';
import { DataState } from '../shared/components/DataState';
import { FormField } from '../shared/components/FormField';
import { SoftSelect } from '../shared/components/SoftSelect';
import { EmptyState } from '../shared/components/EmptyState';
import { ConfirmDialog } from '../shared/components/ConfirmDialog';
import { AppModal } from '../shared/components/AppModal';
import { tasksApi } from '../shared/api/tasks';
import { teamsApi } from '../shared/api/teams';
import { ApiError } from '../shared/api/client';
import { isDemoSession } from '../shared/api/session';
import { mockTeams } from '../shared/data/mockTeams';
import { Task, TaskStatus, Team } from '../shared/types/domain';
import { formatDeadline } from '../shared/utils/format';

type ColumnStatus = 'TODO' | 'DOING' | 'DONE';

const columns: Array<{ status: ColumnStatus; title: string; hint: string; icon: typeof Circle }> = [
  { status: 'TODO', title: '待处理', hint: '等待拆解或认领', icon: Circle },
  { status: 'DOING', title: '进行中', hint: '正在协作推进', icon: PlayCircle },
  { status: 'DONE', title: '已完成', hint: '可确认归档', icon: CheckCheck },
];

const demoTasks: Task[] = [
  { id: 'demo-task-1', teamId: 'team-1', title: '需求评审', status: 'TODO', assigneeIds: ['示例同学'], deadline: null },
  { id: 'demo-task-2', teamId: 'team-1', title: '接口草稿', status: 'DOING', assigneeIds: ['接口同学'], deadline: null },
  { id: 'demo-task-3', teamId: 'team-1', title: 'Phase 2 文档同步', status: 'DONE', assigneeIds: ['示例同学'], deadline: null },
];

function columnOf(status: TaskStatus): ColumnStatus {
  return status === 'CONFIRMED' ? 'DONE' : (status as ColumnStatus);
}

export function TaskBoardPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamId, setTeamId] = useState('');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [demo] = useState(() => isDemoSession());
  const [isLoadingTeams, setIsLoadingTeams] = useState(!demo);
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [busyId, setBusyId] = useState('');
  const [pendingDelete, setPendingDelete] = useState<Task | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newDeadline, setNewDeadline] = useState('');
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedTeamDetail, setSelectedTeamDetail] = useState<Team | null>(null);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editDeadline, setEditDeadline] = useState('');
  const [editAssigneeIds, setEditAssigneeIds] = useState<string[]>([]);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [teamsReloadKey, setTeamsReloadKey] = useState(0);
  const hasNoTeam = !demo && !isLoadingTeams && teams.length === 0 && !teamId && !isLoadingTasks;

  useEffect(() => {
    let cancelled = false;
    if (demo) {
      setTeams(mockTeams);
      setTeamId((current) => current || mockTeams[0]?.id || '');
      return;
    }

    setIsLoadingTeams(true);
    teamsApi
      .mine()
      .then((items) => {
        if (cancelled) return;
        setTeams(items);
        setTeamId((current) => current || items[0]?.id || '');
        if (items.length === 0) {
          setNotice({ tone: 'info', text: '你还没有创建或加入任何队伍，先去组队大厅加入一个吧。' });
        }
      })
      .catch(() => {
        if (cancelled) return;
        setTeams([]);
        setTeamId('');
        setNotice({ tone: 'error', text: '读取我的队伍失败，请检查后端服务后重试。' });
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingTeams(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [demo, teamsReloadKey]);

  const loadTasks = useCallback(async () => {
    if (!teamId) return;
    setIsLoadingTasks(true);
    setNotice(null);
    if (demo) {
      setTasks(demoTasks);
      setIsLoadingTasks(false);
      return;
    }

    try {
      setTasks(await tasksApi.board(teamId));
    } catch (error) {
      const reason = error instanceof ApiError ? error.message : '无法读取任务';
      setNotice({ tone: 'error', text: `读取任务失败：${reason}` });
      setTasks([]);
    } finally {
      setIsLoadingTasks(false);
    }
  }, [demo, teamId]);

  useEffect(() => {
    void loadTasks();
  }, [loadTasks]);

  useEffect(() => {
    if (!teamId || demo) {
      setSelectedTeamDetail(null);
      return;
    }
    let cancelled = false;
    setIsLoadingMembers(true);
    teamsApi
      .detail(teamId)
      .then((team) => {
        if (!cancelled) setSelectedTeamDetail(team);
      })
      .catch(() => {
        if (!cancelled) setSelectedTeamDetail(null);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingMembers(false);
      });
    return () => {
      cancelled = true;
    };
  }, [demo, teamId]);

  const grouped = useMemo(() => {
    const map: Record<ColumnStatus, Task[]> = { TODO: [], DOING: [], DONE: [] };
    for (const task of tasks) {
      map[columnOf(task.status)].push(task);
    }
    return map;
  }, [tasks]);

  const taskStats = useMemo(() => {
    const datedTasks = tasks
      .filter((task) => task.deadline)
      .sort((left, right) => new Date(left.deadline ?? 0).getTime() - new Date(right.deadline ?? 0).getTime());
    return [
      { value: tasks.length, label: '总任务' },
      { value: grouped.DOING.length, label: '进行中' },
      { value: grouped.DONE.length, label: '已完成' },
      { value: datedTasks[0]?.deadline ? formatDeadline(datedTasks[0].deadline) : '暂无', label: '最近截止' },
    ];
  }, [grouped, tasks]);

  const teamOptions = useMemo(
    () =>
      teams.map((team) => ({
        value: team.id,
        label: team.myRole === 'OWNER' ? `${team.title}（我创建）` : team.title,
      })),
    [teams],
  );

  function resetDraft() {
    setNewTitle('');
    setNewDescription('');
    setNewDeadline('');
  }

  function openEditTask(task: Task) {
    setEditingTask(task);
    setEditTitle(task.title);
    setEditDescription(task.description ?? '');
    setEditDeadline(task.deadline ? task.deadline.slice(0, 10) : '');
    setEditAssigneeIds(task.assigneeIds);
  }

  function guardWrite() {
    if (demo) {
      setNotice({ tone: 'error', text: '检测到旧演示会话，任务操作需要重新使用真实后端账号登录。' });
      return false;
    }
    return true;
  }

  async function createTask(event: FormEvent) {
    event.preventDefault();
    const title = newTitle.trim();
    if (!title || !teamId) return;
    if (!guardWrite()) return;
    setIsCreating(true);
    setNotice(null);
    try {
      const created = await tasksApi.create(teamId, {
        title,
        description: newDescription.trim() || undefined,
        deadline: newDeadline ? new Date(`${newDeadline}T23:59:59`).toISOString() : undefined,
      });
      setTasks((current) => [created, ...current]);
      resetDraft();
      setIsCreateModalOpen(false);
      setNotice({ tone: 'success', text: '任务已创建。' });
    } catch (error) {
      const reason = error instanceof ApiError ? error.message : '创建失败';
      setNotice({ tone: 'error', text: `创建任务失败：${reason}` });
    } finally {
      setIsCreating(false);
    }
  }

  async function withBusy(id: string, action: () => Promise<unknown>, failMessage: string) {
    if (!guardWrite()) return undefined;
    setBusyId(id);
    setNotice(null);
    try {
      return await action();
    } catch (error) {
      const reason = error instanceof ApiError ? error.message : failMessage;
      setNotice({ tone: 'error', text: `${failMessage}：${reason}` });
      await loadTasks();
      return undefined;
    } finally {
      setBusyId('');
    }
  }

  function moveTask(task: Task, next: TaskStatus) {
    if (busyId === task.id) return;
    setTasks((current) => current.map((item) => (item.id === task.id ? { ...item, status: next } : item)));
    void withBusy(task.id, () => tasksApi.updateStatus(task.id, next), '更新状态失败').then((updated) => {
      if (updated) {
        setTasks((current) => current.map((item) => (item.id === task.id ? (updated as Task) : item)));
      }
    });
  }

  function confirmTask(task: Task) {
    if (busyId === task.id) return;
    setTasks((current) => current.map((item) => (item.id === task.id ? { ...item, status: 'CONFIRMED' } : item)));
    void withBusy(task.id, () => tasksApi.confirm(task.id), '确认任务失败').then((updated) => {
      if (updated) {
        setTasks((current) => current.map((item) => (item.id === task.id ? (updated as Task) : item)));
      }
    });
  }

  function confirmDeleteTask() {
    if (!pendingDelete) return;
    const task = pendingDelete;
    setTasks((current) => current.filter((item) => item.id !== task.id));
    setPendingDelete(null);
    void withBusy(task.id, () => tasksApi.remove(task.id), '删除任务失败');
  }

  async function saveTaskEdit(event: FormEvent) {
    event.preventDefault();
    if (!editingTask || !guardWrite()) return;
    const title = editTitle.trim();
    if (!title) return;
    setIsSavingEdit(true);
    setNotice(null);
    try {
      let updated = await tasksApi.update(editingTask.id, {
        title,
        description: editDescription.trim() || undefined,
        deadline: editDeadline ? new Date(`${editDeadline}T23:59:59`).toISOString() : undefined,
      });
      const assigneesChanged = editAssigneeIds.slice().sort().join('|') !== editingTask.assigneeIds.slice().sort().join('|');
      if (assigneesChanged) {
        updated = await tasksApi.updateAssignees(editingTask.id, editAssigneeIds);
      }
      setTasks((current) => current.map((item) => (item.id === editingTask.id ? updated : item)));
      setEditingTask(null);
      setNotice({ tone: 'success', text: '任务已更新。' });
    } catch (error) {
      const reason = error instanceof ApiError ? error.message : '更新任务失败';
      setNotice({ tone: 'error', text: `更新任务失败：${reason}` });
      await loadTasks();
    } finally {
      setIsSavingEdit(false);
    }
  }

  function toggleAssignee(userId: string) {
    setEditAssigneeIds((current) => (current.includes(userId) ? current.filter((id) => id !== userId) : [...current, userId]));
  }

  return (
    <section className="task-page market-page">
      <PageHero
        icon={<ClipboardList size={16} />}
        eyebrow="任务看板"
        title="跟踪团队交付进度"
        description="选择一支队伍，用轻量看板管理任务状态，让每个成员都清楚下一步。"
        actions={
          <div className="task-hero-actions">
            <button type="button" className="market-hero-action" disabled={!teamId} onClick={() => setIsCreateModalOpen(true)} aria-label="新增任务" title="新增任务">
              <Plus size={18} />
            </button>
            <a className={teamId ? 'market-hero-action task-chat-link' : 'market-hero-action task-chat-link disabled'} href={teamId ? `/chat/${teamId}` : undefined} aria-label="队伍群聊" title="队伍群聊">
              <MessageCircle size={18} />
            </a>
          </div>
        }
      />

      {!hasNoTeam && <div className="market-toolbar task-toolbar">
        <div className={`task-team-picker field-card picker-field${isPickerOpen ? ' is-picker-open' : ''}`}>
          <span>
            <UsersRound size={16} />
            当前队伍
          </span>
          <SoftSelect
            open={isPickerOpen}
            value={teamId}
            options={teamOptions.length > 0 ? teamOptions : [{ value: '', label: '暂无队伍' }]}
            onOpenChange={setIsPickerOpen}
            onChange={(value) => {
              setTeamId(value);
              setIsPickerOpen(false);
            }}
            placeholder="暂无队伍"
          />
        </div>
        <div className="task-stat-strip">
          {taskStats.map((stat) => (
            <span key={stat.label}>
              <strong>{stat.value}</strong>
              {stat.label}
            </span>
          ))}
        </div>
      </div>}

      {notice && <DataState tone={notice.tone}>{notice.text}</DataState>}
      {demo && !notice && <DataState tone="info">检测到旧演示会话，看板仅展示示例任务；请重新登录真实后端账号后操作。</DataState>}

      {hasNoTeam ? (
        <EmptyState
          icon={<ClipboardList size={24} />}
          title="你还没有加入任何队伍"
          description="加入或创建一支队伍后，就可以在这里跟踪任务分配和交付进度。"
          primaryAction={
            <Link className="button-link" to="/teams">
              浏览队伍
            </Link>
          }
          secondaryAction={
            <button type="button" className="button-link secondary icon-only" onClick={() => setTeamsReloadKey((key) => key + 1)} aria-label="刷新队伍" title="刷新队伍">
              <RotateCcw size={16} />
            </button>
          }
        />
      ) : isLoadingTasks ? (
        <DataState tone="loading">正在读取任务看板...</DataState>
      ) : (
        <div className="board">
          {columns.map((column) => (
            <div className={`board-column polished board-column-${column.status.toLowerCase()}`} key={column.status}>
              <div className="board-column-header">
                <div>
                  <column.icon size={18} />
                  <h2>{column.title}</h2>
                </div>
                <span>{grouped[column.status].length}</span>
              </div>
              <p>{column.hint}</p>
              {grouped[column.status].length === 0 && (
                <DataState tone="empty">
                  {column.status === 'TODO' ? '还没有待办任务' : column.status === 'DOING' ? '暂时没有进行中的任务' : '完成的任务会在这里归档'}
                </DataState>
              )}
              {grouped[column.status].map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  column={column.status}
                  busy={busyId === task.id}
                  onMove={moveTask}
                  onConfirm={confirmTask}
                  onEdit={openEditTask}
                  onRemove={setPendingDelete}
                />
              ))}
            </div>
          ))}
        </div>
      )}

      <AppModal
        open={isCreateModalOpen}
        title="新增任务"
        description="填写标题、截止日期和任务内容，创建成功后会立即进入当前看板。"
        className="task-create-modal"
        onClose={() => {
          if (!isCreating) setIsCreateModalOpen(false);
        }}
        footer={
          <>
            <button type="button" className="task-modal-btn" disabled={isCreating} onClick={() => setIsCreateModalOpen(false)}>
              取消
            </button>
            <button type="submit" form="task-create-form" className="task-modal-btn primary" disabled={isCreating || !newTitle.trim() || !teamId}>
              {isCreating ? <Loader2 size={14} className="spin-icon" /> : <Plus size={14} />}
              创建任务
            </button>
          </>
        }
      >
        <form id="task-create-form" className="task-create-card modal-form" onSubmit={createTask}>
          <div className="task-create-intro">
            <ClipboardList size={18} />
            <div>
              <strong>先写清交付物，再分派状态</strong>
              <span>新任务会进入“待处理”，之后可以在看板里推进到进行中或已完成。</span>
            </div>
          </div>
          <div className="task-create-grid">
            <FormField className="task-create-title" label="任务标题">
              <input value={newTitle} onChange={(event) => setNewTitle(event.target.value)} placeholder="例如：完成接口联调" />
            </FormField>
            <FormField label="截止日期（可选）">
              <input type="date" value={newDeadline} onChange={(event) => setNewDeadline(event.target.value)} />
            </FormField>
            <FormField className="task-create-desc" label="任务内容（可选）">
              <textarea
                value={newDescription}
                onChange={(event) => setNewDescription(event.target.value)}
                placeholder="补充任务目标、交付要求或参考链接。"
              />
            </FormField>
          </div>
        </form>
      </AppModal>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="删除任务"
        description={pendingDelete ? `确认删除任务「${pendingDelete.title}」？该操作不可撤销。` : ''}
        confirmLabel="删除"
        tone="danger"
        loading={Boolean(pendingDelete && busyId === pendingDelete.id)}
        onCancel={() => setPendingDelete(null)}
        onConfirm={confirmDeleteTask}
      />

      <AppModal
        open={Boolean(editingTask)}
        title="编辑任务"
        description="调整任务信息和负责人，保存后同步当前看板。"
        className="task-create-modal"
        onClose={() => {
          if (!isSavingEdit) setEditingTask(null);
        }}
        footer={
          <>
            <button type="button" className="task-modal-btn" disabled={isSavingEdit} onClick={() => setEditingTask(null)}>
              取消
            </button>
            <button type="submit" form="task-edit-form" className="task-modal-btn primary" disabled={isSavingEdit || !editTitle.trim()}>
              {isSavingEdit ? <Loader2 size={14} className="spin-icon" /> : <Edit3 size={14} />}
              保存任务
            </button>
          </>
        }
      >
        <form id="task-edit-form" className="task-create-card modal-form" onSubmit={saveTaskEdit}>
          <div className="task-create-grid">
            <FormField className="task-create-title" label="任务标题">
              <input value={editTitle} onChange={(event) => setEditTitle(event.target.value)} />
            </FormField>
            <FormField label="截止日期（可选）">
              <input type="date" value={editDeadline} onChange={(event) => setEditDeadline(event.target.value)} />
            </FormField>
            <FormField className="task-create-desc" label="任务内容（可选）">
              <textarea value={editDescription} onChange={(event) => setEditDescription(event.target.value)} />
            </FormField>
          </div>
          <div className="task-assignee-picker">
            <strong>负责人</strong>
            {isLoadingMembers ? (
              <DataState tone="loading">正在读取成员...</DataState>
            ) : selectedTeamDetail?.members?.length ? (
              <div className="task-assignee-list">
                {selectedTeamDetail.members.map((member) => {
                  const nickname = member.nickname ?? member.user?.profile?.nickname ?? member.user?.email ?? '匿名同学';
                  return (
                    <label key={member.userId} className={editAssigneeIds.includes(member.userId) ? 'selected' : undefined}>
                      <input
                        type="checkbox"
                        checked={editAssigneeIds.includes(member.userId)}
                        onChange={() => toggleAssignee(member.userId)}
                      />
                      {nickname}
                    </label>
                  );
                })}
              </div>
            ) : (
              <DataState tone="empty">暂时没有可分配成员。</DataState>
            )}
          </div>
        </form>
      </AppModal>
    </section>
  );
}

function TaskCard({
  task,
  column,
  busy,
  onMove,
  onConfirm,
  onEdit,
  onRemove,
}: {
  task: Task;
  column: ColumnStatus;
  busy: boolean;
  onMove: (task: Task, next: TaskStatus) => void;
  onConfirm: (task: Task) => void;
  onEdit: (task: Task) => void;
  onRemove: (task: Task) => void;
}) {
  const nextStatus: Record<ColumnStatus, TaskStatus | null> = {
    TODO: 'DOING',
    DOING: 'DONE',
    DONE: null,
  };
  const previousStatus: Record<ColumnStatus, TaskStatus | null> = {
    TODO: null,
    DOING: 'TODO',
    DONE: 'DOING',
  };
  const next = nextStatus[column];
  const previous = previousStatus[column];
  const confirmed = task.status === 'CONFIRMED';

  return (
    <article className={`task-card task-card-${column.toLowerCase()}${confirmed ? ' is-confirmed' : ''}`}>
      <div className="task-card-head">
        <strong>{task.title}</strong>
        {confirmed && <span className="task-confirmed">已确认</span>}
      </div>
      {task.description && <p className="task-card-desc">{task.description}</p>}
      <div className="task-card-meta">
        <span className="task-chip">负责人：{formatAssignees(task.assigneeIds)}</span>
        {task.deadline && (
          <span className="task-chip task-deadline">
            <Clock3 size={13} />
            {formatDeadline(task.deadline)}
          </span>
        )}
      </div>
      <div className="task-card-actions">
        <button type="button" className="task-mini-btn task-mini-btn-secondary icon-only" disabled={busy} onClick={() => onEdit(task)} aria-label="编辑任务" title="编辑任务">
          <Edit3 size={14} />
        </button>
        {previous && !confirmed && (
          <button type="button" className="task-mini-btn task-mini-btn-muted icon-only" disabled={busy} onClick={() => onMove(task, previous)} aria-label="退回任务" title="退回任务">
            {busy ? <Loader2 size={14} className="spin-icon" /> : <RotateCcw size={14} />}
          </button>
        )}
        {next && (
          <button type="button" className="task-mini-btn task-mini-btn-primary icon-only" disabled={busy} onClick={() => onMove(task, next)} aria-label={next === 'DOING' ? '开始任务' : '完成任务'} title={next === 'DOING' ? '开始任务' : '完成任务'}>
            {busy ? <Loader2 size={14} className="spin-icon" /> : <ChevronRight size={14} />}
          </button>
        )}
        {column === 'DONE' && !confirmed && (
          <button type="button" className="task-mini-btn task-mini-btn-primary confirm icon-only" disabled={busy} onClick={() => onConfirm(task)} aria-label="确认任务" title="确认任务">
            <CheckCheck size={14} />
          </button>
        )}
        <button type="button" className="task-mini-btn danger" disabled={busy} onClick={() => onRemove(task)} aria-label="删除任务">
          <Trash2 size={14} />
        </button>
      </div>
    </article>
  );
}

function formatAssignees(assigneeIds: string[]) {
  if (assigneeIds.length === 0) return '待分配';
  return assigneeIds.map((id) => (looksLikeMachineId(id) ? '匿名同学' : id)).join('、');
}

function looksLikeMachineId(value: string) {
  return /^c[a-z0-9]{12,}$/i.test(value) || /^[0-9a-f-]{24,}$/i.test(value) || /^demo-user$/i.test(value);
}
