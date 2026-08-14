import { WebSocketGateway, WebSocketServer, SubscribeMessage, MessageBody, ConnectedSocket, OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ChatService } from './chat.service';
import { allowedSocketOrigins } from '../common/websocket/cors-origin';

interface AuthenticatedSocket extends Socket {
  userId?: string;
}

type ChatJwtPayload = {
  sub: string;
};

@WebSocketGateway({ cors: { origin: allowedSocketOrigins(), credentials: true }, namespace: '/chat' })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(ChatGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private chatService: ChatService,
    private jwtService: JwtService,
  ) {}

  handleConnection(client: AuthenticatedSocket) {
    const userId = this.extractUserId(client);
    if (userId) {
      client.userId = userId; 
      this.logger.log(`用户 ${userId} 已连接`);
    } else {
      client.disconnect();
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    this.logger.log(`用户 ${client.userId ?? client.id} 断开连接`);
  }

  @SubscribeMessage('join_room')
  async handleJoinRoom(@ConnectedSocket() client: AuthenticatedSocket, @MessageBody() data: { teamId: string }) {
    try {
      const userId = client.userId!; 
      await this.chatService.verifyMember(data.teamId, userId);
      client.join(data.teamId);
      client.emit('room_joined', { teamId: data.teamId });
      this.logger.log(`用户 ${userId} 成功加入队伍 ${data.teamId} 聊天室`);
    } catch (error) {
      this.logger.warn(`加入聊天室失败: user=${client.userId ?? 'unknown'}, team=${data.teamId}, error=${error instanceof Error ? error.message : String(error)}`);
      client.emit('error', { message: '无权加入该队伍聊天室' });
    }
  }
  @SubscribeMessage('send_message')
  async handleMessage(@ConnectedSocket() client: AuthenticatedSocket, @MessageBody() data: { teamId: string, content: string }) {
    try {
      const userId = client.userId!; 
      
      const message = await this.chatService.saveAndBroadcastMessage(data.teamId, userId, data.content);
      this.server.to(data.teamId).emit('receive_message', message);
    } catch (error) {
      this.logger.warn(`发送消息失败: user=${client.userId ?? 'unknown'}, team=${data.teamId}, error=${error instanceof Error ? error.message : String(error)}`);
      client.emit('error', { message: '消息发送失败' });
    }
  }

  private extractUserId(client: Socket) {
    const rawToken = client.handshake.auth?.token ?? client.handshake.headers.authorization?.replace(/^Bearer\s+/i, '');
    const token = typeof rawToken === 'string' ? rawToken : undefined;
    if (!token) return undefined;

    try {
      const payload = this.jwtService.verify<ChatJwtPayload>(token);
      return payload.sub;
    } catch (error) {
      this.logger.warn(`聊天连接认证失败: ${error instanceof Error ? error.message : String(error)}`);
      return undefined;
    }
  }
}
