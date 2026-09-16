import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type OrganizationDocument = HydratedDocument<Organization>;

/**
 * Organization — the root entity for multi-tenancy.
 *
 * orgId         — Clerk org ID. Used as the primary tenant key on every query.
 * name          — Display name (e.g. "Acme Corp").
 * plan          — Subscription tier. Updated by the Stripe webhook handler.
 * stripeCustomerId — Links this org to a Stripe Customer record.
 * adminEmail    — Primary contact email. Populated from the Clerk webhook when
 *                 the org is created. Used by the anomaly-detection cron to
 *                 send nightly absence summaries to the right person.
 */
@Schema({ timestamps: true })
export class Organization {
  @Prop({ required: true, unique: true, index: true })
  orgId: string;

  @Prop({ required: true })
  name: string;

  @Prop({ type: String, enum: ['free', 'pro', 'enterprise'], default: 'free' })
  plan: string;

  @Prop({ type: String, default: null })
  stripeCustomerId: string | null;

  @Prop({ type: String, default: null })
  adminEmail: string | null;
}

export const OrganizationSchema = SchemaFactory.createForClass(Organization);
