import { CreateTeamPayload, Team, TeamType, UpdateTeamPayload } from '../types/domain';
import { apiRequest } from './client';

type SkillLike = string | { name?: string };

type BackendTeam = Omit<Partial<Team>, 'requiredSkills' | 'members' | 'type'> & {
  type?: TeamType;
  requiredSkills?: SkillLike[];
  members?: Team['members'];
  currentMembers?: number;
  _count?: {
    members?: number;
  };
  owner?: Team['owner'] & {
    profile?: {
      nickname?: string;
      college?: string;
      grade?: string;
    };
  };
};

type TeamListContractResponse =
  | Team[]
  | BackendTeam[]
  | {
      teams?: BackendTeam[];
      pagination?: unknown;
    };

function normalizeSkills(skills: SkillLike[] = []) {
  return skills
    .map((skill) => (typeof skill === 'string' ? skill : skill.name))
    .filter((skill): skill is string => Boolean(skill));
}

function normalizeTeam(team: BackendTeam): Team {
  const members = team.members ?? [];
  return {
    id: team.id ?? '',
    teamCode: (team as { teamCode?: string }).teamCode,
    ownerId: team.ownerId,
    ownerNickname: team.ownerNickname ?? team.owner?.profile?.nickname ?? team.owner?.nickname,
    type: team.type ?? 'COURSE',
    title: team.title ?? '',
    description: team.description ?? '',
    requiredSkills: normalizeSkills(team.requiredSkills),
    status: team.status ?? 'OPEN',
    maxMembers: team.maxMembers ?? 2,
    currentMembers: team.currentMembers ?? team._count?.members ?? members.length,
    deadline: team.deadline ?? null,
    bountyAmount: team.bountyAmount ?? null,
    createdAt: team.createdAt,
    updatedAt: team.updatedAt,
    matchScore: team.matchScore,
    owner: team.owner,
    members,
    applications: team.applications,
  };
}

function normalizeTeamList(response: TeamListContractResponse) {
  const teams = Array.isArray(response) ? response : response.teams ?? [];
  return teams.map(normalizeTeam);
}

export const teamsApi = {
  list: (params: Partial<Record<'type' | 'status' | 'keyword' | 'sortBy' | 'sortOrder', string>> = {}) => {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value) {
        search.set(key, value);
      }
    }
    const suffix = search.size > 0 ? `?${search.toString()}` : '';
    return apiRequest<TeamListContractResponse>(`/teams${suffix}`).then(normalizeTeamList);
  },

  detail: (id: string) => apiRequest<BackendTeam>(`/teams/${id}`).then(normalizeTeam),

  mine: () =>
    apiRequest<BackendTeam[] | { teams?: BackendTeam[] }>('/teams/mine').then((response) => {
      const teams = Array.isArray(response) ? response : response.teams ?? [];
      return teams.map((team) => ({
        ...normalizeTeam(team),
        myRole: (team as { myRole?: string }).myRole,
      }));
    }),

  create: (payload: CreateTeamPayload) =>
    apiRequest<BackendTeam>('/teams', {
      method: 'POST',
      body: JSON.stringify(payload),
    }).then(normalizeTeam),

  update: (id: string, payload: UpdateTeamPayload) =>
    apiRequest<BackendTeam>(`/teams/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }).then(normalizeTeam),

  close: (id: string) =>
    apiRequest<BackendTeam>(`/teams/${id}/close`, {
      method: 'POST',
    }).then(normalizeTeam),

  joinByCode: (teamCode: string) =>
    apiRequest<BackendTeam>('/teams/join-by-code', {
      method: 'POST',
      body: JSON.stringify({ teamCode: teamCode.trim().toUpperCase() }),
    }).then(normalizeTeam),
};
