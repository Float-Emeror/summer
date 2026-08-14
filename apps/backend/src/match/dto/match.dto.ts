import { ApiPropertyOptional } from '@nestjs/swagger';
import { TeamType } from '@prisma/client';
import { IsEnum, IsNumberString, IsOptional, IsString } from 'class-validator';

export class MatchRequirementDto {
  @ApiPropertyOptional({ enum: TeamType })
  @IsOptional()
  @IsEnum(TeamType)
  type?: TeamType;

  @ApiPropertyOptional({ description: 'Title or description keyword' })
  @IsOptional()
  @IsString()
  keyword?: string;

  @ApiPropertyOptional({ description: 'Comma-separated skill names' })
  @IsOptional()
  @IsString()
  skills?: string;

  @ApiPropertyOptional({ description: 'Minimum bounty amount' })
  @IsOptional()
  @IsNumberString()
  minBounty?: string;
}
