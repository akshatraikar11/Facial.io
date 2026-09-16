import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type EmployeeDocument = HydratedDocument<Employee>;

/**
 * Employee schema — represents a registered face in one organization.
 *
 * Fields:
 *
 *   orgId        — Clerk organization ID. Every query filters by this.
 *                  Index on orgId means MongoDB only scans documents
 *                  belonging to the requesting org — not the whole collection.
 *                  This is how multi-tenancy is enforced at the DB level.
 *
 *   name         — Display name (e.g. "Akshat Sharma")
 *
 *   email        — Unique within an org (not globally unique).
 *                  The compound index { orgId, email } enforces this.
 *
 *   role         — 'admin' | 'employee'. Admins can access the dashboard,
 *                  manage employees, and view analytics. Employees are
 *                  kiosk-only — they show up on the face scanner.
 *
 *   descriptor   — The 128-number face embedding extracted by face-api.js.
 *                  Stored here as a backup / for migration.
 *                  The primary matching uses Pinecone (Phase 4).
 *
 *   pineconeId   — The vector ID in Pinecone for this employee's face.
 *                  Format: '<orgId>_<employeeMongoId>'.
 *                  Null until the face is enrolled in Pinecone.
 *
 *   isActive     — Soft delete flag. Deactivated employees stop appearing
 *                  in face matching results without losing their history.
 *
 * Indexes:
 *   { orgId: 1 }              — all employee list queries
 *   { orgId: 1, email: 1 }    — unique email per org (not globally unique)
 *
 * Interview answer:
 * "The compound index on orgId+email enforces email uniqueness within
 *  an org without a global unique constraint. This is correct for multi-tenancy —
 *  the same person could theoretically be an employee in two different orgs
 *  using the same email address."
 */
@Schema({ timestamps: true })
export class Employee {
  @Prop({ required: true, index: true })
  orgId: string;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  email: string;

  @Prop({
    type: String,
    enum: ['admin', 'employee'],
    default: 'employee',
  })
  role: string;

  @Prop({ type: String, default: null })
  department: string | null;

  @Prop({ type: String, default: null })
  managerEmail: string | null; // Email of the employee's direct manager

  @Prop({ type: [Number], default: [] })
  descriptor: number[]; // 128-dim face embedding from face-api.js

  @Prop({ type: String, default: null })
  pineconeId: string | null; // set after Phase 4 face enrollment

  @Prop({ type: Boolean, default: true })
  isActive: boolean;

  // ── Multi-location ──────────────────────────────────────────────────────
  // defaultLocationId — the location this employee primarily checks in from.
  // Optional — employees can check in from any location.
  @Prop({ type: String, default: null })
  defaultLocationId: string | null;

  // ── Face quality score ──────────────────────────────────────────────────
  // Computed at enrollment time. 0–100.
  // 'good' ≥ 70 | 'fair' 40–69 | 'poor' < 40
  @Prop({ type: Number, default: null })
  faceQualityScore: number | null;

  @Prop({ type: String, enum: ['good', 'fair', 'poor', null], default: null })
  faceQualityLabel: string | null;

  // ── Contact ─────────────────────────────────────────────────────────────
  @Prop({ type: String, default: null })
  phone: string | null; // Used for WhatsApp/SMS Twilio alerts
}

export const EmployeeSchema = SchemaFactory.createForClass(Employee);

// Compound index: unique email per org, not globally
EmployeeSchema.index({ orgId: 1, email: 1 }, { unique: true });
