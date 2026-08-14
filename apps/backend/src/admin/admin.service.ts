import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UserRole, UserStatus } from '@prisma/client';
import {
  AdminAppealQueryDto,
  AdminPageQueryDto,
  AdminReportQueryDto,
  CreateAccountDto,
  DisableAccountDto,
  ResetPasswordDto,
  ResolveAppealDto,
  ResolveReportDto,
  UpdateAccountDto,
} from './dto/admin.dto';
import { AdminAccountRecord, AdminRepository } from './admin.repository';

@Injectable()
export class AdminService {
  constructor(private readonly adminRepository: AdminRepository) {}

  reports(query: AdminReportQueryDto = {}) {
    return this.adminRepository.reports(normalizePageQuery(query));
  }

  async resolveReport(actorId: string, id: string, dto: ResolveReportDto) {
    try {
      return await this.adminRepository.resolveReport(actorId, id, dto.resolution.trim());
    } catch {
      throw new NotFoundException('举报不存在');
    }
  }

  appeals(query: AdminAppealQueryDto = {}) {
    return this.adminRepository.appeals(normalizePageQuery(query));
  }

  async resolveAppeal(actorId: string, id: string, dto: ResolveAppealDto) {
    try {
      return await this.adminRepository.resolveAppeal(actorId, id, dto.decision.trim());
    } catch {
      throw new NotFoundException('申诉不存在');
    }
  }

  auditLogs(query: AdminPageQueryDto = {}) {
    return this.adminRepository.auditLogs(normalizePageQuery(query));
  }

  async accounts() {
    const accounts = await this.adminRepository.accounts();
    return accounts.map(formatAccount);
  }

  async createAccount(dto: CreateAccountDto) {
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const account = await this.adminRepository.createAccount({
      email: dto.email.trim().toLowerCase(),
      studentNo: dto.studentNo.trim(),
      passwordHash,
      role: dto.role,
      status: dto.status ?? UserStatus.ACTIVE,
      disabledAt: dto.status === UserStatus.DISABLED ? new Date() : null,
      profile: {
        create: {
          nickname: dto.nickname.trim(),
          college: dto.college?.trim() || null,
          grade: dto.grade?.trim() || null,
          completeness: 82,
          skills: {
            connectOrCreate: normalizeSkills(dto.skills).map((name) => ({ where: { name }, create: { name } })),
          },
        },
      },
      availabilitySlots: {
        create: dto.availability ?? [],
      },
    });
    return formatAccount(account);
  }

  async updateAccount(id: string, dto: UpdateAccountDto) {
    await this.ensureAccount(id);
    const account = await this.adminRepository.updateAccount(id, {
      ...(dto.email ? { email: dto.email.trim().toLowerCase() } : {}),
      ...(dto.studentNo ? { studentNo: dto.studentNo.trim() } : {}),
      ...(dto.role ? { role: dto.role } : {}),
      ...(dto.status ? statusPatch(dto.status) : {}),
      profile: {
        upsert: {
          update: {
            ...(dto.nickname ? { nickname: dto.nickname.trim() } : {}),
            ...(dto.college !== undefined ? { college: dto.college.trim() || null } : {}),
            ...(dto.grade !== undefined ? { grade: dto.grade.trim() || null } : {}),
            ...(dto.skills
              ? {
                  skills: {
                    set: [],
                    connectOrCreate: normalizeSkills(dto.skills).map((name) => ({ where: { name }, create: { name } })),
                  },
                }
              : {}),
          },
          create: {
            nickname: dto.nickname?.trim() || '未命名同学',
            college: dto.college?.trim() || null,
            grade: dto.grade?.trim() || null,
            completeness: 82,
            skills: {
              connectOrCreate: normalizeSkills(dto.skills).map((name) => ({ where: { name }, create: { name } })),
            },
          },
        },
      },
      ...(dto.availability
        ? {
            availabilitySlots: {
              deleteMany: {},
              create: dto.availability,
            },
          }
        : {}),
    });
    return formatAccount(account);
  }

  async disableAccount(id: string, dto: DisableAccountDto) {
    await this.ensureAccount(id);
    return formatAccount(await this.adminRepository.updateStatus(id, UserStatus.DISABLED, dto.reason?.trim() || '管理员禁用'));
  }

  async enableAccount(id: string) {
    await this.ensureAccount(id);
    return formatAccount(await this.adminRepository.updateStatus(id, UserStatus.ACTIVE, null));
  }

  async resetPassword(id: string, dto: ResetPasswordDto) {
    await this.ensureAccount(id);
    const passwordHash = await bcrypt.hash(dto.password, 10);
    return formatAccount(await this.adminRepository.updatePassword(id, passwordHash));
  }

  async deleteAccount(id: string) {
    await this.ensureAccount(id);
    const counts = await this.adminRepository.relationCounts(id);
    const hasRelations = Object.entries(counts).some(([, count]) => count > 0);
    if (hasRelations) {
      throw new BadRequestException('该账号已有队伍、任务或消息等关联数据，请改用禁用账号。');
    }
    await this.adminRepository.deleteAccount(id);
    return { success: true };
  }

  private async ensureAccount(id: string) {
    const account = await this.adminRepository.account(id);
    if (!account) {
      throw new NotFoundException('账号不存在');
    }
    return account;
  }
}

function normalizePageQuery<T extends AdminPageQueryDto>(query: T) {
  return {
    ...query,
    page: Math.max(1, Number(query.page ?? 1)),
    pageSize: Math.min(100, Math.max(1, Number(query.pageSize ?? 20))),
  };
}

function normalizeSkills(skills: string[] = []) {
  return [...new Set(skills.map((skill) => skill.trim()).filter(Boolean))];
}

function statusPatch(status: UserStatus) {
  return {
    status,
    disabledAt: status === UserStatus.DISABLED ? new Date() : null,
    disabledReason: status === UserStatus.DISABLED ? '管理员禁用' : null,
  };
}

function formatAccount(account: NonNullable<AdminAccountRecord>) {
  return {
    id: account.id,
    email: account.email,
    studentNo: account.studentNo,
    role: account.role as UserRole,
    status: account.status,
    disabledAt: account.disabledAt,
    disabledReason: account.disabledReason,
    createdAt: account.createdAt,
    updatedAt: account.updatedAt,
    nickname: account.profile?.nickname ?? '未命名同学',
    college: account.profile?.college ?? '',
    grade: account.profile?.grade ?? '',
    skills: account.profile?.skills.map((skill) => skill.name) ?? [],
    availability: account.availabilitySlots.map((slot) => ({
      weekday: slot.weekday,
      startTime: slot.startTime,
      endTime: slot.endTime,
    })),
  };
}
