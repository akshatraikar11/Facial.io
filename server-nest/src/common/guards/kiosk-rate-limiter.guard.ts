import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  SetMetadata,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { createClient, RedisClientType } from 'redis';
import { randomUUID } from 'crypto';

export interface KioskRateLimitOptions {
  limit?: number; // Maximum requests allowed within window (default: 5)
  windowSec?: number; // Sliding window duration in seconds (default: 60)
}

export const KIOSK_RATE_LIMIT_KEY = 'kiosk_rate_limit';
export const KioskRateLimit = (options?: KioskRateLimitOptions) =>
  SetMetadata(KIOSK_RATE_LIMIT_KEY, options);

/**
 * In-memory fallback sliding window cache used when Redis is unavailable or during tests.
 * Map: clientKey -> array of timestamps in milliseconds
 */
const inMemoryCache = new Map<string, number[]>();

/**
 * KioskRateLimiterGuard — Sliding-Window rate limiter for unattended kiosk devices.
 *
 * Prevents:
 * 1. Brute-force spoofing / face-matching replay attacks.
 * 2. Rapid-fire duplicate attendance check-in submissions.
 * 3. Denial of Service (DoS) targeting unauthenticated public kiosk routes.
 *
 * Implements atomic sliding-window algorithm using Redis Sorted Sets (ZSET):
 * - Removes timestamps older than (now - windowMs)
 * - Counts active timestamps in current sliding window
 * - Rejects request with HTTP 429 & Retry-After header if limit exceeded
 * - Gracefully falls back to thread-safe memory window if Redis is offline
 */
@Injectable()
export class KioskRateLimiterGuard implements CanActivate {
  private readonly logger = new Logger(KioskRateLimiterGuard.name);
  private redisClient: RedisClientType | null = null;
  private isRedisConnected = false;

  constructor(
    private readonly reflector: Reflector,
    private readonly configService?: ConfigService,
  ) {
    this.initRedis();
  }

  private async initRedis() {
    const redisUrl = this.configService?.get<string>('REDIS_URL') || process.env['REDIS_URL'];
    if (!redisUrl) {
      return;
    }

    try {
      this.redisClient = createClient({ url: redisUrl }) as RedisClientType;
      this.redisClient.on('error', (err) => {
        this.logger.warn(`Redis connection error in rate limiter: ${err.message}. Using in-memory fallback.`);
        this.isRedisConnected = false;
      });
      await this.redisClient.connect();
      this.isRedisConnected = true;
      this.logger.log('KioskRateLimiter connected to Redis sliding-window store.');
    } catch (err: any) {
      this.logger.warn(`Failed to connect Redis for rate limiter: ${err?.message}. Using in-memory fallback.`);
      this.isRedisConnected = false;
    }
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const options =
      this.reflector.getAllAndOverride<KioskRateLimitOptions>(KIOSK_RATE_LIMIT_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) || {};

    const limit = options.limit ?? 5; // default 5 attempts
    const windowSec = options.windowSec ?? 60; // default 60 seconds
    const windowMs = windowSec * 1000;
    const now = Date.now();

    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    // Determine unique client key: IP + OrgId + optional Device ID header
    const ip =
      request.headers?.['x-forwarded-for']?.toString().split(',')[0].trim() ||
      request.ip ||
      request.socket?.remoteAddress ||
      '127.0.0.1';
    const orgId = request.body?.orgId || request.query?.orgId || request.headers?.['x-org-id'] || 'global';
    const deviceId = request.headers?.['x-device-id'] || 'kiosk';
    const clientKey = `ratelimit:kiosk:${orgId}:${deviceId}:${ip}`;

    let currentCount = 0;
    let retryAfterSec = windowSec;

    if (this.isRedisConnected && this.redisClient) {
      try {
        const key = clientKey;
        const windowStart = now - windowMs;

        // Atomic Redis sliding window transaction using multi/exec
        const multi = this.redisClient.multi();
        multi.zRemRangeByScore(key, 0, windowStart);
        multi.zCard(key);
        const results = await multi.exec();
        currentCount = (results[1] as unknown as number) || 0;

        if (currentCount >= limit) {
          // Get oldest timestamp in window to calculate exact retryAfter
          const oldestRecords = await this.redisClient.zRangeWithScores(key, 0, 0);
          if (oldestRecords.length > 0) {
            const earliestTime = oldestRecords[0].score;
            retryAfterSec = Math.max(1, Math.ceil((earliestTime + windowMs - now) / 1000));
          }
          this.triggerRateLimitException(response, limit, windowSec, retryAfterSec);
        }

        // Add current timestamp and set TTL
        const memberId = `${now}:${randomUUID()}`;
        const addMulti = this.redisClient.multi();
        addMulti.zAdd(key, [{ score: now, value: memberId }]);
        addMulti.expire(key, windowSec + 5);
        await addMulti.exec();
        currentCount += 1;
      } catch (err: any) {
        if (err instanceof HttpException) throw err;
        this.logger.warn(`Redis sliding window query failed: ${err.message}. Falling back to memory window.`);
        currentCount = this.checkInMemory(clientKey, now, windowMs, limit, windowSec, response);
      }
    } else {
      currentCount = this.checkInMemory(clientKey, now, windowMs, limit, windowSec, response);
    }

    // Set rate limit headers
    if (response && typeof response.setHeader === 'function') {
      response.setHeader('X-RateLimit-Limit', limit.toString());
      response.setHeader('X-RateLimit-Remaining', Math.max(0, limit - currentCount).toString());
      response.setHeader('X-RateLimit-Reset', Math.ceil((now + windowMs) / 1000).toString());
    }

    return true;
  }

  private checkInMemory(
    key: string,
    now: number,
    windowMs: number,
    limit: number,
    windowSec: number,
    response: any,
  ): number {
    const windowStart = now - windowMs;
    const history = inMemoryCache.get(key) || [];
    const activeTimestamps = history.filter((t) => t > windowStart);

    if (activeTimestamps.length >= limit) {
      const earliest = activeTimestamps[0] || now;
      const retryAfterSec = Math.max(1, Math.ceil((earliest + windowMs - now) / 1000));
      this.triggerRateLimitException(response, limit, windowSec, retryAfterSec);
    }

    activeTimestamps.push(now);
    inMemoryCache.set(key, activeTimestamps);

    // Garbage collect memory cache periodically
    if (inMemoryCache.size > 2000) {
      for (const [k, timestamps] of inMemoryCache.entries()) {
        const valid = timestamps.filter((t) => t > windowStart);
        if (valid.length === 0) {
          inMemoryCache.delete(k);
        } else {
          inMemoryCache.set(k, valid);
        }
      }
    }

    return activeTimestamps.length;
  }

  private triggerRateLimitException(response: any, limit: number, windowSec: number, retryAfterSec: number) {
    if (response && typeof response.setHeader === 'function') {
      response.setHeader('Retry-After', retryAfterSec.toString());
    }

    throw new HttpException(
      {
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        error: 'Too Many Requests',
        message: `Kiosk rate limit exceeded: maximum ${limit} check-ins per ${windowSec} seconds allowed. Please wait ${retryAfterSec}s.`,
        retryAfter: retryAfterSec,
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  /**
   * Helper to clear in-memory state during unit tests
   */
  static clearMemoryCache() {
    inMemoryCache.clear();
  }
}

