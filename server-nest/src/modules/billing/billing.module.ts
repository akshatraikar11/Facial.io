import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller.js';
import { BillingService } from './billing.service.js';
import { OrganizationsModule } from '../organizations/organizations.module.js';

/**
 * BillingModule — Stripe subscription management.
 *
 * imports: [OrganizationsModule]
 *   BillingService needs OrganizationsService to:
 *     - findByOrgId() — get org's stripeCustomerId before checkout
 *     - setStripeCustomerId() — store after creating a Stripe customer
 *     - updatePlan() — upgrade/downgrade on webhook events
 *
 * No MongooseModule.forFeature() — no schemas owned by this module.
 * Billing state lives on the Organization document (plan, stripeCustomerId).
 */
@Module({
  imports: [OrganizationsModule],
  controllers: [BillingController],
  providers: [BillingService],
  exports: [BillingService],
})
export class BillingModule {}
