import { FormEvent, KeyboardEvent, ReactNode, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  BookOpen,
  CalendarDays,
  CalendarClock,
  FileText,
  Gift,
  HeartHandshake,
  Info,
  Layers3,
  ChevronLeft,
  ChevronRight,
  Send,
  Shapes,
  Sparkles,
  Trash2,
  Tag,
  Trophy,
  UsersRound,
  Wand2,
  Plus,
} from 'lucide-react';
import { MarketCard } from '../shared/components/MarketCard';
import { PageHero } from '../shared/components/PageHero';
import { SoftSelect } from '../shared/components/SoftSelect';
import { teamsApi } from '../shared/api/teams';
import { ApiError } from '../shared/api/client';
import { getAccessToken, isDemoSession } from '../shared/api/session';
import { teamTypeLabels } from '../shared/constants/team';
import { TeamType } from '../shared/types/domain';

const previewCoverIcons: Record<TeamType, ReactNode> = {
  COURSE: <BookOpen size={34} />,
  COMPETITION: <Trophy size={34} />,
  VOLUNTEER: <HeartHandshake size={34} />,
  CLUB: <Shapes size={34} />,
  BOUNTY: <Gift size={34} />,
};

const teamTypeOptions: Array<{ value: TeamType; label: string; helper: string }> = [
  { value: 'COURSE', label: '后端开发', helper: '后端服务 / API 研发' },
  { value: 'COMPETITION', label: '前端开发', helper: '前端与交互实现' },
  { value: 'VOLUNTEER', label: '数据工程', helper: '数据清洗 / ETL / 数据平台' },
  { value: 'CLUB', label: '产品与设计', helper: '产品经理 / 交互与视觉' },
  { value: 'BOUNTY', label: '测试与质量', helper: '测试自动化 / QA / 性能' },
];

const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

export function CreateTeamPage() {
  const navigate = useNavigate();
  const [notice, setNotice] = useState<{ tone: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [title, setTitle] = useState('');
  const [type, setType] = useState<TeamType>('COURSE');
  const [maxMembers, setMaxMembers] = useState(5);
  const [skillDraft, setSkillDraft] = useState('');
  const [skills, setSkills] = useState<string[]>([]);
  const [description, setDescription] = useState('');
  const [deadline, setDeadline] = useState('');
  const [bountyAmount, setBountyAmount] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTypePickerOpen, setIsTypePickerOpen] = useState(false);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

  function addSkill() {
    const value = skillDraft.trim();
    if (!value) return;
    if (value.length > 16) return;
    setSkills((current) => {
      if (current.some((skill) => skill.toLowerCase() === value.toLowerCase())) return current;
      return [...current, value];
    });
    setSkillDraft('');
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setIsSubmitting(true);
    setNotice(null);

    try {
      const token = getAccessToken();
      if (!token || isDemoSession()) {
        throw new ApiError('检测到旧演示会话，发布组队需要重新使用真实后端账号登录。', 401);
      }

      const createdTeam = await teamsApi.create({
        type,
        title: title.trim(),
        description: description.trim(),
        maxMembers: clampNumber(maxMembers, 2, 20),
        requiredSkills: skills,
        deadline: deadline ? new Date(`${deadline}T23:59:59`).toISOString() : undefined,
        ...(type === 'BOUNTY' ? { bountyAmount: Math.max(0, bountyAmount) } : {}),
      });
      setNotice({ tone: 'success', text: `发布成功：${createdTeam.title}` });
      navigate(`/teams/${createdTeam.id}`, { replace: true });
    } catch (error) {
      const reason = error instanceof ApiError ? error.message : '后端暂时不可用，请稍后再试';
      setNotice({ tone: 'error', text: `发布失败：${reason}` });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="create-team-page">
      <PageHero
        className="create-hero"
        icon={<Wand2 size={16} />}
        eyebrow="发布组队"
        title="创建一个清晰的招募卡片"
        description="写清目标、人数和所需技能，可以让合适的同学更快找到你。"
        actions={(
          <Link className="create-back-link" to="/teams" aria-label="返回大厅" title="返回大厅">
            <ArrowLeft size={22} strokeWidth={2.7} aria-hidden="true" />
          </Link>
        )}
      />

      <div className="create-team-layout">
        <form className="create-team-form polished-form" onSubmit={submit}>
          <div className="form-section-title">
            <Sparkles size={18} />
            <span>招募信息</span>
          </div>

          <div className="form-grid">
            <label className="field-card">
              <span>
                <FileText size={16} />
                标题
                <HelpTooltip text="建议标题控制在 12 到 18 个字。" />
              </span>
                <input
                required
                minLength={4}
                placeholder="例如：后端开发岗位招聘"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
            </label>

            <label className={`field-card picker-field${isTypePickerOpen ? ' is-picker-open' : ''}`}>
              <span>
                <Layers3 size={16} />
                类型
                <HelpTooltip text={selectedTypeHelper(type)} />
              </span>
              <TypePicker
                open={isTypePickerOpen}
                value={type}
                onOpenChange={(open) => {
                  setIsTypePickerOpen(open);
                  if (open) {
                    setIsDatePickerOpen(false);
                  }
                }}
                onChange={(nextType) => {
                  setType(nextType);
                  setIsTypePickerOpen(false);
                }}
              />
            </label>

            <label className="field-card">
              <span>
                <UsersRound size={16} />
                人数上限
              </span>
              <input
                required
                max={20}
                min={2}
                type="number"
                value={maxMembers}
                onBlur={() => setMaxMembers((value) => clampNumber(value, 2, 20))}
                onChange={(event) => setMaxMembers(readNumber(event.target.value, 2))}
              />
            </label>

            <div className="field-card">
              <span>
                <Tag size={16} />
                技能标签
                <HelpTooltip text="逐个添加标签，越具体越容易匹配。" />
              </span>
              <div className="create-skill-picker">
                <input
                  value={skillDraft}
                  placeholder="例如：React"
                  onChange={(event) => setSkillDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      addSkill();
                    }
                  }}
                />
                <button type="button" className="create-skill-add icon-only" onClick={addSkill} aria-label="添加技能标签" title="添加技能标签">
                  <Plus size={16} />
                </button>
              </div>
              <div className="tags profile-skill-preview editable-tags create-skill-tags">
                {skills.length > 0 ? (
                  skills.map((skill) => (
                    <span key={skill}>
                      {skill}
                      <button type="button" aria-label={`删除 ${skill}`} onClick={() => setSkills((current) => current.filter((item) => item !== skill))}>
                        <Trash2 size={12} />
                      </button>
                    </span>
                  ))
                ) : (
                  <div className="profile-skill-empty">
                    <strong>暂未添加技能标签</strong>
                    <small>逐个添加更便于后续匹配</small>
                  </div>
                )}
              </div>
            </div>

            <label className={`field-card picker-field${isDatePickerOpen ? ' is-picker-open' : ''}`}>
              <span>
                <CalendarDays size={16} />
                截止日期
              </span>
              <DatePicker
                open={isDatePickerOpen}
                value={deadline}
                onOpenChange={(open) => {
                  setIsDatePickerOpen(open);
                  if (open) {
                    setIsTypePickerOpen(false);
                  }
                }}
                onChange={(nextDate) => {
                  setDeadline(nextDate);
                  setIsDatePickerOpen(false);
                }}
              />
            </label>

            {type === 'BOUNTY' && (
              <label className="field-card">
                <span>
                  <Sparkles size={16} />
                  悬赏积分
                </span>
                <input
                  max={99999}
                  min={0}
                  type="number"
                  value={bountyAmount}
                  onBlur={() => setBountyAmount((value) => clampNumber(value, 0, 99999))}
                  onChange={(event) => setBountyAmount(readNumber(event.target.value, 0))}
                />
              </label>
            )}

            <label className="field-card wide">
              <span>
                <BookOpen size={16} />
                描述
                <HelpTooltip text="说明项目目标、时间安排、协作方式和需要的技能。" />
              </span>
              <textarea
                required
                placeholder="说明项目目标、时间安排、协作方式和需要的技能，帮助合适的同学快速判断是否加入。"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </label>
          </div>

          <div className="create-actions">
            <button disabled={isSubmitting} type="submit">
              <Send size={18} />
              {isSubmitting ? '发布中' : '发布'}
            </button>
            {notice && <p className={`form-message form-message-${notice.tone}`}>{notice.text}</p>}
          </div>
        </form>

        <aside className="create-preview-panel">
          <div className="form-section-title">
            <Sparkles size={18} />
            <span>实时预览</span>
          </div>
          <MarketCard
            cover={{
              label: teamTypeLabels[type],
              tone: type === 'COMPETITION' ? 'indigo' : type === 'VOLUNTEER' ? 'rose' : type === 'CLUB' ? 'sky' : type === 'BOUNTY' ? 'amber' : 'violet',
              variant:
                type === 'COURSE'
                  ? 'course'
                  : type === 'COMPETITION'
                    ? 'competition'
                    : type === 'VOLUNTEER'
                      ? 'volunteer'
                      : type === 'CLUB'
                        ? 'club'
                        : 'bounty',
              icon: previewCoverIcons[type],
              height: 132,
            }}
            category={teamTypeLabels[type]}
            statusLabel="草稿"
            title={title || '未命名组队'}
            description={description || '补充目标、时间安排和需要的技能。'}
            stats={[
              { label: `剩余 ${Math.max((maxMembers || 2) - 1, 1)} 席` },
              { label: deadline ? '已设截止' : '长期招募' },
              { label: type === 'BOUNTY' ? `悬赏 ${bountyAmount || 0}` : '草稿预览' },
            ]}
            meta={[
              { label: `1/${maxMembers || 2} 人`, icon: <UsersRound size={15} /> },
              { label: '待选择学院', icon: <BookOpen size={15} /> },
              { label: deadline ? `${Number(deadline.slice(5, 7))}月${Number(deadline.slice(8, 10))}日截止` : '长期招募', icon: <CalendarClock size={15} /> },
            ]}
            progress={Math.min(100, Math.round(100 / Math.max(maxMembers || 2, 2)))}
            progressLabel="草稿成员进度"
            owner="v0.2.0 · Draft"
            supportText="支持: 课程协作 / 校园活动"
            highlight="发布后展示"
            tags={skills.length > 0 ? skills : ['技能待补充']}
          />
        </aside>
      </div>
    </section>
  );
}

function readNumber(value: string, fallback: number) {
  if (value === '') return fallback;
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function clampNumber(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}

function HelpTooltip({ text }: { text: string }) {
  return (
    <span className="field-help" data-tooltip={text} tabIndex={0} aria-label={text}>
      <Info size={14} />
    </span>
  );
}

function selectedTypeHelper(value: TeamType) {
  return teamTypeOptions.find((option) => option.value === value)?.helper ?? '';
}

function TypePicker({
  open,
  value,
  onChange,
  onOpenChange,
}: {
  open: boolean;
  value: TeamType;
  onChange: (value: TeamType) => void;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <SoftSelect
      open={open}
      value={value}
      options={teamTypeOptions}
      onChange={onChange}
      onOpenChange={onOpenChange}
    />
  );
}

function DatePicker({
  open,
  value,
  onChange,
  onOpenChange,
}: {
  open: boolean;
  value: string;
  onChange: (value: string) => void;
  onOpenChange: (open: boolean) => void;
}) {
  const current = value ? new Date(`${value}T00:00:00`) : new Date();
  const today = new Date();
  const minYear = today.getFullYear();
  const minMonth = today.getMonth();
  const initialVisibleDate =
    current.getFullYear() < minYear || (current.getFullYear() === minYear && current.getMonth() < minMonth)
      ? new Date(minYear, minMonth, 1)
      : new Date(current.getFullYear(), current.getMonth(), 1);
  const [visibleDate, setVisibleDate] = useState(() => initialVisibleDate);
  const [draftYear, setDraftYear] = useState(String(initialVisibleDate.getFullYear()));
  const [draftMonth, setDraftMonth] = useState(String(initialVisibleDate.getMonth() + 1));
  const [calendarMotion, setCalendarMotion] = useState<'prev' | 'next' | 'pick'>('pick');
  const [periodNotice, setPeriodNotice] = useState('');
  const year = visibleDate.getFullYear();
  const month = visibleDate.getMonth();
  const selectedDay =
    current.getFullYear() === year && current.getMonth() === month ? current.getDate() : null;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstWeekday = new Date(year, month, 1).getDay();
  const days = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ];

  useEffect(() => {
    setDraftYear(String(year));
    setDraftMonth(String(month + 1));
  }, [year, month]);

  function commitDay(day: number) {
    const nextDate = new Date(year, month, day);
    const normalized = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    setCalendarMotion('pick');
    onChange(normalized);
  }

  function moveMonth(offset: number) {
    const nextDate = new Date(year, month + offset, 1);
    setCalendarMotion(offset < 0 ? 'prev' : 'next');
    commitVisiblePeriod(nextDate.getFullYear(), nextDate.getMonth());
  }

  function commitVisiblePeriod(nextYear: number, nextMonth: number) {
    if (nextYear < minYear || (nextYear === minYear && nextMonth < minMonth)) {
      setPeriodNotice(`不能早于 ${minYear} 年 ${minMonth + 1} 月`);
      setCalendarMotion('next');
      setVisibleDate(new Date(minYear, minMonth, 1));
      return;
    }

    setPeriodNotice('');
    setVisibleDate(new Date(nextYear, nextMonth, 1));
  }

  function commitDraftPeriod() {
    const nextYear = Number(draftYear);
    const nextMonthNumber = Number(draftMonth);

    if (!Number.isInteger(nextYear) || !Number.isInteger(nextMonthNumber) || nextMonthNumber < 1 || nextMonthNumber > 12) {
      setPeriodNotice('请输入有效的年份和月份');
      setDraftYear(String(year));
      setDraftMonth(String(month + 1));
      return;
    }

    setCalendarMotion(nextYear < year || (nextYear === year && nextMonthNumber - 1 < month) ? 'prev' : 'next');
    commitVisiblePeriod(nextYear, nextMonthNumber - 1);
  }

  function commitDraftPeriodOnEnter(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.currentTarget.blur();
      commitDraftPeriod();
    }
  }

  return (
    <div className="soft-picker date-picker">
      <button
        className="soft-picker-trigger"
        type="button"
        onClick={() => {
          onOpenChange(!open);
        }}
      >
        <span>
          <strong>{value ? value.split('-').join('/') : '长期招募'}</strong>
        </span>
        <CalendarDays size={17} />
      </button>
      {open && (
        <div className="soft-picker-menu date-picker-menu">
          <div className="date-picker-head">
            <div className="date-picker-nav">
              <button type="button" onClick={() => moveMonth(-1)} aria-label="上个月">
                <ChevronLeft size={15} />
              </button>
              <strong>{year} {monthNames[month]}</strong>
              <button type="button" onClick={() => moveMonth(1)} aria-label="下个月">
                <ChevronRight size={15} />
              </button>
            </div>
            <div className="date-picker-period">
              <label>
                <span>年</span>
                <input
                  inputMode="numeric"
                  min={minYear}
                  type="number"
                  value={draftYear}
                  onBlur={commitDraftPeriod}
                  onChange={(event) => setDraftYear(event.target.value)}
                  onKeyDown={commitDraftPeriodOnEnter}
                />
              </label>
              <label>
                <span>月</span>
                <input
                  inputMode="numeric"
                  max={12}
                  min={1}
                  type="number"
                  value={draftMonth}
                  onBlur={commitDraftPeriod}
                  onChange={(event) => setDraftMonth(event.target.value)}
                  onKeyDown={commitDraftPeriodOnEnter}
                />
              </label>
            </div>
            {periodNotice && <p className="date-picker-notice">{periodNotice}</p>}
          </div>
          <button className="date-picker-clear" type="button" onClick={() => onChange('')}>
            不设截止
          </button>
          <div className={`date-picker-calendar calendar-${calendarMotion}`} key={`${year}-${month}-${calendarMotion}`}>
            <div className="date-picker-weekdays">
              {['日', '一', '二', '三', '四', '五', '六'].map((weekday) => (
                <span key={weekday}>{weekday}</span>
              ))}
            </div>
            <div className="date-picker-grid">
              {days.map((day, index) =>
                day ? (
                  <button
                    className={day === selectedDay ? 'active' : undefined}
                    key={day}
                    type="button"
                    onClick={() => commitDay(day)}
                  >
                    {day}
                  </button>
                ) : (
                  <span key={`blank-${index}`} />
                ),
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
