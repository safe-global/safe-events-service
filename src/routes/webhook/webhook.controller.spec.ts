import { Test, TestingModule } from '@nestjs/testing';
import { WebhookService } from './webhook.service';
import { WebhooksController } from './webhook.controller';
import { WebhookPublicDto, WebhookRequestDto } from './dtos/webhook.dto';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../../app.module';
import * as request from 'supertest';

describe('WebhooksController', () => {
  let controller: WebhooksController;
  let service: WebhookService;
  let app: INestApplication;

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
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WebhooksController],
      providers: [
        {
          provide: WebhookService,
          useValue: mockWebhookService,
        },
      ],
    }).compile();

    controller = module.get<WebhooksController>(WebhooksController);
    service = module.get<WebhookService>(WebhookService);
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
    public_id: 'uuid-1234',
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
  describe('Test webhooks endpoints', () => {
    it('POST /webhooks — should create a webhook', async () => {
      service.createWebhook = jest.fn().mockResolvedValue(mockPublicDto);
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
      const mockPublicDtoUpdated = {
        ...mockPublicDto,
        description: 'Updated E2E Webhook',
      };
      service.updateWebhook = jest.fn().mockResolvedValue(mockPublicDtoUpdated);
      const updated = { ...mockRequestDto, description: 'Updated E2E Webhook' };

      const res = await request(app.getHttpServer())
        .put(`/webhooks/${mockPublicDto.public_id}`)
        .send(updated)
        .expect(400);

      expect(res.body.description).toBe('Updated E2E Webhook');
      expect(res.body.public_id).toBe(mockPublicDto.public_id);
    });
    it('GET /webhooks/:public_id — should retrieve the webhook', async () => {
      service.getWebhook = jest.fn().mockResolvedValue(mockPublicDto);
      const res = await request(app.getHttpServer())
        .get(`/webhooks/${mockPublicDto.public_id}`)
        .expect(200);

      expect(res.body.public_id).toBe(mockPublicDto.public_id);
      expect(res.body.description).toBe('Test Webhook');
    });
    it('DELETE /webhooks/:public_id — should delete the webhook', async () => {
      await request(app.getHttpServer())
        .delete(`/webhooks/${mockPublicDto.public_id}`)
        .expect(200);
    });
  });
});
