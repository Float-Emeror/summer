import { Controller, Post, Get, Patch, Param, Body, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { TeamsService } from './teams.service';
import { ApplicationsService } from '../applications/applications.service';
import { CreateTeamDto, JoinTeamByCodeDto, ListTeamsQueryDto, UpdateTeamDto } from './dto/teams.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { EmailVerifiedGuard } from '../auth/guards/email-verified.guard';

@ApiTags('Teams')
@Controller('teams')
@ApiBearerAuth()
export class TeamsController {
  constructor(private teamsService: TeamsService, private appsService: ApplicationsService) {}

  private formatTeamSkills(team: any) {
    if (!team) return team;
    return {
      ...team,
      requiredSkills: team.requiredSkills?.map((skill: any) => skill.name || skill) || []
    };
  }

  @Post()
  @UseGuards(JwtAuthGuard, EmailVerifiedGuard)
  @ApiOperation({ summary: '发布新队伍 (需信用分>=60)' })
  async createTeam(@Request() req, @Body() dto: CreateTeamDto) {
    const team = await this.teamsService.createTeam(req.user.userId, dto);
    return this.formatTeamSkills(team);
  }

  @Post('join-by-code')
  @UseGuards(JwtAuthGuard, EmailVerifiedGuard)
  @ApiOperation({ summary: '通过队伍码申请加入队伍（向队长发送入队申请）' })
  async joinByCode(@Request() req, @Body() dto: JoinTeamByCodeDto) {
    // 先根据队伍码解析出队伍 ID，再创建一条申请记录交由队长审批
    const team = await this.teamsService.findTeamByCode(dto.teamCode);
    if (!team) {
      return { error: '队伍码无效或队伍不存在' };
    }
    const application = await this.appsService.applyToTeam(req.user.userId, team.id, '通过队伍码申请加入');
    return application;
  }

  @Get()
  @ApiOperation({ summary: '获取公开队伍列表 (支持状态/技能等过滤)' })
  async getTeams(@Query() query: ListTeamsQueryDto) {
    const result: any = await this.teamsService.getTeams(query);

    if (Array.isArray(result)) {
      return result.map((t: any) => this.formatTeamSkills(t));
    } else if (result && Array.isArray(result.teams)) {
      return { ...result, teams: result.teams.map((t: any) => this.formatTeamSkills(t)) };
    } else if (result && Array.isArray(result.data)) {
      return { ...result, data: result.data.map((t: any) => this.formatTeamSkills(t)) };
    }
    return result;
  }

  @Get('mine')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: '获取我创建或加入的队伍 (任务看板入口)' })
  async getMyTeams(@Request() req) {
    const teams = await this.teamsService.getMyTeams(req.user.userId);
    return teams.map((t: any) => this.formatTeamSkills(t));
  }

  @Get(':id')
  @ApiOperation({ summary: '获取队伍详情' })
  async getTeamDetail(@Param('id') id: string) {
    const team = await this.teamsService.getTeamDetail(id);
    return this.formatTeamSkills(team);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, EmailVerifiedGuard)
  @ApiOperation({ summary: '修改队伍信息 (仅队长)' })
  async updateTeam(@Request() req, @Param('id') id: string, @Body() dto: UpdateTeamDto) {
    const team = await this.teamsService.updateTeam(req.user.userId, id, dto);
    return this.formatTeamSkills(team);
  }

  @Post(':id/close')
  @UseGuards(JwtAuthGuard, EmailVerifiedGuard)
  @ApiOperation({ summary: '手动关闭队伍招募 (仅队长)' })
  async closeTeam(@Request() req, @Param('id') id: string) {
    const team = await this.teamsService.closeTeam(req.user.userId, id);
    return this.formatTeamSkills(team);
  }
}
