import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { AuditModule } from './common/audit/audit.module';
import { SupportActivityInterceptor } from './common/audit/support-activity.interceptor';
import { AllExceptionsFilter } from './common/http/all-exceptions.filter';
import { AuthGuard } from './common/auth/auth.guard';
import { AuthorizationGuard } from './common/auth/authorization.guard';
import { DatabaseModule } from './common/database/database.module';
import { EntitlementsModule } from './common/entitlements/entitlements.module';
import { NumberingModule } from './common/numbering/numbering.module';
import { AuthModule } from './modules/auth/auth.module';
import { HealthModule } from './modules/health/health.module';
import { PlatformModule } from './modules/platform/platform.module';
import { JobsModule } from './modules/jobs/jobs.module';
import { TenantModule } from './modules/tenant/tenant.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    DatabaseModule,
    AuditModule,
    EntitlementsModule,
    NumberingModule,
    AuthModule,
    HealthModule,
    PlatformModule,
    TenantModule,
    JobsModule,
  ],
  providers: [
    // L'ordre compte : authentifier, puis autoriser.
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: AuthorizationGuard },
    // Trace les consultations faites sous un accès support.
    { provide: APP_INTERCEPTOR, useClass: SupportActivityInterceptor },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
