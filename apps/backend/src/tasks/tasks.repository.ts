import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TaskStatus } from '@prisma/client';

@Injectable()
export class TasksRepository {
  constructor(private prisma: PrismaService) {}

  async create(data: any, assigneeIds: string[]) {
    return this.prisma.task.create({
      data: {
        teamId: data.teamId,
        title: data.title,
        description: data.description,
        deadline: data.deadline ? new Date(data.deadline) : null,
        assignments: assigneeIds && assigneeIds.length > 0 ? {
          create: assigneeIds.map(userId => ({ userId }))
        } : undefined
      },
      include: { assignments: { include: { user: { select: { profile: true } } } } }
    });
  }

  async findByTeamId(teamId: string) {
    return this.prisma.task.findMany({
      where: { teamId },
      orderBy: { createdAt: 'desc' },
      include: { assignments: { include: { user: { select: { id: true, email: true, profile: true } } } } }
    });
  }

  async findById(taskId: string) {
    return this.prisma.task.findUnique({
      where: { id: taskId },
      include: { team: true, assignments: true }
    });
  }

  async updateStatus(taskId: string, status: TaskStatus) {
    const isConfirmed = status === 'CONFIRMED';
    return this.prisma.task.update({
      where: { id: taskId },
      data: { status, confirmedAt: isConfirmed ? new Date() : null }
    });
  }

  async updateTask(taskId: string, data: any) {
    return this.prisma.task.update({
      where: { id: taskId },
      data: {
        title: data.title,
        description: data.description,
        deadline: data.deadline ? new Date(data.deadline) : undefined,
      }
    });
  }

  async deleteTask(taskId: string) {
    return this.prisma.task.delete({ where: { id: taskId } });
  }

  async updateAssignees(taskId: string, assigneeIds: string[]) {
    return this.prisma.$transaction(async (prisma) => {
      await prisma.taskAssignment.deleteMany({ where: { taskId } });
      if (assigneeIds.length > 0) {
        await prisma.taskAssignment.createMany({
          data: assigneeIds.map(userId => ({ taskId, userId }))
        });
      }
      return prisma.task.findUnique({
        where: { id: taskId },
        include: { assignments: { include: { user: { select: { profile: true } } } } }
      });
    });
  }

  async checkTeamMembership(teamId: string, userId: string) {
    return this.prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId } }
    });
  }
}