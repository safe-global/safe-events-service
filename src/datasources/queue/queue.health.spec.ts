import { Logger } from '@nestjs/common';
import { HealthIndicatorService } from '@nestjs/terminus';
import { QueueHealthIndicator } from './queue.health';
import { QueueProvider } from './queue.provider';

describe('QueueHealthIndicator', () => {
  const getConnection = jest.fn();
  const isShuttingDown = jest.fn();
  const queueProvider = {
    getConnection,
    isShuttingDown,
  } as unknown as QueueProvider;
  const queueHealthIndicator = new QueueHealthIndicator(
    queueProvider,
    new HealthIndicatorService(),
  );

  const queueDown = { queue: { status: 'down' } };

  let loggerError: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    isShuttingDown.mockReturnValue(false);
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

  it('should be down when the connection is not established', async () => {
    getConnection.mockResolvedValue({
      connection: { isConnected: () => false },
    });

    await expect(
      queueHealthIndicator.isHealthy('queue'),
    ).resolves.toStrictEqual(queueDown);
  });

  it('should be down when the provider cannot be reached', async () => {
    const message = 'Configuration key "AMQP_URL" does not exist';
    getConnection.mockRejectedValue(new Error(message));

    await expect(
      queueHealthIndicator.isHealthy('queue'),
    ).resolves.toStrictEqual(queueDown);
    expect(loggerError).toHaveBeenCalledWith(
      `Cannot reach the queue provider: ${message}`,
    );
  });

  it('should be down without logging an error when shutting down', async () => {
    isShuttingDown.mockReturnValue(true);

    await expect(
      queueHealthIndicator.isHealthy('queue'),
    ).resolves.toStrictEqual(queueDown);
    expect(getConnection).not.toHaveBeenCalled();
    expect(loggerError).not.toHaveBeenCalled();
  });
});
