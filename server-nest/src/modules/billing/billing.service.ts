import {
  Injectable,
  Logger,
  OnModuleInit,
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { OrganizationsService } from '../organizations/organizations.service.js';
import { Plan } from '../../common/decorators/roles.decorator.js';

/**
 * BillingService — Stripe subscription management.
 *
 * All Stripe calls use TEST mode keys during development — no real charges.
 * The flow mirrors exactly what production Stripe looks like, so going live
 * is just a key swap.
 *
 * Key flows:
 *
 * 1. Checkout session
 *    Admin clicks "Upgrade to Pro" → createCheckout() creates a Stripe
 *    Checkout Session → returns a URL → frontend redirects to Stripe's
 *    hosted payment page → on success, Stripe fires a webhook.
 *
 * 2. Billing portal
 *    Admin wants to manage their subscription → createPortal() creates
 *    a Stripe Customer Portal session → returns a URL → frontend redirects.
 *    From the portal, they can upgrade, downgrade, cancel, update payment info.
 *
 * 3. Webhook processing
 *    Stripe fires events to POST /api/billing/webhook.
 *    We verify the signature (prevents faked events), then handle:
 *      checkout.session.completed     → subscription activated
 *      customer.subscription.updated  → plan changed
 *      customer.subscription.deleted  → subscription cancelled → downgrade to free
 *
 * Graceful degradation:
 *    If STRIPE_SECRET_KEY is empty, Stripe isn't initialized.
 *    Non-billing routes still work. Billing endpoints return 503.
 */
@Injectable()
export class BillingService implements OnModuleInit {
  private readonly logger = new Logger(BillingService.name);
  private stripe: Stripe | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly organizationsService: OrganizationsService,
  ) {}

  async onModuleInit() {
    const secretKey = this.config.get<string>('stripe.secretKey');
    if (!secretKey) {
      this.logger.warn('STRIPE_SECRET_KEY not set — billing endpoints will return 503');
      return;
    }
    this.stripe = new Stripe(secretKey, { 
      apiVersion: '2024-11-20' as any, // Using stable version 2024-11-20.acacia
    });
    this.logger.log('Stripe initialized (test mode)');
  }

  private assertStripe(): Stripe {
    if (!this.stripe) {
      throw new ServiceUnavailableException(
        'Billing service not configured. Set STRIPE_SECRET_KEY in .env.',
      );
    }
    return this.stripe;
  }

  /**
   * Creates a Stripe Checkout Session for upgrading to pro/enterprise.
   *
   * Steps:
   * 1. Look up or create a Stripe Customer for this org.
   * 2. Create a Checkout Session with the right Price ID.
   * 3. Return the session URL — frontend redirects to it.
   *
   * success_url / cancel_url: where Stripe redirects after payment.
   * metadata.orgId: stored on the session so the webhook knows which org to upgrade.
   */
  async createCheckout(
    orgId: string,
    plan: 'pro' | 'enterprise',
    clientUrl: string,
  ): Promise<{ url: string }> {
    const stripe = this.assertStripe();

    const org = await this.organizationsService.findByOrgId(orgId);
    if (!org) throw new BadRequestException('Organization not found');

    // Get or create Stripe customer for this org
    let customerId = org.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        name: org.name,
        metadata: { orgId },
      });
      customerId = customer.id;
      await this.organizationsService.setStripeCustomerId(orgId, customerId);
    }

    // Resolve the Price ID for the selected plan
    const priceId =
      plan === 'pro'
        ? this.config.get<string>('stripe.proPriceId')
        : this.config.get<string>('stripe.enterprisePriceId');

    if (!priceId) {
      throw new BadRequestException(
        `Price ID for plan "${plan}" not configured. Set STRIPE_${plan.toUpperCase()}_PRICE_ID in .env.`,
      );
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${clientUrl}/billing?success=true&plan=${plan}`,
      cancel_url: `${clientUrl}/billing?cancelled=true`,
      metadata: { orgId, plan },
      subscription_data: { metadata: { orgId, plan } },
    });

    return { url: session.url! };
  }

  /**
   * Creates a Stripe Customer Portal session.
   * The portal lets admins manage their subscription without any custom UI.
   * Stripe hosts the entire billing management page.
   */
  async createPortal(
    orgId: string,
    clientUrl: string,
  ): Promise<{ url: string }> {
    const stripe = this.assertStripe();

    const org = await this.organizationsService.findByOrgId(orgId);
    if (!org?.stripeCustomerId) {
      throw new BadRequestException(
        'No billing account found. Please subscribe to a plan first.',
      );
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: org.stripeCustomerId,
      return_url: `${clientUrl}/billing`,
    });

    return { url: session.url };
  }

  /**
   * Handles incoming Stripe webhook events.
   *
   * MUST receive the raw request body (Buffer) to verify the signature.
   * That's why main.ts has rawBody: true and the controller passes req.rawBody.
   *
   * Stripe-Signature header + webhook secret → stripe.webhooks.constructEvent()
   * If signature is invalid → throws → we return 400 → Stripe retries.
   */
  async handleWebhook(rawBody: Buffer, signature: string): Promise<void> {
    const stripe = this.assertStripe();
    const webhookSecret = this.config.get<string>('stripe.webhookSecret');

    if (!webhookSecret) {
      throw new BadRequestException('Stripe webhook secret not configured');
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch {
      throw new BadRequestException('Invalid Stripe webhook signature');
    }

    this.logger.log(`Stripe webhook: ${event.type}`);

    switch (event.type) {
      // Payment succeeded — subscription is now active
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const orgId = session.metadata?.orgId;
        const plan = (session.metadata?.plan ?? 'free') as Plan;
        if (orgId) {
          await this.organizationsService.updatePlan(orgId, plan);
          this.logger.log(`Plan activated: ${orgId} → ${plan}`);
        }
        break;
      }

      // Subscription changed (upgrade/downgrade via portal)
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription;
        const orgId = sub.metadata?.orgId;
        // Map Stripe price ID back to our plan name
        const priceId = sub.items.data[0]?.price.id;
        const plan = this.priceIdToPlan(priceId);
        if (orgId && plan) {
          await this.organizationsService.updatePlan(orgId, plan);
          this.logger.log(`Plan updated: ${orgId} → ${plan}`);
        }
        break;
      }

      // Subscription cancelled — downgrade to free
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        const orgId = sub.metadata?.orgId;
        if (orgId) {
          await this.organizationsService.updatePlan(orgId, 'free');
          this.logger.log(`Subscription cancelled: ${orgId} → free`);
        }
        break;
      }

      default:
        break;
    }
  }

  /** Maps a Stripe Price ID back to our plan enum. */
  private priceIdToPlan(priceId: string | undefined): Plan | null {
    if (!priceId) return null;
    if (priceId === this.config.get<string>('stripe.proPriceId')) return 'pro';
    if (priceId === this.config.get<string>('stripe.enterprisePriceId')) return 'enterprise';
    return null;
  }

  /** Returns the public plan descriptions — used by the pricing page. */
  getPlans() {
    return [
      {
        id: 'free',
        name: 'Free',
        price: 0,
        features: ['Up to 10 employees', '1 location', 'Basic attendance tracking'],
        limits: { employees: 10, locations: 1 },
      },
      {
        id: 'pro',
        name: 'Pro',
        price: 29,
        features: [
          'Up to 100 employees',
          '5 locations',
          'AI analytics assistant',
          'CSV/PDF export',
          'Anomaly alerts via email',
        ],
        limits: { employees: 100, locations: 5 },
      },
      {
        id: 'enterprise',
        name: 'Enterprise',
        price: 99,
        features: [
          'Unlimited employees',
          'Unlimited locations',
          'All Pro features',
          'Custom webhooks',
          'Priority support',
        ],
        limits: { employees: -1, locations: -1 },
      },
    ];
  }

  get isReady(): boolean {
    return this.stripe !== null;
  }
}
