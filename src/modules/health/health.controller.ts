import { Controller, Get } from '@nestjs/common';
import { HealthCheckService, HealthCheck } from '@nestjs/terminus';
import { DatabaseHealthIndicator } from '../../datasources/db/database.health';
import { QueueHealthIndicator } from '../../datasources/queue/queue.health';
import { ApiTags, ApiOkResponse } from '@nestjs/swagger';
import { Health, HealthStatus } from './health.entities';

@Controller('health')
@ApiTags('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: DatabaseHealthIndicator,
    private readonly queue: QueueHealthIndicator,
  ) {}

  @Get('live')
  @ApiOkResponse({ type: Health })
  liveness(): Health {
    return new Health(HealthStatus.OK);
  }

  @Get('ready')
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.db.isHealthy('database'),
      () => this.queue.isHealthy('queue'),
    ]);
  }
}
