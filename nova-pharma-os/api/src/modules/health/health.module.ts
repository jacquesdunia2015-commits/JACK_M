import { Controller, Get, Module } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/auth/decorators';
import { DatabaseService } from '../../common/database/database.service';

@ApiTags('Exploitation')
@Controller('health')
class HealthController {
  constructor(private readonly db: DatabaseService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'État de santé de la plateforme' })
  async check() {
    const startedAt = Date.now();
    let database = 'up';
    try {
      await this.db.getPool().query('SELECT 1');
    } catch {
      database = 'down';
    }
    return {
      status: database === 'up' ? 'ok' : 'degraded',
      service: 'nova-pharma-os-api',
      database,
      latencyMs: Date.now() - startedAt,
      timestamp: new Date().toISOString(),
    };
  }
}

@Module({ controllers: [HealthController] })
export class HealthModule {}
