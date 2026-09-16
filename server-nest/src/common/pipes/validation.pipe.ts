import { ValidationPipe } from '@nestjs/common';

/**
 * Global Validation Pipe — configured once, applied to every route.
 *
 * Options explained:
 *   whitelist: true         — strips any properties NOT in the DTO.
 *                             If a client sends extra fields, they're silently removed.
 *                             Prevents mass assignment attacks.
 *
 *   forbidNonWhitelisted: true — goes further: if extra props are sent,
 *                             it throws a 400 instead of silently stripping.
 *                             More explicit — useful for catching client bugs early.
 *
 *   transform: true         — auto-converts incoming JSON strings to the types
 *                             declared in your DTO (e.g. "42" → 42 for @IsNumber()).
 *                             Also transforms plain objects into DTO class instances
 *                             so class-validator decorators work correctly.
 *
 * Without this you'd manually call validate() on every DTO in every controller.
 * With this, just decorate your DTO class and NestJS handles the rest.
 *
 * Why this matters in interviews:
 * "We apply a global ValidationPipe with whitelist and transform enabled.
 *  This means invalid or unexpected input is rejected at the framework level,
 *  before it ever reaches business logic — a secure-by-default approach."
 */
export const globalValidationPipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
});
