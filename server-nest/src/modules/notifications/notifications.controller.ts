import { Controller, Post, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service.js';
import { AnomalyDetectionService } from './anomaly-detection.service.js';

/**
 * NotificationsController — notification status and manual triggers.
 *
 * Routes:
 *   GET  /api/notifications/health   — check Resend connection status
 *   POST /api/notifications/trigger  — manually fire the nightly cron (admin/debug)
 */
@ApiTags('notifications')
@ApiBearerAuth('clerk-jwt')
@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly anomalyService: AnomalyDetectionService,
  ) {}

  @Get('health')
  @ApiOperation({ summary: 'Check Resend email service status' })
  health() {
    return {
      resend: this.notificationsService.ready ? 'connected' : 'not configured',
    };
  }

  @Post('trigger')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Manually trigger the nightly anomaly detection (admin/debug)' })
  async trigger() {
    return this.anomalyService.triggerManually();
  }
}
