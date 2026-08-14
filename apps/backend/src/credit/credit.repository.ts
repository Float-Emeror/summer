import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AppealStatus } from '@prisma/client';

@Injectable()
export class CreditRepository {
  constructor(private prisma: PrismaService) {}

  async checkTeamMembership(teamId: string, userId: string) {
    return this.prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId } }
    });
  }

  async getTeamStatus(teamId: string) {
    return this.prisma.team.findUnique({
      where: { id: teamId },
      select: { status: true }
    });
  }

  async createReview(data: any, creditChange: number) {
    return this.prisma.$transaction(async (prisma) => {
      const review = await prisma.review.create({
        data: {
          teamId: data.teamId,
          reviewerId: data.reviewerId,
          revieweeId: data.revieweeId,
          rating: data.rating,
          tags: data.tags ?? [],
          comment: data.comment
        }
      });

      if (creditChange !== 0) {
        await prisma.creditSnapshot.create({
          data: {
            userId: data.revieweeId,
            score: creditChange,
            reason: `收到同队成员评价（评分：${data.rating}星）`,
            metadata: { reviewId: review.id, teamId: data.teamId }
          }
        });
      }
      return review;
    });
  }

  async findReviewsByUser(userId: string) {
    return this.prisma.review.findMany({
      where: { revieweeId: userId },
      include: {
        reviewer: { select: { profile: true } },
        team: { select: { title: true, type: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async calculateTotalCreditChange(userId: string) {
    const result = await this.prisma.creditSnapshot.aggregate({
      _sum: { score: true },
      where: { userId }
    });
    return result._sum.score || 0;
  }

  async findReviewById(reviewId: string) {
    return this.prisma.review.findUnique({ where: { id: reviewId } });
  }

  async createAppeal(reviewId: string, userId: string, reason: string) {
    return this.prisma.appeal.create({
      data: { reviewId, userId, reason }
    });
  }

  async findAppealById(appealId: string) {
    return this.prisma.appeal.findUnique({
      where: { id: appealId },
      include: { review: true }
    });
  }

  async processAppealTransaction(appealId: string, status: AppealStatus, revieweeId: string, compensationScore: number, reviewId: string) {
    return this.prisma.$transaction(async (prisma) => {
      const appeal = await prisma.appeal.update({
        where: { id: appealId },
        data: { status, resolvedAt: new Date() }
      });

      if (status === 'APPROVED') {
        if (compensationScore > 0) {
          await prisma.creditSnapshot.create({
            data: {
              userId: revieweeId,
              score: compensationScore,
              reason: '申诉通过，撤销不当评价扣分',
              metadata: { appealId }
            }
          });
        }
        await prisma.review.update({
          where: { id: reviewId },
          data: { isHidden: true }
        });
      }
      return appeal;
    });
  }

  async getUserRole(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true }
    });
  }
}
