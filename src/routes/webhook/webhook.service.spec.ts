import { Test } from '@nestjs/testing';
import { WebhookService } from './webhook.service';
import { Webhook } from './entities/webhook.entity';
import { AppModule } from '../../app.module';

describe('Webhook service', () => {
  let webhookService: WebhookService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    webhookService = moduleRef.get<WebhookService>(WebhookService);
  });

  describe('findAll', () => {
    it('should return an array of webhooks', async () => {
      const expected: Webhook[] = [];
      jest
        .spyOn(webhookService, 'findAll')
        .mockImplementation(async () => expected);

      const results = await webhookService.findAll();
      expect(results).toBe(expected);
    });
  });
});
