import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Masonry, RenderComponentProps } from 'masonic';
import { ArrowRight, BookOpen, CalendarClock, Search, SlidersHorizontal, Sparkles, UsersRound } from 'lucide-react';
import { teamsApi } from '../shared/api/teams';
import { ApiError } from '../shared/api/client';
import { DataState } from '../shared/components/DataState';
import { teamTypeLabels } from '../shared/constants/team';
import { teamTypeIcon } from '../shared/constants/teamUi';
import { TeamDisplay } from '../shared/data/mockTeams';
import { MarketCard } from '../shared/components/MarketCard';
import { MarketStatStrip } from '../shared/components/MarketStatStrip';
import { EmptyState } from '../shared/components/EmptyState';
import type { DefaultCoverVariant } from '../shared/components/DefaultCover';
import { Team, TeamType } from '../shared/types/domain';
import { formatDeadline } from '../shared/utils/format';

type SortMode = 'createdAt' | 'deadline' | 'members';
const teamListCacheMs = 30_000;

type TeamListCacheEntry = {
  items: TeamDisplay[];
  sourceLabel: string;
  timestamp: number;
};

export function TeamListPage() {
  const navigate = useNavigate();
  const [keyword, setKeyword] = useState('');
  const [debouncedKeyword, setDebouncedKeyword] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('createdAt');
  const [teams, setTeams] = useState<TeamDisplay[]>([]);
  const [sourceLabel, setSourceLabel] = useState('正在加载');
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [joinCode, setJoinCode] = useState('');
  const [joiningByCode, setJoiningByCode] = useState(false);
  const [joinCodeMessage, setJoinCodeMessage] = useState<{ tone: 'success' | 'error' | 'info'; text: string } | null>(null);
  const listCacheRef = useRef(new Map<string, TeamListCacheEntry>());

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedKeyword(keyword.trim()), 320);
    return () => window.clearTimeout(timer);
  }, [keyword]);

  useEffect(() => {
    let cancelled = false;
    const cacheKey = `${debouncedKeyword}:${sortMode}:${reloadKey}`;
    const cached = listCacheRef.current.get(cacheKey);
    const canUseCache = cached && Date.now() - cached.timestamp < teamListCacheMs;

    if (canUseCache) {
      setTeams(cached.items);
      setSourceLabel(cached.sourceLabel);
      setIsLoading(false);
    } else {
      setIsLoading(true);
    }
    setLoadError('');

    const request = teamsApi.mine();

    request
      .then((items) => {
        if (!cancelled) {
          const nextTeams = items.map(toTeamDisplay);
          const nextSourceLabel = '实时数据';
          setTeams(nextTeams);
          setSourceLabel(nextSourceLabel);
          listCacheRef.current.set(cacheKey, {
            items: nextTeams,
            sourceLabel: nextSourceLabel,
            timestamp: Date.now(),
          });
        }
      })
      .catch((error) => {
        if (!cancelled) {
          if (!canUseCache) {
            setTeams([]);
          }
          setSourceLabel('读取失败');
          setLoadError(error instanceof Error ? error.message : '读取队伍列表失败');
        }
      })
      .finally(() => {
        if (!cancelled && !canUseCache) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedKeyword, reloadKey, sortMode]);

  const visibleTeams = useMemo(() => {
    const normalizedKeyword = debouncedKeyword.toLowerCase();
    const filtered = teams.filter((team) => {
      if (!normalizedKeyword) return true;
      const haystack = [team.title, team.description, team.college, team.owner, ...team.requiredSkills].join(' ').toLowerCase();
      return haystack.includes(normalizedKeyword);
    });

    return [...filtered].sort((a, b) => compareTeams(a, b, sortMode));
  }, [debouncedKeyword, sortMode, teams]);

  const openTeams = visibleTeams.filter((team) => team.status === 'OPEN').length;
  const totalSlots = visibleTeams.reduce((sum, team) => sum + team.maxMembers, 0);
  const occupiedSlots = visibleTeams.reduce((sum, team) => sum + team.currentMembers, 0);
  const marketStats = [
    { value: visibleTeams.length, label: '我的队伍' },
    { value: openTeams, label: '招募中' },
    { value: `${occupiedSlots}/${totalSlots || 0}`, label: '成员席位' },
  ];
  const sortLabel = sortMode === 'createdAt' ? '最新发布' : sortMode === 'deadline' ? '截止优先' : '名额热度';

  async function submitJoinByCode(event: FormEvent) {
    event.preventDefault();
    const normalized = joinCode.trim().toUpperCase();
    if (!normalized) {
      setJoinCodeMessage({ tone: 'error', text: '请输入队伍码。' });
      return;
    }
    if (normalized.length !== 8) {
      setJoinCodeMessage({ tone: 'error', text: '队伍码应为 8 位大写字母数字。' });
      return;
    }

    setJoiningByCode(true);
    setJoinCodeMessage(null);
    try {
      const result = await teamsApi.joinByCode(normalized);
      setJoinCodeMessage({ tone: 'success', text: '入队申请已发送，等待队长审核' });
      setJoinCode('');
    } catch (error) {
      const reason = error instanceof ApiError ? error.message : '通过队伍码申请加入失败';
      setJoinCodeMessage({ tone: 'error', text: reason });
    } finally {
      setJoiningByCode(false);
    }
  }

  return (
    <section className="team-page market-page">
      <header className="market-hero">
        <div className="market-hero-copy">
          <span className="eyebrow">
            <Sparkles size={16} />
            我的队伍
          </span>
          <h1>管理你创建或加入的队伍</h1>
          <p>保留发布组队和队伍码入队两个主入口，下面只展示你自己的队伍记录。</p>
          <form className="market-code-join" onSubmit={submitJoinByCode}>
            <input
              aria-label="输入队伍码"
              placeholder="输入 8 位队伍码直接加入"
              value={joinCode}
              maxLength={12}
              onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
            />
            <button type="submit" className="button-link" disabled={joiningByCode || joinCode.trim().length === 0}>
              {joiningByCode ? '加入中' : '通过队伍码加入'}
            </button>
          </form>
          {joinCodeMessage && <DataState tone={joinCodeMessage.tone}>{joinCodeMessage.text}</DataState>}
        </div>
        <Link className="button-link market-hero-action" to="/teams/new">
          发布组队
          <ArrowRight size={18} />
        </Link>
      </header>

      <div className="market-toolbar team-market-toolbar">
        <label className="market-search">
          <Search size={18} />
          <input aria-label="搜索我的队伍" placeholder="搜索我的队伍、技能或岗位" value={keyword} onChange={(event) => setKeyword(event.target.value)} />
        </label>
        <button className="market-filter" type="button" onClick={() => setSortMode(nextSortMode(sortMode))} aria-label="切换排序">
          <SlidersHorizontal size={17} />
          {sortLabel}
        </button>
        <MarketStatStrip stats={marketStats} />
      </div>

      <div className="market-section-title">
        <Sparkles size={16} />
        <span>我的队伍 · {sourceLabel}</span>
      </div>

      <div className={`team-results-stage ${isLoading ? 'is-loading' : 'is-ready'}`}>
        {isLoading ? (
          <DataState tone="loading">正在读取我的队伍...</DataState>
        ) : loadError ? (
          <div className="team-load-error">
            <DataState tone="error">我的队伍读取失败：{loadError}。请确认后端服务和数据库已经启动。</DataState>
            <button type="button" className="icon-only" onClick={() => setReloadKey((key) => key + 1)} aria-label="重试读取队伍" title="重试">
              <ArrowRight size={16} />
            </button>
          </div>
        ) : visibleTeams.length === 0 ? (
          <EmptyState
            compact
            icon={<Sparkles size={24} />}
            title="你还没有加入任何队伍"
            description="先发布一个新队伍，或者用上面的队伍码入口加入已有队伍。"
            primaryAction={
              <Link className="button-link" to="/teams/new">
                发布组队
              </Link>
            }
          />
        ) : (
          <TeamMasonryGrid
            key={visibleTeams.map((team) => team.id).join('|')}
            teams={visibleTeams}
          />
        )}
      </div>
    </section>
  );
}

function TeamMasonryGrid({
  teams,
}: {
  teams: TeamDisplay[];
}) {
  return (
    <Masonry
      className="market-grid"
      columnGutter={18}
      columnWidth={260}
      itemHeightEstimate={300}
      itemKey={(team) => team.id}
      items={teams}
      overscanBy={1.5}
      render={(props) => (
        <TeamMasonryCard {...props} />
      )}
      rowGutter={18}
      ssrHeight={720}
      ssrWidth={1280}
    />
  );
}

function TeamMasonryCard({
  data: team,
}: RenderComponentProps<TeamDisplay>) {
  return <TeamVisualCard team={team} />;
}

function TeamVisualCard({
  team,
}: {
  team: TeamDisplay;
}) {
  const location = useLocation();
  const progress = Math.round((team.currentMembers / team.maxMembers) * 100);
  const cover = getTeamCover(team);
  const statusText = team.status === 'OPEN' ? '招募中' : team.status === 'FULL' ? '已满员' : team.status === 'CLOSED' ? '已关闭' : '已完成';
  const roleText = team.myRole === 'OWNER' ? '我创建的' : '我加入的';

  return (
    <div className="favorite-team-card-wrap">
      <MarketCard
        className={`market-card-${team.type.toLowerCase()}`}
        to={`/teams/${team.id}`}
        state={{ from: `${location.pathname}${location.search}`, source: 'mine' }}
        cover={cover}
        category={team.category}
        statusLabel={statusText}
        title={team.title}
        description={team.description}
        stats={[
          { label: `剩余 ${Math.max(team.maxMembers - team.currentMembers, 0)} 席`, icon: <UsersRound size={15} /> },
          { label: formatCreatedAt(team.createdAt) },
          { label: roleText },
        ]}
        meta={[
          { label: `${team.currentMembers}/${team.maxMembers} 人`, icon: <UsersRound size={15} /> },
          { label: team.college, icon: <BookOpen size={15} /> },
          { label: formatDeadline(team.deadline), icon: <CalendarClock size={15} /> },
        ]}
        progress={progress}
        progressLabel={`队伍成员进度 ${progress}%`}
        owner={`v0.2.0 · ${team.owner}`}
        supportText="支持: 课程协作 / 校园活动"
        highlight={team.highlight}
        tags={team.requiredSkills}
      />
    </div>
  );
}

function nextSortMode(current: SortMode): SortMode {
  if (current === 'createdAt') return 'deadline';
  if (current === 'deadline') return 'members';
  return 'createdAt';
}

function compareTeams(a: TeamDisplay, b: TeamDisplay, sortMode: SortMode) {
  if (sortMode === 'members') {
    return b.currentMembers / b.maxMembers - a.currentMembers / a.maxMembers;
  }

  if (sortMode === 'deadline') {
    return deadlineTime(a.deadline) - deadlineTime(b.deadline);
  }

  return dateTime(b.createdAt) - dateTime(a.createdAt);
}

function dateTime(value?: string | null) {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function deadlineTime(value?: string | null) {
  const time = dateTime(value);
  return time || Number.MAX_SAFE_INTEGER;
}

function formatCreatedAt(value?: string | null) {
  const time = dateTime(value);
  if (!time) return '暂无发布时间';
  const date = new Date(time);
  return `${date.getMonth() + 1}月${date.getDate()}日发布`;
}

function getTeamCover(team: TeamDisplay) {
  const tones: Record<TeamType, string> = {
    COURSE: 'violet',
    COMPETITION: 'indigo',
    VOLUNTEER: 'rose',
    CLUB: 'sky',
    BOUNTY: 'amber',
  };
  const variants: Record<TeamType, DefaultCoverVariant> = {
    COURSE: 'course',
    COMPETITION: 'competition',
    VOLUNTEER: 'volunteer',
    CLUB: 'club',
    BOUNTY: 'bounty',
  };
  const numericId = Number(team.id.match(/\d+/)?.[0] ?? 1);
  const heightSteps = [116, 138, 168, 202, 148, 184];
  const descriptionBonus = team.description.length > 120 ? 28 : 0;

  return {
    label: team.category,
    tone: tones[team.type],
    icon: teamTypeIcon(team.type, 34),
    variant: variants[team.type],
    height: heightSteps[numericId % heightSteps.length] + descriptionBonus,
  };
}

function toTeamDisplay(team: Team): TeamDisplay {
  return {
    ...team,
    category: teamTypeLabels[team.type],
    college: team.owner?.profile?.college ?? team.owner?.college ?? '校园团队',
    highlight: team.myRole === 'OWNER' ? '我创建的队伍' : '我参与的队伍',
    owner: team.ownerNickname ?? team.owner?.profile?.nickname ?? team.owner?.nickname ?? '匿名队长',
  };
}
