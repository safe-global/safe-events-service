import { Injectable } from '@nestjs/common';
import {
  HealthIndicator,
  HealthIndicatorResult,
  HealthCheckError,
} from '@nestjs/terminus';
import { QueueProvider } from './queue.provider';

@Injectable()
export class QueueHealthIndicator extends HealthIndicator {
  constructor(private queueProvider: QueueProvider) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const { connection } = await this.queueProvider.getConnection();
    const connected = connection.isConnected();
    const result = this.getStatus(key, connected, {});

    if (connected) {
      return result;
    }
    throw new HealthCheckError('Queue provider not connected', result);
  }
}
