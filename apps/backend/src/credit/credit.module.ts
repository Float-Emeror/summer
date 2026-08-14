import { Module } from '@nestjs/common';
import { CreditService } from './credit.service';
import { CreditController } from './credit.controller';
import { CreditRepository } from './credit.repository';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [CreditController],
  providers: [CreditService, CreditRepository],
  exports: [CreditService], 
})
export class CreditModule {}
