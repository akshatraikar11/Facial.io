import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

/**
 * @OrgId() — custom parameter decorator.
 *
 * Usage in a controller:
 *   @Get()
 *   findAll(@OrgId() orgId: string) { ... }
 *
 * Instead of doing: const orgId = req.auth?.orgId
 * You just declare @OrgId() and NestJS injects it for you.
 *
 * The orgId is extracted from the Clerk JWT payload that the
 * ClerkAuthGuard attaches to req.auth after verification.
 *
 * Why this matters in interviews:
 * "We use a custom @OrgId() decorator so every controller gets the
 *  organization ID cleanly from the verified JWT — not from the request body.
 *  The client can never spoof which org they belong to."
 */
export const OrgId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest<Request & { auth?: { orgId?: string } }>();
    return request.auth?.orgId ?? '';
  },
);
