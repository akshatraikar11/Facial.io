import { Reflector } from '@nestjs/core';
import { HttpException, HttpStatus } from '@nestjs/common';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { KioskRateLimiterGuard, KIOSK_RATE_LIMIT_KEY } from './kiosk-rate-limiter.guard.js';

describe('KioskRateLimiterGuard', () => {
  let guard: KioskRateLimiterGuard;
  let reflector: Reflector;

  beforeEach(() => {
    KioskRateLimiterGuard.clearMemoryCache();
    reflector = new Reflector();
    guard = new KioskRateLimiterGuard(reflector);
  });

  const createMockContext = (ip: string, orgId: string, limit = 5, windowSec = 60) => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue({ limit, windowSec });
    const headers: Record<string, string> = {};

    return {
      switchToHttp: () => ({
        getRequest: () => ({
          ip,
          body: { orgId },
          headers: {},
        }),
        getResponse: () => ({
          setHeader: (name: string, val: string) => {
            headers[name] = val;
          },
          headers,
        }),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as any;
  };

  it('allows requests up to the defined limit within the time window', async () => {
    const context = createMockContext('192.168.1.50', 'org_test', 3, 60);

    // Requests 1, 2, 3 should all succeed
    expect(await guard.canActivate(context)).toBe(true);
    expect(await guard.canActivate(context)).toBe(true);
    expect(await guard.canActivate(context)).toBe(true);
  });

  it('throws HTTP 429 Too Many Requests when exceeding the limit', async () => {
    const context = createMockContext('192.168.1.51', 'org_test', 2, 60);

    // 1st request ok
    expect(await guard.canActivate(context)).toBe(true);
    // 2nd request ok
    expect(await guard.canActivate(context)).toBe(true);

    // 3rd request should fail
    await expect(guard.canActivate(context)).rejects.toThrow(HttpException);

    try {
      await guard.canActivate(context);
    } catch (err: any) {
      expect(err.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
      const res = err.getResponse();
      expect(res.message).toContain('Kiosk rate limit exceeded');
      expect(res.statusCode).toBe(429);
      expect(res.retryAfter).toBeGreaterThan(0);
    }
  });

  it('differentiates between distinct kiosks or organizations', async () => {
    const contextA = createMockContext('10.0.0.1', 'org_alpha', 1, 60);
    const contextB = createMockContext('10.0.0.2', 'org_beta', 1, 60);

    // Kiosk A uses its quota
    expect(await guard.canActivate(contextA)).toBe(true);
    await expect(guard.canActivate(contextA)).rejects.toThrow(HttpException);

    // Kiosk B has separate quota and still succeeds
    expect(await guard.canActivate(contextB)).toBe(true);
  });
});

