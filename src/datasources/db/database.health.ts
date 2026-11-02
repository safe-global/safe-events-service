import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  HealthIndicatorResult,
  HealthIndicatorService,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';
import { parseNumberConfig } from '../../common/utils/parse-number-config';

@Injectable()
export class DatabaseHealthIndicator {
  private readonly logger = new Logger(DatabaseHealthIndicator.name);
  private readonly timeoutMs: number;

  constructor(
    configService: ConfigService,
    private readonly typeOrmHealthIndicator: TypeOrmHealthIndicator,
    private readonly healthIndicatorService: HealthIndicatorService,
  ) {
    this.timeoutMs = parseNumberConfig(
      'DB_HEALTH_CHECK_TIMEOUT',
      configService.get('DB_HEALTH_CHECK_TIMEOUT'),
      5_000,
      1,
    );
  }

  // The ping error comes from the driver and can hold connection details, so
  // it stays in the logs and is not returned in the response
  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const result = await this.typeOrmHealthIndicator
      .pingCheck(key)
      .withTimeout(this.timeoutMs);
    if (result[key].status === 'up') {
      return result;
    }
    this.logger.error(`Cannot reach the database: ${result[key].message}`);
    return this.healthIndicatorService.check(key).down();
  }
}
