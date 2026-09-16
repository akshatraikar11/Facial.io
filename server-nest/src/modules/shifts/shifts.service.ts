import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Shift, ShiftDocument } from './schemas/shift.schema.js';
import { CreateShiftDto } from './dto/create-shift.dto.js';

/** Result of resolving a shift for a given check-in time */
export interface ResolvedShift {
  shiftId: string;
  shiftName: string;
  status: 'present' | 'late';
}

@Injectable()
export class ShiftsService {
  private readonly logger = new Logger(ShiftsService.name);

  constructor(
    @InjectModel(Shift.name)
    private readonly shiftModel: Model<ShiftDocument>,
  ) {}

  async findAll(orgId: string): Promise<ShiftDocument[]> {
    return this.shiftModel
      .find({ orgId, isActive: true })
      .sort({ startTime: 1 })
      .exec();
  }

  async create(orgId: string, dto: CreateShiftDto): Promise<ShiftDocument> {
    const existing = await this.shiftModel
      .findOne({ orgId, name: dto.name })
      .exec();

    if (existing) {
      throw new ConflictException(
        `Shift "${dto.name}" already exists in your organization`,
      );
    }

    const shift = await this.shiftModel.create({
      orgId,
      name: dto.name,
      startTime: dto.startTime,
      endTime: dto.endTime,
      gracePeriodMinutes: dto.gracePeriodMinutes ?? 15,
      isActive: true,
    });

    this.logger.log(`Shift created: ${dto.name} @ ${dto.startTime} (${orgId})`);
    return shift;
  }

  async softDelete(orgId: string, shiftId: string): Promise<void> {
    const result = await this.shiftModel
      .findOneAndUpdate(
        { _id: shiftId, orgId },
        { isActive: false },
        { new: true },
      )
      .exec();

    if (!result) {
      throw new NotFoundException(`Shift "${shiftId}" not found`);
    }
  }

  /**
   * Resolve which shift applies to a given check-in time and whether
   * the employee is on time or late.
   *
   * Algorithm:
   *   1. Fetch all active shifts for the org.
   *   2. Convert each shift's startTime + the check-in time to total minutes.
   *   3. Find the shift whose startTime is closest to (and before or equal)
   *      the check-in time — i.e. the most recently started shift.
   *   4. If no shift has started yet (all start in the future), pick the
   *      earliest one (employee arrived very early).
   *   5. Compare check-in minutes to (shiftStart + gracePeriod):
   *      - on time  → 'present'
   *      - over grace → 'late'
   *
   * Returns null if the org has no shifts defined (don't change status).
   */
  async resolveShift(
    orgId: string,
    checkInTime: string, // HH:MM
  ): Promise<ResolvedShift | null> {
    const shifts = await this.findAll(orgId);
    if (shifts.length === 0) return null;

    const toMinutes = (hhmm: string): number => {
      const [h, m] = hhmm.split(':').map(Number);
      return h * 60 + m;
    };

    const checkInMinutes = toMinutes(checkInTime);

    // Find shifts that have already started (startTime <= checkInTime)
    const started = shifts.filter(
      (s) => toMinutes(s.startTime) <= checkInMinutes,
    );

    let match: ShiftDocument;
    if (started.length > 0) {
      // Pick the one whose startTime is closest to (most recent before) check-in
      match = started.reduce((best, s) =>
        toMinutes(s.startTime) > toMinutes(best.startTime) ? s : best,
      );
    } else {
      // All shifts are in the future — employee is very early, pick earliest
      match = shifts.reduce((best, s) =>
        toMinutes(s.startTime) < toMinutes(best.startTime) ? s : best,
      );
    }

    const shiftStart = toMinutes(match.startTime);
    const lateThreshold = shiftStart + match.gracePeriodMinutes;
    const status: 'present' | 'late' =
      checkInMinutes <= lateThreshold ? 'present' : 'late';

    return {
      shiftId: (match._id as any).toString(),
      shiftName: match.name,
      status,
    };
  }
}
