import { TeamApplication } from '../types/domain';
import { apiRequest } from './client';

function normalize(item: any): TeamApplication {
  return {
    id: item.id ?? '',
    teamId: item.teamId ?? '',
    applicantId: item.applicantId ?? '',
    applicantNickname:
      item.applicantNickname ?? item.applicant?.profile?.nickname ?? item.applicant?.nickname,
    creditScore: item.creditScore ?? item.applicant?.creditScore ?? item.applicant?.credit?.totalScore ?? item.applicant?.creditSnapshots?.[0]?.score,
    reason: item.reason ?? '',
    status: item.status ?? 'PENDING',
    createdAt: item.createdAt,
    reviewedAt: item.reviewedAt ?? null,
  };
}

export const applicationsApi = {
  apply: (teamId: string, reason: string) =>
    apiRequest(`/teams/${teamId}/applications`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),
  list: (teamId: string) =>
    apiRequest<any[]>(`/teams/${teamId}/applications`).then((items) => (items ?? []).map(normalize)),
  approve: (id: string) => apiRequest(`/applications/${id}/approve`, { method: 'POST' }),
  reject: (id: string) => apiRequest(`/applications/${id}/reject`, { method: 'POST' }),
};
