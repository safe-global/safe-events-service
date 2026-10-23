import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  HealthCheckService,
  HealthCheck,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';
import { QueueHealthIndicator } from '../../datasources/queue/queue.health';
import { ApiTags, ApiOkResponse } from '@nestjs/swagger';
import { Health, HealthStatus } from './health.entities';
import { EnvironmentVariables } from '../../config/environment';

@Controller('health')
@ApiTags('health')
export class HealthController {
  constructor(
    private readonly configService: ConfigService<EnvironmentVariables, true>,
    private readonly health: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
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
      () =>
        this.db.pingCheck('database', {
          timeout: this.configService.get('DB_HEALTH_CHECK_TIMEOUT', {
            infer: true,
          }),
        }),
      () => this.queue.isHealthy('queue'),
    ]);
  }
}
