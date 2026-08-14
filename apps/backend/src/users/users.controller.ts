import { Controller, Get, Put, Patch, Post, Delete, Body, Param, Query, UseGuards, Request, UseInterceptors, ClassSerializerInterceptor } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { UpdateProfileDto, UpdateSkillsDto, UpdateAvailabilityDto, UserResponseDto } from './dto/users.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'; 
import { EmailVerifiedGuard } from '../auth/guards/email-verified.guard';

@ApiTags('Users')
@Controller('users')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth() 
@UseInterceptors(ClassSerializerInterceptor) 
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get('me/profile')
  @ApiOperation({ summary: '获取当前登录用户完整资料' })
  async getMe(@Request() req) {
    const user = await this.usersService.getProfile(req.user.userId);
    return new UserResponseDto(user);
  }

  @Get(':identifier/public-profile')
  @ApiOperation({ summary: '获取用户公开资料 (支持 ID 或 学号)' })
  async getPublicProfile(@Param('identifier') identifier: string) {
    const isStudentNo = /^\d{8}$/.test(identifier);
    
    let user;
    if (isStudentNo) {
      user = await this.usersService.getProfileByStudentNo(identifier);
    } else {
      user = await this.usersService.getProfile(identifier);
    }
    
    return new UserResponseDto(user);
  }
  
  @Patch('me/profile')
  @UseGuards(EmailVerifiedGuard)
  @ApiOperation({ summary: '更新基础个人资料' })
  async updateProfile(@Request() req, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateProfile(req.user.userId, dto);
  }

  @Put('me/skills')
  @UseGuards(EmailVerifiedGuard)
  @ApiOperation({ summary: '更新技能标签 (全量覆盖)' })
  async updateSkills(@Request() req, @Body() dto: UpdateSkillsDto) {
    return this.usersService.updateSkills(req.user.userId, dto.skills);
  }

  @Put('me/availability')
  @UseGuards(EmailVerifiedGuard)
  @ApiOperation({ summary: '更新空闲时间 (全量覆盖)' })
  async updateAvailability(@Request() req, @Body() dto: UpdateAvailabilityDto) {
    return this.usersService.updateAvailability(req.user.userId, dto.slots);
  }

  @Post('me/favorites/teams/:teamId')
  @UseGuards(EmailVerifiedGuard)
  @ApiOperation({ summary: '收藏队伍' })
  async addFavorite(@Request() req, @Param('teamId') teamId: string) {
    return this.usersService.addFavorite(req.user.userId, teamId);
  }

  @Delete('me/favorites/teams/:teamId')
  @UseGuards(EmailVerifiedGuard)
  @ApiOperation({ summary: '取消收藏队伍' })
  async removeFavorite(@Request() req, @Param('teamId') teamId: string) {
    return this.usersService.removeFavorite(req.user.userId, teamId);
  }

  @Get('me/favorites/teams')
  @ApiOperation({ summary: '获取我收藏的队伍列表' })
  async getMyFavorites(@Request() req, @Query('page') page?: string, @Query('pageSize') pageSize?: string) {
    return this.usersService.getUserFavorites(req.user.userId, {
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
  }
}
