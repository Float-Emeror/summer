import { Injectable, NotFoundException } from '@nestjs/common';
import { UsersRepository } from './users.repository';
import { UpdateProfileDto, SlotDto } from './dto/users.dto';

@Injectable()
export class UsersService {
  constructor(private usersRepo: UsersRepository) {}

  async getProfile(userId: string) {
    const user = await this.usersRepo.findById(userId);
    if (!user) {
      throw new NotFoundException('找不到该用户');
    }
    return user;
  }

  async getProfileByStudentNo(studentNo: string) {
    const user = await this.usersRepo.findByStudentNo(studentNo);
    if (!user) {
      throw new NotFoundException('该学号对应的用户不存在');
    }
    return user;
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    return this.usersRepo.updateProfile(userId, dto);
  }

  async updateSkills(userId: string, skills: string[]) {
    return this.usersRepo.updateSkills(userId, skills);
  }

  async updateAvailability(userId: string, slots: SlotDto[]) {
    return this.usersRepo.updateAvailability(userId, slots);
  }

  async addFavorite(userId: string, teamId: string) {
    // 👈 移除 try-catch 块，让 Repository 层的 NotFoundException 直接穿透到控制器
    return this.usersRepo.addFavorite(userId, teamId);
  }

  async removeFavorite(userId: string, teamId: string) {
    return this.usersRepo.removeFavorite(userId, teamId);
  }

  async getUserFavorites(userId: string, pagination: { page?: number; pageSize?: number } = {}) {
    const page = Math.max(1, pagination.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, pagination.pageSize ?? 50));
    const favorites = await this.usersRepo.getUserFavorites(userId, {
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    return favorites.map(f => {
      const team = f.team;
      return {
        ...team,
        currentMembers: team.members?.length || 0,
        requiredSkills: team.requiredSkills?.map((s: any) => s.name || s) || []
      };
    });
  }
}
