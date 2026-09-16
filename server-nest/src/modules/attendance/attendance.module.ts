import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AttendanceController } from './attendance.controller.js';
import { AttendanceService } from './attendance.service.js';
import { AttendanceGateway } from './attendance.gateway.js';
import { AttendanceLog, AttendanceSchema } from './schemas/attendance.schema.js';
import { EmployeesModule } from '../employees/employees.module.js';
import { LocationsModule } from '../locations/locations.module.js';
import { ShiftsModule } from '../shifts/shifts.module.js';
import { AuditModule } from '../audit/audit.module.js';

/**
 * AttendanceModule — owns the check-in flow, attendance data, and real-time events.
 *
 * Phase 5 addition: AttendanceGateway added to providers.
 *
 * AttendanceGateway is a WebSocket server decorated with @WebSocketGateway().
 * In NestJS, gateways are providers — they live in the providers array just
 * like services. NestJS handles the WebSocket lifecycle automatically.
 *
 * exports: [AttendanceService, AttendanceGateway]
 *   AttendanceGateway is exported so NotificationsModule (Phase 9) can call
 *   gateway.emitToOrg() to push alerts to connected dashboard clients.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AttendanceLog.name, schema: AttendanceSchema },
    ]),
    EmployeesModule,
    LocationsModule,
    ShiftsModule,
    AuditModule,
  ],
  controllers: [AttendanceController],
  providers: [AttendanceService, AttendanceGateway],
  exports: [AttendanceService, AttendanceGateway],
})
export class AttendanceModule {}
