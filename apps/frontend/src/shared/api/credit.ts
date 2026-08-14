import { apiRequest } from './client';
import { CreateReviewPayload, CreditReview, CreditScore } from '../types/domain';

function normalizeReview(review: CreditReview): CreditReview {
  return {
    ...review,
    tags: review.tags ?? [],
    reviewerName: review.reviewerName ?? review.reviewer?.profile?.nickname ?? review.reviewer?.email ?? undefined,
    teamTitle: review.teamTitle ?? review.team?.title ?? undefined,
    teamType: review.teamType ?? review.team?.type ?? undefined,
  };
}

export const creditApi = {
  userCredit: (userId: string) => apiRequest<CreditScore>(`/users/${userId}/credit`),
  myReviews: () => apiRequest<CreditReview[]>('/users/me/reviews').then((reviews) => reviews.map(normalizeReview)),
  createReview: (teamId: string, payload: CreateReviewPayload) =>
    apiRequest<CreditReview>(`/teams/${teamId}/reviews`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }).then(normalizeReview),
  appeal: (reviewId: string, reason: string) =>
    apiRequest(`/reviews/${reviewId}/appeal`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),
};
