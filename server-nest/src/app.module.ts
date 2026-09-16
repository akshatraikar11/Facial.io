import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import {
  appConfig,
  databaseConfig,
  clerkConfig,
  stripeConfig,
} from './config/index.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { OrganizationsModule } from './modules/organizations/organizations.module.js';
import { EmployeesModule } from './modules/employees/employees.module.js';
import { AttendanceModule } from './modules/attendance/attendance.module.js';
import { FaceRecognitionModule } from './modules/face-recognition/face-recognition.module.js';
import { BillingModule } from './modules/billing/billing.module.js';
import { AiModule } from './modules/ai/ai.module.js';
import { NotificationsModule } from './modules/notifications/notifications.module.js';
import { LocationsModule } from './modules/locations/locations.module.js';
import { ShiftsModule } from './modules/shifts/shifts.module.js';
import { AuditModule } from './modules/audit/audit.module.js';

/**
 * AppModule — the root module of the entire NestJS application.
 *
 * Think of it as the "wiring diagram" for the whole backend.
 * Every feature module will be imported here as we build them in later phases.
 *
 * What each import does:
 *
 * ConfigModule.forRoot()
 *   — Loads environment variables from .env into process.env at startup.
 *   — isGlobal: true means every other module can inject ConfigService
 *     without re-importing ConfigModule themselves.
 *   — load: [...] registers our typed config factories (database, clerk, stripe, app).
 *
 * MongooseModule.forRootAsync()
 *   — Connects to MongoDB using the URI from our databaseConfig.
 *   — forRootAsync (vs forRoot) lets us inject ConfigService so we can
 *     read the URI from environment variables safely.
 *   — This single registration is shared by ALL feature modules.
 *     Each module just adds its own schema via MongooseModule.forFeature([]).
 *
 * ScheduleModule.forRoot()
 *   — Enables NestJS's cron job system.
 *   — Required for the nightly anomaly detection job in Phase 9.
 *   — Zero config needed here — just registering the capability.
 *
 * ThrottlerModule.forRoot()
 *   — Global rate limiting: 10 requests per 60 seconds per IP by default.
 *   — Protects against brute force attacks, DDoS, and abuse.
 *   — Individual routes can override with @Throttle() decorator.
 *   — Automatically applied to all routes via ThrottlerGuard (APP_GUARD).
 */
@Module({
  imports: [
    // ── Configuration ──────────────────────────────────────────────────────
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      load: [appConfig, databaseConfig, clerkConfig, stripeConfig],
    }),

    // ── Database ───────────────────────────────────────────────────────────
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.get<string>('database.uri'),
      }),
    }),

    // ── Scheduler (cron jobs) ──────────────────────────────────────────────
    ScheduleModule.forRoot(),

    // ── Rate Limiting ──────────────────────────────────────────────────────
    // Default: 10 requests per 60 seconds per IP.
    // Face-matching endpoint has custom higher limit (see face-recognition.controller.ts)
    ThrottlerModule.forRoot([
      {
        ttl: 60000,  // 60 seconds
        limit: 10,   // 10 requests per window
      },
    ]),

    // ── Feature modules (added phase by phase) ─────────────────────────────
    // Phase 2: ✅ AuthModule, OrganizationsModule
    AuthModule,
    OrganizationsModule,
    // Phase 3: ✅ EmployeesModule, AttendanceModule
    EmployeesModule,
    AttendanceModule,
    // Phase 4: ✅ FaceRecognitionModule
    FaceRecognitionModule,
    // Phase 6: ✅ BillingModule
    BillingModule,
    // Phase 7+8: ✅ AiModule, NotificationsModule
    AiModule,
    NotificationsModule,
    // Phase 10+: ✅ LocationsModule, ShiftsModule, AuditModule
    LocationsModule,
    ShiftsModule,
    AuditModule,
  ],
  providers: [
    // Apply ThrottlerGuard globally to all routes
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
