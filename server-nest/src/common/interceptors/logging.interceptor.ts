import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request } from 'express';

/**
 * LoggingInterceptor — logs every incoming request and its response time.
 *
 * Output format:
 *   [LoggingInterceptor] GET /api/employees — 42ms
 *
 * Applied globally in main.ts so you get visibility on every route
 * without adding console.log to individual controllers.
 *
 * Why this matters in interviews:
 * "We have a global logging interceptor that traces every HTTP request
 *  with method, path, and duration — zero boilerplate per controller."
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request>();
    const { method, url } = req;
    const start = Date.now();

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - start;
        this.logger.log(`${method} ${url} — ${duration}ms`);
      }),
    );
  }
}
