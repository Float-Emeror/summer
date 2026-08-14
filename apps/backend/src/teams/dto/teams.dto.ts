import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TeamStatus, TeamType } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';

export class CreateTeamDto {
  @ApiProperty({ enum: TeamType, example: 'COURSE' })
  @IsEnum(TeamType)
  type!: TeamType;

  @ApiProperty({ example: '软件工程课程项目组队' })
  @IsString()
  title!: string;

  @ApiProperty({ example: '需要前端、后端和测试同学协作完成校园组队平台。' })
  @IsString()
  description!: string;

  @ApiProperty({ example: 5 })
  @IsInt()
  @Min(2)
  @Max(20)
  maxMembers!: number;

  @ApiPropertyOptional({ example: ['React', 'NestJS', 'MySQL'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  requiredSkills: string[] = [];

  @ApiPropertyOptional({ example: '2026-06-30T00:00:00Z' })
  @IsOptional()
  @IsDateString()
  deadline?: string;

  @ApiPropertyOptional({ example: 200 })
  @IsOptional()
  @IsNumber()
  bountyAmount?: number;
}

export class UpdateTeamDto {
  @ApiPropertyOptional({ enum: TeamType, example: 'COURSE' })
  @IsOptional()
  @IsEnum(TeamType)
  type?: TeamType;

  @ApiPropertyOptional({ example: '软件工程课程项目组队' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ example: '需要前端、后端和测试同学协作完成校园组队平台。' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 5 })
  @IsOptional()
  @IsInt()
  @Min(2)
  @Max(20)
  maxMembers?: number;

  @ApiPropertyOptional({ example: ['React', 'NestJS', 'MySQL'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  requiredSkills?: string[];

  @ApiPropertyOptional({ example: '2026-06-30T00:00:00Z' })
  @IsOptional()
  @IsDateString()
  deadline?: string;

  @ApiPropertyOptional({ example: 200 })
  @IsOptional()
  @IsNumber()
  bountyAmount?: number;

  @ApiPropertyOptional({ example: '9X2Q7MKA', description: '8 位大写字母数字队伍码' })
  @IsOptional()
  @IsString()
  @Matches(/^[A-Z0-9]{8}$/, { message: '队伍码格式错误，应为 8 位大写字母数字' })
  teamCode?: string;
}

export class ListTeamsQueryDto {
  @ApiPropertyOptional({ enum: TeamType })
  @IsOptional()
  @IsEnum(TeamType)
  type?: TeamType;

  @ApiPropertyOptional({ enum: TeamStatus })
  @IsOptional()
  @IsEnum(TeamStatus)
  status?: TeamStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  keyword?: string;

  @ApiPropertyOptional({ description: 'Comma-separated skill names' })
  @IsOptional()
  @IsString()
  skill?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  college?: string;

  @ApiPropertyOptional({ minimum: 2 })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(2)
  minMembers?: number;

  @ApiPropertyOptional({ maximum: 20 })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Max(20)
  maxMembers?: number;

  @ApiPropertyOptional({ enum: ['createdAt', 'deadline', 'members'], default: 'createdAt' })
  @IsOptional()
  @IsIn(['createdAt', 'deadline', 'members'])
  sortBy: 'createdAt' | 'deadline' | 'members' = 'createdAt';

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder: 'asc' | 'desc' = 'desc';

  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number = 20;
}

export class JoinTeamByCodeDto {
  @ApiProperty({ example: '9X2Q7MKA', description: '8 位大写字母数字队伍码' })
  @IsString()
  @Matches(/^[A-Z0-9]{8}$/, { message: '队伍码格式错误，应为 8 位大写字母数字' })
  teamCode!: string;
}
