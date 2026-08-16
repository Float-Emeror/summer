import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MatchRequirementDto } from './dto/match.dto';

@Injectable()
export class MatchService {
  constructor(private prisma: PrismaService) {}

  async recommendTeamsForUser(userId: string, requirements: MatchRequirementDto = {}) {
    const userSkills = await this.getUserSkills(userId);
    const requestedSkills = this.parseSkills(requirements.skills);
    const skillsForScoring = requestedSkills.length > 0 ? requestedSkills : userSkills;
    const where: any = { status: 'OPEN' };

    if (requirements.type) {
      where.type = requirements.type;
    }

    if (requirements.minBounty) {
      where.bountyAmount = { gte: Number(requirements.minBounty) };
    }

    if (requirements.keyword) {
      where.OR = [{ title: { contains: requirements.keyword } }, { description: { contains: requirements.keyword } }];
    }

    if (requestedSkills.length > 0) {
      where.requiredSkills = { some: { name: { in: requestedSkills } } };
    }

    const teams = await this.prisma.team.findMany({
      where,
      include: {
        requiredSkills: true,
        owner: { select: { id: true, profile: true } },
        members: true,
        _count: { select: { members: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return teams
      .map((team) => this.withTeamScore(team, skillsForScoring))
      .filter((team) => {
        if (requestedSkills.length > 0) {
          return team.matchScore > 0;
        }
        return true;
      })
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, 10);
  }

  async recommendUsersForUser(userId: string, requirements: MatchRequirementDto = {}) {
    const userSkills = await this.getUserSkills(userId);
    const requestedSkills = this.parseSkills(requirements.skills);
    const skillsForScoring = requestedSkills.length > 0 ? requestedSkills : userSkills;
    const keyword = requirements.keyword?.trim();

    const users = await this.prisma.user.findMany({
      where: {
        id: { not: userId },
        ...(requestedSkills.length > 0
          ? {
              profile: {
                skills: { some: { name: { in: requestedSkills } } },
              },
            }
          : {}),
        ...(keyword
          ? {
              OR: [
                { studentNo: { contains: keyword } },
                { email: { contains: keyword } },
                { profile: { is: { nickname: { contains: keyword } } } },
                { profile: { is: { college: { contains: keyword } } } },
                { profile: { is: { grade: { contains: keyword } } } },
              ],
            }
          : {}),
      },
      include: {
        profile: { include: { skills: true } },
      },
      take: 20,
    });

    return users
      .map((user) => {
        const skills = this.skillNames(user.profile?.skills);
        const matchedSkills = skills.filter((skill) => skillsForScoring.includes(skill));
        return {
          userId: user.id,
          studentNo: user.studentNo,
          nickname: user.profile?.nickname ?? '未命名',
          college: user.profile?.college,
          grade: user.profile?.grade,
          skills,
          matchScore: matchedSkills.length * 20,
          matchedSkills,
        };
      })
      .filter((user) => {
        if (requestedSkills.length > 0) {
          return user.matchScore > 0;
        }
        return true;
      })
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, 10);
  }

  private async getUserSkills(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: {
          include: { skills: true },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    return this.skillNames(user.profile?.skills);
  }

  private async ensureUserExists(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('用户不存在');
    }
  }

  private withTeamScore(team: any, userSkills: string[]) {
    const requiredSkills = this.skillNames(team.requiredSkills);
    const matchedSkills = requiredSkills.filter((skill) => userSkills.includes(skill));
    const remainingSlots = team.maxMembers - (team._count?.members ?? team.members?.length ?? 0);
    const skillScore = matchedSkills.length * 20;
    const urgencyBoost = remainingSlots === 1 ? 5 : 0;
    const bountyBoost = team.bountyAmount && Number(team.bountyAmount) > 0 ? 2 : 0;

    return {
      id: team.id,
      ownerId: team.ownerId,
      ownerNickname: team.owner?.profile?.nickname,
      type: team.type,
      title: team.title,
      description: team.description,
      maxMembers: team.maxMembers,
      currentMembers: team._count?.members ?? team.members?.length ?? 0,
      status: team.status,
      requiredSkills,
      deadline: team.deadline,
      bountyAmount: team.bountyAmount ? Number(team.bountyAmount) : null,
      createdAt: team.createdAt,
      updatedAt: team.updatedAt,
      matchScore: skillScore + urgencyBoost + bountyBoost,
      matchedSkills,
    };
  }

  private parseSkills(skills?: string) {
    return (skills ?? '')
      .split(',')
      .map((skill) => skill.trim())
      .filter(Boolean);
  }

  private skillNames(skills: any[] = []) {
    return skills.map((skill) => skill.name).filter(Boolean);
  }
}
