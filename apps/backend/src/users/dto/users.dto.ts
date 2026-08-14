import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString, IsInt, ValidateNested } from 'class-validator';
import { Exclude, Type } from 'class-transformer';

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: '海宝' })
  @IsOptional() @IsString()
  nickname?: string;

  @ApiPropertyOptional({ example: '智软你崛起吧' })
  @IsOptional() @IsString()
  college?: string;

  @ApiPropertyOptional({ example: '大二' })
  @IsOptional() @IsString()
  grade?: string;
}

export class UpdateSkillsDto {
  @ApiProperty({ type: [String], example: ['React', 'NestJS'] })
  @IsArray()
  @IsString({ each: true })
  skills!: string[];
}

export class SlotDto {
  @ApiProperty({ example: 1, description: '1代表周一，7代表周日' })
  @IsInt() 
  weekday!: number;

  @ApiProperty({ example: '14:00' })
  @IsString()
  startTime!: string;

  @ApiProperty({ example: '16:00' })
  @IsString()
  endTime!: string;
}

export class UpdateAvailabilityDto {
  @ApiProperty({ type: [SlotDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SlotDto)
  slots!: SlotDto[];
}

export class UserResponseDto {
  id!: string; 
  userId!: string;
  email!: string;
  studentNo!: string;
  
  // 展平的 profile 字段
  nickname?: string;
  college?: string;
  grade?: string;
  completeness?: number;
  
  // 映射后的前端友好格式
  skills?: string[];
  availability?: string[]; 

  @Exclude()
  passwordHash!: string; 

  constructor(partial: any) {
    // 1. 基础字段赋值
    this.id = partial.id;
    this.userId = partial.id; 
    this.email = partial.email;
    this.studentNo = partial.studentNo;
    this.passwordHash = partial.passwordHash;

    // 2. 智能解包 Profile 嵌套数据
    if (partial.profile) {
      this.nickname = partial.profile.nickname;
      this.college = partial.profile.college;
      this.grade = partial.profile.grade;
      this.completeness = partial.profile.completeness;
      this.skills = partial.profile.skills?.map((skill: any) => skill.name) || [];
    } else {
      this.skills = [];
    }

    // 3. 智能转化可用时间
    if (partial.availabilitySlots && partial.availabilitySlots.length > 0) {
      const dayMap = ['周日', '周一', '周二', '周三', '周四', '周五', '周六', '周日'];
      this.availability = partial.availabilitySlots.map(
        (slot: any) => `${dayMap[slot.weekday]} ${slot.startTime}-${slot.endTime}`
      );
    } else {
      this.availability = [];
    }
  }
}