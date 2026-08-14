import { Controller, Post, Get, Param, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ApplicationsService } from './applications.service';
import { ApplyTeamDto } from './dto/applications.dto'; 
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { EmailVerifiedGuard } from '../auth/guards/email-verified.guard';

@ApiTags('Applications')
@Controller() 
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ApplicationsController {
  constructor(private appsService: ApplicationsService) {}

  @Post('teams/:teamId/applications')
  @UseGuards(EmailVerifiedGuard)
  @ApiOperation({ summary: '申请加入队伍 (需信用分>=60)' })
  async applyToTeam(@Request() req, @Param('teamId') teamId: string, @Body() dto: ApplyTeamDto) {
    return this.appsService.applyToTeam(req.user.userId, teamId, dto.reason);
  }

  @Get('teams/:teamId/applications')
  @ApiOperation({ summary: '获取队伍的申请列表 (仅队长)' })
  async getApplications(@Request() req, @Param('teamId') teamId: string) {
    return this.appsService.getTeamApplications(req.user.userId, teamId);
  }

  @Post('applications/:id/approve')
  @UseGuards(EmailVerifiedGuard)
  @ApiOperation({ summary: '队长同意入队申请' })
  async approveApplication(@Request() req, @Param('id') id: string) {
    
    return this.appsService.reviewApplication(req.user.userId, id, 'APPROVED');
  }

  @Post('applications/:id/reject')
  @UseGuards(EmailVerifiedGuard)
  @ApiOperation({ summary: '队长拒绝入队申请' })
  async rejectApplication(@Request() req, @Param('id') id: string) {
    return this.appsService.reviewApplication(req.user.userId, id, 'REJECTED');
  }
}
