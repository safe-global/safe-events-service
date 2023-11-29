import { Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IAmqpConnectionManager } from 'amqp-connection-manager/dist/esm/AmqpConnectionManager';
import { Channel, ConsumeMessage } from 'amqplib';
import amqp, { ChannelWrapper } from 'amqp-connection-manager';

@Injectable()
export class QueueProvider implements OnApplicationShutdown {
  private readonly logger = new Logger(QueueProvider.name);
  private connection: IAmqpConnectionManager | undefined;
  private channelWrapper: ChannelWrapper | undefined;

  constructor(private readonly configService: ConfigService) {}

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onApplicationShutdown(signal?: string) {
    // Not enabled by default
    // https://docs.nestjs.com/fundamentals/lifecycle-events#application-shutdown
    return this.disconnect();
  }

  getAmqpUrl(): string {
    return this.configService.getOrThrow('AMQP_URL');
  }

  getQueueName(): string {
    return this.configService.get('AMQP_QUEUE') ?? 'safe-events-service';
  }

  getExchangeName(): string {
    return (
      this.configService.get('AMQP_EXCHANGE') ??
      'safe-transaction-service-events'
    );
  }

  /**
   *
   * @returns Number of messages to prefetch, no longer than AMQP_PREFETCH_MESSAGES can be attended
   *          at the same time
   */
  getPrefetchMessages(): number {
    return this.configService.get('AMQP_PREFETCH_MESSAGES') ?? 10;
  }

  async getConnection() {
    if (
      !this.connection ||
      !this.connection.isConnected() ||
      !this.channelWrapper
    ) {
      return this.connect();
    }

    return {
      connection: this.connection,
      channel: this.channelWrapper,
    };
  }

  async connect() {
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
    return {
      connection: this.connection,
      channel: this.channelWrapper,
    };
  }

  async disconnect(): Promise<void> {
    this.channelWrapper && (await this.channelWrapper.close());
    this.connection && (await this.connection.close());

    this.channelWrapper = undefined;
    this.connection = undefined;
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
        (message: ConsumeMessage) => {
          if (message.content) func(message.content.toString());
        },
        {
          noAck: true,
        },
      );
      this.logger.debug(
        `Subscribed to RabbitMQ exchange ${this.getExchangeName()} and queue ${this.getQueueName()}`,
      );
      return consumer.consumerTag;
    }
  }
}
