import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsRepository } from './notifications.repository';
import { NotificationsGateway } from './notifications.gateway';
import { PrismaModule } from '../prisma/prisma.module';
import { AppMailModule } from '../mail/mail.module';

@Module({
  imports: [PrismaModule, AppMailModule],
  controllers: [NotificationsController],
  providers: [
    NotificationsService, 
    NotificationsRepository, 
    NotificationsGateway
  ],
})
export class NotificationsModule {}
