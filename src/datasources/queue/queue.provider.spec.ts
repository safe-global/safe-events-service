import { Test } from '@nestjs/testing';
import {
  connect as amqplibConnect,
  ChannelModel,
  ConfirmChannel,
} from 'amqplib';
import { QueueProvider } from './queue.provider';
import { ConfigModule } from '@nestjs/config';
import { QueueModule } from './queue.module';

describe('QueueProvider', () => {
  let queueProvider: QueueProvider;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      imports: [QueueModule, ConfigModule.forRoot()],
    }).compile();

    queueProvider = module.get<QueueProvider>(QueueProvider);
  });

  afterEach(async () => {
    await queueProvider.disconnect();
    jest.restoreAllMocks();
  });

  describe('get configuration', () => {
    it('getAmqpUrl should return a value', () => {
      expect(queueProvider.getAmqpUrl()).toBeDefined();
    });
    it('getQueueName should return a value', () => {
      expect(queueProvider.getQueueName()).toBeDefined();
    });
    it('getExchangeName should return a value', async () => {
      expect(queueProvider.getExchangeName()).toBeDefined();
    });
    it('getExchangeName should default to the topic exchange', () => {
      const configService = queueProvider['configService'];
      jest
        .spyOn(configService, 'get')
        .mockImplementation((_key: string, defaultValue: unknown) => {
          return defaultValue;
        });
      expect(queueProvider.getExchangeName()).toBe(
        'safe-transaction-service-events-with-topics',
      );
    });
  });

  describe('connection', () => {
    it('should connect', async () => {
      const { connection, channel } = await queueProvider.getConnection();
      expect(connection).toBeDefined();
      expect(channel).toBeDefined();
    });

    it('should reuse the connection manager while it is disconnected', async () => {
      const { connection, channel } = await queueProvider.getConnection();
      jest.spyOn(connection, 'isConnected').mockReturnValue(false);
      const closeSpy = jest.spyOn(connection, 'close');

      const { connection: reusedConnection, channel: reusedChannel } =
        await queueProvider.getConnection();

      expect(reusedConnection).toBe(connection);
      expect(reusedChannel).toBe(channel);
      expect(closeSpy).not.toHaveBeenCalled();
    });

    it('should create a single manager for concurrent first callers', async () => {
      await queueProvider.disconnect();

      const [first, second] = await Promise.all([
        queueProvider.getConnection(),
        queueProvider.getConnection(),
      ]);

      expect(first.connection).toBe(second.connection);
      expect(first.channel).toBe(second.channel);
    });

    it('should drop the connection manager when closing it fails', async () => {
      const { connection } = await queueProvider.getConnection();
      const closeSpy = jest
        .spyOn(connection, 'close')
        .mockRejectedValueOnce(new Error('Connection closed'));

      await expect(queueProvider.disconnect()).rejects.toThrow(
        'Connection closed',
      );

      const { connection: newConnection } = await queueProvider.getConnection();
      expect(newConnection).not.toBe(connection);

      closeSpy.mockRestore();
      await connection.close();
    });

    it('should close a manager created by a concurrent connection attempt', async () => {
      await queueProvider.disconnect();

      await Promise.all([
        queueProvider.getConnection(),
        queueProvider.disconnect(),
      ]);

      expect(queueProvider['connection']).toBeUndefined();
      expect(queueProvider['channelWrapper']).toBeUndefined();
    });
  });
  describe('bindings', () => {
    // Own queue and exchange, so the tests do not touch the ones of a running
    // service on the same broker
    const queue = `safe-events-service-test-${process.pid}`;
    const exchange = `safe-events-service-test-topic-${process.pid}`;
    let adminConnection: ChannelModel;
    let adminChannel: ConfirmChannel;

    /**
     * @returns routing key of the message, `undefined` if it was not routed to
     *          the queue
     */
    async function publishAndGet(
      routingKey: string,
    ): Promise<string | undefined> {
      adminChannel.publish(exchange, routingKey, Buffer.from('{}'));
      // The broker confirms a transient message once it is routed
      await adminChannel.waitForConfirms();
      const received = await adminChannel.get(queue, { noAck: true });
      return received ? received.fields.routingKey : undefined;
    }

    beforeEach(async () => {
      adminConnection = await amqplibConnect(queueProvider.getAmqpUrl());
      adminChannel = await adminConnection.createConfirmChannel();
      await adminChannel.deleteQueue(queue);
      jest.spyOn(queueProvider, 'getQueueName').mockReturnValue(queue);
      jest.spyOn(queueProvider, 'getExchangeName').mockReturnValue(exchange);
    });

    afterEach(async () => {
      await adminChannel.deleteQueue(queue);
      await adminChannel.deleteExchange(exchange);
      await adminConnection.close();
    });

    it('should declare a topic exchange and bind the queue with #', async () => {
      const { channel } = await queueProvider.getConnection();
      await channel.waitForConnect();

      // Throws if the exchange was declared with another type
      await adminChannel.assertExchange(exchange, 'topic', { durable: true });
      expect(await publishAndGet('1.SAFE_CREATED.0x1')).toBe(
        '1.SAFE_CREATED.0x1',
      );
      expect(await publishAndGet('any.other.key')).toBe('any.other.key');
    });
  });

  describe('events', () => {
    it('should subscribe to events', async () => {
      const func = async (arg: string) => arg;
      const result = await queueProvider.subscribeToEvents(func);
      expect(typeof result).toEqual('string');
      expect(result.length).toBeGreaterThanOrEqual(1);
    });
  });
});
