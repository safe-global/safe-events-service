import { Logger } from '@nestjs/common';
import { HealthCheckError } from '@nestjs/terminus';
import { QueueHealthIndicator } from './queue.health';
import { QueueProvider } from './queue.provider';

describe('QueueHealthIndicator', () => {
  const getConnection = jest.fn();
  const queueProvider = { getConnection } as unknown as QueueProvider;
  const queueHealthIndicator = new QueueHealthIndicator(queueProvider);

  let loggerError: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    loggerError = jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  it('should be up when the connection is established', async () => {
    getConnection.mockResolvedValue({
      connection: { isConnected: () => true },
    });

    await expect(
      queueHealthIndicator.isHealthy('queue'),
    ).resolves.toStrictEqual({ queue: { status: 'up' } });
  });

  it('should throw a HealthCheckError when the connection is down', async () => {
    getConnection.mockResolvedValue({
      connection: { isConnected: () => false },
    });

    await expect(queueHealthIndicator.isHealthy('queue')).rejects.toThrow(
      HealthCheckError,
    );
  });

  it('should throw a HealthCheckError when the provider cannot be reached', async () => {
    const message = 'Configuration key "AMQP_URL" does not exist';
    getConnection.mockRejectedValue(new Error(message));

    const error = await queueHealthIndicator.isHealthy('queue').catch((e) => e);

    expect(error).toBeInstanceOf(HealthCheckError);
    expect(error.causes).toStrictEqual({ queue: { status: 'down' } });
    expect(loggerError).toHaveBeenCalledWith(
      `Cannot reach the queue provider: ${message}`,
    );
  });
});
