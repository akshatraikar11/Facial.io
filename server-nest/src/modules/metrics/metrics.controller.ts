import { Controller, Get, Header, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import type { Response } from 'express';
import { MetricsService } from './metrics.service.js';
import { SkipTenantCheck } from '../../common/guards/tenant-isolation.guard.js';

@ApiTags('metrics')
@Controller()
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get('metrics')
  @SkipTenantCheck()
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  @ApiOperation({ summary: 'Prometheus metrics scrape endpoint for K8s HPA and Grafana' })
  @ApiResponse({ status: 200, description: 'Prometheus metrics payload' })
  getMetrics(@Res() res: Response) {
    res.send(this.metricsService.getMetrics());
  }

  @Get('api/metrics')
  @SkipTenantCheck()
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  @ApiOperation({ summary: 'Prometheus metrics scrape endpoint (API prefix)' })
  @ApiResponse({ status: 200, description: 'Prometheus metrics payload' })
  getApiMetrics(@Res() res: Response) {
    res.send(this.metricsService.getMetrics());
  }
}

