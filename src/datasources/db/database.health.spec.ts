import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  HealthIndicatorService,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';
import { DatabaseHealthIndicator } from './database.health';

describe('DatabaseHealthIndicator', () => {
  const withTimeout = jest.fn();
  const typeOrmHealthIndicator = {
    pingCheck: jest.fn(() => ({ withTimeout })),
  } as unknown as TypeOrmHealthIndicator;
  const configService = {
    get: jest.fn(() => '1500'),
  } as unknown as ConfigService;
  const databaseHealthIndicator = new DatabaseHealthIndicator(
    configService,
    typeOrmHealthIndicator,
    new HealthIndicatorService(),
  );

  let loggerError: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    loggerError = jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  it('should return the ping result when the database is up', async () => {
    /** The up result is returned as is, with the configured timeout. */
    const databaseUp = { database: { status: 'up', responseTime: 1 } };
    withTimeout.mockResolvedValue(databaseUp);

    await expect(
      databaseHealthIndicator.isHealthy('database'),
    ).resolves.toStrictEqual(databaseUp);
    expect(typeOrmHealthIndicator.pingCheck).toHaveBeenCalledWith('database');
    expect(withTimeout).toHaveBeenCalledWith(1500);
    expect(loggerError).not.toHaveBeenCalled();
  });

  it('should log the ping error and not return it', async () => {
    /** The driver message can hold hosts and ports, so it is only logged. */
    const message = 'connect ECONNREFUSED 10.0.0.1:5432';
    withTimeout.mockResolvedValue({
      database: { status: 'down', message, responseTime: 1 },
    });

    await expect(
      databaseHealthIndicator.isHealthy('database'),
    ).resolves.toStrictEqual({ database: { status: 'down' } });
    expect(loggerError).toHaveBeenCalledWith(
      `Cannot reach the database: ${message}`,
    );
  });
});
