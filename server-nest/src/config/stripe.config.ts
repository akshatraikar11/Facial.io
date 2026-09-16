import { registerAs } from '@nestjs/config';

/**
 * Stripe billing configuration.
 * All keys here are TEST mode keys — no real charges during development.
 * STRIPE_SECRET_KEY           — server-side Stripe API calls
 * STRIPE_WEBHOOK_SECRET       — verify incoming Stripe webhook signatures
 * STRIPE_PRO_PRICE_ID         — Stripe Price ID for the Pro plan
 * STRIPE_ENTERPRISE_PRICE_ID  — Stripe Price ID for the Enterprise plan
 */
export default registerAs('stripe', () => ({
  secretKey: process.env.STRIPE_SECRET_KEY || '',
  webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
  proPriceId: process.env.STRIPE_PRO_PRICE_ID || '',
  enterprisePriceId: process.env.STRIPE_ENTERPRISE_PRICE_ID || '',
}));
