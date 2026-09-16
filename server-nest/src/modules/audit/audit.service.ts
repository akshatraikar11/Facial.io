import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AuditLog, AuditLogDocument } from './schemas/audit-log.schema.js';

export interface LogActionParams {
  orgId: string;
  userId: string;
  userEmail: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
}

export interface AuditQueryParams {
  limit?: number;
  offset?: number;
  action?: string;
  entityType?: string;
  userId?: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectModel(AuditLog.name)
    private readonly auditModel: Model<AuditLogDocument>,
  ) {}

  /**
   * Records one admin action.
   *
   * Called from service methods — not from controllers.
   * Services know the before/after state; controllers just handle HTTP.
   *
   * Strips descriptor[] from before/after to prevent face embedding leakage.
   * Fire-and-forget: never throws — a logging failure must not break the action.
   */
  async log(params: LogActionParams): Promise<void> {
    try {
      const strip = (obj: Record<string, unknown> | null | undefined) => {
        if (!obj) return obj ?? null;
        const { descriptor, ...rest } = obj as any;
        void descriptor; // intentionally excluded
        return rest;
      };

      await this.auditModel.create({
        orgId: params.orgId,
        userId: params.userId,
        userEmail: params.userEmail,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId ?? null,
        before: strip(params.before ?? null),
        after: strip(params.after ?? null),
        metadata: params.metadata ?? null,
      });
    } catch (err) {
      // Audit failures are logged but never bubble up
      this.logger.error(`Audit log write failed: ${(err as Error).message}`);
    }
  }

  /**
   * Paginated query of audit logs for an org.
   * Most recent first.
   */
  async findAll(
    orgId: string,
    params: AuditQueryParams = {},
  ): Promise<{ entries: AuditLogDocument[]; total: number }> {
    const filter: Record<string, unknown> = { orgId };

    if (params.action) filter['action'] = params.action;
    if (params.entityType) filter['entityType'] = params.entityType;
    if (params.userId) filter['userId'] = params.userId;

    const limit  = Math.min(params.limit  ?? 50, 200);
    const offset = params.offset ?? 0;

    const [entries, total] = await Promise.all([
      this.auditModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(offset)
        .limit(limit)
        .exec(),
      this.auditModel.countDocuments(filter).exec(),
    ]);

    return { entries, total };
  }
}
