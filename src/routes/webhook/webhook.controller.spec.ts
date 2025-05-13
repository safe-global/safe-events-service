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
    is_active: true,
    authorization: 'Bearer token',
    chains: [1, 2],
    events: ['SEND_CONFIRMATIONS'],
  };

  const mockPublicDto: WebhookPublicDto = {
    ...mockRequestDto,
    public_id: '88888888-e757-4b74-a40f-8dca14553576',
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

      const result = await controller.getWebhookByUuid(mockPublicDto.public_id);
      expect(result).toEqual(mockPublicDto);
      expect(service.getWebhook).toHaveBeenCalledWith(mockPublicDto.public_id);
    });

    it('Should update a webhook and return WebhookPublicDto', async () => {
      service.updateWebhook = jest.fn().mockResolvedValue(mockPublicDto);

      const result = await controller.updateWebhook(
        mockPublicDto.public_id,
        mockRequestDto,
      );
      expect(result).toEqual(mockPublicDto);
      expect(service.updateWebhook).toHaveBeenCalledWith(
        mockPublicDto.public_id,
        mockRequestDto,
      );
    });
    it('Should call delete webhook', async () => {
      service.deleteWebhook = jest.fn().mockResolvedValue(mockPublicDto);

      const result = await controller.deleteWebhook(mockPublicDto.public_id);
      expect(result).toBeUndefined();
      expect(service.deleteWebhook).toHaveBeenCalledWith(
        mockPublicDto.public_id,
      );
    });
  });
  describe('Test E2E webhooks endpoints', () => {
    it('POST /webhooks — should create a webhook', async () => {
      const res = await request(app.getHttpServer())
        .post('/webhooks')
        .send(mockRequestDto)
        .expect(201);

      expect(res.body).toHaveProperty('public_id');
      expect(res.body.description).toBe(mockRequestDto.description);
      expect(res.body.url).toBe(mockRequestDto.url);
      expect(res.body.chains).toEqual(mockRequestDto.chains);
      expect(res.body.events.sort()).toEqual(mockRequestDto.events.sort());
    });
    it('PUT /webhooks/:public_id — should update the webhook', async () => {
      let res = await request(app.getHttpServer())
        .post('/webhooks')
        .send(mockRequestDto)
        .expect(201);
      const public_id = res.body.public_id;
      const updated = { ...mockRequestDto, description: 'Updated E2E Webhook' };

      res = await request(app.getHttpServer())
        .put(`/webhooks/${public_id}`)
        .send(updated)
        .expect(200);

      expect(res.body.description).toBe('Updated E2E Webhook');
      expect(res.body.public_id).toBe(public_id);
    });
    it('GET /webhooks/:public_id — should retrieve the webhook', async () => {
      let res = await request(app.getHttpServer())
        .post('/webhooks')
        .send(mockRequestDto)
        .expect(201);
      const public_id = res.body.public_id;
      res = await request(app.getHttpServer())
        .get(`/webhooks/${public_id}`)
        .expect(200);

      expect(res.body.public_id).toBe(public_id);
      expect(res.body.description).toBe('Test Webhook');
    });
    it('DELETE /webhooks/:public_id — should delete the webhook', async () => {
      let res = await request(app.getHttpServer())
        .post('/webhooks')
        .send(mockRequestDto)
        .expect(201);
      const public_id = res.body.public_id;

      res = await request(app.getHttpServer())
        .get(`/webhooks/${public_id}`)
        .expect(200);

      await request(app.getHttpServer())
        .delete(`/webhooks/${public_id}`)
        .expect(204);

      res = await request(app.getHttpServer())
        .get(`/webhooks/${public_id}`)
        .expect(404);
    });
  });
});
