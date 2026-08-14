import { Body, Controller, Delete, Get, Param, Post, Put, Query, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AskQuestionDto, GenerateSummaryDto, ImportProjectDto, UpsertAiConfigDto } from './dto/ai.dto';
import { AiService } from './ai.service';

@ApiTags('AI Knowledge Map')
@Controller('ai')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('projects/import')
  @ApiOperation({ summary: '导入并解析本地项目或 Git 仓库' })
  importProject(@Request() req, @Body() body: ImportProjectDto) {
    return this.aiService.importProject(req.user.userId, body.sourcePath, body.projectName);
  }

  @Get('projects')
  @ApiOperation({ summary: '查询我的 AI 项目列表' })
  listProjects(@Request() req) {
    return this.aiService.listProjects(req.user.userId);
  }

  @Get('projects/:id')
  @ApiOperation({ summary: '查看 AI 项目详情' })
  getProject(@Request() req, @Param('id') id: string) {
    return this.aiService.getProject(req.user.userId, id);
  }

  @Post('projects/:id/generate')
  @ApiOperation({ summary: '生成项目知识摘要文档' })
  generate(@Request() req, @Param('id') id: string, @Body() body: GenerateSummaryDto) {
    return this.aiService.generateKnowledge(req.user.userId, id, body.provider || 'openai');
  }

  @Post('projects/:id/qa')
  @ApiOperation({ summary: '针对项目进行问答并记录历史' })
  ask(@Request() req, @Param('id') id: string, @Body() body: AskQuestionDto) {
    return this.aiService.askQuestion(req.user.userId, id, body.question, body.provider || 'openai');
  }

  @Get('projects/:id/documents')
  @ApiOperation({ summary: '获取知识文档历史' })
  listDocuments(@Request() req, @Param('id') id: string) {
    return this.aiService.listDocuments(req.user.userId, id);
  }

  @Get('projects/:id/conversations')
  @ApiOperation({ summary: '获取问答历史' })
  listConversations(@Request() req, @Param('id') id: string) {
    return this.aiService.listConversations(req.user.userId, id);
  }

  @Get('projects/:id/files')
  @ApiOperation({ summary: '获取项目文档列表' })
  listProjectFiles(@Request() req, @Param('id') id: string) {
    return this.aiService.listProjectFiles(req.user.userId, id);
  }

  @Get('projects/:id/files/content')
  @ApiOperation({ summary: '获取项目文档内容' })
  getProjectFileContent(@Request() req, @Param('id') id: string, @Query('path') filePath: string) {
    return this.aiService.getProjectFileContent(req.user.userId, id, filePath);
  }

  @Get('configs/:provider/status')
  @ApiOperation({ summary: '查看 AI 凭据配置状态（不返回明文）' })
  getConfigStatus(@Param('provider') provider: string) {
    return this.aiService.getConfigStatus(provider);
  }

  @Put('configs/:provider')
  @ApiOperation({ summary: '更新 AI 凭据（加密后存储）' })
  upsertConfig(@Param('provider') provider: string, @Body() body: UpsertAiConfigDto) {
    return this.aiService.upsertConfig(provider, body.apiKey, body.status || 'configured');
  }

  @Delete('configs/:provider')
  @ApiOperation({ summary: '清除 AI 凭据配置' })
  clearConfig(@Param('provider') provider: string) {
    return this.aiService.clearConfig(provider);
  }
}
