import { Controller, Get, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ChatService } from './chat.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Chat')
@Controller() 
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ChatController {
  constructor(private chatService: ChatService) {}

  @Get('teams/:teamId/messages')
  @ApiOperation({ summary: '获取队伍的聊天历史记录 (支持分页)' })
  async getHistory(
    @Request() req,
    @Param('teamId') teamId: string,
    @Query('page') page: string
  ) {
    const pageNum = parseInt(page, 10) || 1;
    return this.chatService.getChatHistory(req.user.userId, teamId, pageNum);
  }
}