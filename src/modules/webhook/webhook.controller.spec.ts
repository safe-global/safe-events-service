import { Test, TestingModule } from '@nestjs/testing';
import { WebhookService } from './webhook.service';
import { WebhooksController } from './webhook.controller';
import { WebhookPublicDto, WebhookRequestDto } from './dtos/webhook.dto';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../../app.module';
import * as request from 'supertest';
import { DataSource, Repository } from 'typeorm';
import { Webhook } from './repositories/webhook.entity';
import { WebhookModule } from './webhook.module';
import { DatabaseModule } from '../../datasources/db/database.module';
import { ConfigModule } from '@nestjs/config';

describe('WebhooksController', () => {
  let controller: WebhooksController;
  let service: WebhookService;
  let app: INestApplication;
  let dataSource: DataSource;
  let webhookRepository: Repository<Webhook>;

  const mockWebhookService = {
    createWebhook: jest.fn(),
    updateWebhook: jest.fn(),
  };

  beforeAll(async () => {
    process.env.ADMIN_WEBHOOK_AUTH = 'super-secret-auth-key';
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
  });

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot(), WebhookModule, DatabaseModule],
      controllers: [WebhooksController],
      providers: [
        {
          provide: WebhookService,
          useValue: mockWebhookService,
        },
      ],
    }).compile();

    controller = moduleRef.get<WebhooksController>(WebhooksController);
    service = moduleRef.get<WebhookService>(WebhookService);
    dataSource = moduleRef.get<DataSource>(DataSource);
    webhookRepository = dataSource.getRepository(Webhook);
    await webhookRepository.clear();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const mockRequestDto: WebhookRequestDto = {
    description: 'Test Webhook',
    url: 'https://example.com/hook',
    isActive: true,
    authorization: 'Bearer token',
    chains: [1, 2],
    addresses: ['0x0275FC2adfF11270F3EcC4D2F7Aa0a9784601Ca6'],
    events: ['SEND_CONFIRMATIONS'],
  };

  const mockPublicDto: WebhookPublicDto = {
    ...mockRequestDto,
    id: '88888888-e757-4b74-a40f-8dca14553576',
  };

  describe('Test webhook controller', () => {
    it('Should create a webhook and return WebhookPublicDto', async () => {
      service.createWebhook = jest.fn().mockResolvedValue(mockPublicDto);

      const result = await controller.createWebhook(mockRequestDto);
      expect(result).toEqual(mockPublicDto);
      expect(service.createWebhook).toHaveBeenCalledWith(mockRequestDto);
    });
    it('Should get a webhook and return WebhookPublicDto', async () => {
      service.getWebhook = jest.fn().mockResolvedValue(mockPublicDto);

      const result = await controller.getWebhookByUuid(mockPublicDto.id);
      expect(result).toEqual(mockPublicDto);
      expect(service.getWebhook).toHaveBeenCalledWith(mockPublicDto.id);
    });

    it('Should update a webhook and return WebhookPublicDto', async () => {
      service.updateWebhook = jest.fn().mockResolvedValue(mockPublicDto);

      const result = await controller.updateWebhook(
        mockPublicDto.id,
        mockRequestDto,
      );
      expect(result).toEqual(mockPublicDto);
      expect(service.updateWebhook).toHaveBeenCalledWith(
        mockPublicDto.id,
        mockRequestDto,
      );
    });
    it('Should call delete webhook', async () => {
      service.deleteWebhook = jest.fn().mockResolvedValue(mockPublicDto);

      const result = await controller.deleteWebhook(mockPublicDto.id);
      expect(result).toBeUndefined();
      expect(service.deleteWebhook).toHaveBeenCalledWith(mockPublicDto.id);
    });
  });
  describe('Test E2E webhooks endpoints', () => {
    it('POST /webhooks — should returen 403', async () => {
      await request(app.getHttpServer())
        .post('/webhooks')
        .send(mockRequestDto)
        .expect(403);
    });
    it('POST /webhooks — should create a webhook', async () => {
      const res = await request(app.getHttpServer())
        .post('/webhooks')
        .set('Authorization', 'Basic ' + process.env.ADMIN_WEBHOOK_AUTH)
        .send(mockRequestDto)
        .expect(201);

      expect(res.body).toHaveProperty('id');
      expect(res.body.description).toBe(mockRequestDto.description);
      expect(res.body.url).toBe(mockRequestDto.url);
      expect(res.body.chains).toEqual(mockRequestDto.chains);
      expect(res.body.events.sort()).toEqual(mockRequestDto.events.sort());
    });
    it('PUT /webhooks/:id — should return 403', async () => {
      await request(app.getHttpServer())
        .put(`/webhooks/${mockPublicDto.id}`)
        .send(mockRequestDto)
        .expect(403);
    });
    it('PUT /webhooks/:id — should return 404', async () => {
      await request(app.getHttpServer())
        .put(`/webhooks/${mockPublicDto.id}`)
        .set('Authorization', 'Basic ' + process.env.ADMIN_WEBHOOK_AUTH)
        .send(mockRequestDto)
        .expect(404);
    });
    it('PUT /webhooks/:id — should update the webhook', async () => {
      let res = await request(app.getHttpServer())
        .post('/webhooks')
        .set('Authorization', 'Basic ' + process.env.ADMIN_WEBHOOK_AUTH)
        .send(mockRequestDto)
        .expect(201);

      expect(res.body.events).toStrictEqual(['SEND_CONFIRMATIONS']);

      const publicId = res.body.id;
      const updated = {
        ...mockRequestDto,
        description: 'Updated E2E Webhook',
        events: ['SEND_MULTISIG_TXS'],
      };

      res = await request(app.getHttpServer())
        .put(`/webhooks/${publicId}`)
        .set('Authorization', 'Basic ' + process.env.ADMIN_WEBHOOK_AUTH)
        .send(updated)
        .expect(200);

      expect(res.body.description).toBe('Updated E2E Webhook');
      expect(res.body.events).toStrictEqual(['SEND_MULTISIG_TXS']);
      expect(res.body.id).toBe(publicId);
    });
    it('GET /webhooks/:id — should return 403', async () => {
      await request(app.getHttpServer())
        .get(`/webhooks/${mockPublicDto.id}`)
        .set('Authorization', 'Basic ' + 'other-wrong-token')
        .expect(403);
    });
    it('GET /webhooks/:id — should return 404', async () => {
      await request(app.getHttpServer())
        .get(`/webhooks/${mockPublicDto.id}`)
        .set('Authorization', 'Basic ' + process.env.ADMIN_WEBHOOK_AUTH)
        .expect(404);
    });
    it('GET /webhooks/:id — should retrieve the webhook', async () => {
      let res = await request(app.getHttpServer())
        .post('/webhooks')
        .set('Authorization', 'Basic ' + process.env.ADMIN_WEBHOOK_AUTH)
        .send(mockRequestDto)
        .expect(201);
      const publicId = res.body.id;
      res = await request(app.getHttpServer())
        .get(`/webhooks/${publicId}`)
        .set('Authorization', 'Basic ' + process.env.ADMIN_WEBHOOK_AUTH)
        .expect(200);

      expect(res.body.id).toBe(publicId);
      expect(res.body.description).toBe('Test Webhook');
    });
    it('DELETE /webhooks/:id — should return 403', async () => {
      await request(app.getHttpServer())
        .delete(`/webhooks/${mockPublicDto.id}`)
        .expect(403);
    });
    it('DELETE /webhooks/:id — should return 404', async () => {
      await request(app.getHttpServer())
        .delete(`/webhooks/${mockPublicDto.id}`)
        .set('Authorization', 'Basic ' + process.env.ADMIN_WEBHOOK_AUTH)
        .expect(404);
    });
    it('DELETE /webhooks/:id — should delete the webhook', async () => {
      let res = await request(app.getHttpServer())
        .post('/webhooks')
        .set('Authorization', 'Basic ' + process.env.ADMIN_WEBHOOK_AUTH)
        .send(mockRequestDto)
        .expect(201);
      const publicId = res.body.id;

      res = await request(app.getHttpServer())
        .get(`/webhooks/${publicId}`)
        .set('Authorization', 'Basic ' + process.env.ADMIN_WEBHOOK_AUTH)
        .expect(200);

      await request(app.getHttpServer())
        .delete(`/webhooks/${publicId}`)
        .set('Authorization', 'Basic ' + process.env.ADMIN_WEBHOOK_AUTH)
        .expect(204);

      res = await request(app.getHttpServer())
        .get(`/webhooks/${publicId}`)
        .set('Authorization', 'Basic ' + process.env.ADMIN_WEBHOOK_AUTH)
        .expect(404);
    });
  });
});
