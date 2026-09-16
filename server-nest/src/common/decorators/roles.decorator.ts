import { SetMetadata } from '@nestjs/common';

/**
 * Plan tiers available in Facial.io.
 * These map directly to the org.plan field in MongoDB.
 */
export type Plan = 'free' | 'pro' | 'enterprise';

export const PLAN_KEY = 'requiredPlan';

/**
 * @RequiresPlan('pro') — metadata decorator for route-level plan gating.
 *
 * Usage:
 *   @RequiresPlan('pro')
 *   @Get('analytics')
 *   getAnalytics() { ... }
 *
 * The RolesGuard (Phase 2) reads this metadata and checks
 * whether the requesting org's plan meets the requirement.
 *
 * Why this matters in interviews:
 * "Feature gating is a single decorator on the controller method.
 *  The guard reads the required plan from metadata and compares it
 *  to the org's current subscription — clean separation of concerns."
 */
export const RequiresPlan = (...plans: Plan[]) => SetMetadata(PLAN_KEY, plans);
