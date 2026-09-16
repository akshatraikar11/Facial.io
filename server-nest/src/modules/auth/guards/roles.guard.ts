import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { PLAN_KEY, Plan } from '../../../common/decorators/roles.decorator.js';
import { OrganizationsService } from '../../organizations/organizations.service.js';

/**
 * Plan hierarchy — higher index = more access.
 * A 'pro' org can access 'free' routes. An 'enterprise' org can access everything.
 */
const PLAN_HIERARCHY: Plan[] = ['free', 'pro', 'enterprise'];

/**
 * RolesGuard — enforces subscription-based feature gating.
 *
 * Works in tandem with the @RequiresPlan() decorator:
 *
 *   @RequiresPlan('pro')       ← sets metadata: requiredPlan = ['pro']
 *   @Get('analytics')
 *   getAnalytics() { ... }
 *
 * How it works:
 *
 * 1. Read the required plan from route metadata via Reflector.
 * 2. If no @RequiresPlan() on the route → allow through (no plan required).
 * 3. Get the orgId from req.auth (set by ClerkAuthGuard, which runs first).
 * 4. Look up the org's current plan in MongoDB.
 * 5. Compare plan hierarchy — org plan must be >= required plan.
 *
 * Guard ordering matters:
 *   ClerkAuthGuard runs BEFORE RolesGuard (registered first in the module).
 *   By the time RolesGuard runs, req.auth is guaranteed to be populated.
 *
 * Interview answer:
 * "Feature gating is a single @RequiresPlan('pro') decorator on the controller.
 *  The RolesGuard reads that metadata, fetches the org's plan from MongoDB,
 *  and compares it against a plan hierarchy array. Enterprise > Pro > Free.
 *  If the org doesn't have the required tier, it gets a 403 before any
 *  business logic executes."
 */
@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger = new Logger(RolesGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly organizationsService: OrganizationsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // ── Step 1: Check if route requires a specific plan ───────────────────
    const requiredPlans = this.reflector.getAllAndOverride<Plan[]>(PLAN_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // No @RequiresPlan() on this route — allow through
    if (!requiredPlans || requiredPlans.length === 0) return true;

    // ── Step 2: Get orgId from the verified JWT payload ───────────────────
    const request = context
      .switchToHttp()
      .getRequest<Request & { auth?: { orgId?: string } }>();

    const orgId = request.auth?.orgId;

    if (!orgId) {
      throw new ForbiddenException(
        'This feature requires an organization context. Please sign in with an org account.',
      );
    }

    // ── Step 3: Fetch org plan from database ──────────────────────────────
    const org = await this.organizationsService.findByOrgId(orgId);

    if (!org) {
      throw new ForbiddenException('Organization not found');
    }

    // ── Step 4: Check plan hierarchy ──────────────────────────────────────
    const orgPlanIndex = PLAN_HIERARCHY.indexOf(org.plan as Plan);
    const requiredPlanIndex = Math.min(
      ...requiredPlans.map((p) => PLAN_HIERARCHY.indexOf(p)),
    );

    if (orgPlanIndex < requiredPlanIndex) {
      throw new ForbiddenException(
        `This feature requires a ${requiredPlans.join(' or ')} plan. Your current plan is '${org.plan}'.`,
      );
    }

    return true;
  }
}
