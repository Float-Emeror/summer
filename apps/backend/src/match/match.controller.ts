import { Controller, Get, Query, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MatchRequirementDto } from './dto/match.dto';
import { MatchService } from './match.service';

@ApiTags('Intelligent Match')
@Controller('match')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class MatchController {
  constructor(private readonly matchService: MatchService) {}

  @Get('teams')
  @ApiOperation({ summary: '智能推荐招募队伍' })
  async getRecommendedTeams(@Request() req, @Query() requirements: MatchRequirementDto) {
    return this.matchService.recommendTeamsForUser(req.user.userId, requirements);
  }

  @Get('users')
  @ApiOperation({ summary: '智能推荐协作用户' })
  async getRecommendedUsers(@Request() req, @Query() requirements: MatchRequirementDto) {
    return this.matchService.recommendUsersForUser(req.user.userId, requirements);
  }
}
