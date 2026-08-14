import { Controller, Get, Patch, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Notifications')
@Controller('notifications')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class NotificationsController {
  constructor(private notifService: NotificationsService) {}

  private formatNotification(notif: any) {
    if (!notif) return notif;
    const { readAt, ...rest } = notif;
    return {
      ...rest,
      read: readAt !== null && readAt !== undefined,
    };
  }

  @Get()
  @ApiOperation({ summary: '获取通知列表 (默认历史，传 unreadOnly=true 获取未读)' })
  async getNotifications(@Request() req, @Query('page') page: string, @Query('unreadOnly') unreadOnly: string) {
    let result;
    if (unreadOnly === 'true') {
      result = await this.notifService.getMyUnread(req.user.userId);
    } else {
      const pageNum = parseInt(page, 10) || 1;
      result = await this.notifService.getMyHistory(req.user.userId, pageNum);
    }

    // 智能识别返回结构并进行数据层展平
    if (Array.isArray(result)) {
      return result.map(n => this.formatNotification(n));
    } else if (result && Array.isArray(result.data)) { 
      return { ...result, data: result.data.map((n: any) => this.formatNotification(n)) };
    }
    return result;
  }

  @Patch('read-all')
  @ApiOperation({ summary: '一键全部已读' })
  async markAllAsRead(@Request() req) {
    await this.notifService.markAllAsRead(req.user.userId);
    return { success: true };
  }

  @Patch(':id/read')
  @ApiOperation({ summary: '单条标记为已读' })
  async markAsRead(@Request() req, @Param('id') id: string) {
    await this.notifService.markAsRead(req.user.userId, [id]);
    return { success: true };
  }
}