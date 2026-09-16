import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * HttpExceptionFilter — global error handler.
 *
 * Catches EVERY thrown exception (HttpException or unexpected errors) and
 * formats them into a consistent error envelope:
 *
 *   {
 *     status: 'error',
 *     statusCode: 404,
 *     message: 'Employee not found',
 *     path: '/api/employees/abc123',
 *     timestamp: '2026-08-28T...'
 *   }
 *
 * Without this, NestJS returns different shapes for different error types.
 * With this, the frontend always knows exactly what to expect on failure.
 *
 * @Catch() with no argument = catches everything, including non-HTTP errors
 * (e.g. a MongoDB connection timeout becomes a clean 500 response).
 *
 * Why this matters in interviews:
 * "We have a global exception filter that normalises all errors — both
 *  expected HttpExceptions and unexpected runtime errors — into one shape.
 *  The frontend never receives raw stack traces."
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      // NestJS validation errors come as { message: string[] }
      message =
        typeof exceptionResponse === 'string'
          ? exceptionResponse
          : (exceptionResponse as { message: string | string[] }).message
              instanceof Array
          ? (exceptionResponse as { message: string[] }).message.join(', ')
          : (exceptionResponse as { message: string }).message;
    } else if (exception instanceof Error) {
      message = exception.message;
      this.logger.error(exception.message, exception.stack);
    }

    response.status(statusCode).json({
      status: 'error',
      statusCode,
      message,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}
