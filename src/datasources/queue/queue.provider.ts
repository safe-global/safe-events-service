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
  private connection: AmqpConnectionManager | undefined;
  private channelWrapper: ChannelWrapper | undefined;

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
    this.logger.log({
      message: 'Using AMQP url',
      messageContext: { amqpUrl: value },
    });
    return value;
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

  async getConnection(): Promise<QueueConnection> {
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

  async connect(): Promise<QueueConnection> {
    this.logger.debug(
      'Connecting to RabbitMQ and creating exchange/queue if not created',
    );
    // Connection will be succesful even if RabbitMQ is down, connection will be retried until it's up
    this.connection = amqp.connect(this.getAmqpUrl());
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
    return {
      connection: this.connection,
      channel: this.channelWrapper,
    };
  }

  async disconnect(): Promise<void> {
    if (this.channelWrapper) await this.channelWrapper.close();
    if (this.connection) await this.connection.close();

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
          if (message.content) {
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
        },
        {
          noAck: false,
        },
      );
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
}
