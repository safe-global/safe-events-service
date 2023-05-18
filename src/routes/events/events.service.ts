import { Injectable, Logger } from '@nestjs/common';
import amqp, { ChannelWrapper } from 'amqp-connection-manager';
import { IAmqpConnectionManager } from 'amqp-connection-manager/dist/esm/AmqpConnectionManager';
import { Channel, ConsumeMessage } from 'amqplib';
import { EXCHANGE, QUEUE } from './events.constants';
import { WebhookService } from '../webhook/webhook.service';
import { Webhook } from '../webhook/entities/webhook.entity';

@Injectable()
export class EventsService {
  private readonly logger = new Logger('EventsService');
  private connection: IAmqpConnectionManager;
  private channelWrapper: ChannelWrapper;

  constructor(private readonly webhookService: WebhookService) {}

  onApplicationBootstrap() {
    this.subscribeToEvents();
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

  async subscribeToEvents() {
    this.logger.debug(`Subscribing to RabbitMQ exchange ${EXCHANGE} and queue ${QUEUE}`);
    const { channel } = await this.getConnection();
    channel.consume(QUEUE, (message: ConsumeMessage) => this.processEvent(message) ,{
      noAck: true,
    });
  }

  async processEvent(message: ConsumeMessage) {
    if (message.content) {
      let originalMessage: string = message.content.toString()
      let parsedMessage: object = JSON.parse(originalMessage)
      this.webhookService.postEveryWebhook(parsedMessage);
    }
  }
}
