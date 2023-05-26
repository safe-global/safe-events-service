import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import amqp, { ChannelWrapper } from 'amqp-connection-manager';
import { IAmqpConnectionManager } from 'amqp-connection-manager/dist/esm/AmqpConnectionManager';
import { Channel, ConsumeMessage } from 'amqplib';
import { EXCHANGE, QUEUE } from './events.constants';
import { WebhookService } from '../webhook/webhook.service';

@Injectable()
export class EventsService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger('EventsService');
  private connection: IAmqpConnectionManager;
  private channelWrapper: ChannelWrapper;

  constructor(private readonly webhookService: WebhookService) {}

  onApplicationBootstrap() {
    return this.subscribeToEvents();
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onApplicationShutdown(signal?: string) {
    // Not enabled by default
    // https://docs.nestjs.com/fundamentals/lifecycle-events#application-shutdown
    return this.disconnect();
  }

  async connect() {
    this.logger.debug('Connecting to RabbitMQ');
    // Connection will be succesful even if RabbitMQ is down, connection will be retried until it's up
    this.connection = amqp.connect('amqp://localhost:5672');
    this.channelWrapper = this.connection.createChannel({
      json: true,
      setup: async (channel: Channel) => {
        channel.assertExchange(EXCHANGE, 'fanout', {
          durable: true,
        });

        channel.assertQueue(QUEUE, {
          durable: true,
        });

        return channel.bindQueue(QUEUE, EXCHANGE, '');
      },
    });
  }

  public disconnect(): void {
    this.channelWrapper && this.channelWrapper.close();
    this.connection && this.connection.close();
    // TODO Empty variables
    // this.channelWrapper = undefined;
    // this.connection = undefined;
  }

  async getConnection() {
    if (!this.connection || !this.connection.isConnected()) {
      await this.connect();
    }

    return {
      connection: this.connection,
      channel: this.channelWrapper,
    };
  }

  async subscribeToEvents(): Promise<string> {
    /*
    Return consumerTag
    */

    this.logger.debug(
      `Subscribing to RabbitMQ exchange ${EXCHANGE} and queue ${QUEUE}`,
    );
    const { channel } = await this.getConnection();
    const consumer = await channel.consume(
      QUEUE,
      (message: ConsumeMessage) => {
        if (message.content) this.processEvent(message.content.toString());
      },
      {
        noAck: true,
      },
    );
    return consumer.consumerTag;
  }

  async unSubscribeToAllQueues() {
    this.logger.debug('Unsubscribing to every RabbitMQ queue');
    const { channel } = await this.getConnection();
    return channel.cancelAll();
  }

  async processEvent(message: string): Promise<Response[]> {
    const parsedMessage: object = JSON.parse(message);
    return this.webhookService.postEveryWebhook(parsedMessage);
  }
}
