import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString } from 'class-validator';
import { ApplicationStatus } from '@prisma/client';

export class ApplyTeamDto {
  @ApiProperty({ example: '我非常精通相关技术栈，求带！' })
  @IsString()
  reason!: string;
}

export class ReviewApplicationDto {
  @ApiProperty({ enum: ApplicationStatus, example: 'APPROVED' })
  @IsEnum(ApplicationStatus)
  status!: ApplicationStatus;
}