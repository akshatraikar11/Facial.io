import { SetMetadata } from '@nestjs/common';
import { IS_PUBLIC_KEY } from '../guards/clerk-auth.guard.js';

/**
 * @Public() — marks a route as publicly accessible (no JWT required).
 *
 * Usage:
 *   @Public()
 *   @Post('webhook')
 *   handleWebhook() { ... }
 *
 * The ClerkAuthGuard reads the IS_PUBLIC_KEY metadata and skips
 * JWT verification if this decorator is present.
 *
 * Use this for:
 *   - Clerk webhooks (Clerk sends these, not authenticated users)
 *   - Stripe webhooks (same reason)
 *   - Health check endpoints
 *   - Public-facing kiosk check-in (the kiosk identifies by face, not login)
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
