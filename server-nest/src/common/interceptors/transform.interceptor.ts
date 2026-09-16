import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/**
 * TransformInterceptor — wraps EVERY successful response in a consistent shape:
 *
 *   { status: 'success', data: <original response body> }
 *
 * You write this once here and never touch it again.
 * Every controller just returns its data directly — the wrapper is automatic.
 *
 * Why this matters in interviews:
 * "We use a global response interceptor so every API endpoint returns
 *  a predictable envelope. Frontend clients can always expect { status, data }."
 */
export interface ApiResponse<T> {
  status: 'success';
  data: T;
}

@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, ApiResponse<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponse<T>> {
    return next.handle().pipe(
      map((data) => ({
        status: 'success' as const,
        data,
      })),
    );
  }
}
