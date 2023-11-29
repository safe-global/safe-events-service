import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { HealthModule } from './health.module';
import { HealthCheckResult, HealthCheckStatus } from '@nestjs/terminus';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '../datasources/db/database.module';
import { QueueProvider } from '../datasources/queue/queue.provider';

describe('HealthController', () => {
  let controller: HealthController;
  let queueProvider: QueueProvider;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [HealthModule, ConfigModule.forRoot(), DatabaseModule],
    }).compile();

    controller = module.get<HealthController>(HealthController);
    queueProvider = module.get<QueueProvider>(QueueProvider);

    // Wait for queue provider connection to be established, as it could take a little
    const { channel } = await queueProvider.getConnection();
    if (channel !== undefined) await channel.waitForConnect();
  });

  afterEach(async () => {
    await queueProvider.disconnect();
  });

  it('health check should be ok', async () => {
    const healthCheckResult: HealthCheckResult = await controller.check();
    const expected: HealthCheckStatus = 'ok';
    expect(healthCheckResult.status).toBe(expected);
  });
});
