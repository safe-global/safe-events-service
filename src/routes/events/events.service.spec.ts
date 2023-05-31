import { Test } from '@nestjs/testing';
import { EventsService } from './events.service';
import { QueueProvider } from '../../datasources/queue/queue.provider';
import { WebhookService } from '../webhook/webhook.service';

describe('EventsService', () => {
  let eventsService: EventsService;
  const queueProvider = {
    /* eslint-disable @typescript-eslint/no-unused-vars */
    subscribeToEvents: async (_: (_: string) => Promise<string>) =>
      'exampleTag',
  };
  const webhookService = {
    postEveryWebhook: async (_: object) => new Response(),
  };
  /* eslint-enable @typescript-eslint/no-unused-vars */

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [EventsService, QueueProvider, WebhookService],
    })
      .overrideProvider(QueueProvider)
      .useValue(queueProvider)
      .overrideProvider(WebhookService)
      .useValue(webhookService)
      .compile();

    eventsService = module.get<EventsService>(EventsService);
  });

  describe('listenToEvents', () => {
    it('should return consumer tag', async () => {
      const expected = 'exampleTag';
      const consumerTag = await eventsService.listenToEvents();
      expect(consumerTag).toEqual(expected);
    });
  });

  describe('processEvent', () => {
    it('should post webhooks', async () => {
      const postEveryWebhook = jest.spyOn(webhookService, 'postEveryWebhook');
      const msg = {
        hero: 'saitama',
      };
      await eventsService.processEvent(JSON.stringify(msg));
      expect(postEveryWebhook).toBeCalledTimes(1);
      expect(postEveryWebhook).toBeCalledWith(msg);
    });
  });
});
