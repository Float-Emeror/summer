import { Controller, Post, Get, Put, Param, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CreditService } from './credit.service';
import { CreateReviewDto, CreateAppealDto, ProcessAppealDto } from './dto/credit.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { EmailVerifiedGuard } from '../auth/guards/email-verified.guard';

@ApiTags('Credit & Reviews')
@Controller() 
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CreditController {
  constructor(private creditService: CreditService) {}

  @Post('teams/:teamId/reviews')
  @UseGuards(EmailVerifiedGuard)
  @ApiOperation({ summary: '提交队伍成员互评 (限结项后，触发信用分结算)' })
  async createReview(@Request() req, @Param('teamId') teamId: string, @Body() dto: CreateReviewDto) {
    dto.teamId = teamId;
    return this.creditService.createReview(req.user.userId, dto);
  }
  @Get('users/me/reviews')
  @ApiOperation({ summary: '获取当前登录用户收到的所有评价明细' })
  async getMyReviews(@Request() req) {
    return this.creditService.getUserReviews(req.user.userId);
  }

  @Get('users/:uid/credit')
  @ApiOperation({ summary: '获取某位用户的当前总信用分' })
  async getUserTotalCredit(@Param('uid') uid: string) {
    return this.creditService.getUserTotalCredit(uid);
  }

  @Post('reviews/:id/appeal')
  @UseGuards(EmailVerifiedGuard)
  @ApiOperation({ summary: '对收到的评价发起申诉' })
  async submitAppeal(@Request() req, @Param('id') id: string, @Body() dto: CreateAppealDto) {
    return this.creditService.submitAppeal(req.user.userId, id, dto.reason);
  }

  @Put('appeals/:id/process')
  @ApiOperation({ summary: '处理申诉记录 (仅管理员可用，申诉成功自动折叠评论并补分)' })
  async processAppeal(@Request() req, @Param('id') id: string, @Body() dto: ProcessAppealDto) {
    return this.creditService.processAppeal(req.user.userId, id, dto.status);
  }
}
