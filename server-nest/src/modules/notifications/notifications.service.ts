import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

export interface LateAlertPayload {
  adminEmail: string;
  orgName: string;
  employeeName: string;
  checkInTime: string;
  date: string;
}

export interface AbsenceSummaryPayload {
  adminEmail: string;
  orgName: string;
  date: string;
  absentEmployees: string[];
  presentCount: number;
  totalCount: number;
}

/**
 * NotificationsService — transactional email via Resend.
 *
 * Resend free tier: 3,000 emails/month, no card required.
 * API is simple — just POST with HTML or text body.
 *
 * Methods:
 *   sendLateAlert()       — triggered when an employee checks in after cutoff
 *   sendAbsenceSummary()  — daily summary sent by the anomaly detection cron
 *   sendWelcomeEmail()    — sent when a new org is created (future use)
 *
 * Graceful degradation: RESEND_API_KEY not set → logs warning, skips sends.
 */
@Injectable()
export class NotificationsService implements OnModuleInit {
  private readonly logger = new Logger(NotificationsService.name);
  private resend: Resend | null = null;
  private fromAddress = 'Facial.io <noreply@facialio.app>';

  constructor(private readonly config: ConfigService) {}

  async onModuleInit() {
    const apiKey = this.config.get<string>('RESEND_API_KEY');
    if (!apiKey) {
      this.logger.warn('RESEND_API_KEY not set — email notifications disabled');
      return;
    }
    this.resend = new Resend(apiKey);
    this.logger.log('Resend email service initialized');
  }

  /**
   * Generic sendEmail method for custom email sending.
   * Used by manager alerts and other custom notifications.
   */
  async sendEmail(options: {
    to: string;
    subject: string;
    html: string;
  }): Promise<void> {
    if (!this.resend) {
      this.logger.warn('Resend not configured - email not sent');
      return;
    }

    try {
      await this.resend.emails.send({
        from: this.fromAddress,
        to: options.to,
        subject: options.subject,
        html: options.html,
      });
      this.logger.log(`Email sent to ${options.to}: ${options.subject}`);
    } catch (err: unknown) {
      this.logger.error('Failed to send email', err);
      throw err;
    }
  }

  /**
   * Sends a late arrival alert to the org admin.
   * Called by AnomalyDetectionService when an employee checks in late.
   */
  async sendLateAlert(payload: LateAlertPayload): Promise<void> {
    if (!this.resend) return;

    await this.resend.emails.send({
      from: this.fromAddress,
      to: payload.adminEmail,
      subject: `⏰ Late Arrival — ${payload.employeeName}`,
      html: `
        <div style="font-family: sans-serif; max-width: 480px;">
          <h2 style="color: #f59e0b;">Late Arrival Alert</h2>
          <p><strong>${payload.employeeName}</strong> checked in at <strong>${payload.checkInTime}</strong> on ${payload.date}.</p>
          <p style="color: #6b7280;">Organization: ${payload.orgName}</p>
          <hr/>
          <p style="font-size: 12px; color: #9ca3af;">Powered by Facial.io — Face Recognition Attendance SaaS</p>
        </div>
      `,
    }).catch((err: unknown) => {
      this.logger.error('Failed to send late alert email', err);
    });
  }

  /**
   * Sends a daily absence summary to the org admin.
   * Called by the nightly anomaly detection cron.
   */
  async sendAbsenceSummary(payload: AbsenceSummaryPayload): Promise<void> {
    if (!this.resend) return;

    const absentList = payload.absentEmployees
      .map((name) => `<li>${name}</li>`)
      .join('');

    const rate = Math.round((payload.presentCount / payload.totalCount) * 100);

    await this.resend.emails.send({
      from: this.fromAddress,
      to: payload.adminEmail,
      subject: `📊 Daily Attendance Summary — ${payload.date}`,
      html: `
        <div style="font-family: sans-serif; max-width: 480px;">
          <h2 style="color: #6366f1;">Daily Attendance Summary</h2>
          <p><strong>${payload.orgName}</strong> — ${payload.date}</p>
          <table style="width: 100%; margin: 16px 0;">
            <tr><td>Present</td><td><strong>${payload.presentCount} / ${payload.totalCount}</strong></td></tr>
            <tr><td>Attendance Rate</td><td><strong>${rate}%</strong></td></tr>
            <tr><td>Absent</td><td><strong>${payload.absentEmployees.length}</strong></td></tr>
          </table>
          ${payload.absentEmployees.length > 0
            ? `<h3>Absent Employees:</h3><ul>${absentList}</ul>`
            : '<p style="color: #10b981;">✅ Full attendance today!</p>'
          }
          <hr/>
          <p style="font-size: 12px; color: #9ca3af;">Powered by Facial.io</p>
        </div>
      `,
    }).catch((err: unknown) => {
      this.logger.error('Failed to send absence summary email', err);
    });
  }

  /**
   * Welcome email when a new org signs up.
   * Called by OrganizationsService after org creation (wired in Phase 9+ optionally).
   */
  async sendWelcomeEmail(adminEmail: string, orgName: string): Promise<void> {
    if (!this.resend) return;

    await this.resend.emails.send({
      from: this.fromAddress,
      to: adminEmail,
      subject: `Welcome to Facial.io — ${orgName}`,
      html: `
        <div style="font-family: sans-serif; max-width: 480px;">
          <h2 style="color: #6366f1;">Welcome to Facial.io 👋</h2>
          <p>Your organization <strong>${orgName}</strong> is set up and ready to go.</p>
          <p>Get started by registering your first employee with a face scan.</p>
          <a href="https://facialio.app/register"
             style="display: inline-block; background: #6366f1; color: white;
                    padding: 12px 24px; border-radius: 8px; text-decoration: none;
                    margin: 16px 0;">
            Register Your First Employee
          </a>
          <hr/>
          <p style="font-size: 12px; color: #9ca3af;">Powered by Facial.io</p>
        </div>
      `,
    }).catch((err: unknown) => {
      this.logger.error('Failed to send welcome email', err);
    });
  }

  get ready(): boolean {
    return this.resend !== null;
  }
}
