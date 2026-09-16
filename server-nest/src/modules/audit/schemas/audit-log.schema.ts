import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type AuditLogDocument = HydratedDocument<AuditLog>;

/**
 * AuditLog — immutable record of every admin action.
 *
 * Fields:
 *
 *   orgId        — Tenant key. Every query scoped to this.
 *
 *   userId       — Clerk user ID of the admin who performed the action.
 *
 *   userEmail    — Denormalized email at action time. Self-contained log.
 *
 *   action       — Dot-notation event type. Examples:
 *                    employee.created   employee.deleted   employee.updated
 *                    plan.changed       attendance.deleted attendance.cleared
 *                    location.created   location.deleted
 *                    shift.created      shift.deleted
 *
 *   entityType   — The domain object affected: 'employee' | 'attendance' |
 *                  'location' | 'shift' | 'plan' | 'organization'
 *
 *   entityId     — MongoDB _id of the affected document (null for bulk ops).
 *
 *   before       — Snapshot of the document state BEFORE the action.
 *                  Null for create operations.
 *
 *   after        — Snapshot of the document state AFTER the action.
 *                  Null for delete operations.
 *
 *   metadata     — Optional extra context (e.g. IP address, reason string).
 *
 * Design decisions:
 *   - Documents are NEVER deleted. Audit logs are append-only.
 *   - descriptor[] is always stripped from before/after snapshots —
 *     face embeddings must not leak into the audit trail.
 *   - Stored as plain objects (Mixed type) so the schema doesn't
 *     need to know the shape of every entity.
 *
 * Indexes:
 *   { orgId, createdAt }  — most common query: "recent actions for this org"
 *   { orgId, action }     — filter by action type
 *   { orgId, userId }     — filter by who did it
 */
@Schema({ timestamps: true })
export class AuditLog {
  @Prop({ required: true, index: true })
  orgId: string;

  @Prop({ required: true })
  userId: string;

  @Prop({ required: true })
  userEmail: string;

  @Prop({ required: true })
  action: string; // e.g. 'employee.created'

  @Prop({ required: true })
  entityType: string; // e.g. 'employee'

  @Prop({ type: String, default: null })
  entityId: string | null;

  @Prop({ type: Object, default: null })
  before: Record<string, unknown> | null; // state before — null on create

  @Prop({ type: Object, default: null })
  after: Record<string, unknown> | null;  // state after  — null on delete

  @Prop({ type: Object, default: null })
  metadata: Record<string, unknown> | null; // extra context
}

export const AuditLogSchema = SchemaFactory.createForClass(AuditLog);

AuditLogSchema.index({ orgId: 1, createdAt: -1 });
AuditLogSchema.index({ orgId: 1, action: 1 });
AuditLogSchema.index({ orgId: 1, userId: 1 });
