import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuditController } from './audit.controller.js';
import { AuditService } from './audit.service.js';
import { AuditLog, AuditLogSchema } from './schemas/audit-log.schema.js';

/**
 * AuditModule — append-only audit trail for all admin actions.
 *
 * AuditService is exported so any other module can inject it
 * and call auditService.log() without circular dependency issues.
 *
 * Usage in other services:
 *   1. Import AuditModule in the consuming module.
 *   2. Inject AuditService in the consuming service constructor.
 *   3. Call: await this.auditService.log({ orgId, userId, userEmail, action, ... })
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AuditLog.name, schema: AuditLogSchema },
    ]),
  ],
  controllers: [AuditController],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
