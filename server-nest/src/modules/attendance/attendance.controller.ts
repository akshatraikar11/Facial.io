import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { AttendanceService } from './attendance.service.js';
import { CreateAttendanceDto } from './dto/create-attendance.dto.js';
import { AttendanceQueryDto } from './dto/attendance-query.dto.js';
import { OrgId } from '../../common/decorators/org-id.decorator.js';
import { Public } from '../auth/decorators/public.decorator.js';
import { RequiresPlan } from '../../common/decorators/roles.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { AuditService } from '../audit/audit.service.js';

/**
 * AttendanceController — REST API for attendance management.
 *
 * Base route: /api/attendance
 *
 * Route summary:
 *   POST   /api/attendance/check-in       — kiosk check-in (public — kiosk has no JWT)
 *   GET    /api/attendance                — list logs with optional filters
 *   GET    /api/attendance/today          — today's logs only
 *   GET    /api/attendance/stats          — dashboard statistics
 *   GET    /api/attendance/export/csv     — download CSV (Pro plan only)
 *   DELETE /api/attendance/:id            — delete single log
 *   DELETE /api/attendance/clear          — clear all logs (dangerous)
 *
 * Check-in is @Public():
 *   The kiosk screen runs without an admin being logged in.
 *   It identifies employees by face, not by JWT.
 *   But it does send the orgId in the body (the kiosk knows which org it belongs to).
 *
 *   Wait — doesn't that let anyone fake check-ins?
 *   In Phase 4, the check-in flow will require a valid face match result token
 *   from the FaceRecognitionService. For now (Phase 3), it's open to
 *   bootstrap the flow.
 *
 * CSV export is @RequiresPlan('pro'):
 *   Free tier gets basic attendance view, Pro gets export.
 *   This is a single decorator — RolesGuard does the rest.
 */
@ApiTags('attendance')
@ApiBearerAuth('clerk-jwt')
@Controller('attendance')
export class AttendanceController {
  constructor(
    private readonly attendanceService: AttendanceService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * POST /api/attendance/check-in
   * Kiosk check-in endpoint.
   * @Public() — the kiosk doesn't have a Clerk JWT.
   *
   * orgId comes from the DTO body here (not JWT) because kiosk is unauthenticated.
   * Phase 4 will add a signed token from the face-recognition result to validate this.
   */
  @Public()
  @Post('check-in')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Kiosk check-in — record attendance for an employee' })
  @ApiResponse({ status: 201, description: 'Check-in recorded' })
  @ApiResponse({ status: 409, description: 'Already checked in today' })
  @ApiResponse({ status: 404, description: 'Employee not found' })
  async checkIn(
    @Body() dto: CreateAttendanceDto & { orgId: string },
  ) {
    const { orgId, ...rest } = dto;
    return this.attendanceService.checkIn(orgId, rest);
  }

  /**
   * GET /api/attendance
   * List all logs for the org with optional filters.
   * Query params: date, employeeId, startDate, endDate
   */
  @Get()
  @ApiOperation({ summary: 'List attendance logs with optional filters' })
  @ApiResponse({ status: 200, description: 'Attendance log list' })
  async findAll(
    @OrgId() orgId: string,
    @Query() query: AttendanceQueryDto,
  ) {
    return this.attendanceService.findAll(orgId, query);
  }

  /**
   * GET /api/attendance/today
   * Returns today's check-ins. Used by the dashboard live feed.
   * Must be defined before /:id.
   */
  @Get('today')
  @ApiOperation({ summary: "Get today's attendance logs" })
  async findToday(@OrgId() orgId: string) {
    return this.attendanceService.findToday(orgId);
  }

  /**
   * GET /api/attendance/stats
   * Dashboard statistics: presentToday, totalEmployees, rate, weeklyTrend.
   */
  @Get('stats')
  @ApiOperation({ summary: 'Get attendance statistics for dashboard' })
  async getStats(@OrgId() orgId: string) {
    return this.attendanceService.getStats(orgId);
  }

  /**
   * GET /api/attendance/export/csv
   * Downloads attendance data as a CSV file.
   * Pro plan only — @RequiresPlan('pro') gates this via RolesGuard.
   *
   * Sets response headers so the browser triggers a file download:
   *   Content-Type: text/csv
   *   Content-Disposition: attachment; filename="attendance-2026-08-28.csv"
   */
  @Get('export/csv')
  @RequiresPlan('pro')
  @ApiOperation({ summary: 'Export attendance as CSV (Pro plan)' })
  @ApiResponse({ status: 200, description: 'CSV file download' })
  @ApiResponse({ status: 403, description: 'Pro plan required' })
  async exportCsv(
    @OrgId() orgId: string,
    @Query() query: AttendanceQueryDto,
    @Res() res: Response,
  ) {
    const csv = await this.attendanceService.generateCsv(orgId, query);
    const filename = `attendance-${new Date().toISOString().slice(0, 10)}.csv`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  }

  /**
   * DELETE /api/attendance/clear
   * Clears ALL logs for the org. Dangerous — admin only.
   * Must be defined before /:id to avoid 'clear' being treated as an ID.
   */
  @Delete('clear')
  @ApiOperation({ summary: 'Clear all attendance logs for the org (irreversible)' })
  async clearAll(
    @OrgId() orgId: string,
    @CurrentUser('userId') userId: string,
    @CurrentUser('email') userEmail: string,
  ) {
    const result = await this.attendanceService.clearAll(orgId);
    await this.auditService.log({
      orgId, userId, userEmail: userEmail ?? '',
      action: 'attendance.cleared',
      entityType: 'attendance',
      metadata: { deletedCount: result.deleted },
    });
    return result;
  }

  /**
   * DELETE /api/attendance/:id
   * Delete a single attendance log by MongoDB ID.
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a single attendance log' })
  @ApiParam({ name: 'id', description: 'MongoDB log ID' })
  async deleteOne(
    @OrgId() orgId: string,
    @CurrentUser('userId') userId: string,
    @CurrentUser('email') userEmail: string,
    @Param('id') id: string,
  ) {
    await this.attendanceService.deleteOne(orgId, id);
    await this.auditService.log({
      orgId, userId, userEmail: userEmail ?? '',
      action: 'attendance.deleted',
      entityType: 'attendance',
      entityId: id,
    });
  }
}
