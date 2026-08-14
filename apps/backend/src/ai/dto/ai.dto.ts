import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class ImportProjectDto {
  @ApiProperty({ description: '本地项目路径或 Git 仓库 URL' })
  @IsString()
  @IsNotEmpty()
  sourcePath!: string;

  @ApiPropertyOptional({ description: '可选自定义项目名称' })
  @IsOptional()
  @IsString()
  projectName?: string;
}

export class GenerateSummaryDto {
  @ApiPropertyOptional({ description: 'LLM 供应商', default: 'openai' })
  @IsOptional()
  @IsString()
  provider?: string;
}

export class AskQuestionDto {
  @ApiProperty({ description: '问题内容' })
  @IsString()
  @MinLength(2)
  question!: string;

  @ApiPropertyOptional({ description: 'LLM 供应商', default: 'openai' })
  @IsOptional()
  @IsString()
  provider?: string;
}

export class UpsertAiConfigDto {
  @ApiProperty({ description: 'API 密钥' })
  @IsString()
  @MinLength(8)
  apiKey!: string;

  @ApiPropertyOptional({ description: '配置状态', default: 'configured' })
  @IsOptional()
  @IsString()
  @IsIn(['configured', 'disabled'])
  status?: string;
}
