import { hostname } from 'node:os';
import { BeforeApplicationShutdown, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Channel, ConsumeMessage } from 'amqplib';
import { parseNumberConfig } from '../../common/utils/parse-number-config';
import amqp, {
  ChannelWrapper,
  AmqpConnectionManager,
} from 'amqp-connection-manager';

const SERVICE_NAME = 'safe-events-service';
// Bounds every broker call during shutdown, as a broker that does not answer
// must not hold the pod until it is killed
const BROKER_SHUTDOWN_TIMEOUT_MS = 5_000;

export type QueueConnection = {
  connection: AmqpConnectionManager;
  channel: ChannelWrapper;
};

@Injectable()
export class QueueProvider implements BeforeApplicationShutdown {
  private readonly logger = new Logger(QueueProvider.name);
  // `AmqpConnectionManager` retries on its own and is never closed by itself, so
  // there must be at most one live manager: any path that builds a new one closes
  // the previous one first, and concurrent callers share a single attempt.
  private connection: AmqpConnectionManager | undefined;
  private channelWrapper: ChannelWrapper | undefined;
  private connecting: Promise<QueueConnection> | undefined;
  private readonly inFlightMessages = new Set<Promise<void>>();
  // Set on shutdown: readiness fails while messages are drained, and a late
  // caller does not open a new connection that nothing would close
  private shuttingDown = false;

  constructor(private readonly configService: ConfigService) {}

  /**
   * Runs before the `onApplicationShutdown` hooks, which close what the message
   * handlers use (webhook agent, database).
   * Unacked messages are requeued by the broker when the channel closes, so a
   * message still in flight after the timeout is delivered again, not lost.
   */
  async beforeApplicationShutdown(): Promise<void> {
    this.shuttingDown = true;
    await this.withTimeout(
      this.stopConsuming(),
      this.getShutdownTimeout(),
      'Timeout waiting for in-flight messages, unacked messages will be requeued',
    );
    await this.withTimeout(
      this.disconnect(),
      BROKER_SHUTDOWN_TIMEOUT_MS,
      'Timeout closing the AMQP connection',
    );
  }

  /**
   *
   * @returns AMQP Url
   */
  getAmqpUrl(): string {
    const value = this.configService.getOrThrow('AMQP_URL');
    this.logger.log({
      message: 'Using AMQP url',
      messageContext: { amqpUrl: value },
    });
    return value;
  }

  /**
   *
   * @returns AMQP connection name shown by the broker (management UI, logs), using
   *          the hostname (the pod name in k8s) to tell instances apart
   */
  getConnectionName(): string {
    return `${SERVICE_NAME}@${hostname()}`;
  }

  /**
   *
   * @returns AMQP Queue Name to consum from, if it doesn't exist it will be created
   */
  getQueueName(): string {
    const value = this.configService.get('AMQP_QUEUE', 'safe-events-service');
    this.logger.log({
      message: 'Using AMQP queue',
      messageContext: { queue: value },
    });
    return value;
  }

  /**
   *
   * @returns AMQP Exchange Name to bind the queue to
   */
  getExchangeName(): string {
    const value = this.configService.get(
      'AMQP_EXCHANGE',
      'safe-transaction-service-events',
    );
    this.logger.log({
      message: 'Using AMQP exchange',
      messageContext: { exchange: value },
    });
    return value;
  }

  /**
   *
   * @returns Number of messages to prefetch, no longer than AMQP_PREFETCH_MESSAGES can be attended
   *          at the same time
   */
  getPrefetchMessages(): number {
    const value = Number(this.configService.get('AMQP_PREFETCH_MESSAGES', 100));
    this.logger.log({
      message: 'Using AMQP prefetch messages',
      messageContext: { prefetchMessages: value },
    });
    return value;
  }

  /**
   * @returns Milliseconds to wait on shutdown for the consumers to be cancelled
   *          and the messages being processed to be acked
   */
  getShutdownTimeout(): number {
    return parseNumberConfig(
      'AMQP_SHUTDOWN_TIMEOUT',
      this.configService.get('AMQP_SHUTDOWN_TIMEOUT'),
      15_000,
      0,
    );
  }

  isShuttingDown(): boolean {
    return this.shuttingDown;
  }

  async getConnection(): Promise<QueueConnection> {
    if (this.shuttingDown) {
      throw new Error('Queue provider is shutting down');
    }
    // A disconnected manager is still reused, it reconnects on its own
    if (!this.connection || !this.channelWrapper) {
      return this.connect();
    }

    return {
      connection: this.connection,
      channel: this.channelWrapper,
    };
  }

  private async connect(): Promise<QueueConnection> {
    this.connecting ??= this.createConnection().finally(() => {
      this.connecting = undefined;
    });
    return this.connecting;
  }

  private async createConnection(): Promise<QueueConnection> {
    // A previous attempt can leave a manager without its channel wrapper
    await this.closeConnection();
    this.logger.debug(
      'Connecting to RabbitMQ and creating exchange/queue if not created',
    );
    // Connection will be succesful even if RabbitMQ is down, connection will be retried until it's up
    this.connection = amqp.connect(this.getAmqpUrl(), {
      connectionOptions: {
        clientProperties: { connection_name: this.getConnectionName() },
      },
    });
    this.channelWrapper = this.connection.createChannel({
      json: true,
      setup: async (channel: Channel) => {
        this.logger.debug({
          message: 'Asserting exchange and queue are created',
          messageContext: {
            exchange: this.getExchangeName(),
            queue: this.getQueueName(),
          },
        });
        await channel.assertExchange(this.getExchangeName(), 'fanout', {
          durable: true,
        });

        await channel.assertQueue(this.getQueueName(), {
          durable: true,
        });

        this.logger.debug({
          message: 'Exchange and queue are created',
          messageContext: {
            exchange: this.getExchangeName(),
            queue: this.getQueueName(),
          },
        });

        await channel.prefetch(this.getPrefetchMessages());

        return channel.bindQueue(
          this.getQueueName(),
          this.getExchangeName(),
          '',
        );
      },
    });

    // `ChannelWrapper` is an `EventEmitter`, an `error` without a listener takes
    // the process down. The wrapper reconnects on its own, so logging is enough
    this.channelWrapper.on('error', (error, { name }) => {
      this.logger.error(`Error on channel ${name}: ${error.message}`);
    });

    return {
      connection: this.connection,
      channel: this.channelWrapper,
    };
  }

  async disconnect(): Promise<void> {
    // An attempt in flight installs its manager after this call, so wait for it.
    // Its rejection belongs to the caller that started it.
    await this.connecting?.catch(() => undefined);
    return this.closeConnection();
  }

  /**
   * Closes the current manager and its channel wrapper, keeping the fields empty
   * even when closing fails. A manager that is still referenced after a failed
   * close is already closed and never reconnects.
   */
  private async closeConnection(): Promise<void> {
    try {
      if (this.channelWrapper) await this.channelWrapper.close();
      if (this.connection) await this.connection.close();
    } finally {
      this.channelWrapper = undefined;
      this.connection = undefined;
    }
  }

  /**
   * Cancels the consumers, so the broker stops delivering, and waits for the
   * messages already delivered to be processed and acked.
   */
  private async stopConsuming(): Promise<void> {
    try {
      await this.channelWrapper?.cancelAll();
    } finally {
      await Promise.all(this.inFlightMessages);
    }
  }

  /**
   * Waits for `promise` at most `timeoutMs`. A timeout or an error is logged and
   * not thrown, so the remaining shutdown steps still run.
   */
  private async withTimeout(
    promise: Promise<void>,
    timeoutMs: number,
    timeoutMessage: string,
  ): Promise<void> {
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<void>((resolve) => {
      timer = setTimeout(() => {
        this.logger.warn(timeoutMessage);
        resolve();
      }, timeoutMs);
    });
    try {
      await Promise.race([promise, timeout]);
    } catch (error) {
      this.logger.error({
        message: 'Error on AMQP shutdown',
        messageContext: {
          error: error instanceof Error ? error.message : String(error),
        },
      });
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * @returns consumerTag for the event
   */
  async subscribeToEvents(
    func: (arg: string) => Promise<any>,
  ): Promise<string> {
    const { channel } = await this.getConnection();
    if (channel === undefined) {
      this.logger.error({
        message: 'Cannot subscribe to RabbitMQ, channel is undefined',
        messageContext: {
          exchange: this.getExchangeName(),
          queue: this.getQueueName(),
        },
      });
      return '';
    } else {
      this.logger.debug({
        message: 'Subscribing to RabbitMQ',
        messageContext: {
          exchange: this.getExchangeName(),
          queue: this.getQueueName(),
        },
      });
      const consumer = await channel.consume(
        this.getQueueName(),
        async (message: ConsumeMessage) => {
          // A message delivered once shutdown started is not waited for, so it
          // is requeued instead of processed
          if (this.shuttingDown) {
            channel.nack(message, false, true);
            return;
          }
          if (message.content) {
            const processing = this.processMessage(channel, message, func);
            this.inFlightMessages.add(processing);
            try {
              await processing;
            } finally {
              this.inFlightMessages.delete(processing);
            }
          }
        },
        {
          noAck: false,
        },
      );
      // Shutdown can start while `consume()` is still registering the consumer
      // (Nest does not wait for bootstrap to finish), so `cancelAll()` missed it
      if (this.shuttingDown) {
        await channel.cancel(consumer.consumerTag);
        return consumer.consumerTag;
      }
      this.logger.debug({
        message: 'Subscribed to RabbitMQ',
        messageContext: {
          exchange: this.getExchangeName(),
          queue: this.getQueueName(),
        },
      });
      return consumer.consumerTag;
    }
  }

  private async processMessage(
    channel: ChannelWrapper,
    message: ConsumeMessage,
    func: (arg: string) => Promise<any>,
  ): Promise<void> {
    try {
      await func(message.content.toString());
    } catch (error) {
      this.logger.error({
        message: 'Error processing message',
        messageContext: {
          error: error instanceof Error ? error.message : String(error),
        },
      });
    } finally {
      channel.ack(message);
    }
  }
}
