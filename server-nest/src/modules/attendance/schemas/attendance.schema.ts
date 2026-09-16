import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type AttendanceDocument = HydratedDocument<AttendanceLog>;

/**
 * AttendanceLog schema — one record per employee check-in.
 *
 * Fields:
 *
 *   orgId        — Tenant key. Every query filters by this.
 *
 *   employeeId   — MongoDB ObjectId reference to Employee.
 *                  Stored as a string (not ObjectId ref) for query flexibility —
 *                  we can look up logs even if the employee is hard-deleted.
 *
 *   name         — Denormalized employee name.
 *                  Copied at check-in time so the log is self-contained.
 *                  If the employee is later renamed, historical logs still
 *                  show what their name was at the time of check-in.
 *
 *   date         — 'YYYY-MM-DD' string for easy filtering.
 *                  Using a string (not Date) keeps date queries simple:
 *                  AttendanceLog.find({ date: '2026-08-28' })
 *                  No timezone confusion, no date math needed.
 *
 *   time         — 'HH:MM' string (24h format). Same reason as date.
 *
 *   status       — 'present' | 'late' | 'absent'.
 *                  'late' is set when check-in time is after the org's
 *                  configured cutoff (Phase 9, anomaly detection).
 *
 *   checkInAt    — Full ISO timestamp for precise time tracking.
 *                  The date+time strings are for filtering; this is for display.
 *
 * Indexes:
 *   { orgId, date }           — most common query: "today's logs for this org"
 *   { orgId, employeeId }     — employee history view
 *   { orgId, employeeId, date } — duplicate check-in prevention
 *
 * Interview answer:
 * "We store date as a 'YYYY-MM-DD' string deliberately. It avoids timezone
 *  issues — the date is recorded in the local time of the kiosk, not UTC.
 *  Filtering by date becomes a simple string equality check rather than
 *  a range query on a timestamp field."
 */
@Schema({ timestamps: true })
export class AttendanceLog {
  @Prop({ required: true, index: true })
  orgId: string;

  @Prop({ required: true })
  employeeId: string;

  @Prop({ required: true })
  name: string; // denormalized for self-contained logs

  @Prop({ required: true })
  date: string; // YYYY-MM-DD

  @Prop({ required: true })
  time: string; // HH:MM

  @Prop({
    type: String,
    enum: ['present', 'late', 'absent'],
    default: 'present',
  })
  status: string;

  @Prop({ type: Date, default: Date.now })
  checkInAt: Date;

  // ── Multi-location support ──────────────────────────────────────────────
  // locationId   — slug from the kiosk URL (?location=main-gate)
  // locationName — denormalized display name, captured at check-in time
  //                so the log is self-contained even if the location is renamed later.
  @Prop({ type: String, default: null })
  locationId: string | null;

  @Prop({ type: String, default: null })
  locationName: string | null;

  // ── Shift awareness ─────────────────────────────────────────────────────
  // shiftId   — reference to the Shift document that was active at check-in
  // shiftName — denormalized name (e.g. "Morning Shift")
  @Prop({ type: String, default: null })
  shiftId: string | null;

  @Prop({ type: String, default: null })
  shiftName: string | null;
}

export const AttendanceSchema = SchemaFactory.createForClass(AttendanceLog);

// Compound indexes for the most frequent query patterns
AttendanceSchema.index({ orgId: 1, date: 1 });
AttendanceSchema.index({ orgId: 1, employeeId: 1 });
AttendanceSchema.index({ orgId: 1, employeeId: 1, date: 1 });
AttendanceSchema.index({ orgId: 1, locationId: 1, date: 1 }); // location filter
