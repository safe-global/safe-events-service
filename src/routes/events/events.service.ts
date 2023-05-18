import { Injectable, Logger } from '@nestjs/common';
import amqp, { ChannelWrapper } from 'amqp-connection-manager';
import { IAmqpConnectionManager } from 'amqp-connection-manager/dist/esm/AmqpConnectionManager';
import { Channel, ConsumeMessage } from 'amqplib';
import { EXCHANGE, QUEUE } from './events.constants';
import { WebhookService } from '../webhook/webhook.service';

@Injectable()
export class EventsService {
  private readonly logger = new Logger('EventsService');
  private connection: IAmqpConnectionManager;
  private channelWrapper: ChannelWrapper;

  constructor(private readonly webhookService: WebhookService) {}

  onApplicationBootstrap() {
    this.subscribeToEvents();
  }

  beforeApplicationShutdown() {
    this.unSubscribeToAllQueues();
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
      (message: ConsumeMessage) => this.processEvent(message),
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

  async processEvent(message: ConsumeMessage) {
    if (message.content) {
      const originalMessage: string = message.content.toString();
      const parsedMessage: object = JSON.parse(originalMessage);
      this.webhookService.postEveryWebhook(parsedMessage);
    }
  }
}
