import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminService } from './admin.service';
import {
  CreateAccountDto,
  DisableAccountDto,
  AdminAppealQueryDto,
  AdminPageQueryDto,
  AdminReportQueryDto,
  ResetPasswordDto,
  ResolveAppealDto,
  ResolveReportDto,
  UpdateAccountDto,
} from './dto/admin.dto';

@ApiTags('admin')
@ApiBearerAuth()
@Roles('ADMIN')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('reports')
  reports(@Query() query: AdminReportQueryDto) {
    return this.adminService.reports(query);
  }

  @Post('reports/:id/resolve')
  resolveReport(@Request() req, @Param('id') id: string, @Body() dto: ResolveReportDto) {
    return this.adminService.resolveReport(req.user.userId, id, dto);
  }

  @Get('appeals')
  appeals(@Query() query: AdminAppealQueryDto) {
    return this.adminService.appeals(query);
  }

  @Post('appeals/:id/resolve')
  resolveAppeal(@Request() req, @Param('id') id: string, @Body() dto: ResolveAppealDto) {
    return this.adminService.resolveAppeal(req.user.userId, id, dto);
  }

  @Get('audit-logs')
  auditLogs(@Query() query: AdminPageQueryDto) {
    return this.adminService.auditLogs(query);
  }

  @Get('accounts')
  accounts() {
    return this.adminService.accounts();
  }

  @Post('accounts')
  createAccount(@Body() dto: CreateAccountDto) {
    return this.adminService.createAccount(dto);
  }

  @Patch('accounts/:id')
  updateAccount(@Param('id') id: string, @Body() dto: UpdateAccountDto) {
    return this.adminService.updateAccount(id, dto);
  }

  @Post('accounts/:id/disable')
  disableAccount(@Param('id') id: string, @Body() dto: DisableAccountDto) {
    return this.adminService.disableAccount(id, dto);
  }

  @Post('accounts/:id/enable')
  enableAccount(@Param('id') id: string) {
    return this.adminService.enableAccount(id);
  }

  @Post('accounts/:id/reset-password')
  resetPassword(@Param('id') id: string, @Body() dto: ResetPasswordDto) {
    return this.adminService.resetPassword(id, dto);
  }

  @Delete('accounts/:id')
  deleteAccount(@Param('id') id: string) {
    return this.adminService.deleteAccount(id);
  }
}
