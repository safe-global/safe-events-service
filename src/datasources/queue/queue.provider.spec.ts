import { hostname } from 'node:os';
import { setTimeout as sleep } from 'node:timers/promises';
import { Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import amqp from 'amqp-connection-manager';
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
    it('getConnectionName should use the service name and hostname', () => {
      expect(queueProvider.getConnectionName()).toEqual(
        `safe-events-service@${hostname()}`,
      );
    });
  });

  describe('connection', () => {
    it('should connect', async () => {
      const { connection, channel } = await queueProvider.getConnection();
      expect(connection).toBeDefined();
      expect(channel).toBeDefined();
    });

    it('should set the connection name in the client properties', async () => {
      const connectSpy = jest.spyOn(amqp, 'connect');
      await queueProvider.disconnect();

      await queueProvider.getConnection();

      expect(connectSpy).toHaveBeenCalledWith(queueProvider.getAmqpUrl(), {
        connectionOptions: {
          clientProperties: {
            connection_name: `safe-events-service@${hostname()}`,
          },
        },
      });
      connectSpy.mockRestore();
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

  describe('shutdown', () => {
    let closeSpy: jest.SpyInstance;
    let warnSpy: jest.SpyInstance;

    beforeEach(async () => {
      const { connection, channel } = await queueProvider.getConnection();
      // A message left by a previous test would reach the handler under test
      await channel.waitForConnect();
      await channel.purgeQueue(queueProvider.getQueueName());
      closeSpy = jest.spyOn(connection, 'close');
      warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    /**
     * Subscribes a handler that blocks until `finish` is called, publishes one
     * message and resolves once the handler is processing it
     */
    const processBlockingMessage = async () => {
      let finish = () => {};
      const started = new Promise<void>((resolveStarted) => {
        void queueProvider.subscribeToEvents(() => {
          resolveStarted();
          return new Promise<void>((resolve) => {
            finish = resolve;
          });
        });
      });
      const { channel } = await queueProvider.getConnection();
      await channel.publish(queueProvider.getExchangeName(), '', {
        type: 'SHUTDOWN_TEST',
      });
      await started;
      return { finish };
    };

    it('should cancel the consumer, close the connection and not connect again', async () => {
      await queueProvider.subscribeToEvents(async () => {});
      const { channel } = await queueProvider.getConnection();
      const cancelAllSpy = jest.spyOn(channel, 'cancelAll');

      await queueProvider.beforeApplicationShutdown();

      expect(cancelAllSpy).toHaveBeenCalled();
      expect(closeSpy).toHaveBeenCalled();
      expect(queueProvider['connection']).toBeUndefined();
      await expect(queueProvider.getConnection()).rejects.toThrow(
        'Queue provider is shutting down',
      );
    });

    it('should ack the messages being processed before closing', async () => {
      const { channel } = await queueProvider.getConnection();
      const ackSpy = jest.spyOn(channel, 'ack');
      const { finish } = await processBlockingMessage();

      const shutdown = queueProvider.beforeApplicationShutdown();
      await sleep(100);
      expect(ackSpy).not.toHaveBeenCalled();
      expect(closeSpy).not.toHaveBeenCalled();

      finish();
      await shutdown;

      expect(ackSpy).toHaveBeenCalledTimes(1);
      expect(closeSpy).toHaveBeenCalled();
    });

    it('should close the connection when processing takes longer than the timeout', async () => {
      jest.spyOn(queueProvider, 'getShutdownTimeout').mockReturnValue(100);
      const { finish } = await processBlockingMessage();

      try {
        await queueProvider.beforeApplicationShutdown();

        expect(warnSpy).toHaveBeenCalledWith(
          'Timeout waiting for in-flight messages, unacked messages will be requeued',
        );
        expect(closeSpy).toHaveBeenCalled();
      } finally {
        finish();
      }
    });

    it('should not wait for a broker that does not answer', async () => {
      jest.useFakeTimers();
      try {
        jest
          .spyOn(queueProvider, 'disconnect')
          .mockReturnValueOnce(new Promise<void>(() => {}));

        const shutdown = queueProvider.beforeApplicationShutdown();
        await jest.advanceTimersByTimeAsync(5_000);
        await shutdown;

        expect(warnSpy).toHaveBeenCalledWith(
          'Timeout closing the AMQP connection',
        );
      } finally {
        jest.useRealTimers();
      }
    });
  });
});
