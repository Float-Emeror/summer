import { Injectable, NotFoundException } from '@nestjs/common'; // 👈 引入内置异常
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

type UserProfilePatch = Partial<Pick<Prisma.UserProfileUncheckedCreateInput, 'nickname' | 'college' | 'grade'>>;

@Injectable()
export class UsersRepository {
  constructor(private prisma: PrismaService) {}

  async create(data: Prisma.UserCreateInput) {
    return this.prisma.user.create({ data });
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
      include: { profile: { include: { skills: true } } },
    });
  }

  async findByStudentNo(studentNo: string) {
    return this.prisma.user.findUnique({
      where: { studentNo },
      include: {
        profile: { include: { skills: true } },
        availabilitySlots: true 
      }
    });
  }

  async findById(id: string) {
    return this.prisma.user.findUnique({ 
      where: { id },
      include: { 
        profile: { include: { skills: true } },
        availabilitySlots: true 
      } 
    });
  }

  async updateProfile(userId: string, data: UserProfilePatch) {
    return this.prisma.userProfile.upsert({
      where: { userId },
      update: data,
      create: {
        userId,
        nickname: data.nickname ?? '未命名同学',
        college: data.college,
        grade: data.grade,
      },
    });
  }

  async updateSkills(userId: string, skillNames: string[]) {
    return this.prisma.userProfile.update({
      where: { userId },
      data: {
        skills: {
          set: [], 
          connectOrCreate: skillNames.map(name => ({
            where: { name },
            create: { name }
          }))
        }
      }
    });
  }

  async updateAvailability(userId: string, slots: { weekday: number, startTime: string, endTime: string }[]) {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        availabilitySlots: {
          deleteMany: {}, 
          create: slots   
        }
      }
    });
  }

  async addFavorite(userId: string, teamId: string) {
    //  校验队伍是否存在，防止 Prisma 外键约束报错
    const teamExists = await this.prisma.team.findUnique({
      where: { id: teamId },
      select: { id: true }
    });
    
    if (!teamExists) {
      throw new NotFoundException('找不到该队伍，可能已被解散'); 
    }

    //  查重
    const existing = await this.prisma.favorite.findUnique({
      where: { userId_teamId: { userId, teamId } }
    });
    if (existing) return existing;

    //  写入
    return this.prisma.favorite.create({
      data: { userId, teamId }
    });
  }

  async removeFavorite(userId: string, teamId: string) {
    return this.prisma.favorite.deleteMany({
      where: { userId, teamId }
    });
  }

  async getUserFavorites(userId: string, pagination: { skip?: number; take?: number } = {}) {
    return this.prisma.favorite.findMany({
      where: { userId },
      skip: pagination.skip,
      take: pagination.take,
      include: {
        team: {
          include: { 
            requiredSkills: true, 
            owner: { select: { profile: true } } ,
            members: true
          }
        }
      },
      orderBy: { createdAt: 'desc' } 
    });
  }
}
