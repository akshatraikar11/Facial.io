import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

/**
 * @CurrentUser() — custom parameter decorator.
 *
 * Usage in a controller:
 *   @Get('me')
 *   getProfile(@CurrentUser() user: ClerkUser) { ... }
 *
 * Extracts the full authenticated user object from req.auth
 * (set by ClerkAuthGuard after JWT verification).
 *
 * Optional field selector:
 *   @CurrentUser('userId') userId: string
 *   — extracts just one field from the user object.
 */
export const CurrentUser = createParamDecorator(
  (field: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<Request & { auth?: Record<string, unknown> }>();
    const auth = request.auth;
    return field ? auth?.[field] : auth;
  },
);
