import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/core';
import { Reflector } from '@nestjs/core';
import { PLAN_KEY, Plan } from '../decorators/roles.decorator.js';

@Injectable()
export class PlanQuotaGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPlans = this.reflector.getAllAndOverride<Plan[]>(
      PLAN_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPlans || requiredPlans.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const currentPlan: Plan = request.auth?.plan || request.org?.plan || 'free';

    const planTierRank: Record<Plan, number> = {
      free: 1,
      pro: 2,
      enterprise: 3,
    };

    const currentRank = planTierRank[currentPlan] || 1;
    const meetsRequirement = requiredPlans.some(
      (required) => currentRank >= planTierRank[required],
    );

    if (!meetsRequirement) {
      throw new ForbiddenException(
        `Feature requires one of the following subscription plans: [${requiredPlans.join(', ')}]. Current plan: ${currentPlan}. Please upgrade via billing portal.`,
      );
    }

    return true;
  }
}
