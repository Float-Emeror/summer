import { PublicProfile, Team, UserProfile } from '../types/domain';
import { apiRequest } from './client';

export type AvailabilitySlotPayload = {
  weekday: number;
  startTime: string;
  endTime: string;
};

export type UpdateProfilePayload = {
  nickname?: string;
  college?: string;
  grade?: string;
};

export const usersApi = {
  me: () => apiRequest<UserProfile & { id?: string; email?: string; studentNo?: string }>('/users/me/profile'),

  publicProfile: (identifier: string) => apiRequest<PublicProfile>(`/users/${identifier}/public-profile`),

  updateProfile: (payload: UpdateProfilePayload) =>
    apiRequest('/users/me/profile', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  updateSkills: (skills: string[]) =>
    apiRequest('/users/me/skills', {
      method: 'PUT',
      body: JSON.stringify({ skills }),
    }),

  updateAvailability: (slots: AvailabilitySlotPayload[]) =>
    apiRequest('/users/me/availability', {
      method: 'PUT',
      body: JSON.stringify({ slots }),
    }),

  favoriteTeam: (teamId: string) =>
    apiRequest(`/users/me/favorites/teams/${teamId}`, {
      method: 'POST',
    }),

  unfavoriteTeam: (teamId: string) =>
    apiRequest(`/users/me/favorites/teams/${teamId}`, {
      method: 'DELETE',
    }),

  favoriteTeams: () => apiRequest<Team[]>('/users/me/favorites/teams'),
};
