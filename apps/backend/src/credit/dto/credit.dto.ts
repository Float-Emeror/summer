import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsInt, Min, Max, IsOptional, IsArray, IsEnum } from 'class-validator';
import { AppealStatus } from '@prisma/client';

export class CreateReviewDto {
  @ApiPropertyOptional({ example: 'cm...teamId...' })
  @IsOptional()
  @IsString()
  teamId?: string;

  @ApiProperty({ example: 'cm...userId...' })
  @IsString()
  revieweeId!: string;

  @ApiProperty({ example: 5, description: '1-5星评分' })
  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @ApiPropertyOptional({ type: [String], example: ['沟通顺畅', '技术大牛', '按时交付'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiProperty({ example: '代码写得很规范，合作非常愉快！' })
  @IsString()
  comment!: string;
}

export class CreateAppealDto {
  @ApiProperty({ example: '恶意差评，我承担了大部分后端工作，对方却给了1星。' })
  @IsString()
  reason!: string;
}

export class ProcessAppealDto {
  @ApiProperty({ enum: AppealStatus, example: 'APPROVED' })
  @IsEnum(AppealStatus)
  status!: AppealStatus;
}

