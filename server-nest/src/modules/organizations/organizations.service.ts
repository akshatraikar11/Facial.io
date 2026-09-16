import { Injectable, Logger, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  Organization,
  OrganizationDocument,
} from './schemas/organization.schema.js';
import { CreateOrganizationDto } from './dto/create-organization.dto.js';
import { Plan } from '../../common/decorators/roles.decorator.js';

/**
 * OrganizationsService — all business logic for organization management.
 *
 * Services in NestJS hold the actual logic.
 * Controllers receive HTTP requests and delegate to services.
 * Services talk to the database (via Mongoose models) and other services.
 *
 * @InjectModel(Organization.name) — NestJS DI injects the Mongoose Model
 * for the Organization collection. The collection name in MongoDB will be
 * 'organizations' (Mongoose pluralises + lowercases the schema name).
 *
 * Methods:
 *   create()        — called by the Clerk webhook handler when an org is created
 *   findByOrgId()   — called by RolesGuard on every request to check plan
 *   updatePlan()    — called by the Stripe webhook handler on subscription change
 *   setStripeId()   — called by BillingService after creating a Stripe customer
 */
@Injectable()
export class OrganizationsService {
  private readonly logger = new Logger(OrganizationsService.name);

  constructor(
    @InjectModel(Organization.name)
    private readonly orgModel: Model<OrganizationDocument>,
  ) {}

  /**
   * Creates a new organization record.
   * Called when Clerk fires 'organization.created' webhook.
   * ConflictException if the orgId already exists (idempotency guard).
   */
  async create(dto: CreateOrganizationDto): Promise<OrganizationDocument> {
    const existing = await this.orgModel.findOne({ orgId: dto.orgId });

    if (existing) {
      this.logger.warn(`Org already exists: ${dto.orgId} — skipping duplicate`);
      return existing;
    }

    const org = await this.orgModel.create({
      orgId: dto.orgId,
      name: dto.name,
      plan: 'free',
      stripeCustomerId: dto.stripeCustomerId ?? null,
    });

    this.logger.log(`Organization created: ${dto.name} (${dto.orgId})`);
    return org;
  }

  /**
   * Finds an org by its Clerk orgId.
   * Used by RolesGuard on every protected request.
   * Returns null if not found — guard handles the 403.
   */
  async findByOrgId(orgId: string): Promise<OrganizationDocument | null> {
    return this.orgModel.findOne({ orgId }).exec();
  }

  /**
   * Updates the org's subscription plan.
   * Called by BillingService when Stripe fires a subscription event.
   *
   * @param orgId  — Clerk org ID
   * @param plan   — new plan tier ('free' | 'pro' | 'enterprise')
   */
  async updatePlan(
    orgId: string,
    plan: Plan,
  ): Promise<OrganizationDocument | null> {
    const org = await this.orgModel
      .findOneAndUpdate({ orgId }, { plan }, { new: true })
      .exec();

    if (org) {
      this.logger.log(`Plan updated: ${orgId} → ${plan}`);
    }

    return org;
  }

  /**
   * Stores the Stripe customer ID after BillingService creates the customer.
   * This links MongoDB org ↔ Stripe customer for all future billing ops.
   */
  async setStripeCustomerId(
    orgId: string,
    stripeCustomerId: string,
  ): Promise<void> {
    await this.orgModel
      .findOneAndUpdate({ orgId }, { stripeCustomerId })
      .exec();

    this.logger.log(`Stripe customer linked: ${orgId} → ${stripeCustomerId}`);
  }

  /**
   * Returns all orgs — admin/debug use only.
   * Will be protected by an admin-only guard in production.
   */
  async findAll(): Promise<OrganizationDocument[]> {
    return this.orgModel.find().exec();
  }
}
