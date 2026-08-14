import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { TasksService } from './tasks.service';

describe('TasksService', () => {
  const buildService = () => {
    const tasksRepo = {
      checkTeamMembership: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      findByTeamId: jest.fn(),
      updateStatus: jest.fn(),
      updateTask: jest.fn(),
      deleteTask: jest.fn(),
      updateAssignees: jest.fn(),
    };

    const eventEmitter = {
      emit: jest.fn(),
    };

    return {
      service: new TasksService(tasksRepo as any, eventEmitter as any),
      tasksRepo,
      eventEmitter,
    };
  };

  it('should reject invalid task status transitions', async () => {
    const { service, tasksRepo } = buildService();
    tasksRepo.checkTeamMembership.mockResolvedValue({ role: 'MEMBER' });
    tasksRepo.findById.mockResolvedValue({
      id: 'task-1',
      teamId: 'team-1',
      status: 'DONE',
      assignments: [{ userId: 'u-1' }],
    });

    await expect(service.updateTaskStatus('u-1', 'task-1', 'TODO' as any)).rejects.toThrow(BadRequestException);
    await expect(service.updateTaskStatus('u-1', 'task-1', 'TODO' as any)).rejects.toThrow('非法状态转移');
  });

  it('should allow the owner to confirm a task only after completion', async () => {
    const { service, tasksRepo } = buildService();
    tasksRepo.checkTeamMembership.mockResolvedValue({ role: 'OWNER' });
    tasksRepo.findById.mockResolvedValue({
      id: 'task-1',
      teamId: 'team-1',
      status: 'DONE',
      assignments: [{ userId: 'u-1' }],
    });
    tasksRepo.updateStatus.mockResolvedValue({ status: 'CONFIRMED' });

    const result = await service.updateTaskStatus('owner-1', 'task-1', 'CONFIRMED' as any);

    expect(tasksRepo.updateStatus).toHaveBeenCalledWith('task-1', 'CONFIRMED');
    expect(result).toEqual({ status: 'CONFIRMED' });
  });

  it('should reject a non-owner from deleting a task', async () => {
    const { service, tasksRepo } = buildService();
    tasksRepo.checkTeamMembership.mockResolvedValue({ role: 'MEMBER' });
    tasksRepo.findById.mockResolvedValue({
      id: 'task-1',
      teamId: 'team-1',
      status: 'TODO',
      assignments: [],
    });

    await expect(service.deleteTask('u-1', 'task-1')).rejects.toThrow(ForbiddenException);
  });
});
