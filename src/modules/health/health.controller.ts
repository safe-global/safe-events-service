import { Controller, Get, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  HealthCheckService,
  HealthCheck,
  HealthIndicatorResult,
  HealthIndicatorService,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';
import { QueueHealthIndicator } from '../../datasources/queue/queue.health';
import { ApiTags, ApiOkResponse } from '@nestjs/swagger';
import { Health, HealthStatus } from './health.entities';
import { parseNumberConfig } from '../../common/utils/parse-number-config';

@Controller('health')
@ApiTags('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);
  private readonly dbTimeoutMs: number;

  constructor(
    configService: ConfigService,
    private readonly health: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
    private readonly queue: QueueHealthIndicator,
    private readonly healthIndicatorService: HealthIndicatorService,
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
      () => this.checkDatabase(),
      () => this.queue.isHealthy('queue'),
    ]);
  }

  // The ping error comes from the driver and can hold connection details, so
  // it stays in the logs and is not returned in the response
  private async checkDatabase(): Promise<HealthIndicatorResult> {
    const key = 'database';
    const result = await this.db.pingCheck(key).withTimeout(this.dbTimeoutMs);
    if (result[key].status === 'up') {
      return result;
    }
    this.logger.error(`Cannot reach the database: ${result[key].message}`);
    return this.healthIndicatorService.check(key).down();
  }
}
