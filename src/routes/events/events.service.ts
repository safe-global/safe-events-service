import { Injectable } from '@nestjs/common';
import amqp, { ChannelWrapper } from 'amqp-connection-manager';
import { IAmqpConnectionManager } from 'amqp-connection-manager/dist/esm/AmqpConnectionManager';
import { Channel, ConsumeMessage } from 'amqplib';
import { EXCHANGE, QUEUE } from './events.constants';

@Injectable()
export class EventsService {
  private connection: IAmqpConnectionManager;
  private channelWrapper: ChannelWrapper;

  // OnApplicationBootstrap() {
  //  this.subscribeToEvents();
  // }

  async connect() {
    console.log('Connecting to RabbitMQ');
    this.connection = amqp.connect('amqp://localhost:5672');
    console.log('Connected to RabbitMQ');
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
    const { channel } = await this.getConnection();
    channel.consume(QUEUE, (message: ConsumeMessage) => {
      if (message.content) {
        console.log(' [x] %s', message.content.toString());
      }
    });
  }
}
