import { Module } from '@nestjs/common';
import { PlatformModule } from '../platform/platform.module';
import { InscriptionController } from './inscription.controller';
import { InscriptionService } from './inscription.service';

@Module({
  imports: [PlatformModule],
  controllers: [InscriptionController],
  providers: [InscriptionService],
})
export class InscriptionModule {}
