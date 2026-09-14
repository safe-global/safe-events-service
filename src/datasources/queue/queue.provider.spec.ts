import { Test } from '@nestjs/testing';
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
  describe('events', () => {
    it('should subscribe to events', async () => {
      const func = async (arg: string) => arg;
      const result = await queueProvider.subscribeToEvents(func);
      expect(typeof result).toEqual('string');
      expect(result.length).toBeGreaterThanOrEqual(1);
    });
  });
});
