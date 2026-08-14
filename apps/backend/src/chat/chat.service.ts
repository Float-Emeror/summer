import { Injectable, ForbiddenException } from '@nestjs/common';
import { ChatRepository } from './chat.repository';

@Injectable()
export class ChatService {
  constructor(private chatRepo: ChatRepository) {}

  async verifyMember(teamId: string, userId: string) {
    const member = await this.chatRepo.checkTeamMember(teamId, userId);
    if (!member) throw new ForbiddenException('您不是该队伍成员，无法访问聊天室');
    return member;
  }

  async saveAndBroadcastMessage(teamId: string, senderId: string, content: string) {
    await this.verifyMember(teamId, senderId);
    return this.chatRepo.saveMessage(teamId, senderId, content);
  }

  async getChatHistory(userId: string, teamId: string, page = 1, limit = 50) {
    await this.verifyMember(teamId, userId);
    const skip = (page - 1) * limit;
    return this.chatRepo.getTeamMessages(teamId, skip, limit);
  }
}