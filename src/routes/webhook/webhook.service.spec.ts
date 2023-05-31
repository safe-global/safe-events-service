import { Test } from '@nestjs/testing';
import { WebhookService } from './webhook.service';
import { Webhook } from './entities/webhook.entity';
import { WebhookModule } from './webhook.module';
import { DatabaseModule } from '../../datasources/db/database.module';
import { ConfigModule } from '@nestjs/config';

describe('Webhook service', () => {
  let webhookService: WebhookService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [WebhookModule, DatabaseModule, ConfigModule.forRoot()],
    }).compile();

    webhookService = moduleRef.get<WebhookService>(WebhookService);
  });

  describe('getCachedActiveWebhooks', () => {
    it('should return an array of webhooks', async () => {
      const expected: Webhook[] = [new Webhook()];
      const findAllActiveSpy = jest
        .spyOn(webhookService, 'findAllActive')
        .mockImplementation(async () => expected);

      let results = await webhookService.getCachedActiveWebhooks();
      expect(results).toEqual(expected);
      expect(findAllActiveSpy).toBeCalledTimes(1);

      // As it's cached, it shouldn't be called again
      results = await webhookService.getCachedActiveWebhooks();
      expect(results).toEqual(expected);
      expect(findAllActiveSpy).toBeCalledTimes(1);
    });
  });

  describe('postEveryWebhook', () => {
    it('should not post if webhooks are not defined', async () => {
      const webhooks: Webhook[] = [];
      const findAllActiveSpy = jest
        .spyOn(webhookService, 'findAllActive')
        .mockImplementation(async () => webhooks);
      const postWebhookSpy = jest
        .spyOn(webhookService, 'postWebhook')
        .mockImplementation(async () => new Response());

      const msg = { text: 'hello' };
      const results = await webhookService.postEveryWebhook(msg);
      expect(results).toEqual([]);
      expect(findAllActiveSpy).toBeCalledTimes(1);
      expect(postWebhookSpy).toBeCalledTimes(0);
    });
    it('should post if webhooks are defined', async () => {
      const webhooks: Webhook[] = [new Webhook(), new Webhook()];
      webhooks[0].url = 'localhost:4815';
      webhooks[1].url = 'localhost:1623';
      const mockedResponse: Response = new Response();
      const findAllActiveSpy = jest
        .spyOn(webhookService, 'findAllActive')
        .mockImplementation(async () => webhooks);
      const postWebhookSpy = jest
        .spyOn(webhookService, 'postWebhook')
        .mockImplementation(async () => mockedResponse);

      const msg = { text: 'hello' };
      const results = await webhookService.postEveryWebhook(msg);
      expect(results).toEqual([mockedResponse, mockedResponse]);
      expect(findAllActiveSpy).toBeCalledTimes(1);
      expect(postWebhookSpy).toBeCalledTimes(2);
      webhooks.map((webhook: Webhook, index: number) => {
        expect(postWebhookSpy).toHaveBeenNthCalledWith(
          index + 1,
          msg,
          webhook.url,
        );
      });
    });
  });
});
