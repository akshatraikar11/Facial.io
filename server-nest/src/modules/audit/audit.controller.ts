import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AuditService } from './audit.service.js';
import { OrgId } from '../../common/decorators/org-id.decorator.js';

@ApiTags('audit')
@ApiBearerAuth()
@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @ApiOperation({ summary: 'Paginated audit log for the org' })
  @ApiQuery({ name: 'limit',      required: false, type: Number })
  @ApiQuery({ name: 'offset',     required: false, type: Number })
  @ApiQuery({ name: 'action',     required: false, type: String })
  @ApiQuery({ name: 'entityType', required: false, type: String })
  @ApiQuery({ name: 'userId',     required: false, type: String })
  findAll(
    @OrgId() orgId: string,
    @Query('limit')      limit?: string,
    @Query('offset')     offset?: string,
    @Query('action')     action?: string,
    @Query('entityType') entityType?: string,
    @Query('userId')     userId?: string,
  ) {
    return this.auditService.findAll(orgId, {
      limit:      limit      ? parseInt(limit, 10)  : undefined,
      offset:     offset     ? parseInt(offset, 10) : undefined,
      action,
      entityType,
      userId,
    });
  }
}
