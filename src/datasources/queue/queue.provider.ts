import { Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Channel, ConsumeMessage } from 'amqplib';
import amqp, {
  ChannelWrapper,
  AmqpConnectionManager,
} from 'amqp-connection-manager';

export type QueueConnection = {
  connection: AmqpConnectionManager;
  channel: ChannelWrapper;
};

@Injectable()
export class QueueProvider implements OnApplicationShutdown {
  private readonly logger = new Logger(QueueProvider.name);
  // `AmqpConnectionManager` retries on its own and is never closed by itself, so
  // there must be at most one live manager: any path that builds a new one closes
  // the previous one first, and concurrent callers share a single attempt.
  private connection: AmqpConnectionManager | undefined;
  private channelWrapper: ChannelWrapper | undefined;
  private connecting: Promise<QueueConnection> | undefined;

  constructor(private readonly configService: ConfigService) {}

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onApplicationShutdown(signal?: string) {
    // Not enabled by default https://docs.nestjs.com/fundamentals/lifecycle-events#application-shutdown
    return this.disconnect();
  }

  /**
   *
   * @returns AMQP Url
   */
  getAmqpUrl(): string {
    const value = this.configService.getOrThrow('AMQP_URL');
    this.logger.log(`AMQP_URL=${value}`);
    return value;
  }

  /**
   *
   * @returns AMQP Queue Name to consum from, if it doesn't exist it will be created
   */
  getQueueName(): string {
    const value = this.configService.get('AMQP_QUEUE', 'safe-events-service');
    this.logger.log(`AMQP_QUEUE=${value}`);
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
    this.logger.log(`AMQP_EXCHANGE=${value}`);
    return value;
  }

  /**
   *
   * @returns Number of messages to prefetch, no longer than AMQP_PREFETCH_MESSAGES can be attended
   *          at the same time
   */
  getPrefetchMessages(): number {
    const value = Number(this.configService.get('AMQP_PREFETCH_MESSAGES', 100));
    this.logger.log(`AMQP_PREFETCH_MESSAGES=${value}`);
    return value;
  }

  async getConnection(): Promise<QueueConnection> {
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
    this.connection = amqp.connect(this.getAmqpUrl());
    this.channelWrapper = this.connection.createChannel({
      json: true,
      setup: async (channel: Channel) => {
        this.logger.debug(
          `Asserting exchange ${this.getExchangeName()} and queue ${this.getQueueName()} are created`,
        );
        await channel.assertExchange(this.getExchangeName(), 'fanout', {
          durable: true,
        });

        await channel.assertQueue(this.getQueueName(), {
          durable: true,
        });

        this.logger.debug(
          `Exchange ${this.getExchangeName()} and queue ${this.getQueueName()} are created`,
        );

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
   * @returns consumerTag for the event
   */
  async subscribeToEvents(
    func: (arg: string) => Promise<any>,
  ): Promise<string> {
    const { channel } = await this.getConnection();
    if (channel === undefined) {
      this.logger.error(
        `Cannot subscribe to RabbitMQ exchange ${this.getExchangeName()} and queue ${this.getQueueName()}, channel is undefined`,
      );
      return '';
    } else {
      this.logger.debug(
        `Subscribing to RabbitMQ exchange ${this.getExchangeName()} and queue ${this.getQueueName()}`,
      );
      const consumer = await channel.consume(
        this.getQueueName(),
        async (message: ConsumeMessage) => {
          if (message.content) {
            try {
              await func(message.content.toString());
            } catch (error) {
              this.logger.error(`Error processing message: ${error.message}`);
            } finally {
              channel.ack(message);
            }
          }
        },
        {
          noAck: false,
        },
      );
      this.logger.debug(
        `Subscribed to RabbitMQ exchange ${this.getExchangeName()} and queue ${this.getQueueName()}`,
      );
      return consumer.consumerTag;
    }
  }
}
