import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CreditService } from '../credit/credit.service';
import { CreateTeamDto, ListTeamsQueryDto } from './dto/teams.dto';
import { TeamsRepository } from './teams.repository';

@Injectable()
export class TeamsService {
  constructor(
    private teamsRepo: TeamsRepository,
    private creditService: CreditService,
  ) {}

  async createTeam(userId: string, dto: CreateTeamDto) {
    await this.checkCreditThreshold(userId);
    const { requiredSkills = [], ...teamData } = dto;
    const teamCode = await this.generateUniqueTeamCode();
    const team = await this.teamsRepo.create(userId, teamData, requiredSkills, teamCode);
    return this.toTeamDetail(team);
  }

  async joinTeamByCode(userId: string, teamCode: string) {
    await this.checkCreditThreshold(userId);
    const normalizedCode = teamCode.trim().toUpperCase();

    const team = await this.teamsRepo.findByCode(normalizedCode);
    if (!team) {
      throw new NotFoundException('队伍码无效或队伍不存在');
    }

    try {
      const joined = await this.teamsRepo.addMember(team.id, userId);
      return this.toTeamDetail(joined);
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'UNKNOWN';
      if (reason === 'TEAM_NOT_OPEN') {
        throw new BadRequestException('该队伍当前不可加入');
      }
      if (reason === 'ALREADY_MEMBER') {
        throw new BadRequestException('您已在该队伍中');
      }
      if (reason === 'TEAM_FULL') {
        throw new BadRequestException('该队伍人数已满');
      }
      if (reason === 'TEAM_NOT_FOUND') {
        throw new NotFoundException('队伍不存在');
      }
      throw error;
    }
  }

  async getTeams(query: ListTeamsQueryDto) {
    await this.backfillMissingTeamCodes();
    const result = await this.teamsRepo.findAll(query);
    return {
      teams: result.teams.map((team) => this.toTeamListItem(team)),
      pagination: result.pagination,
    };
  }

  async getMyTeams(userId: string) {
    await this.backfillMissingTeamCodes();
    const teams = await this.teamsRepo.findByMember(userId);
    return teams.map((team) => ({
      ...this.toTeamListItem(team),
      // 标注当前用户在该队伍中的角色，便于前端区分“我创建的”和“我加入的”。
      myRole: team.members?.find((member: any) => member.userId === userId)?.role ?? 'MEMBER',
    }));
  }

  async getTeamDetail(teamId: string) {
    await this.backfillMissingTeamCodes();
    const team = await this.teamsRepo.findById(teamId);
    if (!team) {
      throw new NotFoundException('找不到该队伍');
    }
    return this.toTeamDetail(team);
  }

  async updateTeam(userId: string, teamId: string, dto: any) {
    const team = await this.teamsRepo.findById(teamId);
    if (!team) {
      throw new NotFoundException('找不到该队伍');
    }
    if (team.ownerId !== userId) {
      throw new ForbiddenException('权限不足：只有队长可以修改队伍信息');
    }

    if (typeof dto.teamCode === 'string') {
      dto.teamCode = dto.teamCode.trim().toUpperCase();
      if (!/^[A-Z0-9]{8}$/.test(dto.teamCode)) {
        throw new BadRequestException('队伍码格式错误，应为 8 位大写字母数字');
      }
      const exists = await this.teamsRepo.findByCode(dto.teamCode);
      if (exists && exists.id !== teamId) {
        throw new BadRequestException('队伍码已被占用，请更换一个新的');
      }
    }

    const updated = await this.teamsRepo.update(teamId, dto);
    return this.toTeamDetail(updated);
  }

  async closeTeam(userId: string, teamId: string) {
    const team = await this.teamsRepo.findById(teamId);
    if (!team) {
      throw new NotFoundException('找不到该队伍');
    }
    if (team.ownerId !== userId) {
      throw new ForbiddenException('权限不足：只有队长可以关闭队伍招募');
    }

    const updated = await this.teamsRepo.updateStatus(teamId, 'CLOSED');
    return this.toTeamDetail(updated);
  }

  private async checkCreditThreshold(userId: string) {
    const credit = await this.creditService.getUserTotalCredit(userId);
    if (credit.totalScore < 60) {
      throw new ForbiddenException('您的信用分低于 60 分，系统已限制您发布招募。');
    }
  }

  private toTeamListItem(team: any) {
    return {
      id: team.id,
      teamCode: team.teamCode,
      ownerId: team.ownerId,
      ownerNickname: team.owner?.profile?.nickname,
      type: team.type,
      title: team.title,
      description: team.description,
      maxMembers: team.maxMembers,
      currentMembers: team._count?.members ?? team.members?.length ?? 0,
      status: team.status,
      requiredSkills: this.skillNames(team.requiredSkills),
      deadline: team.deadline,
      bountyAmount: team.bountyAmount ? Number(team.bountyAmount) : null,
      createdAt: team.createdAt,
      updatedAt: team.updatedAt,
      matchScore: team.matchScore,
    };
  }

  private toTeamDetail(team: any) {
    const listItem = this.toTeamListItem(team);
    return {
      ...listItem,
      owner: team.owner
        ? {
            id: team.owner.id,
            nickname: team.owner.profile?.nickname,
            college: team.owner.profile?.college,
            grade: team.owner.profile?.grade,
          }
        : undefined,
      members: (team.members ?? []).map((member: any) => ({
        userId: member.userId,
        nickname: member.user?.profile?.nickname,
        role: member.role,
        skills: this.skillNames(member.user?.profile?.skills),
        joinedAt: member.joinedAt,
      })),
      applications: this.applicationCounts(team.applications),
    };
  }

  private skillNames(skills: any[] = []) {
    return skills.map((skill) => skill.name).filter(Boolean);
  }

  private applicationCounts(applications?: any[]) {
    if (!applications) {
      return undefined;
    }
    return {
      pending: applications.filter((application) => application.status === 'PENDING').length,
      approved: applications.filter((application) => application.status === 'APPROVED').length,
      rejected: applications.filter((application) => application.status === 'REJECTED').length,
    };
  }

  private async generateUniqueTeamCode() {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const code = this.randomTeamCode(8);
      const exists = await this.teamsRepo.findByCode(code);
      if (!exists) {
        return code;
      }
    }
    throw new ForbiddenException('队伍码生成失败，请稍后重试');
  }

  private randomTeamCode(length: number) {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < length; i += 1) {
      code += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    return code;
  }

  private async backfillMissingTeamCodes() {
    const teams = await this.teamsRepo.findMissingCodes();
    for (const team of teams) {
      const teamCode = await this.generateUniqueTeamCode();
      await this.teamsRepo.updateCode(team.id, teamCode);
    }
  }

  // 查找队伍（按队伍码）——供控制器调用以支持通过队伍码申请入队
  async findTeamByCode(teamCode: string) {
    return this.teamsRepo.findByCode(teamCode.trim().toUpperCase());
  }
}
