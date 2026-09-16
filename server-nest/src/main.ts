import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import * as Sentry from '@sentry/nestjs';
import { nodeProfilingIntegration } from '@sentry/profiling-node';
import { AppModule } from './app.module.js';
import { HttpExceptionFilter } from './common/filters/http-exception.filter.js';
import { TransformInterceptor } from './common/interceptors/transform.interceptor.js';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor.js';
import { globalValidationPipe } from './common/pipes/validation.pipe.js';

/**
 * bootstrap() — application entry point.
 *
 * This is where NestJS creates the application instance and applies
 * all global-level configuration before the server starts listening.
 *
 * Execution order matters here:
 *  1. Sentry initialized (must be first to catch all errors)
 *  2. App is created
 *  3. CORS is configured (must be before any middleware)
 *  4. Global pipes applied (validation runs first on every request)
 *  5. Global filters applied (catches errors after pipes/guards/interceptors)
 *  6. Global interceptors applied (transform wraps responses last)
 *  7. Swagger docs are set up (dev only)
 *  8. Server starts listening
 *
 * Why global vs module-level:
 *   Global = applies to every single route automatically.
 *   Module-level = only applies to routes in that module.
 *   The pipe, filter, and interceptors here are infrastructure concerns
 *   that should apply everywhere — so they go global.
 */
async function bootstrap() {
  // ── Sentry Initialization ─────────────────────────────────────────────────
  // Initialize Sentry FIRST before creating the app so it can catch all errors.
  // Only enable in production — dev errors are better in console.
  const sentryDsn = process.env['SENTRY_DSN'];
  if (sentryDsn && process.env['NODE_ENV'] === 'production') {
    Sentry.init({
      dsn: sentryDsn,
      environment: process.env['NODE_ENV'] ?? 'development',
      tracesSampleRate: 0.1, // 10% of requests tracked for performance monitoring
      profilesSampleRate: 0.1, // 10% profiled for performance insights
      integrations: [nodeProfilingIntegration()],
    });
    console.log('🔍 Sentry monitoring enabled');
  }

  const app = await NestFactory.create(AppModule, {
    // rawBody: true — required for Clerk and Stripe webhook signature verification.
    // svix (Clerk) and Stripe both need the raw request buffer to verify HMAC signatures.
    // Once the body is JSON-parsed, the original bytes are gone and verification fails.
    rawBody: true,
  });

  const config = app.get(ConfigService);
  const port = config.get<number>('app.port') ?? 3001;
  const clientUrl = config.get<string>('app.clientUrl') ?? 'http://localhost:5173';
  const nodeEnv = config.get<string>('app.nodeEnv') ?? 'development';

  // ── CORS ─────────────────────────────────────────────────────────────────
  // Allow the React frontend (and localhost variants) to call this API.
  // credentials: true is required for Clerk session cookies.
  app.enableCors({
    origin: [
      clientUrl,
      'http://localhost:5173',
      'http://localhost:3000',
      'http://127.0.0.1:5173',
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // ── Global API prefix ─────────────────────────────────────────────────────
  // All routes are prefixed with /api — e.g. GET /api/employees
  app.setGlobalPrefix('api');

  // ── Global Validation Pipe ────────────────────────────────────────────────
  // Runs class-validator on every incoming request body.
  // whitelist strips unknown fields; forbidNonWhitelisted rejects them.
  app.useGlobalPipes(globalValidationPipe);

  // ── Global Exception Filter ───────────────────────────────────────────────
  // Catches all errors and formats them into { status, statusCode, message }.
  app.useGlobalFilters(new HttpExceptionFilter());

  // ── Global Interceptors ───────────────────────────────────────────────────
  // Order matters: logging runs first (sees raw response), then transform wraps it.
  app.useGlobalInterceptors(
    new LoggingInterceptor(),
    new TransformInterceptor(),
  );

  // ── Swagger (OpenAPI docs) ────────────────────────────────────────────────
  // Auto-generates interactive API documentation at /api/docs.
  // Only enabled in development — no docs exposed in production.
  if (nodeEnv !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Facial.io API')
      .setDescription(
        'Multi-tenant face recognition attendance SaaS — REST API documentation',
      )
      .setVersion('1.0')
      .addBearerAuth(
        { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        'clerk-jwt', // This name is referenced in @ApiBearerAuth('clerk-jwt') decorators
      )
      .addTag('auth', 'Authentication and session management')
      .addTag('organizations', 'Organization management')
      .addTag('employees', 'Employee CRUD and face enrollment')
      .addTag('attendance', 'Check-in logging and history')
      .addTag('face-recognition', 'Server-side face matching via Pinecone')
      .addTag('billing', 'Stripe subscription management')
      .addTag('ai', 'RAG-powered attendance analytics assistant')
      .addTag('notifications', 'Email alerts and absence summaries')
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true, // keeps the JWT token between page refreshes
      },
    });

    console.log(`📖 Swagger docs: http://localhost:${port}/api/docs`);
  }

  // ── Health check ──────────────────────────────────────────────────────────
  // Used by K8s liveness + readiness probes in server-deployment.yaml.
  // Must return 200 for the pod to receive traffic.
  app.getHttpAdapter().get('/api/health', (_req: unknown, res: any) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  await app.listen(port);

  console.log(`🚀 Server running on http://localhost:${port}`);
  console.log(`🌐 Environment: ${nodeEnv}`);
  console.log(`🔗 CORS enabled for: ${clientUrl}`);
  console.log(`💾 Database: MongoDB`);
}

bootstrap();
