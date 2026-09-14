import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { HealthModule } from './health.module';
import {
  HealthCheckError,
  HealthCheckResult,
  HealthCheckStatus,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';
import { ConfigModule } from '@nestjs/config';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { DatabaseModule } from '../../datasources/db/database.module';
import { QueueHealthIndicator } from '../../datasources/queue/queue.health';
import { QueueProvider } from '../../datasources/queue/queue.provider';
import { HealthStatus } from './health.entities';

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
  const queueDown = { queue: { status: 'down' } };
  const queueDownError = new HealthCheckError(
    'Queue provider not connected',
    queueDown,
  );

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot(), HealthModule],
    })
      .overrideProvider(TypeOrmHealthIndicator)
      .useValue(mockDb)
      .overrideProvider(QueueHealthIndicator)
      .useValue(mockQueue)
      .compile();

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

  describe('GET /health/live', () => {
    it('should return 200 without checking any dependency', async () => {
      mockDb.pingCheck.mockResolvedValue(databaseDown);
      mockQueue.isHealthy.mockRejectedValue(queueDownError);

      const response = await request(app.getHttpServer())
        .get('/health/live')
        .expect(200);

      expect(response.body).toStrictEqual({ status: HealthStatus.OK });
      expect(mockDb.pingCheck).not.toHaveBeenCalled();
      expect(mockQueue.isHealthy).not.toHaveBeenCalled();
    });

    // Kubernetes probes are configured with a trailing slash, so both forms must
    // answer. Express is not in strict routing mode, so they map to the same route.
    it('should answer the trailing slash form', async () => {
      await request(app.getHttpServer()).get('/health/live/').expect(200);
    });
  });

  describe('GET /health/ready', () => {
    it('should return 200 when every dependency is up', async () => {
      const response = await request(app.getHttpServer())
        .get('/health/ready')
        .expect(200);

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

      const response = await request(app.getHttpServer())
        .get('/health/ready')
        .expect(503);

      expect(response.body.status).toBe('error');
      expect(response.body.error).toStrictEqual(databaseDown);
    });

    it('should return 503 when the queue is down', async () => {
      mockQueue.isHealthy.mockRejectedValue(queueDownError);

      const response = await request(app.getHttpServer())
        .get('/health/ready')
        .expect(503);

      expect(response.body.status).toBe('error');
      expect(response.body.error).toStrictEqual(queueDown);
    });

    it('should return 503 when every dependency is down', async () => {
      mockDb.pingCheck.mockResolvedValue(databaseDown);
      mockQueue.isHealthy.mockRejectedValue(queueDownError);

      const response = await request(app.getHttpServer())
        .get('/health/ready')
        .expect(503);

      expect(response.body.status).toBe('error');
      expect(response.body.error).toStrictEqual({
        ...databaseDown,
        ...queueDown,
      });
    });

    it('should answer the trailing slash form', async () => {
      await request(app.getHttpServer()).get('/health/ready/').expect(200);
    });
  });
});
