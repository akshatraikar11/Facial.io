import { Reflector } from '@nestjs/core';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { TenantIsolationGuard } from './tenant-isolation.guard.js';
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('TenantIsolationGuard', () => {
  let guard: TenantIsolationGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new TenantIsolationGuard(reflector);
  });

  const createMockContext = (request: any, isSkipped = false) => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(isSkipped);
    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as any;
  };

  it('allows request when token orgId matches requested params', () => {
    const context = createMockContext({
      auth: { orgId: 'org_123' },
      params: { orgId: 'org_123' },
      query: {},
      body: {},
    });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('throws ForbiddenException on cross-tenant param access attempt', () => {
    const context = createMockContext({
      auth: { orgId: 'org_123' },
      params: { orgId: 'org_999' },
      query: {},
      body: {},
    });

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('throws ForbiddenException on cross-tenant query access attempt', () => {
    const context = createMockContext({
      auth: { orgId: 'org_123' },
      params: {},
      query: { orgId: 'org_malicious' },
      body: {},
    });

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('allows public webhook endpoints with @SkipTenantCheck', () => {
    const context = createMockContext({}, true);

    expect(guard.canActivate(context)).toBe(true);
  });
});
