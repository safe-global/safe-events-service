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
import { parseNumberConfig } from '../../common/utils/parse-number-config';

@Controller('health')
@ApiTags('health')
export class HealthController {
  private readonly dbTimeoutMs: number;

  constructor(
    configService: ConfigService,
    private readonly health: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
    private readonly queue: QueueHealthIndicator,
  ) {
    this.dbTimeoutMs = parseNumberConfig(
      'DB_HEALTH_CHECK_TIMEOUT',
      configService.get('DB_HEALTH_CHECK_TIMEOUT'),
      5_000,
      1,
    );
  }

  @Get('live')
  @ApiOkResponse({ type: Health })
  liveness(): Health {
    return new Health(HealthStatus.OK);
  }

  @Get('ready')
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.db.pingCheck('database').withTimeout(this.dbTimeoutMs),
      () => this.queue.isHealthy('queue'),
    ]);
  }
}
