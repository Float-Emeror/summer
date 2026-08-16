import { Injectable, NotFoundException, UnauthorizedException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { ApplicationsRepository } from './applications.repository';
import { ApplicationStatus, NotificationType } from '@prisma/client';
import { CreditService } from '../credit/credit.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { EventNames, NotificationCreateEvent } from '../events/domain-events';

@Injectable()
export class ApplicationsService {
  constructor(
    private appsRepo: ApplicationsRepository,
    private creditService: CreditService,
    private eventEmitter: EventEmitter2 
  ) {}

  private async checkCreditThreshold(userId: string) {
    const credit = await this.creditService.getUserTotalCredit(userId);
    if (credit.totalScore < 60) {
      throw new ForbiddenException('您的信用分低于 60 分，系统已限制您申请入队的权限。');
    }
  }

  async applyToTeam(userId: string, teamId: string, reason: string) {
    await this.checkCreditThreshold(userId); 

    const team = await this.appsRepo.getTeamBasicInfo(teamId);
    if (!team) throw new NotFoundException('找不到该队伍');
    
    if (team.ownerId === userId) {
      throw new BadRequestException('不能申请加入自己创建的队伍');
    }
    if (team.members.length >= team.maxMembers) {
      throw new BadRequestException('该队伍人数已满');
    }

    const existingApplication = await this.appsRepo.checkExistingApplication(teamId, userId);
    if (existingApplication) {
      throw new BadRequestException('您已经提交过申请或申请已被处理');
    }

    return this.appsRepo.createApplication(teamId, userId, reason);
  }

  async getTeamApplications(userId: string, teamId: string) {
    const team = await this.appsRepo.getTeamBasicInfo(teamId);
    if (!team) throw new NotFoundException('队伍不存在');
    if (team.ownerId !== userId) {
      throw new UnauthorizedException('只有队长可以查看申请列表');
    }
    return this.appsRepo.findApplicationsByTeam(teamId);
  }

  async reviewApplication(userId: string, applicationId: string, status: ApplicationStatus) {
    const application = await this.appsRepo.findApplicationById(applicationId);
    if (!application) throw new NotFoundException('找不到该申请记录');
    if (application.team.ownerId !== userId) {
      throw new UnauthorizedException('只有队长可以审批该申请');
    }
    if (application.status !== 'PENDING') {
      throw new BadRequestException('该申请已被处理过');
    }

    if (status === 'APPROVED') {
      const teamMembers = Array.isArray((application.team as any).members) ? (application.team as any).members : [];
      const alreadyJoined = teamMembers.some((member: any) => member.userId === application.applicantId);
      if (alreadyJoined) {
        throw new BadRequestException('该用户已经在队伍中，无法重复加入');
      }
      if (teamMembers.length >= (application.team as any).maxMembers) {
        throw new BadRequestException('该队伍人数已满');
      }
    }

    const result = await this.appsRepo.reviewApplication(applicationId, status);

    if (status === 'APPROVED') {
      this.eventEmitter.emit(
        EventNames.NOTIFICATION_CREATE,
        new NotificationCreateEvent(
          application.applicantId,
          NotificationType.APPLICATION_APPROVED,
          '入队申请通过',
          `恭喜！队长已同意您的入队申请。快去队伍群组里打个招呼吧！`
        )
      );
    }

    return result;
  }
}