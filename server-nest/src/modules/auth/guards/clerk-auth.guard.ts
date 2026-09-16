import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { verifyToken } from '@clerk/backend';
import { Request } from 'express';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * ClerkAuthGuard — JWT verification on every protected route.
 *
 * Uses Clerk's standalone verifyToken() directly — no createClerkClient()
 * call needed, which was previously instantiating a throwaway Clerk client
 * object on every authenticated request (memory waste, extra object allocation).
 *
 * Flow:
 *  1. @Public() route → skip, return true immediately.
 *  2. Extract Bearer token from Authorization header.
 *  3. verifyToken() — Clerk verifies signature, expiry, JWKS.
 *  4. Attach normalized payload to req.auth for downstream use.
 */
@Injectable()
export class ClerkAuthGuard implements CanActivate {
  private readonly logger = new Logger(ClerkAuthGuard.name);

  constructor(
    private readonly config: ConfigService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Step 1 — check @Public() metadata
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    // Step 2 — extract token
    const request = context
      .switchToHttp()
      .getRequest<Request & { auth?: Record<string, unknown> }>();

    const authHeader = request.headers['authorization'];
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException(
        'Missing or malformed Authorization header. Expected: Bearer <token>',
      );
    }
    const token = authHeader.split(' ')[1];

    // Step 3 — verify with Clerk (no throwaway client object)
    const secretKey = this.config.get<string>('clerk.secretKey');
    if (!secretKey) {
      this.logger.error('CLERK_SECRET_KEY is not configured');
      throw new UnauthorizedException('Authentication service not configured');
    }

    const payload = await verifyToken(token, { secretKey }).catch(() => {
      throw new UnauthorizedException('Invalid or expired token');
    });

    // Step 4 — normalize field names and attach to request
    request.auth = {
      userId:  payload.sub,
      orgId:   (payload as Record<string, unknown>)['org_id']   as string ?? '',
      orgRole: (payload as Record<string, unknown>)['org_role'] as string ?? '',
      email:   (payload as Record<string, unknown>)['email']    as string ?? '',
      raw:     payload,
    };

    return true;
  }
}
