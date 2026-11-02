import { Injectable, Logger } from '@nestjs/common';
import {
  HealthIndicatorResult,
  HealthIndicatorService,
} from '@nestjs/terminus';
import { QueueProvider } from './queue.provider';

@Injectable()
export class QueueHealthIndicator {
  private readonly logger = new Logger(QueueHealthIndicator.name);

  constructor(
    private readonly queueProvider: QueueProvider,
    private readonly healthIndicatorService: HealthIndicatorService,
  ) {}

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const indicator = this.healthIndicatorService.check(key);

    // During shutdown the queue is expected to be down while messages are
    // drained, so it is reported as not ready without logging an error.
    // Reaching the provider can fail on its own, e.g. a missing `AMQP_URL`.
    // The reason stays in the logs, the message comes from the libraries and
    // can hold connection details
    if (this.queueProvider.isShuttingDown()) {
      return indicator.down();
    }
    try {
      const { connection } = await this.queueProvider.getConnection();
      return connection.isConnected() ? indicator.up() : indicator.down();
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      this.logger.error(`Cannot reach the queue provider: ${error}`);
      return indicator.down();
    }
  }
}
