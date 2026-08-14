import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ChatRepository {
  constructor(private prisma: PrismaService) {}

  async checkTeamMember(teamId: string, userId: string) {
    return this.prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId } }
    });
  }
  async saveMessage(teamId: string, senderId: string, content: string) {
    return this.prisma.message.create({
      data: { teamId, senderId, content },
      include: {
        sender: { select: { email: true, profile: true } }
      }
    });
  }
  async getTeamMessages(teamId: string, skip = 0, take = 50) {
    return this.prisma.message.findMany({
      where: { teamId },
      include: {
        sender: { select: { email: true, profile: true } }
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take
    });
  }
}