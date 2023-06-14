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
