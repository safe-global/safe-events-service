import { Injectable, Logger } from '@nestjs/common';
import {
  HealthIndicator,
  HealthIndicatorResult,
  HealthCheckError,
} from '@nestjs/terminus';
import { QueueProvider } from './queue.provider';

@Injectable()
export class QueueHealthIndicator extends HealthIndicator {
  private readonly logger = new Logger(QueueHealthIndicator.name);

  constructor(private readonly queueProvider: QueueProvider) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    let connected = false;
    let error: string | undefined;

    // Reaching the provider can fail on its own, e.g. a missing `AMQP_URL`.
    // Only a `HealthCheckError` is turned into a `503` by Terminus, any other
    // rejection would surface as a `500`.
    try {
      const { connection } = await this.queueProvider.getConnection();
      connected = connection.isConnected();
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
      this.logger.error(`Cannot reach the queue provider: ${error}`);
    }

    const result = this.getStatus(key, connected, error ? { error } : {});

    if (connected) {
      return result;
    }
    throw new HealthCheckError('Queue provider not connected', result);
  }
}
