import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { HealthModule } from './health.module';
import {
  HealthCheckError,
  HealthCheckResult,
  HealthCheckStatus,
  TerminusModule,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';
import { ConfigModule } from '@nestjs/config';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { DatabaseModule } from '../../datasources/db/database.module';
import { QueueHealthIndicator } from '../../datasources/queue/queue.health';
import { QueueProvider } from '../../datasources/queue/queue.provider';
import { Health, HealthStatus } from './health.entities';

describe('HealthController', () => {
  let controller: HealthController;
  let queueProvider: QueueProvider;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot(), HealthModule, DatabaseModule],
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

  it('liveness check should be ok', async () => {
    const healthResult: Health = await controller.liveness();
    const expected: Health = new Health(HealthStatus.OK);
    expect(healthResult).toStrictEqual(expected);
  });

  it('readiness check should be ok', async () => {
    const healthCheckResult: HealthCheckResult = await controller.check();
    const expected: HealthCheckStatus = 'ok';
    expect(healthCheckResult.status).toBe(expected);
  });
});

describe('Health endpoints', () => {
  let app: INestApplication;

  const mockDb = { pingCheck: jest.fn() };
  const mockQueue = { isHealthy: jest.fn() };

  const databaseUp = { database: { status: 'up' } };
  const databaseDown = { database: { status: 'down' } };
  const queueUp = { queue: { status: 'up' } };
  const queueDown = new HealthCheckError('Queue provider not connected', {
    queue: { status: 'down' },
  });

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot(), TerminusModule],
      controllers: [HealthController],
      providers: [
        { provide: TypeOrmHealthIndicator, useValue: mockDb },
        { provide: QueueHealthIndicator, useValue: mockQueue },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockDb.pingCheck.mockResolvedValue(databaseUp);
    mockQueue.isHealthy.mockResolvedValue(queueUp);
  });

  // Kubernetes probes are configured with a trailing slash, so both forms must
  // answer. Express is not in strict routing mode, so they map to the same route.
  describe.each(['/health/live', '/health/live/'])('GET %s', (url) => {
    it('should return 200', async () => {
      const response = await request(app.getHttpServer()).get(url).expect(200);
      expect(response.body).toStrictEqual(new Health(HealthStatus.OK));
    });

    it('should not check any dependency', async () => {
      await request(app.getHttpServer()).get(url).expect(200);
      expect(mockDb.pingCheck).not.toHaveBeenCalled();
      expect(mockQueue.isHealthy).not.toHaveBeenCalled();
    });

    it('should return 200 when every dependency is down', async () => {
      mockDb.pingCheck.mockResolvedValue(databaseDown);
      mockQueue.isHealthy.mockRejectedValue(queueDown);

      await request(app.getHttpServer()).get(url).expect(200);
    });
  });

  describe.each(['/health/ready', '/health/ready/'])('GET %s', (url) => {
    it('should return 200 when every dependency is up', async () => {
      const response = await request(app.getHttpServer()).get(url).expect(200);

      expect(response.body.status).toBe('ok');
      expect(response.body.details).toStrictEqual({
        ...databaseUp,
        ...queueUp,
      });
      expect(mockDb.pingCheck).toHaveBeenCalledWith('database', {
        timeout: expect.any(Number),
      });
      expect(mockQueue.isHealthy).toHaveBeenCalledWith('queue');
    });

    it('should return 503 when the database is down', async () => {
      mockDb.pingCheck.mockResolvedValue(databaseDown);

      const response = await request(app.getHttpServer()).get(url).expect(503);

      expect(response.body.status).toBe('error');
      expect(response.body.error).toStrictEqual(databaseDown);
    });

    it('should return 503 when the queue is down', async () => {
      mockQueue.isHealthy.mockRejectedValue(queueDown);

      const response = await request(app.getHttpServer()).get(url).expect(503);

      expect(response.body.status).toBe('error');
      expect(response.body.error).toStrictEqual({ queue: { status: 'down' } });
    });

    it('should return 503 when every dependency is down', async () => {
      mockDb.pingCheck.mockResolvedValue(databaseDown);
      mockQueue.isHealthy.mockRejectedValue(queueDown);

      const response = await request(app.getHttpServer()).get(url).expect(503);

      expect(response.body.status).toBe('error');
      expect(response.body.error).toStrictEqual({
        ...databaseDown,
        queue: { status: 'down' },
      });
    });
  });
});
