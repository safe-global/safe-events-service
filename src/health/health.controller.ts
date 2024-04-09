import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  HealthCheckService,
  HealthCheck,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';
import { QueueHealthIndicator } from '../datasources/queue/queue.health';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly configService: ConfigService,
    private readonly health: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
    private readonly queue: QueueHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () =>
        this.db.pingCheck('database', {
          timeout: this.configService.get('DB_HEALTH_CHECK_TIMEOUT', 5000),
        }),
      () => this.queue.isHealthy('queue'),
    ]);
  }
}
