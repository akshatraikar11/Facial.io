import { Module, Global } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ClerkAuthGuard } from './guards/clerk-auth.guard.js';
import { RolesGuard } from './guards/roles.guard.js';
import { OrganizationsModule } from '../organizations/organizations.module.js';

/**
 * AuthModule — registers auth guards globally.
 *
 * @Global() means this module's exports are available everywhere
 * without re-importing AuthModule in every feature module.
 *
 * APP_GUARD is a special NestJS injection token.
 * Providing ClerkAuthGuard and RolesGuard via APP_GUARD registers them
 * as APPLICATION-LEVEL guards — they run on every single route automatically.
 *
 * The alternative is putting @UseGuards(ClerkAuthGuard) on every controller.
 * With APP_GUARD, you protect everything by default and only opt-out
 * with @Public() for specific routes.
 *
 * Guard execution order follows registration order:
 *   1. ClerkAuthGuard — verifies JWT, attaches req.auth
 *   2. RolesGuard     — reads req.auth.orgId, checks plan
 *
 * Why OrganizationsModule is imported here:
 *   RolesGuard needs OrganizationsService to look up the org's plan.
 *   Importing OrganizationsModule here makes OrganizationsService
 *   available via NestJS DI inside RolesGuard.
 *
 * Interview answer:
 * "Both guards are registered via APP_GUARD which makes them application-wide.
 *  By default every route is protected. We use @Public() to explicitly
 *  opt-out — a secure-by-default posture rather than opt-in."
 */
@Global()
@Module({
  imports: [OrganizationsModule],
  providers: [
    // ClerkAuthGuard runs first — MUST be before RolesGuard
    {
      provide: APP_GUARD,
      useClass: ClerkAuthGuard,
    },
    // RolesGuard runs second — depends on req.auth from ClerkAuthGuard
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
  // No exports needed — APP_GUARD registers these globally.
  // Every route in the entire application is protected automatically.
})
export class AuthModule {}
