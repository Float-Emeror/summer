import { Controller, Post, Get, Patch, Delete, Param, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { TaskStatus } from '@prisma/client';
import { TasksService } from './tasks.service';
import { CreateTaskDto, UpdateTaskStatusDto, UpdateTaskDto, UpdateTaskAssigneesDto, TaskResponseDto } from './dto/tasks.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { EmailVerifiedGuard } from '../auth/guards/email-verified.guard';

@ApiTags('Tasks')
@Controller() 
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class TasksController {
  constructor(private tasksService: TasksService) {}

  @Get('teams/:teamId/tasks')
  @ApiOperation({ summary: '获取队伍的任务看板墙' })
  async getTeamTasks(@Request() req, @Param('teamId') teamId: string) {
    const tasks = await this.tasksService.getTeamTasks(req.user.userId, teamId);
    // 列表数据：使用 map 批量转换为 DTO
    return tasks.map(task => new TaskResponseDto(task));
  }

  @Post('teams/:teamId/tasks')
  @UseGuards(EmailVerifiedGuard)
  @ApiOperation({ summary: '在队伍中发布新任务' })
  async createTask(@Request() req, @Param('teamId') teamId: string, @Body() dto: CreateTaskDto) {
    dto.teamId = teamId; 
    const task = await this.tasksService.createTask(req.user.userId, dto);
    return new TaskResponseDto(task);
  }

  @Patch('tasks/:id')
  @UseGuards(EmailVerifiedGuard)
  @ApiOperation({ summary: '修改任务基本信息 (标题/描述/截止日期)' })
  async updateTaskInfo(@Request() req, @Param('id') id: string, @Body() dto: UpdateTaskDto) {
    const task = await this.tasksService.updateTaskInfo(req.user.userId, id, dto);
    return new TaskResponseDto(task);
  }

  @Patch('tasks/:id/status')
  @UseGuards(EmailVerifiedGuard)
  @ApiOperation({ summary: '更新任务进度 (拖拽看板)' })
  async updateTaskStatus(@Request() req, @Param('id') id: string, @Body() dto: UpdateTaskStatusDto) {
    const task = await this.tasksService.updateTaskStatus(req.user.userId, id, dto.status);
    return new TaskResponseDto(task);
  }

  @Post('tasks/:id/confirm')
  @UseGuards(EmailVerifiedGuard)
  @ApiOperation({ summary: '队长确认任务完成' })
  async confirmTask(@Request() req, @Param('id') id: string) {
    const task = await this.tasksService.updateTaskStatus(req.user.userId, id, TaskStatus.CONFIRMED);
    return new TaskResponseDto(task);
  }

  @Patch('tasks/:id/assignees')
  @UseGuards(EmailVerifiedGuard)
  @ApiOperation({ summary: '重新分配任务负责人 (仅队长可用)' })
  async updateTaskAssignees(@Request() req, @Param('id') id: string, @Body() dto: UpdateTaskAssigneesDto) {
    const task = await this.tasksService.updateTaskAssignees(req.user.userId, id, dto.assigneeIds);
    return new TaskResponseDto(task);
  }

  @Delete('tasks/:id')
  @UseGuards(EmailVerifiedGuard)
  @ApiOperation({ summary: '删除任务 (仅队长可用)' })
  async deleteTask(@Request() req, @Param('id') id: string) {
    const task = await this.tasksService.deleteTask(req.user.userId, id);
    return new TaskResponseDto(task);
  }
}
