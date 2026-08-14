import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsArray, IsDateString, IsIn } from 'class-validator';
import { TaskStatus } from '@prisma/client';

const TASK_STATUSES = ['TODO', 'DOING', 'DONE', 'CONFIRMED'] as const;

export class CreateTaskDto {
  @ApiProperty({ example: 'cm...teamId...' })
  @IsOptional()
  @IsString()
  teamId?: string;

  @ApiProperty({ example: '完成多模态大模型后端的 API 接口开发' })
  @IsString()
  title!: string;

  @ApiPropertyOptional({ example: '需要考虑并发请求下的性能优化，周末前对接前端页面。' })
  @IsOptional() @IsString()
  description?: string;

  @ApiPropertyOptional({ example: '2026-06-30T00:00:00Z' })
  @IsOptional() @IsDateString()
  deadline?: string;

  @ApiPropertyOptional({ type: [String], description: '被分配该任务的成员 ID 列表' })
  @IsOptional() @IsArray() @IsString({ each: true })
  assigneeIds?: string[];
}

export class UpdateTaskStatusDto {
  @ApiProperty({ enum: TASK_STATUSES, example: 'DOING' })
  @IsIn(TASK_STATUSES)
  status!: TaskStatus;
}

export class UpdateTaskDto {
  @ApiPropertyOptional({ example: '修改后的任务标题' })
  @IsOptional() @IsString()
  title?: string;

  @ApiPropertyOptional({ example: '修改后的任务描述' })
  @IsOptional() @IsString()
  description?: string;

  @ApiPropertyOptional({ example: '2026-07-01T00:00:00Z' })
  @IsOptional() @IsDateString()
  deadline?: string;
}

export class UpdateTaskAssigneesDto {
  @ApiProperty({ type: [String], example: ['user_id_1', 'user_id_2'] })
  @IsArray() @IsString({ each: true })
  assigneeIds!: string[];
}

export class TaskResponseDto {
  id: string;
  teamId: string;
  title: string;
  description?: string | null;
  status: string;
  deadline?: Date | null;
  createdAt: Date;
  
  assigneeIds: string[];

  constructor(task: any) {
    if (!task) return;
    this.id = task.id;
    this.teamId = task.teamId;
    this.title = task.title;
    this.description = task.description;
    this.deadline = task.deadline;
    this.createdAt = task.createdAt;

    this.status = task.status === 'CONFIRMED' ? 'DONE' : task.status;

    this.assigneeIds = task.assignments?.map((a: any) => a.userId) || [];
  }
}
