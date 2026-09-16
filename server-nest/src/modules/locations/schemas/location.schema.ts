import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type LocationDocument = HydratedDocument<Location>;

/**
 * Location — a physical check-in point within an organization.
 *
 * Examples: "Main Gate", "Side Entrance", "Floor 3 Reception"
 *
 * locationId   — slugified identifier for URL usage (e.g. "main-gate")
 *                Unique per org so kiosk URL is human-readable:
 *                /kiosk?org=org_xxx&location=main-gate
 *
 * name         — display name shown on the dashboard filter and attendance log.
 *
 * isActive     — soft delete. Deactivated locations stop appearing in filters
 *                but historical logs still reference them.
 *
 * Index: { orgId, locationId } unique — enforces one slug per org.
 */
@Schema({ timestamps: true })
export class Location {
  @Prop({ required: true, index: true })
  orgId: string;

  @Prop({ required: true })
  locationId: string; // e.g. "main-gate" — URL-safe slug

  @Prop({ required: true })
  name: string; // e.g. "Main Gate"

  @Prop({ type: String, default: null })
  description: string | null;

  @Prop({ type: Boolean, default: true })
  isActive: boolean;
}

export const LocationSchema = SchemaFactory.createForClass(Location);

// Unique slug per org
LocationSchema.index({ orgId: 1, locationId: 1 }, { unique: true });
