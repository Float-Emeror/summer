import { MatchTeam, MatchUser, TeamType } from '../types/domain';
import { apiRequest } from './client';
import { ApiError } from './client';
import { teamsApi } from './teams';

export type MatchQuery = {
  skills?: string[];
  type?: TeamType;
  keyword?: string;
  minBounty?: number;
};

function buildQuery(query: MatchQuery) {
  const search = new URLSearchParams();
  if (query.skills && query.skills.length > 0) {
    search.set('skills', query.skills.join(','));
  }
  if (query.type) {
    search.set('type', query.type);
  }
  if (query.keyword) {
    search.set('keyword', query.keyword);
  }
  if (typeof query.minBounty === 'number' && !Number.isNaN(query.minBounty)) {
    search.set('minBounty', String(query.minBounty));
  }
  return search.size > 0 ? `?${search.toString()}` : '';
}

function normalizeTeam(team: any): MatchTeam {
  return {
    id: team.id ?? '',
    ownerId: team.ownerId,
    ownerNickname: team.ownerNickname ?? team.owner?.profile?.nickname,
    type: team.type ?? 'COURSE',
    title: team.title ?? '',
    description: team.description ?? '',
    requiredSkills: Array.isArray(team.requiredSkills)
      ? team.requiredSkills.map((skill: any) => (typeof skill === 'string' ? skill : skill?.name)).filter(Boolean)
      : [],
    status: team.status ?? 'OPEN',
    maxMembers: team.maxMembers ?? 0,
    currentMembers: team.currentMembers ?? 0,
    deadline: team.deadline ?? null,
    bountyAmount: team.bountyAmount != null ? Number(team.bountyAmount) : null,
    matchScore: Number(team.matchScore ?? 0),
    matchedSkills: Array.isArray(team.matchedSkills) ? team.matchedSkills : [],
  };
}

function normalizeUser(user: any): MatchUser {
  return {
    userId: user.userId ?? user.id ?? '',
    studentNo: user.studentNo ?? null,
    nickname: user.nickname ?? '未命名',
    college: user.college ?? null,
    grade: user.grade ?? null,
    skills: Array.isArray(user.skills) ? user.skills : [],
    matchScore: Number(user.matchScore ?? 0),
    matchedSkills: Array.isArray(user.matchedSkills) ? user.matchedSkills : [],
  };
}

function isHtmlResponseError(error: unknown) {
  return error instanceof ApiError && error.message.includes('HTML');
}

function buildFallbackMatchTeams(query: MatchQuery, items: ReturnType<typeof normalizeTeam>[]) {
  const wantedSkills = new Set((query.skills ?? []).map((skill) => skill.trim().toLowerCase()).filter(Boolean));
  return items.map((team) => {
    const matchedSkills = team.requiredSkills.filter((skill) => wantedSkills.has(skill.toLowerCase()));
    const matchScore = wantedSkills.size === 0 ? 0 : Math.round((matchedSkills.length / wantedSkills.size) * 100);
    return {
      ...team,
      matchedSkills,
      matchScore,
    };
  });
}

export const matchApi = {
  teams: (query: MatchQuery = {}) =>
    apiRequest<any[]>(`/match/teams${buildQuery(query)}`)
      .then((items) => (items ?? []).map(normalizeTeam))
      .catch((error) => {
        if (!isHtmlResponseError(error)) {
          throw error;
        }

        return teamsApi
          .list({
            type: query.type,
            status: 'OPEN',
            keyword: query.keyword,
            sortBy: 'createdAt',
            sortOrder: 'desc',
          })
          .then((items) =>
            buildFallbackMatchTeams(
              query,
              items.map((team) => normalizeTeam(team)),
            ),
          );
      }),
  users: (query: MatchQuery = {}) =>
    apiRequest<any[]>(`/match/users${buildQuery(query)}`)
      .then((items) => (items ?? []).map(normalizeUser))
      .catch((error) => {
        if (!isHtmlResponseError(error)) {
          throw error;
        }
        return [];
      }),
};
