import { BadRequestException, Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { TasksRepository } from './tasks.repository';
import { CreateTaskDto, UpdateTaskDto } from './dto/tasks.dto';
import { TaskStatus, NotificationType } from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { EventNames, NotificationCreateEvent } from '../events/domain-events';

@Injectable()
export class TasksService {
  constructor(
    private tasksRepo: TasksRepository,
    private eventEmitter: EventEmitter2 
  ) {}

  private async verifyTeamMember(teamId: string, userId: string) {
    const member = await this.tasksRepo.checkTeamMembership(teamId, userId);
    if (!member) throw new ForbiddenException('抱歉，您不是该队伍的成员，无法执行此操作');
    return member;
  }

  private async getValidTask(taskId: string) {
    const task = await this.tasksRepo.findById(taskId);
    if (!task) throw new NotFoundException('找不到该任务');
    return task;
  }

  async createTask(userId: string, dto: CreateTaskDto) {
    if (!dto.teamId) {
      throw new BadRequestException('缺少队伍 ID');
    }

    await this.verifyTeamMember(dto.teamId, userId);
    const { assigneeIds, ...taskData } = dto;
    
    const task = await this.tasksRepo.create(taskData, assigneeIds || []);

    if (assigneeIds && assigneeIds.length > 0) {
      assigneeIds.forEach(assigneeId => {
        this.eventEmitter.emit(
          EventNames.NOTIFICATION_CREATE,
          new NotificationCreateEvent(
            assigneeId,
            NotificationType.TASK_ASSIGNED, 
            '新任务指派',
            `队长给您指派了一项新任务：【${taskData.title}】，请及时确认进度。`
          )
        );
      });
    }

    return task;
  }

  async getTeamTasks(userId: string, teamId: string) {
    await this.verifyTeamMember(teamId, userId);
    return this.tasksRepo.findByTeamId(teamId);
  }

  async updateTaskStatus(userId: string, taskId: string, status: TaskStatus) {
    const task = await this.getValidTask(taskId);
    const member = await this.verifyTeamMember(task.teamId, userId);

    const allowedTransitions: Record<TaskStatus, TaskStatus[]> = {
      TODO: ['DOING', 'DONE'],
      DOING: ['DONE'],
      DONE: ['CONFIRMED'],
      CONFIRMED: [],
    };

    if (task.status !== 'TODO' && task.status !== 'DOING' && task.status !== 'DONE' && task.status !== 'CONFIRMED') {
      throw new BadRequestException('非法状态转移');
    }

    const currentStatus = task.status as TaskStatus;
    const validNextStatuses = allowedTransitions[currentStatus] ?? [];
    if (!validNextStatuses.includes(status)) {
      throw new BadRequestException('非法状态转移');
    }

    if (member.role !== 'OWNER') {
      if (status === 'CONFIRMED') {
        throw new ForbiddenException('只有队长可以进行最终的 CONFIRMED 确认');
      }
      const isAssignee = task.assignments.some(a => a.userId === userId);
      if (task.assignments.length > 0 && !isAssignee) {
        throw new ForbiddenException('您不是该任务的负责人，无法修改其进度状态');
      }
    }
    return this.tasksRepo.updateStatus(taskId, status);
  }
  
  async updateTaskInfo(userId: string, taskId: string, dto: UpdateTaskDto) {
    const task = await this.getValidTask(taskId);
    await this.verifyTeamMember(task.teamId, userId);
    return this.tasksRepo.updateTask(taskId, dto);
  }

  async deleteTask(userId: string, taskId: string) {
    const task = await this.getValidTask(taskId);
    const member = await this.verifyTeamMember(task.teamId, userId);
    if (member.role !== 'OWNER') {
      throw new ForbiddenException('只有队长可以删除任务');
    }
    return this.tasksRepo.deleteTask(taskId);
  }

  async updateTaskAssignees(userId: string, taskId: string, assigneeIds: string[]) {
    const task = await this.getValidTask(taskId);
    const member = await this.verifyTeamMember(task.teamId, userId);
    if (member.role !== 'OWNER') {
      throw new ForbiddenException('只有队长可以调整任务的负责人');
    }
    return this.tasksRepo.updateAssignees(taskId, assigneeIds);
  }
}
