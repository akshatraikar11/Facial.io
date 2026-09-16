import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ShiftDocument = HydratedDocument<Shift>;

/**
 * Shift — a named time window within an org.
 *
 * name              — e.g. "Morning Shift", "Evening Shift"
 * startTime         — HH:MM (24h). The expected check-in time.
 * endTime           — HH:MM (24h). Informational — end of the shift.
 * gracePeriodMinutes — how many minutes after startTime before a
 *                      check-in is marked 'late'. Default 15.
 *
 * How late detection works:
 *   On check-in, AttendanceService.checkIn() calls ShiftsService.resolveShift()
 *   which finds the shift whose startTime is closest to (but before) the
 *   check-in time. If the gap > gracePeriodMinutes, status = 'late'.
 *
 * Compound index: { orgId, name } unique — one shift name per org.
 */
@Schema({ timestamps: true })
export class Shift {
  @Prop({ required: true, index: true })
  orgId: string;

  @Prop({ required: true })
  name: string; // e.g. "Morning Shift"

  @Prop({ required: true })
  startTime: string; // HH:MM

  @Prop({ required: true })
  endTime: string; // HH:MM

  @Prop({ type: Number, default: 15 })
  gracePeriodMinutes: number;

  @Prop({ type: Boolean, default: true })
  isActive: boolean;
}

export const ShiftSchema = SchemaFactory.createForClass(Shift);

ShiftSchema.index({ orgId: 1, name: 1 }, { unique: true });
