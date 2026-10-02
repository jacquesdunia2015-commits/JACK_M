import { Module } from '@nestjs/common';
import { PlatformModule } from '../platform/platform.module';
import { TenantModule } from '../tenant/tenant.module';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';

@Module({
  imports: [PlatformModule, TenantModule],
  controllers: [JobsController],
  providers: [JobsService],
  exports: [JobsService],
})
export class JobsModule {}
