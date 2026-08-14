import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ListTeamsQueryDto } from './dto/teams.dto';

@Injectable()
export class TeamsRepository {
  constructor(private prisma: PrismaService) {}

  async create(ownerId: string, data: any, skills: string[], teamCode: string) {
    return this.prisma.team.create({
      data: {
        ownerId,
        teamCode,
        type: data.type,
        title: data.title,
        description: data.description,
        maxMembers: data.maxMembers,
        deadline: data.deadline ? new Date(data.deadline) : null,
        bountyAmount: data.bountyAmount,
        requiredSkills: {
          connectOrCreate: skills.map((name) => ({
            where: { name },
            create: { name },
          })),
        },
        members: {
          create: { userId: ownerId, role: 'OWNER' },
        },
      },
      include: this.teamInclude(),
    });
  }

  async findByCode(teamCode: string) {
    return this.prisma.team.findUnique({
      where: { teamCode },
      include: this.teamInclude(),
    });
  }

  async findMissingCodes() {
    return this.prisma.team.findMany({
      where: { teamCode: null },
      select: { id: true },
    });
  }

  async updateCode(teamId: string, teamCode: string) {
    return this.prisma.team.update({
      where: { id: teamId },
      data: { teamCode },
    });
  }

  async addMember(teamId: string, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const team = await tx.team.findUnique({
        where: { id: teamId },
        include: { members: true },
      });

      if (!team) {
        throw new Error('TEAM_NOT_FOUND');
      }
      if (team.status !== 'OPEN') {
        throw new Error('TEAM_NOT_OPEN');
      }
      if (team.members.some((member) => member.userId === userId)) {
        throw new Error('ALREADY_MEMBER');
      }
      if (team.members.length >= team.maxMembers) {
        throw new Error('TEAM_FULL');
      }

      await tx.teamMember.create({
        data: {
          teamId: team.id,
          userId,
          role: 'MEMBER',
        },
      });

      const nextCount = team.members.length + 1;
      if (nextCount >= team.maxMembers) {
        await tx.team.update({
          where: { id: team.id },
          data: { status: 'FULL' },
        });
      }

      const updated = await tx.team.findUnique({
        where: { id: team.id },
        include: this.teamInclude(),
      });

      if (!updated) {
        throw new Error('TEAM_NOT_FOUND');
      }

      return updated;
    });
  }
  async findAll(query: ListTeamsQueryDto) {
    const where = this.buildWhere(query);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const orderBy = this.buildOrderBy(query);

    const [teams, total] = await this.prisma.$transaction([
      this.prisma.team.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: this.teamInclude(),
      }),
      this.prisma.team.count({ where }),
    ]);

    return {
      teams,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  async findById(teamId: string) {
    return this.prisma.team.findUnique({
      where: { id: teamId },
      include: {
        ...this.teamInclude(),
        applications: true,
      },
    });
  }

  async findByMember(userId: string) {
    return this.prisma.team.findMany({
      where: { members: { some: { userId } } },
      orderBy: { createdAt: 'desc' },
      include: this.teamInclude(),
    });
  }

  async update(teamId: string, data: any) {
    const { requiredSkills, deadline, ...teamData } = data;
    return this.prisma.team.update({
      where: { id: teamId },
      data: {
        ...teamData,
        ...(deadline !== undefined ? { deadline: deadline ? new Date(deadline) : null } : {}),
        ...(requiredSkills
          ? {
              requiredSkills: {
                set: [],
                connectOrCreate: requiredSkills.map((name: string) => ({
                  where: { name },
                  create: { name },
                })),
              },
            }
          : {}),
      },
      include: this.teamInclude(),
    });
  }

  async updateStatus(teamId: string, status: any) {
    return this.prisma.team.update({
      where: { id: teamId },
      data: { status },
      include: this.teamInclude(),
    });
  }

  private buildWhere(query: ListTeamsQueryDto) {
    const where: any = {};

    where.status = query.status ?? 'OPEN';

    if (query.keyword) {
      where.OR = [{ title: { contains: query.keyword } }, { description: { contains: query.keyword } }];
    }

    if (query.type) {
      where.type = query.type;
    }

    if (query.skill) {
      const skills = query.skill
        .split(',')
        .map((skill) => skill.trim())
        .filter(Boolean);
      if (skills.length > 0) {
        where.requiredSkills = { some: { name: { in: skills } } };
      }
    }

    if (query.college) {
      where.owner = { profile: { college: query.college } };
    }

    if (query.minMembers || query.maxMembers) {
      where.maxMembers = {
        ...(query.minMembers ? { gte: query.minMembers } : {}),
        ...(query.maxMembers ? { lte: query.maxMembers } : {}),
      };
    }

    return where;
  }

  private buildOrderBy(query: ListTeamsQueryDto) {
    const direction = query.sortOrder ?? 'desc';
    if (query.sortBy === 'deadline') {
      return { deadline: direction };
    }
    if (query.sortBy === 'members') {
      return { members: { _count: direction } };
    }
    return { createdAt: direction };
  }

  private teamInclude() {
    return {
      requiredSkills: true,
      owner: { select: { id: true, email: true, studentNo: true, profile: true } },
      members: { include: { user: { select: { id: true, email: true, studentNo: true, profile: { include: { skills: true } } } } } },
      _count: { select: { members: true } },
    };
  }
}
