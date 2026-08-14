import { ApiProperty } from '@nestjs/swagger';

export class MarkReadDto {
  @ApiProperty({ type: [String], example: ['cuid1', 'cuid2'] })
  notificationIds!: string[];
}