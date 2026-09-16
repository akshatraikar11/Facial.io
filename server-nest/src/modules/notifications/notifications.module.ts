import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { NotificationsController } from './notifications.controller.js';
import { NotificationsService } from './notifications.service.js';
import { AnomalyDetectionService } from './anomaly-detection.service.js';
import { TwilioService } from './twilio.service.js';
import { Organization, OrganizationSchema } from '../organizations/schemas/organization.schema.js';
import { AttendanceModule } from '../attendance/attendance.module.js';
import { EmployeesModule } from '../employees/employees.module.js';

/**
 * NotificationsModule — Resend email + nightly anomaly detection.
 *
 * MongooseModule.forFeature([Organization]):
 *   AnomalyDetectionService queries all orgs to process each one.
 *   We re-register the Organization schema here (it's already registered
 *   in OrganizationsModule) — Mongoose deduplicates model registration,
 *   so this is safe and gives AnomalyDetectionService its own injected model.
 *
 * imports: [AttendanceModule, EmployeesModule]
 *   AnomalyDetectionService needs:
 *     AttendanceService — get today's logs, recent logs per employee
 *     EmployeesService  — get full employee list for absence comparison
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Organization.name, schema: OrganizationSchema },
    ]),
    AttendanceModule,
    EmployeesModule,
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService, AnomalyDetectionService, TwilioService],
  exports: [NotificationsService, TwilioService],
})
export class NotificationsModule {}
