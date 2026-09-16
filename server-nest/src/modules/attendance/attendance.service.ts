import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
  Optional,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AttendanceLog, AttendanceDocument } from './schemas/attendance.schema.js';
import { CreateAttendanceDto } from './dto/create-attendance.dto.js';
import { AttendanceQueryDto } from './dto/attendance-query.dto.js';
import { EmployeesService } from '../employees/employees.service.js';
import { AttendanceGateway } from './attendance.gateway.js';
import { LocationsService } from '../locations/locations.service.js';
import { ShiftsService } from '../shifts/shifts.service.js';

/**
 * AttendanceService — business logic for attendance management.
 *
 * Core responsibilities:
 *   1. Check-in: validate employee exists, prevent duplicate, create log
 *   2. Query logs: filter by date, employee, date range — all org-scoped
 *   3. Stats: today's count, attendance rate, trends for dashboard charts
 *   4. Export: generate CSV data for download
 *
 * Duplicate prevention:
 *   One employee can only check in once per day.
 *   We check for an existing log with { orgId, employeeId, date }
 *   before creating a new one. Returns 409 Conflict if already checked in.
 *
 * Stats are computed here in the service, not in the controller.
 * Controllers should be thin — just handle HTTP and delegate to service.
 */
@Injectable()
export class AttendanceService {
  private readonly logger = new Logger(AttendanceService.name);

  constructor(
    @InjectModel(AttendanceLog.name)
    private readonly attendanceModel: Model<AttendanceDocument>,
    private readonly employeesService: EmployeesService,
    // @Optional() because AttendanceService is instantiated before the
    // gateway in some test contexts. Gateway is always present at runtime.
    @Optional()
    private readonly gateway: AttendanceGateway,
    @Optional()
    private readonly locationsService: LocationsService,
    @Optional()
    private readonly shiftsService: ShiftsService,
  ) {}

  /**
   * Creates a check-in log.
   * Validates the employee belongs to the org.
   * Prevents duplicate check-ins on the same day.
   */
  async checkIn(
    orgId: string,
    dto: CreateAttendanceDto,
  ): Promise<AttendanceDocument> {
    // Verify employee exists in this org
    await this.employeesService.findOne(orgId, dto.employeeId);

    // Resolve date/time — use provided or default to now
    const now = new Date();
    const date = dto.date ?? now.toISOString().slice(0, 10);
    const time =
      dto.time ??
      `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    // Prevent duplicate check-in for same employee same day
    const existing = await this.attendanceModel
      .findOne({ orgId, employeeId: dto.employeeId, date })
      .exec();

    if (existing) {
      throw new ConflictException(
        `${dto.name} has already checked in today (${date})`,
      );
    }

    // Resolve location name from slug if provided
    let locationId: string | null = dto.locationId ?? null;
    let locationName: string | null = dto.locationName ?? null;
    if (locationId && !locationName && this.locationsService) {
      const loc = await this.locationsService.findBySlug(orgId, locationId);
      locationName = loc?.name ?? locationId;
    }

    // Resolve shift and derive present/late status
    let resolvedShiftId: string | null = null;
    let resolvedShiftName: string | null = null;
    let status = dto.status ?? 'present';

    if (this.shiftsService) {
      const resolved = await this.shiftsService.resolveShift(orgId, time);
      if (resolved) {
        resolvedShiftId = resolved.shiftId;
        resolvedShiftName = resolved.shiftName;
        // Only override status if it wasn't explicitly set by the caller
        if (!dto.status) {
          status = resolved.status;
        }
      }
    }

    const log = await this.attendanceModel.create({
      orgId,
      employeeId: dto.employeeId,
      name: dto.name,
      date,
      time,
      status,
      checkInAt: now,
      locationId,
      locationName,
      shiftId: resolvedShiftId,
      shiftName: resolvedShiftName,
    });

    this.logger.log(`Check-in: ${dto.name} at ${time} on ${date} (${orgId})`);

    // ── Real-time broadcast ────────────────────────────────────────────────
    // Emit the new log to every dashboard client connected in this org's room.
    // gateway?.emitCheckIn() — optional chaining handles the @Optional() case.
    // toObject() converts the Mongoose document to a plain JS object so
    // Socket.io can serialize it cleanly without Mongoose internals.
    this.gateway?.emitCheckIn(orgId, log.toObject());

    return log;
  }

  /**
   * Query attendance logs with optional filters.
   * All queries are org-scoped.
   * Sorted by checkInAt descending — most recent first.
   */
  async findAll(
    orgId: string,
    query: AttendanceQueryDto,
  ): Promise<AttendanceDocument[]> {
    const filter: Record<string, unknown> = { orgId };

    if (query.employeeId) filter['employeeId'] = query.employeeId;
    if (query.locationId) filter['locationId'] = query.locationId;

    if (query.date) {
      filter['date'] = query.date;
    } else if (query.startDate || query.endDate) {
      const dateFilter: Record<string, string> = {};
      if (query.startDate) dateFilter['$gte'] = query.startDate;
      if (query.endDate) dateFilter['$lte'] = query.endDate;
      filter['date'] = dateFilter;
    }

    return this.attendanceModel
      .find(filter)
      .sort({ checkInAt: -1 })
      .exec();
  }

  /**
   * Returns today's attendance logs for the org.
   * Used by the kiosk live feed and dashboard "today" section.
   */
  async findToday(orgId: string): Promise<AttendanceDocument[]> {
    const today = new Date().toISOString().slice(0, 10);
    return this.attendanceModel
      .find({ orgId, date: today })
      .sort({ checkInAt: -1 })
      .exec();
  }

  /**
   * Dashboard statistics for the org.
   *
   * Returns:
   *   presentToday     — unique employees checked in today
   *   totalEmployees   — total active employees
   *   attendanceRate   — presentToday / totalEmployees * 100
   *   lateToday        — employees with status 'late' today
   *   weeklyTrend      — last 7 days: { date, present, late, absent }[]
   *
   * weeklyTrend is used by the Recharts chart on the dashboard (Phase 7).
   * We pre-compute it here so the frontend just renders — no extra fetch.
   */
  async getStats(orgId: string): Promise<{
    presentToday: number;
    totalEmployees: number;
    attendanceRate: number;
    lateToday: number;
    weeklyTrend: Array<{ date: string; present: number; late: number }>;
  }> {
    const today = new Date().toISOString().slice(0, 10);

    // Get last 7 days dates as YYYY-MM-DD strings
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return d.toISOString().slice(0, 10);
    });

    const [todayLogs, totalEmployees, weekLogs] = await Promise.all([
      this.attendanceModel.find({ orgId, date: today }).exec(),
      this.employeesService.countActive(orgId),
      this.attendanceModel
        .find({ orgId, date: { $in: last7Days } })
        .exec(),
    ]);

    const presentToday = todayLogs.length;
    const lateToday = todayLogs.filter((l) => l.status === 'late').length;
    const attendanceRate =
      totalEmployees > 0
        ? Math.round((presentToday / totalEmployees) * 100)
        : 0;

    // Build weekly trend: group logs by date
    const trendMap = new Map<string, { present: number; late: number }>(
      last7Days.map((d) => [d, { present: 0, late: 0 }]),
    );

    for (const log of weekLogs) {
      const entry = trendMap.get(log.date);
      if (entry) {
        if (log.status === 'late') entry.late++;
        else entry.present++;
      }
    }

    const weeklyTrend = last7Days.map((date) => ({
      date,
      ...trendMap.get(date)!,
    }));

    return {
      presentToday,
      totalEmployees,
      attendanceRate,
      lateToday,
      weeklyTrend,
    };
  }

  /**
   * Generates CSV string from attendance logs.
   * Called by the export endpoint.
   * Returns a string that the controller streams as a file download.
   *
   * CSV format:
   *   Name,Date,Time,Status,CheckedInAt
   */
  async generateCsv(orgId: string, query: AttendanceQueryDto): Promise<string> {
    const logs = await this.findAll(orgId, query);

    const header = 'Name,Date,Time,Status,Location,Shift,CheckedInAt\n';
    const rows = logs
      .map(
        (l) =>
          `"${l.name}","${l.date}","${l.time}","${l.status}","${l.locationName ?? ''}","${l.shiftName ?? ''}","${l.checkInAt?.toISOString() ?? ''}"`,
      )
      .join('\n');

    return header + rows;
  }

  /**
   * Deletes a single attendance log by ID.
   * Admin-only action. Org-scoped.
   */
  async deleteOne(orgId: string, logId: string): Promise<void> {
    const result = await this.attendanceModel
      .findOneAndDelete({ _id: logId, orgId })
      .exec();

    if (!result) {
      throw new NotFoundException(`Attendance log ${logId} not found`);
    }
  }

  /**
   * Clears ALL attendance logs for the org.
   * Destructive — admin-only. Used for testing/demo resets.
   */
  async clearAll(orgId: string): Promise<{ deleted: number }> {
    const result = await this.attendanceModel
      .deleteMany({ orgId })
      .exec();

    this.logger.warn(`All attendance cleared for org: ${orgId} (${result.deletedCount} records)`);
    return { deleted: result.deletedCount };
  }

  /**
   * Returns logs with 3+ consecutive absences — used by anomaly detection cron (Phase 9).
   * Exposed here so NotificationsService can call it.
   */
  async getRecentLogsByEmployee(
    orgId: string,
    employeeId: string,
    days: number,
  ): Promise<AttendanceDocument[]> {
    const since = new Date();
    since.setDate(since.getDate() - days);
    const sinceStr = since.toISOString().slice(0, 10);

    return this.attendanceModel
      .find({ orgId, employeeId, date: { $gte: sinceStr } })
      .sort({ date: -1 })
      .exec();
  }
}
