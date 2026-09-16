import { Controller, Post, Get, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AiService } from './ai.service.js';
import { AiQueryDto } from './dto/ai-query.dto.js';
import { OrgId } from '../../common/decorators/org-id.decorator.js';
import { RequiresPlan } from '../../common/decorators/roles.decorator.js';

/**
 * AiController — attendance analytics assistant endpoints.
 *
 * Both routes require Pro plan via @RequiresPlan('pro').
 * Free tier orgs get a 403 with a clear upgrade message.
 *
 * Routes:
 *   POST /api/ai/query    — ask a natural language question
 *   GET  /api/ai/insights — get 3 pre-built insights for the dashboard
 */
@ApiTags('ai')
@ApiBearerAuth('clerk-jwt')
@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('query')
  @RequiresPlan('pro')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Ask a natural language question about attendance (Pro)' })
  @ApiResponse({ status: 200, description: '{ answer, context }' })
  @ApiResponse({ status: 403, description: 'Pro plan required' })
  @ApiResponse({ status: 503, description: 'GEMINI_API_KEY not configured' })
  async query(@OrgId() orgId: string, @Body() dto: AiQueryDto) {
    return this.aiService.query(orgId, dto.message);
  }

  @Get('insights')
  @RequiresPlan('pro')
  @ApiOperation({ summary: 'Get 3 pre-built attendance insights for the dashboard (Pro)' })
  @ApiResponse({ status: 200, description: '{ insights: string[] }' })
  async getInsights(@OrgId() orgId: string) {
    return this.aiService.getInsights(orgId);
  }
}
