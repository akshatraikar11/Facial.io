import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';

export const SKIP_TENANT_CHECK_KEY = 'skipTenantCheck';
export const SkipTenantCheck = () => SetMetadata(SKIP_TENANT_CHECK_KEY, true);

/**
 * TenantIsolationGuard — Enforces strict multi-tenant boundary isolation.
 *
 * Prevents IDOR (Insecure Direct Object Reference) and cross-tenant data leakage.
 * Inspects the verified token's `orgId` vs any incoming request params/query/body.
 * If there is any discrepancy, immediately aborts with HTTP 403 Forbidden.
 */
@Injectable()
export class TenantIsolationGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isSkipped = this.reflector.getAllAndOverride<boolean>(
      SKIP_TENANT_CHECK_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (isSkipped) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request & { auth?: { orgId?: string } }>();
    const tokenOrgId = request.auth?.orgId;

    // Public / unauthenticated routes handled elsewhere, but if route is authenticated,
    // orgId MUST be present.
    if (request.auth && !tokenOrgId) {
      throw new UnauthorizedException('Authentication token missing valid organization ID context');
    }

    if (!tokenOrgId) {
      return true;
    }

    // Check path parameters (e.g. /api/organizations/:orgId/...)
    const paramOrgId = request.params?.orgId || request.params?.org;
    if (paramOrgId && paramOrgId !== tokenOrgId) {
      throw new ForbiddenException(
        `Cross-tenant boundary violation: Token org (${tokenOrgId}) cannot access resource org (${paramOrgId})`,
      );
    }

    // Check query parameters (e.g. ?orgId=...)
    const queryOrgId = request.query?.orgId || request.query?.org;
    if (queryOrgId && typeof queryOrgId === 'string' && queryOrgId !== tokenOrgId) {
      throw new ForbiddenException(
        `Cross-tenant boundary violation: Token org (${tokenOrgId}) cannot query resource org (${queryOrgId})`,
      );
    }

    // Check body parameters if explicitly passed
    const bodyOrgId = (request.body as any)?.orgId;
    if (bodyOrgId && bodyOrgId !== tokenOrgId) {
      throw new ForbiddenException(
        `Cross-tenant boundary violation: Cannot mutate resources with mismatched body orgId (${bodyOrgId})`,
      );
    }

    return true;
  }
}
