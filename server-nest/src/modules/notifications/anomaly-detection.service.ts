import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Organization, OrganizationDocument } from '../organizations/schemas/organization.schema.js';
import { AttendanceService } from '../attendance/attendance.service.js';
import { EmployeesService } from '../employees/employees.service.js';
import { NotificationsService } from './notifications.service.js';
import { TwilioService } from './twilio.service.js';

/**
 * AnomalyDetectionService — nightly cron job for attendance analytics.
 *
 * @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
 *   Runs once per day at midnight UTC.
 *   NestJS's ScheduleModule (registered in AppModule) powers this.
 *   No external job queue needed — it's all in-process.
 *
 * What it does each night:
 *
 * 1. Fetch all organizations from MongoDB.
 * 2. For each org, get today's attendance + full employee list.
 * 3. Find who was absent (employee exists but no attendance log for today).
 * 4. Send an absence summary email to the org admin if Pro/Enterprise plan.
 * 5. Flag employees with 3+ consecutive absences for a separate alert.
 *
 * Why org admin email from the plan check:
 *   We don't store an adminEmail field on the Organization schema.
 *   In production, you'd fetch it from Clerk via their API.
 *   For now we use a placeholder — Phase 10 connects this to Clerk.
 *
 * Interview answer:
 * "The anomaly detection runs as a NestJS cron job using @Cron().
 *  It's in-process — no Redis, no BullMQ, no external scheduler.
 *  For a SaaS at this scale, in-process crons are perfectly sufficient
 *  and zero extra infrastructure. If we needed distributed job processing,
 *  we'd swap to BullMQ — the interface stays the same."
 */
@Injectable()
export class AnomalyDetectionService {
  private readonly logger = new Logger(AnomalyDetectionService.name);

  constructor(
    @InjectModel(Organization.name)
    private readonly orgModel: Model<OrganizationDocument>,
    private readonly attendanceService: AttendanceService,
    private readonly employeesService: EmployeesService,
    private readonly notificationsService: NotificationsService,
    private readonly twilioService: TwilioService,
  ) {}

  /**
   * Nightly cron — runs at midnight UTC every day.
   * CronExpression.EVERY_DAY_AT_MIDNIGHT = '0 0 * * *'
   *
   * Wrapped in try/catch so one failing org doesn't stop others.
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async runNightlyCheck(): Promise<void> {
    this.logger.log('Starting nightly anomaly detection...');

    const orgs = await this.orgModel
      .find({ plan: { $in: ['pro', 'enterprise'] } }) // only notify paying orgs
      .exec();

    this.logger.log(`Processing ${orgs.length} org(s)`);

    for (const org of orgs) {
      try {
        await this.processOrg(org);
      } catch (err) {
        this.logger.error(`Anomaly check failed for org ${org.orgId}:`, err);
      }
    }

    this.logger.log('Nightly anomaly detection complete');
  }

  /**
   * Processes one org: computes absences and sends summary.
   */
  private async processOrg(org: OrganizationDocument): Promise<void> {
    const today = new Date().toISOString().slice(0, 10);

    const [todayLogs, employees] = await Promise.all([
      this.attendanceService.findToday(org.orgId),
      this.employeesService.findAll(org.orgId),
    ]);

    const presentIds = new Set(todayLogs.map((l) => l.employeeId));
    const absentEmployees = (employees as any[])
      .filter((e: any) => !presentIds.has(e._id.toString()))
      .map((e: any) => e.name);

    const lateEmployees = todayLogs
      .filter((l) => l.status === 'late')
      .map((l) => l.name);

    const totalCount = (employees as any[]).length;
    const presentCount = todayLogs.length;

    this.logger.log(
      `Org ${org.name}: ${presentCount}/${totalCount} present, ${absentEmployees.length} absent, ${lateEmployees.length} late`,
    );

    // ── Admin email (Resend) ──────────────────────────────────────────────
    const adminEmail = org.adminEmail ?? `admin@${org.name.toLowerCase().replace(/\s+/g, '')}.com`;

    await this.notificationsService.sendAbsenceSummary({
      adminEmail,
      orgName: org.name,
      date: today,
      absentEmployees,
      presentCount,
      totalCount,
    });

    // ── Admin WhatsApp daily summary (Twilio) ─────────────────────────────
    await this.twilioService.sendDailySummaryToAdmin({
      orgName: org.name,
      date: today,
      presentCount,
      totalCount,
      absentEmployees,
      lateEmployees,
    });

    // ── Per-employee late WhatsApp alerts ─────────────────────────────────
    const lateLogs = todayLogs.filter((l) => l.status === 'late');
    for (const log of lateLogs) {
      const emp = (employees as any[]).find(
        (e: any) => e._id.toString() === log.employeeId,
      );
      if (emp?.phone) {
        await this.twilioService.sendLateAlertToEmployee({
          employeeName: emp.name,
          phone: emp.phone,
          checkInTime: log.time,
          shiftName: log.shiftName ?? undefined,
          orgName: org.name,
        }).catch((err: Error) =>
          this.logger.error(`Late WhatsApp failed for ${emp.name}: ${err.message}`),
        );
      }
    }

    // ── Per-employee absent SMS alerts ────────────────────────────────────
    const absentEmps = (employees as any[]).filter(
      (e: any) => !presentIds.has(e._id.toString()),
    );
    for (const emp of absentEmps) {
      if (emp.phone) {
        await this.twilioService.sendAbsentAlertToEmployee({
          employeeName: emp.name,
          phone: emp.phone,
          date: today,
          orgName: org.name,
        }).catch((err: Error) =>
          this.logger.error(`Absent SMS failed for ${emp.name}: ${err.message}`),
        );
      }
    }

    // ── Consecutive absence check ─────────────────────────────────────────
    await this.checkConsecutiveAbsences(org.orgId, employees as any[]);
  }

  /**
   * Check for employees with 3+ consecutive days of absence and
   * send targeted alert email to their manager if configured.
   */
  private async checkConsecutiveAbsences(
    orgId: string,
    employees: any[],
  ): Promise<void> {
    const STREAK_THRESHOLD = 3;

    for (const employee of employees) {
      const recentLogs = await this.attendanceService.getRecentLogsByEmployee(
        orgId,
        employee._id.toString(),
        STREAK_THRESHOLD,
      );

      // If no logs in the last N days — consecutive absence streak
      if (recentLogs.length === 0) {
        this.logger.warn(
          `Absence streak detected: ${employee.name} (${orgId}) — ${STREAK_THRESHOLD}+ days`,
        );

        // Send targeted alert to employee's manager if configured
        const managerEmail = employee.managerEmail;
        if (managerEmail) {
          try {
            await this.notificationsService.sendEmail({
              to: managerEmail,
              subject: `Absence Alert: ${employee.name} - ${STREAK_THRESHOLD}+ days`,
              html: `
                <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
                  <h2 style="color: #d32f2f;">⚠️ Consecutive Absence Alert</h2>
                  <p>This is an automated alert regarding an extended absence:</p>
                  <div style="background: #f5f5f5; padding: 16px; border-radius: 8px; margin: 16px 0;">
                    <p style="margin: 8px 0;"><strong>Employee:</strong> ${employee.name}</p>
                    <p style="margin: 8px 0;"><strong>Email:</strong> ${employee.email}</p>
                    <p style="margin: 8px 0;"><strong>Department:</strong> ${employee.department ?? 'N/A'}</p>
                    <p style="margin: 8px 0;"><strong>Absence Duration:</strong> ${STREAK_THRESHOLD}+ consecutive days</p>
                  </div>
                  <p>Please follow up with this employee to ensure their well-being and address any attendance concerns.</p>
                  <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 24px 0;" />
                  <p style="font-size: 12px; color: #666;">
                    This is an automated message from Facial.io attendance monitoring system.
                  </p>
                </div>
              `,
            });
            this.logger.log(
              `Manager alert sent: ${employee.name} → ${managerEmail}`,
            );
          } catch (error) {
            this.logger.error(
              `Failed to send manager alert for ${employee.name}: ${(error as Error).message}`,
            );
          }
        } else {
          this.logger.debug(
            `No manager email configured for ${employee.name} — skipping targeted alert`,
          );
        }
      }
    }
  }

  /**
   * Manual trigger for testing the cron without waiting for midnight.
   * Called via POST /api/notifications/trigger-check (internal/admin use).
   */
  async triggerManually(): Promise<{ processed: number }> {
    this.logger.log('Manual anomaly check triggered');
    await this.runNightlyCheck();
    const orgs = await this.orgModel
      .find({ plan: { $in: ['pro', 'enterprise'] } })
      .exec();
    return { processed: orgs.length };
  }
}
