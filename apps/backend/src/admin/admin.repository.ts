import { Injectable } from '@nestjs/common';
import { AppealStatus, Prisma, ReportStatus, UserRole, UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminRepository {
  constructor(private readonly prisma: PrismaService) {}

  async reports(query: { page: number; pageSize: number; status?: ReportStatus }) {
    const where: Prisma.ReportWhereInput = query.status ? { status: query.status } : {};
    const [items, total] = await this.prisma.$transaction([
      this.prisma.report.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: {
          reporter: { select: { id: true, email: true, profile: { select: { nickname: true } } } },
          reportedUser: { select: { id: true, email: true, profile: { select: { nickname: true } } } },
          team: { select: { id: true, title: true } },
        },
      }),
      this.prisma.report.count({ where }),
    ]);
    return paged(items, total, query);
  }

  async appeals(query: { page: number; pageSize: number; status?: AppealStatus }) {
    const where: Prisma.AppealWhereInput = query.status ? { status: query.status } : {};
    const [items, total] = await this.prisma.$transaction([
      this.prisma.appeal.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: {
          user: { select: { id: true, email: true, profile: { select: { nickname: true } } } },
          review: {
            select: {
              id: true,
              rating: true,
              comment: true,
              team: { select: { id: true, title: true } },
              reviewer: { select: { id: true, email: true, profile: { select: { nickname: true } } } },
              reviewee: { select: { id: true, email: true, profile: { select: { nickname: true } } } },
            },
          },
        },
      }),
      this.prisma.appeal.count({ where }),
    ]);
    return paged(items, total, query);
  }

  async auditLogs(query: { page: number; pageSize: number }) {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: { actor: { select: { id: true, email: true, profile: { select: { nickname: true } } } } },
      }),
      this.prisma.auditLog.count(),
    ]);
    return paged(items, total, query);
  }

  resolveReport(actorId: string, id: string, resolution: string) {
    return this.prisma.$transaction(async (tx) => {
      const report = await tx.report.update({
        where: { id },
        data: { status: ReportStatus.RESOLVED, resolvedAt: new Date() },
      });
      await tx.auditLog.create({
        data: {
          actorId,
          action: 'REPORT_RESOLVED',
          target: `report:${id}`,
          metadata: { resolution },
        },
      });
      return report;
    });
  }

  resolveAppeal(actorId: string, id: string, decision: string) {
    return this.prisma.$transaction(async (tx) => {
      const appeal = await tx.appeal.update({
        where: { id },
        data: { status: AppealStatus.APPROVED, resolvedAt: new Date() },
      });
      await tx.auditLog.create({
        data: {
          actorId,
          action: 'APPEAL_RESOLVED',
          target: `appeal:${id}`,
          metadata: { decision },
        },
      });
      return appeal;
    });
  }

  accounts() {
    return this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        profile: { include: { skills: true } },
        availabilitySlots: { orderBy: [{ weekday: 'asc' }, { startTime: 'asc' }] },
      },
    });
  }

  account(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      include: {
        profile: { include: { skills: true } },
        availabilitySlots: { orderBy: [{ weekday: 'asc' }, { startTime: 'asc' }] },
      },
    });
  }

  createAccount(data: Prisma.UserCreateInput) {
    return this.prisma.user.create({
      data,
      include: {
        profile: { include: { skills: true } },
        availabilitySlots: true,
      },
    });
  }

  updateAccount(id: string, data: Prisma.UserUpdateInput) {
    return this.prisma.user.update({
      where: { id },
      data,
      include: {
        profile: { include: { skills: true } },
        availabilitySlots: true,
      },
    });
  }

  updateStatus(id: string, status: UserStatus, disabledReason?: string | null) {
    return this.updateAccount(id, {
      status,
      disabledAt: status === UserStatus.DISABLED ? new Date() : null,
      disabledReason: status === UserStatus.DISABLED ? disabledReason : null,
    });
  }

  updatePassword(id: string, passwordHash: string) {
    return this.updateAccount(id, { passwordHash });
  }

  async relationCounts(id: string) {
    const [
      ownedTeams,
      memberships,
      applications,
      taskAssignments,
      reviewsWritten,
      reviewsReceived,
      messages,
      notifications,
      reportsCreated,
      reportsTargeting,
      appeals,
    ] = await Promise.all([
      this.prisma.team.count({ where: { ownerId: id } }),
      this.prisma.teamMember.count({ where: { userId: id } }),
      this.prisma.application.count({ where: { applicantId: id } }),
      this.prisma.taskAssignment.count({ where: { userId: id } }),
      this.prisma.review.count({ where: { reviewerId: id } }),
      this.prisma.review.count({ where: { revieweeId: id } }),
      this.prisma.message.count({ where: { senderId: id } }),
      this.prisma.notification.count({ where: { userId: id } }),
      this.prisma.report.count({ where: { reporterId: id } }),
      this.prisma.report.count({ where: { reportedUserId: id } }),
      this.prisma.appeal.count({ where: { userId: id } }),
    ]);
    return {
      ownedTeams,
      memberships,
      applications,
      taskAssignments,
      reviewsWritten,
      reviewsReceived,
      messages,
      notifications,
      reportsCreated,
      reportsTargeting,
      appeals,
    };
  }

  deleteAccount(id: string) {
    return this.prisma.user.delete({ where: { id } });
  }
}

export type AdminAccountRecord = Awaited<ReturnType<AdminRepository['account']>>;
export { UserRole, UserStatus };

function paged<T>(items: T[], total: number, query: { page: number; pageSize: number }) {
  return {
    items,
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    },
  };
}
