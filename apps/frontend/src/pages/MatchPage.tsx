import { CSSProperties, useCallback, useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  CalendarClock,
  Gift,
  GraduationCap,
  RefreshCw,
  Search,
  Sparkles,
  Target,
  UserPlus,
  UserRound,
  UsersRound,
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AppModal } from '../shared/components/AppModal';
import { DataState } from '../shared/components/DataState';
import { SegmentedTabs } from '../shared/components/SegmentedTabs';
import { matchApi } from '../shared/api/match';
import { ApiError } from '../shared/api/client';
import { teamTypeLabels } from '../shared/constants/team';
import { createTeamTypeTabs, teamTypeIcon, type TeamFilter } from '../shared/constants/teamUi';
import { MatchTeam, MatchUser, TeamType } from '../shared/types/domain';
import { formatDeadline } from '../shared/utils/format';
import { parseSkills } from '../shared/utils/skills';

const recommendationLimit = 3;
const typeTabs = createTeamTypeTabs('全部');
const defaultSkillSuggestions = ['React', 'TypeScript', 'NestJS', 'Prisma', '测试协作', '文档', 'Python', 'Excel', 'CSS', '算法', 'PPT', '设计'];

const typeTones: Record<TeamType, string> = {
  COURSE: 'violet',
  COMPETITION: 'indigo',
  VOLUNTEER: 'rose',
  CLUB: 'sky',
  BOUNTY: 'amber',
};

function scorePercent(score: number) {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function pickRandom<T>(items: T[], limit = recommendationLimit) {
  const pool = [...items];
  for (let index = pool.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [pool[index], pool[swapIndex]] = [pool[swapIndex], pool[index]];
  }
  return pool.slice(0, limit);
}

export function MatchPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [skillInput, setSkillInput] = useState('');
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [minBountyText, setMinBountyText] = useState('');
  const [typeFilter, setTypeFilter] = useState<TeamFilter>('ALL');
  const [userKeyword, setUserKeyword] = useState('');
  const [isUserSearchOpen, setIsUserSearchOpen] = useState(false);
  const [isUserLookupLoading, setIsUserLookupLoading] = useState(false);
  const [userLookupError, setUserLookupError] = useState('');
  const [selectedTeam, setSelectedTeam] = useState<MatchTeam | null>(null);
  const [selectedUser, setSelectedUser] = useState<MatchUser | null>(null);
  const [teamPool, setTeamPool] = useState<MatchTeam[]>([]);
  const [userPool, setUserPool] = useState<MatchUser[]>([]);
  const [teams, setTeams] = useState<MatchTeam[]>([]);
  const [users, setUsers] = useState<MatchUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const minBounty = useMemo(() => {
    if (!minBountyText.trim()) return undefined;
    const value = Number(minBountyText);
    return Number.isFinite(value) && value >= 0 ? value : undefined;
  }, [minBountyText]);

  const runMatch = useCallback(async (options: { skills: string[]; type: TeamFilter; minBounty?: number; userKeyword?: string }) => {
    setIsLoading(true);
    setError('');
    const query = {
      skills: options.skills,
      type: options.type === 'ALL' ? undefined : options.type,
      minBounty: options.minBounty,
    };

    try {
      const [teamResult, userResult] = await Promise.all([
        matchApi.teams(query),
        matchApi.users({ skills: options.skills, keyword: options.userKeyword?.trim() || undefined }),
      ]);
      setTeamPool(teamResult);
      setUserPool(userResult);
      setTeams(pickRandom(teamResult));
      setUsers(pickRandom(userResult));
    } catch (err) {
      const reason = err instanceof ApiError ? err.message : '无法获取推荐结果';
      setError(`匹配失败：${reason}`);
      setTeamPool([]);
      setUserPool([]);
      setTeams([]);
      setUsers([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void runMatch({ skills: [], type: 'ALL', minBounty: undefined, userKeyword: '' });
  }, [runMatch]);

  function refreshTeamRecommendations() {
    setTeams(pickRandom(teamPool));
  }

  function refreshUserRecommendations() {
    setUsers(pickRandom(userPool));
  }

  const topScore = [...teamPool, ...userPool].reduce((best, item) => Math.max(best, item.matchScore), 0);
  const skillSuggestionPool = useMemo(() => {
    const pool = new Set(defaultSkillSuggestions);
    teamPool.forEach((team) => team.requiredSkills.forEach((skill) => pool.add(skill)));
    userPool.forEach((user) => user.skills.forEach((skill) => pool.add(skill)));
    return [...pool];
  }, [teamPool, userPool]);
  const skillSuggestions = useMemo(() => {
    const query = skillInput.trim().toLowerCase();
    const next = skillSuggestionPool.filter((skill) => {
      const lower = skill.toLowerCase();
      return !selectedSkills.includes(skill) && (query ? lower.includes(query) : true);
    });
    return next.slice(0, 6);
  }, [selectedSkills, skillInput, skillSuggestionPool]);

  function addSkill(skill: string) {
    setSelectedSkills((current) => (current.includes(skill) ? current : [...current, skill]));
    setSkillInput('');
  }

  async function removeSkill(skill: string) {
    const nextSkills = selectedSkills.filter((item) => item !== skill);
    setSelectedSkills(nextSkills);
    await runMatch({
      skills: nextSkills,
      type: typeFilter,
      minBounty,
      userKeyword,
    });
  }

  async function applySearch() {
    const parsed = parseSkills(skillInput);
    const nextSkills = Array.from(new Set([...selectedSkills, ...parsed]));
    if (parsed.length > 0) {
      setSelectedSkills(nextSkills);
      setSkillInput('');
    }
    await runMatch({
      skills: parsed.length > 0 ? nextSkills : selectedSkills,
      type: typeFilter,
      minBounty,
      userKeyword,
    });
  }

  async function runTypeFilter(nextType: TeamFilter) {
    setTypeFilter(nextType);
    await runMatch({
      skills: selectedSkills,
      type: nextType,
      minBounty,
      userKeyword,
    });
  }

  async function runUserLookup() {
    setIsUserSearchOpen(true);
    setIsUserLookupLoading(true);
    setUserLookupError('');
    try {
      const userResult = await matchApi.users({ skills: selectedSkills, keyword: userKeyword.trim() || undefined });
      setUserPool(userResult);
      setUsers(pickRandom(userResult));
    } catch (err) {
      const reason = err instanceof ApiError ? err.message : '查找队友失败';
      setUserLookupError(reason);
    } finally {
      setIsUserLookupLoading(false);
    }
  }

  const matchStats = [
    { value: teamPool.length, label: '候选队伍' },
    { value: userPool.length, label: '候选队友' },
    { value: `${scorePercent(topScore)}%`, label: '最高匹配' },
  ];
  const visibleSelectedSkills = selectedSkills.slice(0, 4);
  const hiddenSelectedSkillCount = Math.max(0, selectedSkills.length - visibleSelectedSkills.length);
  const shouldShowSkillSuggestions = skillInput.trim().length > 0;
  const userSearchResults = useMemo(() => {
    const keyword = userKeyword.trim().toLowerCase();
    if (!keyword) return userPool.slice(0, 8);
    return userPool
      .filter((user) => {
        const values = [
          user.nickname,
          user.studentNo,
          user.userId,
          user.college,
          user.grade,
          ...user.skills,
        ];
        return values.some((value) => value?.toLowerCase().includes(keyword));
      })
      .slice(0, 8);
  }, [userKeyword, userPool]);
  const detailReturnState = useMemo(
    () => ({ from: `${location.pathname}${location.search}`, source: 'match' }),
    [location.pathname, location.search],
  );

  function openTeamDetail(teamId: string) {
    setSelectedTeam(null);
    navigate(`/teams/${teamId}`, { state: detailReturnState });
  }

  function openPublicProfile(user: MatchUser) {
    setIsUserSearchOpen(false);
    setSelectedUser(null);
    navigate(`/users/${user.studentNo || user.userId}`);
  }

  return (
    <section className="match-page market-page">
      <header className="match-hero-card">
        <div className="match-hero-copy">
          <span className="match-eyebrow">
            <Target size={16} />
            智能匹配
          </span>
          <h1>找到更合拍的队伍和队友</h1>
          <p>输入技能标签和悬赏限制，系统会按当前条件生成推荐结果。</p>
          <div className="match-hero-filter">
            <div className="match-skill-field">
              <div className="match-field-label">
                <Sparkles size={14} />
                技能标签
              </div>
              <div className="match-skill-input-row">
                <div className="match-skill-input-wrap">
                  <input
                    aria-label="技能标签搜索"
                    aria-expanded={shouldShowSkillSuggestions}
                    aria-controls="match-skill-suggestions"
                    onChange={(event) => setSkillInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        void applySearch();
                      }
                    }}
                    placeholder="输入技能，按回车或点击搜索"
                    value={skillInput}
                  />
                  {shouldShowSkillSuggestions && (
                    <div className="match-skill-suggestions" id="match-skill-suggestions" aria-label="联想标签">
                      {skillSuggestions.length > 0 ? (
                        skillSuggestions.map((skill) => (
                          <button key={skill} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => addSkill(skill)}>
                            {skill}
                          </button>
                        ))
                      ) : (
                        <span>未找到匹配标签</span>
                      )}
                    </div>
                  )}
                </div>
                <button type="button" className="match-primary-btn match-search-icon-btn" aria-label="搜索匹配结果" onClick={() => void applySearch()}>
                  <Search size={18} />
                </button>
              </div>
              <div className="match-skill-selected" aria-label="已选技能标签">
                {selectedSkills.length > 0 ? (
                  <>
                    {visibleSelectedSkills.map((skill) => (
                      <button key={skill} type="button" onClick={() => void removeSkill(skill)}>
                        {skill}
                        <span aria-hidden="true">×</span>
                      </button>
                    ))}
                    {hiddenSelectedSkillCount > 0 && <span className="match-skill-overflow">+{hiddenSelectedSkillCount}</span>}
                  </>
                ) : (
                  <span className="match-skill-empty">已选标签会显示在这里。</span>
                )}
              </div>
            </div>

            <label className="match-bounty-field">
              <span>
                <Gift size={14} />
                悬赏下限
              </span>
              <input
                aria-label="悬赏下限"
                inputMode="decimal"
                min={0}
                placeholder="留空表示不限"
                type="number"
                value={minBountyText}
                onChange={(event) => setMinBountyText(event.target.value)}
              />
              <small>仅用于缩小结果范围</small>
            </label>
          </div>
          <div className="match-hero-stat-cell">
            <div className="match-hero-stats" aria-label="匹配统计">
              {matchStats.map((stat) => (
                <span key={stat.label}>
                  <strong>{stat.value}</strong>
                  <small>{stat.label}</small>
                </span>
              ))}
            </div>
          </div>
        </div>
      </header>

      <div className="match-result-toolbar">
        <SegmentedTabs
          activeValue={typeFilter}
          ariaLabel="按类型筛选推荐队伍"
          className="match-type-tabs"
          onChange={(value) => {
            void runTypeFilter(value);
          }}
          tabs={typeTabs}
        />
      </div>

      {error && <DataState tone="error" className="match-data-state">{error}</DataState>}

      <div className="match-layout">
        <article className="match-panel match-panel-teams">
          <MatchPanelHeader
            title="推荐队伍"
            countText={`当前展示 ${teams.length} / ${teamPool.length} 个候选`}
            icon={<UsersRound size={20} />}
            disabled={isLoading || teamPool.length === 0}
            onRefresh={refreshTeamRecommendations}
          />
          {isLoading ? (
            <DataState tone="loading" className="match-data-state">正在按命中度推荐队伍...</DataState>
          ) : teams.length === 0 ? (
            <DataState tone="empty" className="match-data-state">暂未找到合适队伍，试着补充技能标签或放宽筛选条件。</DataState>
          ) : (
            <div className="match-card-list">
              {teams.map((team) => (
                <TeamMatchCard key={team.id} team={team} onOpen={setSelectedTeam} />
              ))}
            </div>
          )}
        </article>

        <article className="match-panel match-panel-users">
          <MatchPanelHeader
            title="推荐队友"
            countText={`当前展示 ${users.length} / ${userPool.length} 个候选`}
            icon={<UserRound size={20} />}
            disabled={isLoading || userPool.length === 0}
            onRefresh={refreshUserRecommendations}
            secondaryAction={
              <button
                type="button"
                className="match-panel-icon-btn"
                title="按昵称或学号找队友"
                aria-label="按昵称或学号找队友"
                onClick={() => setIsUserSearchOpen(true)}
              >
                <Search size={14} />
              </button>
            }
          />
          {isLoading ? (
            <DataState tone="loading" className="match-data-state">正在寻找技能互补的同学...</DataState>
          ) : users.length === 0 ? (
            <DataState tone="empty" className="match-data-state">暂未找到合适队友，可以尝试添加更多技能关键词。</DataState>
          ) : (
            <div className="match-card-list">
              {users.map((user) => (
                <UserMatchCard key={user.userId} user={user} onOpen={setSelectedUser} />
              ))}
            </div>
          )}
        </article>
      </div>

      <AppModal
        open={isUserSearchOpen}
        title="查找队友"
        description="按昵称、学号、学院或技能搜索当前候选队友。"
        className="match-user-search-modal"
        footer={
          <div className="match-modal-footer">
            <span>共找到 {userSearchResults.length} 位候选队友</span>
            <button type="button" className="match-secondary-btn" onClick={() => setIsUserSearchOpen(false)}>
              关闭
            </button>
          </div>
        }
        onClose={() => setIsUserSearchOpen(false)}
      >
        <div className="match-user-search-dialog">
          <label className="match-user-search-box">
            <Search size={18} />
            <input
              aria-label="队友昵称或学号"
              placeholder="输入昵称、学号、学院或技能"
              value={userKeyword}
              onChange={(event) => setUserKeyword(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  void runUserLookup();
                }
              }}
            />
            {userKeyword && (
              <button
                type="button"
                className="match-user-clear-btn"
                aria-label="清空队友搜索"
                onClick={() => {
                  setUserKeyword('');
                  setUserLookupError('');
                }}
              >
                ×
              </button>
            )}
            <button type="button" className="match-user-submit-btn" disabled={isUserLookupLoading} onClick={() => void runUserLookup()}>
              搜索
            </button>
          </label>
          <div className="match-user-search-results">
            {isUserLookupLoading ? (
              <DataState tone="loading" className="match-data-state">正在查找队友...</DataState>
            ) : userLookupError ? (
              <DataState tone="error" className="match-data-state">查找失败，请稍后重试。{userLookupError}</DataState>
            ) : userPool.length === 0 ? (
              <DataState tone="empty" className="match-data-state">暂无候选队友。</DataState>
            ) : userSearchResults.length > 0 ? (
              userSearchResults.map((user) => (
                <div
                  key={user.userId}
                  className="match-user-search-result"
                  role="button"
                  tabIndex={0}
                  onClick={() => openPublicProfile(user)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      openPublicProfile(user);
                    }
                  }}
                >
                  <span className="match-item-avatar" aria-hidden="true">
                    {(user.nickname || '同').slice(0, 1)}
                  </span>
                  <span className="match-user-result-main">
                    <strong>{user.nickname}</strong>
                    <small>{[user.studentNo, user.college, user.grade].filter(Boolean).join(' · ') || '未填写资料'}</small>
                    <span className="match-user-result-tags">
                      {user.skills.slice(0, 3).map((skill) => (
                        <i key={skill}>{skill}</i>
                      ))}
                      {user.skills.length > 3 && <i>+{user.skills.length - 3}</i>}
                      {user.skills.length === 0 && <i>暂无技能</i>}
                    </span>
                  </span>
                  <span className="match-user-result-actions">
                    <button
                      type="button"
                      className="match-user-result-action"
                      onClick={(event) => {
                        event.stopPropagation();
                        openPublicProfile(user);
                      }}
                    >
                      查看资料
                    </button>
                    <button
                      type="button"
                      className="match-user-result-action is-disabled"
                      disabled
                      title="邀请加入需要后续接入邀请接口"
                    >
                      邀请加入
                    </button>
                  </span>
                </div>
              ))
            ) : (
              <DataState tone="empty" className="match-data-state">没有找到匹配队友。</DataState>
            )}
          </div>
        </div>
      </AppModal>

      <AppModal
        open={Boolean(selectedTeam)}
        title={selectedTeam?.title ?? '队伍详情'}
        description={selectedTeam ? `${teamTypeLabels[selectedTeam.type]} · ${selectedTeam.currentMembers}/${selectedTeam.maxMembers} 人` : undefined}
        className="match-detail-modal match-team-preview-modal"
        footer={
          selectedTeam ? (
            <div className="match-modal-footer">
              <button type="button" className="match-secondary-btn" onClick={() => setSelectedTeam(null)}>
                返回列表
              </button>
              <button type="button" className="match-primary-btn" onClick={() => openTeamDetail(selectedTeam.id)}>
                查看详情
              </button>
            </div>
          ) : undefined
        }
        onClose={() => setSelectedTeam(null)}
      >
        {selectedTeam && <MatchTeamDetail team={selectedTeam} />}
      </AppModal>

      <AppModal
        open={Boolean(selectedUser)}
        title={selectedUser?.nickname ?? '队友详情'}
        description={selectedUser ? `${selectedUser.college || '未填写学院'} · ${selectedUser.grade || '未填写年级'}` : undefined}
        className="match-detail-modal"
        onClose={() => setSelectedUser(null)}
      >
        {selectedUser && <MatchUserDetail user={selectedUser} />}
      </AppModal>
    </section>
  );
}

type MatchPanelHeaderProps = {
  title: string;
  countText: string;
  icon: React.ReactNode;
  disabled: boolean;
  onRefresh: () => void;
  secondaryAction?: React.ReactNode;
};

function MatchPanelHeader({ title, countText, icon, disabled, onRefresh, secondaryAction }: MatchPanelHeaderProps) {
  return (
    <div className="match-panel-header">
      <div className="match-panel-title">
        <h2>
          {icon}
          {title}
        </h2>
        <span>{countText}</span>
      </div>
      <div className="match-panel-actions">
        {secondaryAction}
        <button type="button" className="match-refresh-btn icon-only" disabled={disabled} onClick={onRefresh} aria-label="换一组" title="换一组">
          <RefreshCw size={15} />
        </button>
      </div>
    </div>
  );
}

function TeamMatchCard({ team, onOpen }: { team: MatchTeam; onOpen: (team: MatchTeam) => void }) {
  const percent = scorePercent(team.matchScore);
  const tone = typeTones[team.type];
  const teamTags = team.matchedSkills.length > 0 ? team.matchedSkills : team.requiredSkills;
  const visibleTags = teamTags.slice(0, 3);
  const extraTagCount = Math.max(0, teamTags.length - visibleTags.length);

  return (
    <button type="button" className="match-item-card match-team-card" onClick={() => onOpen(team)}>
      <div className={`match-item-icon match-item-icon-${tone}`} aria-hidden="true">
        {teamTypeIcon(team.type, 18)}
      </div>
      <div className="match-item-body">
        <div className="match-item-head">
          <strong title={team.title}>{team.title}</strong>
          <span className="team-type">{teamTypeLabels[team.type]}</span>
        </div>
        <p className="match-item-description">{team.description || '队伍正在招募合适成员。'}</p>
        <div className="match-item-meta">
          <span>
            <UsersRound size={13} />
            {team.currentMembers}/{team.maxMembers} 人
          </span>
          <span>
            <CalendarClock size={13} />
            {formatDeadline(team.deadline)}
          </span>
          {team.ownerNickname && (
            <span>
              <UserRound size={13} />
              {team.ownerNickname}
            </span>
          )}
        </div>
        <div className="tags match-item-tags">
          {visibleTags.length > 0 ? (
            visibleTags.map((skill) => <span key={skill}>{skill}</span>)
          ) : (
            <span>暂无命中标签</span>
          )}
          {extraTagCount > 0 && <span>+{extraTagCount}</span>}
        </div>
        <div className="match-score-row">
          <div className="team-progress" aria-label={`匹配度 ${percent}%`}>
            <span style={{ width: `${percent}%` } as CSSProperties} />
          </div>
          <b>{percent}%</b>
        </div>
      </div>
    </button>
  );
}

function UserMatchCard({ user, onOpen }: { user: MatchUser; onOpen: (user: MatchUser) => void }) {
  const percent = scorePercent(user.matchScore);
  const initial = (user.nickname || '同').slice(0, 1);
  const orderedSkills = [
    ...user.matchedSkills,
    ...user.skills.filter((skill) => !user.matchedSkills.includes(skill)),
  ];
  const visibleSkills = orderedSkills.slice(0, 3);
  const extraCount = Math.max(0, orderedSkills.length - visibleSkills.length);

  return (
    <button type="button" className="match-item-card match-user-card" onClick={() => onOpen(user)}>
      <span className="match-user-main">
        <div className="match-item-avatar" aria-hidden="true">
          {initial}
        </div>
        <div className="match-item-body">
          <div className="match-item-head">
            <strong title={user.nickname}>{user.nickname}</strong>
            {user.matchedSkills.length > 0 && <span className="team-highlight">命中 {user.matchedSkills.length} 项</span>}
          </div>
          <div className="match-item-meta">
            <span>
              <BookOpen size={13} />
              {user.college || '未填写学院'}
            </span>
            <span>
              <GraduationCap size={13} />
              {user.grade || '未填写年级'}
            </span>
          </div>
          <div className="tags match-item-tags">
            {visibleSkills.length > 0 ? (
              visibleSkills.map((skill) => (
                <span key={skill} className={user.matchedSkills.includes(skill) ? 'matched' : undefined}>
                  {skill}
                </span>
              ))
            ) : (
              <span>暂无技能标签</span>
            )}
            {extraCount > 0 && <span>+{extraCount}</span>}
          </div>
        </div>
      </span>
      <div className="match-user-actions">
        <div className="match-score-row">
          <div className="team-progress" aria-label={`匹配度 ${percent}%`}>
            <span style={{ width: `${percent}%` } as CSSProperties} />
          </div>
          <b>{percent}%</b>
        </div>
        <span className="match-invite-btn" title="邀请功能需要后端 Invitation 接口支持">
          <UserPlus size={14} />
          邀请加入
        </span>
      </div>
    </button>
  );
}

function MatchTeamDetail({ team }: { team: MatchTeam }) {
  const percent = scorePercent(team.matchScore);
  const tags = team.matchedSkills.length > 0 ? team.matchedSkills : team.requiredSkills;

  return (
    <div className="match-detail-body match-team-preview">
      <span className="match-preview-badge">{teamTypeLabels[team.type]}</span>
      <div className="match-preview-description">
        <p>{team.description || '队伍正在招募合适成员。'}</p>
      </div>
      <div className="match-detail-grid match-preview-stats">
        <span>
          <small>匹配度</small>
          <strong>{percent}%</strong>
        </span>
        <span>
          <small>招募进度</small>
          <strong>{team.currentMembers}/{team.maxMembers} 人</strong>
        </span>
        <span>
          <small>截止时间</small>
          <strong>{formatDeadline(team.deadline)}</strong>
        </span>
        <span>
          <small>队长</small>
          <strong>{team.ownerNickname}</strong>
        </span>
      </div>
      <div className="tags match-item-tags">
        {tags.length > 0 ? tags.map((skill) => <span key={skill}>{skill}</span>) : <span>暂无技能标签</span>}
      </div>
    </div>
  );
}

function MatchUserDetail({ user }: { user: MatchUser }) {
  const percent = scorePercent(user.matchScore);
  const orderedSkills = [
    ...user.matchedSkills,
    ...user.skills.filter((skill) => !user.matchedSkills.includes(skill)),
  ];

  return (
    <div className="match-detail-body">
      <div className="match-detail-grid">
        <span>
          <small>学号</small>
          <strong>{user.studentNo || '未提供'}</strong>
        </span>
        <span>
          <small>学院</small>
          <strong>{user.college || '未填写'}</strong>
        </span>
        <span>
          <small>年级</small>
          <strong>{user.grade || '未填写'}</strong>
        </span>
        <span>
          <small>匹配度</small>
          <strong>{percent}%</strong>
        </span>
      </div>
      <div className="tags match-item-tags">
        {orderedSkills.length > 0 ? (
          orderedSkills.map((skill) => (
            <span key={skill} className={user.matchedSkills.includes(skill) ? 'matched' : undefined}>
              {skill}
            </span>
          ))
        ) : (
          <span>暂无技能标签</span>
        )}
      </div>
    </div>
  );
}
