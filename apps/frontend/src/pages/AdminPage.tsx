import { ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  FileWarning,
  KeyRound,
  Loader2,
  Lock,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserCog,
  UserX,
} from 'lucide-react';
import { PageHero } from '../shared/components/PageHero';
import { DataState } from '../shared/components/DataState';
import { SegmentedTab, SegmentedTabs } from '../shared/components/SegmentedTabs';
import { FormField } from '../shared/components/FormField';
import { AppModal } from '../shared/components/AppModal';
import { ConfirmDialog } from '../shared/components/ConfirmDialog';
import { Pagination, adminApi } from '../shared/api/admin';
import { ApiError } from '../shared/api/client';
import { useAuth } from '../shared/auth/AuthProvider';
import { AdminAccount, AdminAppeal, AdminAuditLog, AdminReport } from '../shared/types/domain';
import { parseSkills } from '../shared/utils/skills';

type AdminTab = 'accounts' | 'reports' | 'appeals' | 'audit';
type AccountStatusFilter = 'ALL' | 'ACTIVE' | 'DISABLED';
type ReportStatusFilter = 'ALL' | 'PENDING' | 'RESOLVED' | 'REJECTED';
type AppealStatusFilter = 'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED';

const defaultPagination: Pagination = { page: 1, pageSize: 10, total: 0, totalPages: 1 };
const adminPageSize = 10;

type AccountDraft = {
  id?: string;
  email: string;
  studentNo: string;
  password: string;
  role: 'STUDENT' | 'ADMIN';
  status: 'ACTIVE' | 'DISABLED';
  nickname: string;
  college: string;
  grade: string;
  skillsText: string;
};

const adminTabs: SegmentedTab<AdminTab>[] = [
  { value: 'accounts', label: '账号管理' },
  { value: 'reports', label: '举报处理' },
  { value: 'appeals', label: '评价申诉' },
  { value: 'audit', label: '审计日志' },
];

const blankDraft: AccountDraft = {
  email: '',
  studentNo: '',
  password: '',
  role: 'STUDENT',
  status: 'ACTIVE',
  nickname: '',
  college: '',
  grade: '',
  skillsText: '',
};

function statusTone(status: string) {
  if (status === 'PENDING') return 'status';
  if (status === 'RESOLVED' || status === 'APPROVED' || status === 'ACTIVE') return 'team-status';
  return 'team-highlight';
}

function isAdminRole(role?: string) {
  return (role ?? '').toUpperCase() === 'ADMIN';
}

function draftFromAccount(account: AdminAccount): AccountDraft {
  return {
    id: account.id,
    email: account.email,
    studentNo: account.studentNo,
    password: '',
    role: account.role,
    status: account.status,
    nickname: account.nickname,
    college: account.college,
    grade: account.grade,
    skillsText: account.skills.join(', '),
  };
}

export function AdminPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<AdminTab>('accounts');
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [appeals, setAppeals] = useState<AdminAppeal[]>([]);
  const [auditLogs, setAuditLogs] = useState<AdminAuditLog[]>([]);
  const [reportPage, setReportPage] = useState(defaultPagination);
  const [appealPage, setAppealPage] = useState(defaultPagination);
  const [auditPage, setAuditPage] = useState(defaultPagination);
  const [accounts, setAccounts] = useState<AdminAccount[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  const [message, setMessage] = useState('');
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState('');
  const [accountSearch, setAccountSearch] = useState('');
  const [accountStatus, setAccountStatus] = useState<AccountStatusFilter>('ALL');
  const [reportStatus, setReportStatus] = useState<ReportStatusFilter>('ALL');
  const [appealStatus, setAppealStatus] = useState<AppealStatusFilter>('ALL');
  const [accountDraft, setAccountDraft] = useState<AccountDraft | null>(null);
  const [resetTarget, setResetTarget] = useState<AdminAccount | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [disableTarget, setDisableTarget] = useState<AdminAccount | null>(null);
  const [disableReason, setDisableReason] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<AdminAccount | null>(null);

  const roleAllowed = isAdminRole(user?.role);

  const load = useCallback(
    async (target: AdminTab, targetPage = 1) => {
      if (!roleAllowed) {
        setForbidden(true);
        return;
      }
      setIsLoading(true);
      setMessage('');
      try {
        if (target === 'accounts') {
          setAccounts(await adminApi.accounts());
        } else if (target === 'reports') {
          const result = await adminApi.reports({
            page: targetPage,
            pageSize: adminPageSize,
            status: reportStatus === 'ALL' ? undefined : reportStatus,
          });
          setReports(result.items);
          setReportPage(result.pagination);
        } else if (target === 'appeals') {
          const result = await adminApi.appeals({
            page: targetPage,
            pageSize: adminPageSize,
            status: appealStatus === 'ALL' ? undefined : appealStatus,
          });
          setAppeals(result.items);
          setAppealPage(result.pagination);
        } else {
          const result = await adminApi.auditLogs({ page: targetPage, pageSize: adminPageSize });
          setAuditLogs(result.items);
          setAuditPage(result.pagination);
        }
        setForbidden(false);
      } catch (error) {
        if (error instanceof ApiError && error.status === 403) {
          setForbidden(true);
        } else {
          const reason = error instanceof ApiError ? error.message : '加载失败';
          setMessage(`加载失败：${reason}`);
        }
      } finally {
        setIsLoading(false);
      }
    },
    [appealStatus, reportStatus, roleAllowed],
  );

  useEffect(() => {
    void load(tab);
  }, [load, tab, reportStatus, appealStatus]);

  const filteredAccounts = useMemo(() => {
    const keyword = accountSearch.trim().toLowerCase();
    return accounts.filter((account) => {
      const matchesStatus = accountStatus === 'ALL' || account.status === accountStatus;
      const matchesKeyword =
        !keyword ||
        [account.email, account.studentNo, account.nickname, account.college, account.grade, account.role]
          .join(' ')
          .toLowerCase()
          .includes(keyword);
      return matchesStatus && matchesKeyword;
    });
  }, [accountSearch, accountStatus, accounts]);

  function setDraft(id: string, value: string) {
    setDrafts((current) => ({ ...current, [id]: value }));
  }

  async function resolveReport(id: string) {
    const resolution = (drafts[id] ?? '').trim();
    if (!resolution) {
      setMessage('请填写处理说明后再提交。');
      return;
    }
    setBusyId(id);
    setMessage('');
    try {
      await adminApi.resolveReport(id, resolution);
      await load('reports');
      setMessage('举报已处理。');
    } catch (error) {
      const reason = error instanceof ApiError ? error.message : '处理失败';
      setMessage(`处理失败：${reason}`);
    } finally {
      setBusyId('');
    }
  }

  async function resolveAppeal(id: string) {
    const decision = (drafts[id] ?? '').trim();
    if (!decision) {
      setMessage('请填写处理决定后再提交。');
      return;
    }
    setBusyId(id);
    setMessage('');
    try {
      await adminApi.resolveAppeal(id, decision);
      await load('appeals');
      setMessage('申诉已处理。');
    } catch (error) {
      const reason = error instanceof ApiError ? error.message : '处理失败';
      setMessage(`处理失败：${reason}`);
    } finally {
      setBusyId('');
    }
  }

  async function saveAccount(event: React.FormEvent) {
    event.preventDefault();
    if (!accountDraft) return;
    const payload = {
      email: accountDraft.email.trim(),
      studentNo: accountDraft.studentNo.trim(),
      role: accountDraft.role,
      status: accountDraft.status,
      nickname: accountDraft.nickname.trim(),
      college: accountDraft.college.trim(),
      grade: accountDraft.grade.trim(),
      skills: parseSkills(accountDraft.skillsText),
      availability: [],
    };

    if (!payload.email || !payload.studentNo || !payload.nickname) {
      setMessage('邮箱、学号和昵称不能为空。');
      return;
    }
    if (!accountDraft.id && !accountDraft.password.trim()) {
      setMessage('新增账号需要设置初始密码。');
      return;
    }

    setBusyId(accountDraft.id || 'new-account');
    setMessage('');
    try {
      const saved = accountDraft.id
        ? await adminApi.updateAccount(accountDraft.id, payload)
        : await adminApi.createAccount({ ...payload, password: accountDraft.password.trim() });
      setAccounts((current) => (accountDraft.id ? current.map((item) => (item.id === saved.id ? saved : item)) : [saved, ...current]));
      setAccountDraft(null);
      setMessage(accountDraft.id ? '账号已更新。' : '账号已创建。');
    } catch (error) {
      const reason = error instanceof ApiError ? error.message : '保存失败';
      setMessage(`保存账号失败：${reason}`);
    } finally {
      setBusyId('');
    }
  }

  async function confirmDisable() {
    if (!disableTarget) return;
    setBusyId(disableTarget.id);
    setMessage('');
    try {
      const updated = await adminApi.disableAccount(disableTarget.id, disableReason.trim() || '管理员禁用');
      setAccounts((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setDisableTarget(null);
      setDisableReason('');
      setMessage('账号已禁用。');
    } catch (error) {
      const reason = error instanceof ApiError ? error.message : '禁用失败';
      setMessage(`禁用账号失败：${reason}`);
    } finally {
      setBusyId('');
    }
  }

  async function enableAccount(account: AdminAccount) {
    setBusyId(account.id);
    setMessage('');
    try {
      const updated = await adminApi.enableAccount(account.id);
      setAccounts((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setMessage('账号已启用。');
    } catch (error) {
      const reason = error instanceof ApiError ? error.message : '启用失败';
      setMessage(`启用账号失败：${reason}`);
    } finally {
      setBusyId('');
    }
  }

  async function submitResetPassword(event: React.FormEvent) {
    event.preventDefault();
    if (!resetTarget) return;
    const nextPassword = resetPassword.trim();
    if (!nextPassword) {
      setMessage('请填写新密码。');
      return;
    }
    setBusyId(resetTarget.id);
    setMessage('');
    try {
      const updated = await adminApi.resetPassword(resetTarget.id, nextPassword);
      setAccounts((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setResetTarget(null);
      setResetPassword('');
      setMessage('密码已重置。');
    } catch (error) {
      const reason = error instanceof ApiError ? error.message : '重置失败';
      setMessage(`重置密码失败：${reason}`);
    } finally {
      setBusyId('');
    }
  }

  async function confirmDeleteAccount() {
    if (!deleteTarget) return;
    setBusyId(deleteTarget.id);
    setMessage('');
    try {
      await adminApi.deleteAccount(deleteTarget.id);
      setAccounts((current) => current.filter((item) => item.id !== deleteTarget.id));
      setDeleteTarget(null);
      setMessage('账号已删除。');
    } catch (error) {
      const reason = error instanceof ApiError ? error.message : '删除失败';
      setMessage(`删除账号失败：${reason}`);
    } finally {
      setBusyId('');
    }
  }

  if (forbidden) {
    return (
      <section className="admin-page market-page">
        <PageHero
          icon={<ShieldCheck size={16} />}
          eyebrow="管理后台"
          title="处理风险与账号"
          description="集中查看账号、举报、申诉和审计事件，保持平台协作环境可靠。"
        />
        <div className="admin-forbidden">
          <Lock size={26} />
          <h2>权限不足</h2>
          <p>当前账号（{user?.role ?? '未知角色'}）没有管理员权限，无法访问该后台。</p>
        </div>
      </section>
    );
  }

  return (
    <section className="admin-page market-page">
      <PageHero
        icon={<ShieldCheck size={16} />}
        eyebrow="管理后台"
        title="处理风险与账号"
        description="集中查看账号、举报、申诉和审计事件，保持平台协作环境可靠。"
        actions={
          tab === 'accounts' ? (
            <button type="button" className="market-hero-action" onClick={() => setAccountDraft(blankDraft)}>
              <Plus size={18} />
              新增账号
            </button>
          ) : null
        }
      />

      <SegmentedTabs activeValue={tab} ariaLabel="管理后台分区" onChange={setTab} tabs={adminTabs} />

      {message && <DataState tone={message.includes('失败') || message.includes('不能为空') ? 'error' : 'success'}>{message}</DataState>}

      {tab === 'accounts' && (
        <div className="admin-account-toolbar">
          <label className="market-search">
            <Search size={18} />
            <input
              aria-label="搜索账号"
              placeholder="搜索邮箱、学号、昵称、学院"
              value={accountSearch}
              onChange={(event) => setAccountSearch(event.target.value)}
            />
          </label>
          <select value={accountStatus} onChange={(event) => setAccountStatus(event.target.value as AccountStatusFilter)}>
            <option value="ALL">全部状态</option>
            <option value="ACTIVE">已启用</option>
            <option value="DISABLED">已禁用</option>
          </select>
        </div>
      )}

      {tab === 'reports' && (
        <div className="admin-account-toolbar">
          <select value={reportStatus} onChange={(event) => setReportStatus(event.target.value as ReportStatusFilter)}>
            <option value="ALL">全部举报</option>
            <option value="PENDING">待处理</option>
            <option value="RESOLVED">已处理</option>
            <option value="REJECTED">已驳回</option>
          </select>
          <button type="button" className="task-mini-btn icon-only" onClick={() => load('reports', reportPage.page)} aria-label="刷新举报列表" title="刷新">
            <Loader2 size={14} className={isLoading ? 'spin-icon' : undefined} />
          </button>
        </div>
      )}

      {tab === 'appeals' && (
        <div className="admin-account-toolbar">
          <select value={appealStatus} onChange={(event) => setAppealStatus(event.target.value as AppealStatusFilter)}>
            <option value="ALL">全部申诉</option>
            <option value="PENDING">待处理</option>
            <option value="APPROVED">已通过</option>
            <option value="REJECTED">已驳回</option>
          </select>
          <button type="button" className="task-mini-btn icon-only" onClick={() => load('appeals', appealPage.page)} aria-label="刷新申诉列表" title="刷新">
            <Loader2 size={14} className={isLoading ? 'spin-icon' : undefined} />
          </button>
        </div>
      )}

      {isLoading ? (
        <DataState tone="loading">正在加载...</DataState>
      ) : tab === 'accounts' ? (
        <AccountList
          accounts={filteredAccounts}
          busyId={busyId}
          onEdit={(account) => setAccountDraft(draftFromAccount(account))}
          onDisable={(account) => {
            setDisableTarget(account);
            setDisableReason(account.disabledReason ?? '');
          }}
          onEnable={enableAccount}
          onReset={(account) => {
            setResetTarget(account);
            setResetPassword('');
          }}
          onDelete={setDeleteTarget}
        />
      ) : tab === 'reports' ? (
        <AdminList
          icon={<AlertTriangle size={18} />}
          title="举报列表"
          empty="暂无待处理举报"
          rows={reports}
          pagination={reportPage}
          onPageChange={(page) => load('reports', page)}
          renderRow={(report) => (
            <div className="admin-row" key={report.id}>
              <div className="admin-row-head">
                <div className="admin-icon">
                  <AlertTriangle size={20} />
                </div>
                <div className="admin-row-info">
                  <strong>{report.reason}</strong>
                  <small>
                    #{report.id}
                    {report.targetType ? ` · ${report.targetType}` : ''}
                  </small>
                </div>
                <span className={statusTone(report.status)}>{report.status}</span>
              </div>
              {report.status === 'PENDING' && (
                <div className="admin-resolve">
                  <input
                    placeholder="处理说明，例如：核实后驳回 / 警告并删除"
                    value={drafts[report.id] ?? ''}
                    onChange={(event) => setDraft(report.id, event.target.value)}
                  />
                  <button type="button" disabled={busyId === report.id} onClick={() => resolveReport(report.id)}>
                    {busyId === report.id ? <Loader2 size={15} className="spin-icon" /> : null}
                    标记处理
                  </button>
                </div>
              )}
            </div>
          )}
        />
      ) : tab === 'appeals' ? (
        <AdminList
          icon={<FileWarning size={18} />}
          title="评价申诉"
          empty="暂无待审申诉"
          rows={appeals}
          pagination={appealPage}
          onPageChange={(page) => load('appeals', page)}
          renderRow={(appeal) => (
            <div className="admin-row" key={appeal.id}>
              <div className="admin-row-head">
                <div className="admin-icon">
                  <FileWarning size={20} />
                </div>
                <div className="admin-row-info">
                  <strong>{appeal.reason}</strong>
                  <small>
                    #{appeal.id} · 评价 {appeal.reviewId}
                  </small>
                </div>
                <span className={statusTone(appeal.status)}>{appeal.status}</span>
              </div>
              {appeal.status === 'PENDING' && (
                <div className="admin-resolve">
                  <input
                    placeholder="处理决定，例如：申诉成立，折叠评价 / 维持原评价"
                    value={drafts[appeal.id] ?? ''}
                    onChange={(event) => setDraft(appeal.id, event.target.value)}
                  />
                  <button type="button" disabled={busyId === appeal.id} onClick={() => resolveAppeal(appeal.id)}>
                    {busyId === appeal.id ? <Loader2 size={15} className="spin-icon" /> : null}
                    提交决定
                  </button>
                </div>
              )}
            </div>
          )}
        />
      ) : (
        <AdminList
          icon={<Activity size={18} />}
          title="审计日志"
          empty="暂无审计记录"
          rows={auditLogs}
          pagination={auditPage}
          onPageChange={(page) => load('audit', page)}
          renderRow={(log) => (
            <div className="admin-row" key={log.id}>
              <div className="admin-row-head">
                <div className="admin-icon">
                  <Activity size={20} />
                </div>
                <div className="admin-row-info">
                  <strong>{log.action}</strong>
                  <small>
                    #{log.id}
                    {log.actorId ? ` · 操作人 ${log.actorId}` : ''}
                  </small>
                </div>
              </div>
            </div>
          )}
        />
      )}

      <AppModal
        open={Boolean(accountDraft)}
        title={accountDraft?.id ? '编辑账号' : '新增账号'}
        description="账号状态以数据库为准，TOML 只用于初始化和迁移。"
        onClose={() => setAccountDraft(null)}
        footer={
          <>
            <button type="button" className="task-mini-btn" onClick={() => setAccountDraft(null)}>
              取消
            </button>
            <button type="submit" form="account-form" className="task-mini-btn confirm" disabled={busyId === (accountDraft?.id || 'new-account')}>
              {busyId === (accountDraft?.id || 'new-account') ? <Loader2 size={14} className="spin-icon" /> : <UserCheck size={14} />}
              保存账号
            </button>
          </>
        }
      >
        {accountDraft && (
          <form id="account-form" className="admin-account-form" onSubmit={saveAccount}>
            <FormField label="邮箱">
              <input value={accountDraft.email} onChange={(event) => setAccountDraft({ ...accountDraft, email: event.target.value })} />
            </FormField>
            <FormField label="学号">
              <input value={accountDraft.studentNo} onChange={(event) => setAccountDraft({ ...accountDraft, studentNo: event.target.value })} />
            </FormField>
            {!accountDraft.id && (
              <FormField label="初始密码">
                <input
                  type="password"
                  value={accountDraft.password}
                  onChange={(event) => setAccountDraft({ ...accountDraft, password: event.target.value })}
                />
              </FormField>
            )}
            <FormField label="昵称">
              <input value={accountDraft.nickname} onChange={(event) => setAccountDraft({ ...accountDraft, nickname: event.target.value })} />
            </FormField>
            <FormField label="学院">
              <input value={accountDraft.college} onChange={(event) => setAccountDraft({ ...accountDraft, college: event.target.value })} />
            </FormField>
            <FormField label="年级">
              <input value={accountDraft.grade} onChange={(event) => setAccountDraft({ ...accountDraft, grade: event.target.value })} />
            </FormField>
            <FormField label="角色">
              <select value={accountDraft.role} onChange={(event) => setAccountDraft({ ...accountDraft, role: event.target.value as AccountDraft['role'] })}>
                <option value="STUDENT">学生</option>
                <option value="ADMIN">管理员</option>
              </select>
            </FormField>
            <FormField label="状态">
              <select
                value={accountDraft.status}
                onChange={(event) => setAccountDraft({ ...accountDraft, status: event.target.value as AccountDraft['status'] })}
              >
                <option value="ACTIVE">启用</option>
                <option value="DISABLED">禁用</option>
              </select>
            </FormField>
            <FormField className="admin-account-form-wide" label="技能标签（逗号分隔）">
              <input value={accountDraft.skillsText} onChange={(event) => setAccountDraft({ ...accountDraft, skillsText: event.target.value })} />
            </FormField>
          </form>
        )}
      </AppModal>

      <AppModal
        open={Boolean(resetTarget)}
        title="重置密码"
        description={resetTarget ? `为 ${resetTarget.email} 设置新密码。` : ''}
        onClose={() => setResetTarget(null)}
      >
        <form className="admin-account-form single" onSubmit={submitResetPassword}>
          <FormField label="新密码">
            <input type="password" value={resetPassword} onChange={(event) => setResetPassword(event.target.value)} />
          </FormField>
          <div className="app-modal-footer inline">
            <button type="button" className="task-mini-btn" onClick={() => setResetTarget(null)}>
              取消
            </button>
            <button type="submit" className="task-mini-btn confirm" disabled={!resetPassword.trim() || busyId === resetTarget?.id}>
              {busyId === resetTarget?.id ? <Loader2 size={14} className="spin-icon" /> : <KeyRound size={14} />}
              确认重置
            </button>
          </div>
        </form>
      </AppModal>

      <AppModal open={Boolean(disableTarget)} title="禁用账号" description={disableTarget?.email ?? ''} onClose={() => setDisableTarget(null)}>
        <div className="admin-account-form single">
          <FormField label="禁用原因">
            <textarea value={disableReason} onChange={(event) => setDisableReason(event.target.value)} placeholder="例如：测试账号暂停使用" />
          </FormField>
          <div className="app-modal-footer inline">
            <button type="button" className="task-mini-btn" onClick={() => setDisableTarget(null)}>
              取消
            </button>
            <button type="button" className="task-mini-btn danger-text" disabled={busyId === disableTarget?.id} onClick={confirmDisable}>
              {busyId === disableTarget?.id ? <Loader2 size={14} className="spin-icon" /> : <UserX size={14} />}
              禁用账号
            </button>
          </div>
        </div>
      </AppModal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="删除账号"
        description={deleteTarget ? `确认删除 ${deleteTarget.email}？如果账号存在队伍、任务等业务关联，后端会拒绝删除并建议改用禁用。` : ''}
        confirmLabel="删除"
        tone="danger"
        loading={Boolean(deleteTarget && busyId === deleteTarget.id)}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDeleteAccount}
      />
    </section>
  );
}

function AccountList({
  accounts,
  busyId,
  onEdit,
  onDisable,
  onEnable,
  onReset,
  onDelete,
}: {
  accounts: AdminAccount[];
  busyId: string;
  onEdit: (account: AdminAccount) => void;
  onDisable: (account: AdminAccount) => void;
  onEnable: (account: AdminAccount) => void;
  onReset: (account: AdminAccount) => void;
  onDelete: (account: AdminAccount) => void;
}) {
  return (
    <article className="admin-card admin-table">
      <h2>
        <UserCog size={18} />
        账号列表
      </h2>
      {accounts.length === 0 ? (
        <DataState tone="empty">暂无匹配账号</DataState>
      ) : (
        <div className="admin-rows">
          {accounts.map((account) => (
            <div className="admin-row admin-account-row" key={account.id}>
              <div className="admin-row-head">
                <div className="admin-icon">
                  <UserCog size={20} />
                </div>
                <div className="admin-row-info">
                  <strong>{account.nickname || account.email}</strong>
                  <small>
                    {account.email} · {account.studentNo} · {account.role}
                  </small>
                  <small>
                    {[account.college, account.grade].filter(Boolean).join(' · ') || '未填写学院年级'}
                    {account.disabledReason ? ` · ${account.disabledReason}` : ''}
                  </small>
                </div>
                <span className={statusTone(account.status)}>{account.status === 'ACTIVE' ? '启用' : '禁用'}</span>
              </div>
              {account.skills.length > 0 && (
                <div className="tags admin-account-tags">
                  {account.skills.slice(0, 8).map((skill) => (
                    <span key={skill}>{skill}</span>
                  ))}
                </div>
              )}
              <div className="admin-account-actions">
                <button type="button" className="task-mini-btn icon-only" disabled={busyId === account.id} onClick={() => onEdit(account)} aria-label={`编辑账号 ${account.email}`} title="编辑">
                  <Pencil size={14} />
                </button>
                {account.status === 'ACTIVE' ? (
                  <button type="button" className="task-mini-btn danger-text icon-only" disabled={busyId === account.id} onClick={() => onDisable(account)} aria-label={`禁用账号 ${account.email}`} title="禁用">
                    <UserX size={14} />
                  </button>
                ) : (
                  <button type="button" className="task-mini-btn confirm icon-only" disabled={busyId === account.id} onClick={() => onEnable(account)} aria-label={`启用账号 ${account.email}`} title="启用">
                    <UserCheck size={14} />
                  </button>
                )}
                <button type="button" className="task-mini-btn icon-only" disabled={busyId === account.id} onClick={() => onReset(account)} aria-label={`重置密码 ${account.email}`} title="重置密码">
                  <KeyRound size={14} />
                </button>
                <button type="button" className="task-mini-btn danger icon-only" disabled={busyId === account.id} onClick={() => onDelete(account)} aria-label={`删除账号 ${account.email}`} title="删除">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </article>
  );
}

function AdminList<T>({
  icon,
  title,
  empty,
  rows,
  pagination,
  onPageChange,
  renderRow,
}: {
  icon: ReactNode;
  title: string;
  empty: string;
  rows: T[];
  pagination?: Pagination;
  onPageChange?: (page: number) => void;
  renderRow: (row: T) => ReactNode;
}) {
  return (
    <article className="admin-card admin-table">
      <h2>
        {icon}
        {title}
      </h2>
      {rows.length === 0 ? <DataState tone="empty">{empty}</DataState> : <div className="admin-rows">{rows.map(renderRow)}</div>}
      {pagination && onPageChange && (
        <div className="admin-pagination">
          <button type="button" className="task-mini-btn icon-only" disabled={pagination.page <= 1} onClick={() => onPageChange(pagination.page - 1)} aria-label="上一页" title="上一页">
            <ChevronLeft size={14} />
          </button>
          <span>
            第 {pagination.page} / {pagination.totalPages} 页，共 {pagination.total} 条
          </span>
          <button
            type="button"
            className="task-mini-btn icon-only"
            disabled={pagination.page >= pagination.totalPages}
            onClick={() => onPageChange(pagination.page + 1)}
            aria-label="下一页"
            title="下一页"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      )}
    </article>
  );
}
