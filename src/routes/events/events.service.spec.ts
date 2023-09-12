import { Test } from '@nestjs/testing';
import { EventsService } from './events.service';
import { QueueProvider } from '../../datasources/queue/queue.provider';
import { WebhookService } from '../webhook/webhook.service';
import { TxServiceEventType } from './event.dto';

describe('EventsService', () => {
  let eventsService: EventsService;
  let webhookService: WebhookService;
  const queueProvider = {
    /* eslint-disable @typescript-eslint/no-unused-vars */
    subscribeToEvents: async (_: (_: string) => Promise<string>) =>
      'exampleTag',
  };

  /* eslint-enable @typescript-eslint/no-unused-vars */

  beforeEach(async () => {
    const webhookServiceMock = {
      postEveryWebhook: async () => ({
        data: {},
        status: 200,
        statusText: 'OK',
      }),
    };
    const module = await Test.createTestingModule({
      providers: [EventsService, QueueProvider, WebhookService],
    })
      .overrideProvider(QueueProvider)
      .useValue(queueProvider)
      .overrideProvider(WebhookService)
      .useValue(webhookServiceMock)
      .compile();

    eventsService = module.get<EventsService>(EventsService);
    webhookService = module.get<WebhookService>(WebhookService);
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
      const pushEventToEventsObservable = jest.spyOn(
        eventsService,
        'pushEventToEventsObservable',
      );
      const msg = {
        chainId: '1',
        type: 'SAFE_CREATED' as TxServiceEventType,
        hero: 'Saitama',
        address: '0x0275FC2adfF11270F3EcC4D2F7Aa0a9784601Ca6',
      };
      await eventsService.processEvent(JSON.stringify(msg));
      expect(postEveryWebhook).toBeCalledTimes(1);
      expect(postEveryWebhook).toBeCalledWith(msg);
      expect(pushEventToEventsObservable).toBeCalledTimes(1);
      expect(pushEventToEventsObservable).toBeCalledWith(msg);
    });
  });

  describe('processMessageEvents', () => {
    it('should post webhooks', async () => {
      const postEveryWebhook = jest.spyOn(webhookService, 'postEveryWebhook');

      const messageCreated = {
        chainId: '1',
        type: 'MESSAGE_CREATED' as TxServiceEventType,
        messageHash:
          '0x47173285a8d7341e5e972fc677286384f802f8ef42a5ec5f03bbfa254cb01fad',
        address: '0x0275FC2adfF11270F3EcC4D2F7Aa0a9784601Ca6',
      };
      const messageConfirmation = {
        chainId: '1',
        type: 'MESSAGE_CONFIRMATION' as TxServiceEventType,
        messageHash:
          '0xc9b14f03293f5febf968b2a3dde3e5d373f978ea9e9403881c5abfa68322bea9',
        address: '0x0275FC2adfF11270F3EcC4D2F7Aa0a9784601Ca6',
      };

      await eventsService.processEvent(JSON.stringify(messageCreated));
      expect(postEveryWebhook).toBeCalledTimes(1);
      expect(postEveryWebhook).toBeCalledWith(messageCreated);
      await eventsService.processEvent(JSON.stringify(messageConfirmation));
      expect(postEveryWebhook).toBeCalledTimes(2);
      expect(postEveryWebhook).toBeCalledWith(messageConfirmation);
    });
  });
});
