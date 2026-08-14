import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { CreditRepository } from './credit.repository';
import { CreateReviewDto } from './dto/credit.dto';
import { AppealStatus, NotificationType } from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { EventNames, NotificationCreateEvent } from '../events/domain-events';

@Injectable()
export class CreditService {
  private readonly BASE_CREDIT_SCORE = 100; 

  constructor(
    private creditRepo: CreditRepository,
    private eventEmitter: EventEmitter2 
  ) {}

  async createReview(reviewerId: string, dto: CreateReviewDto) {
    if (reviewerId === dto.revieweeId) {
      throw new BadRequestException('不可以给自己写评价哦！');
    }

    if (!dto.teamId) {
      throw new BadRequestException('缺少队伍 ID，无法提交评价');
    }

    const team = await this.creditRepo.getTeamStatus(dto.teamId);
    if (!team || !['COMPLETED', 'CLOSED'].includes(team.status)) {
      throw new BadRequestException('项目尚未结项，暂时无法进行成员互评');
    }

    const isReviewerInTeam = await this.creditRepo.checkTeamMembership(dto.teamId, reviewerId);
    const isRevieweeInTeam = await this.creditRepo.checkTeamMembership(dto.teamId, dto.revieweeId);

    if (!isReviewerInTeam || !isRevieweeInTeam) {
      throw new ForbiddenException('只能对当前队伍内的成员进行互评');
    }

    let creditChange = 0;
    if (dto.rating >= 4) creditChange = 5;
    else if (dto.rating <= 2) creditChange = -5;

    try {
      const review = await this.creditRepo.createReview({ reviewerId, ...dto }, creditChange);
    
      this.eventEmitter.emit(
        EventNames.NOTIFICATION_CREATE,
        new NotificationCreateEvent(
          dto.revieweeId, 
          NotificationType.REVIEW_CREATED, 
          '收到新评价',
          `您的队伍成员给您写了一条 ${dto.rating} 星评价，信用分已结算。`
        )
      );

      return review;
    } catch (error: any) {
      if (error.code === 'P2002') {
        throw new BadRequestException('您已经对该成员进行过评价，无法重复提交');
      }
      throw error;
    }
  }

  async getUserReviews(userId: string) {
    return this.creditRepo.findReviewsByUser(userId);
  }

  async getUserTotalCredit(userId: string) {
    const changeSum = await this.creditRepo.calculateTotalCreditChange(userId);
    return {
      userId,
      baseScore: this.BASE_CREDIT_SCORE,
      totalScore: this.BASE_CREDIT_SCORE + changeSum
    };
  }

  async submitAppeal(userId: string, reviewId: string, reason: string) {
    const review = await this.creditRepo.findReviewById(reviewId);
    if (!review) throw new NotFoundException('找不到该评价记录');
    if (review.revieweeId !== userId) {
      throw new ForbiddenException('您只能对给自己写的评价发起申诉');
    }
    return this.creditRepo.createAppeal(reviewId, userId, reason);
  }

  async processAppeal(adminId: string, appealId: string, status: AppealStatus) {
    const user = await this.creditRepo.getUserRole(adminId);
    if (user?.role !== 'ADMIN') {
      throw new ForbiddenException('权限不足，只有系统管理员可以处理申诉');
    }

    const appeal = await this.creditRepo.findAppealById(appealId);
    if (!appeal) throw new NotFoundException('找不到该申诉记录');
    if (appeal.status !== 'PENDING') throw new BadRequestException('该申诉已被处理过');

    let compensationScore = 0;
    if (status === 'APPROVED' && appeal.review.rating <= 2) {
      compensationScore = 5;
    }

    const result = await this.creditRepo.processAppealTransaction(appealId, status, appeal.userId, compensationScore, appeal.review.id);
    if (status === 'APPROVED') {
      this.eventEmitter.emit(
        EventNames.NOTIFICATION_CREATE,
        new NotificationCreateEvent(
          appeal.userId, 
          NotificationType.CREDIT_UPDATED, 
          '信用分补偿通知',
          `您的申诉已通过！管理员已为您折叠恶意评价，并恢复了对应的信用分。`
        )
      );
    }

    return result;
  }
}