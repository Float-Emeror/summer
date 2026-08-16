import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationType } from '@prisma/client';
import { OnEvent } from '@nestjs/event-emitter';
import { EventNames, NotificationCreateEvent } from '../events/domain-events';
import { AppMailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsGateway } from './notifications.gateway';
import { NotificationsRepository } from './notifications.repository';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private notifRepo: NotificationsRepository,
    private notifGateway: NotificationsGateway,
    private prisma: PrismaService,
    private config: ConfigService,
    private mailService: AppMailService,
  ) {}

  @OnEvent(EventNames.NOTIFICATION_CREATE)
  async handleNotificationEvent(payload: NotificationCreateEvent) {
    if (!payload?.userId?.trim()) {
      this.logger.warn(`通知事件缺少目标用户，已忽略：${payload?.type ?? 'UNKNOWN'}`);
      return;
    }

    const notification = await this.notifRepo.create({
      userId: payload.userId,
      type: payload.type as NotificationType,
      title: payload.title,
      body: payload.content,
    });

    this.notifGateway.pushToUser(payload.userId, notification);

    if (!this.hasMailConfig()) {
      this.logger.debug('Mail config is incomplete; skipped email notification.');
      return;
    }

    try {
      const user = await this.prisma.user.findUnique({
        where: { id: payload.userId },
        select: { email: true },
      });

      if (user?.email) {
        await this.mailService.sendSystemEmail(
          user.email,
          `【系统通知】${payload.title}`,
          `
            <div style="padding: 20px; background-color: #f7f2ff; border-radius: 12px;">
              <h3>你有一条新的系统通知</h3>
              <p><strong>${payload.title}</strong></p>
              <p>${payload.content}</p>
            </div>
          `,
        );
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Failed to send email to ${payload.userId}: ${err.message}`, err.stack);
    }
  }

  async getMyUnread(userId: string) {
    return this.notifRepo.findUnread(userId);
  }

  async getMyHistory(userId: string, page = 1, limit = 20) {
    return this.notifRepo.findAll(userId, (page - 1) * limit, limit);
  }

  async markAsRead(userId: string, ids: string[]) {
    return this.notifRepo.markAsRead(userId, ids);
  }

  async markAllAsRead(userId: string) {
    return this.notifRepo.markAllAsRead(userId);
  }

  private hasMailConfig() {
    const user = this.config.get<string>('MAIL_USER')?.trim();
    const pass = this.config.get<string>('MAIL_PASS')?.trim();
    return Boolean(user && pass && !user.includes('你的邮箱') && !pass.includes('授权码'));
  }
}
