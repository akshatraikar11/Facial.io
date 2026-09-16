import { registerAs } from '@nestjs/config';

/**
 * Clerk authentication configuration.
 * CLERK_SECRET_KEY       — used to verify JWTs server-side
 * CLERK_WEBHOOK_SECRET   — used to verify incoming Clerk webhook payloads
 */
export default registerAs('clerk', () => ({
  secretKey: process.env.CLERK_SECRET_KEY || '',
  webhookSecret: process.env.CLERK_WEBHOOK_SECRET || '',
}));
