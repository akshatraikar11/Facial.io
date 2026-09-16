import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * TwilioService — WhatsApp + SMS alerts via Twilio.
 *
 * Sits alongside NotificationsService (Resend email) in the same module.
 * Both can fire for the same event — email goes to admin, WhatsApp/SMS
 * goes to the employee's phone number.
 *
 * Twilio REST API used directly (no SDK) to keep the dependency surface small.
 * The SDK is ~10MB; a single fetch() call does the same thing.
 *
 * Environment variables required:
 *   TWILIO_ACCOUNT_SID   — Account SID from Twilio console
 *   TWILIO_AUTH_TOKEN    — Auth token from Twilio console
 *   TWILIO_FROM_SMS      — A Twilio phone number, e.g. +15005550006
 *   TWILIO_FROM_WHATSAPP — Twilio WhatsApp-enabled number, e.g. whatsapp:+14155238886
 *                          (use Twilio sandbox number for dev)
 *   TWILIO_ADMIN_WHATSAPP — Admin WhatsApp number for daily summaries, e.g. whatsapp:+919876543210
 *
 * Graceful degradation: if TWILIO_ACCOUNT_SID is not set, all methods
 * are no-ops. This matches the Resend / Pinecone pattern in this codebase.
 *
 * Message channel decision:
 *   - Late alert    → WhatsApp to employee (if phone set) + SMS fallback
 *   - Absent alert  → SMS to employee (if phone set)
 *   - Daily summary → WhatsApp to admin TWILIO_ADMIN_WHATSAPP number
 */
@Injectable()
export class TwilioService implements OnModuleInit {
  private readonly logger = new Logger(TwilioService.name);

  private accountSid: string | null = null;
  private authToken: string | null = null;
  private fromSms: string | null = null;
  private fromWhatsApp: string | null = null;
  private adminWhatsApp: string | null = null;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    this.accountSid   = this.config.get<string>('TWILIO_ACCOUNT_SID') ?? null;
    this.authToken    = this.config.get<string>('TWILIO_AUTH_TOKEN') ?? null;
    this.fromSms      = this.config.get<string>('TWILIO_FROM_SMS') ?? null;
    this.fromWhatsApp = this.config.get<string>('TWILIO_FROM_WHATSAPP') ?? null;
    this.adminWhatsApp = this.config.get<string>('TWILIO_ADMIN_WHATSAPP') ?? null;

    if (!this.accountSid) {
      this.logger.warn('TWILIO_ACCOUNT_SID not set — WhatsApp/SMS alerts disabled');
    } else {
      this.logger.log('Twilio messaging service initialized');
    }
  }

  get ready(): boolean {
    return !!(this.accountSid && this.authToken);
  }

  // ── Core send helper ───────────────────────────────────────────────────────

  /**
   * Posts a message to Twilio Messages API.
   * `to` and `from` should include channel prefix for WhatsApp:
   *   SMS:       '+919876543210'
   *   WhatsApp:  'whatsapp:+919876543210'
   */
  private async send(to: string, from: string, body: string): Promise<void> {
    if (!this.ready || !this.accountSid || !this.authToken) return;

    const url = `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`;

    const params = new URLSearchParams();
    params.append('To', to);
    params.append('From', from);
    params.append('Body', body);

    const credentials = Buffer.from(
      `${this.accountSid}:${this.authToken}`,
    ).toString('base64');

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        this.logger.error(
          `Twilio send failed [${res.status}]: ${JSON.stringify(err)}`,
        );
      } else {
        this.logger.log(`Message sent to ${to}`);
      }
    } catch (err) {
      this.logger.error(`Twilio network error: ${(err as Error).message}`);
    }
  }

  // ── Public alert methods ──────────────────────────────────────────────────

  /**
   * WhatsApp late alert to employee.
   * Falls back silently if employee has no phone number.
   */
  async sendLateAlertToEmployee(payload: {
    employeeName: string;
    phone: string;       // E.164 format, e.g. +919876543210
    checkInTime: string;
    shiftName?: string;
    orgName: string;
  }): Promise<void> {
    if (!this.ready || !this.fromWhatsApp) return;

    const shift = payload.shiftName ? ` for *${payload.shiftName}*` : '';
    const msg =
      `⏰ *Late Check-in Alert*\n\n` +
      `Hi ${payload.employeeName}, you checked in at *${payload.checkInTime}*${shift}.\n\n` +
      `Please reach your supervisor if you need to log a reason.\n\n` +
      `— ${payload.orgName} Attendance System`;

    await this.send(`whatsapp:${payload.phone}`, this.fromWhatsApp, msg);
  }

  /**
   * SMS absent alert to employee.
   */
  async sendAbsentAlertToEmployee(payload: {
    employeeName: string;
    phone: string;
    date: string;
    orgName: string;
  }): Promise<void> {
    if (!this.ready || !this.fromSms) return;

    const msg =
      `[${payload.orgName}] Hi ${payload.employeeName}, ` +
      `you were marked absent on ${payload.date}. ` +
      `If this is an error, please contact your HR team.`;

    await this.send(payload.phone, this.fromSms, msg);
  }

  /**
   * WhatsApp daily summary to the admin.
   * Sent by the nightly anomaly detection cron.
   */
  async sendDailySummaryToAdmin(payload: {
    orgName: string;
    date: string;
    presentCount: number;
    totalCount: number;
    absentEmployees: string[];
    lateEmployees: string[];
  }): Promise<void> {
    if (!this.ready || !this.fromWhatsApp || !this.adminWhatsApp) return;

    const rate = payload.totalCount > 0
      ? Math.round((payload.presentCount / payload.totalCount) * 100)
      : 0;

    const absentList = payload.absentEmployees.length > 0
      ? `\n*Absent:* ${payload.absentEmployees.join(', ')}`
      : '';

    const lateList = payload.lateEmployees.length > 0
      ? `\n*Late:* ${payload.lateEmployees.join(', ')}`
      : '';

    const msg =
      `📊 *Daily Attendance — ${payload.date}*\n` +
      `*${payload.orgName}*\n\n` +
      `✅ Present: ${payload.presentCount}/${payload.totalCount} (${rate}%)` +
      absentList +
      lateList +
      `\n\n_Sent by Facial.io_`;

    await this.send(this.adminWhatsApp, this.fromWhatsApp, msg);
  }
}
