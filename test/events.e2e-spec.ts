import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { EventsService } from '../src/modules/events/events.service';
import { WebhookDispatcherService } from '../src/modules/webhook/webhookDispatcher.service';
import { QueueProvider } from '../src/datasources/queue/queue.provider';
import { TxServiceEventType } from '../src/modules/events/event.dto';
import { publishMessage } from './util';
import { webhookWithStatsFactory } from '../src/modules/webhook/repositories/webhook.test.factory';

describe('Events handling', () => {
  let app: INestApplication;
  let eventsService: EventsService;
  let queueProvider: QueueProvider;
  let webhookDispatcherService: WebhookDispatcherService;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    eventsService = moduleFixture.get<EventsService>(EventsService);
    queueProvider = moduleFixture.get<QueueProvider>(QueueProvider);
    webhookDispatcherService = moduleFixture.get<WebhookDispatcherService>(
      WebhookDispatcherService,
    );

    // Wait for queue provider connection to be established, as it could take a little
    const { channel } = await queueProvider.getConnection();
    if (channel !== undefined) await channel.waitForConnect();

    app = moduleFixture.createNestApplication();
    await app.init();
  }, 10000);

  afterEach(async () => {
    // Nest.js Shutdown hooks are not triggered
    await queueProvider.disconnect();
    await app.close();
  });

  it('Processes events', async () => {
    const msg = {
      chainId: '1',
      type: 'SAFE_CREATED' as TxServiceEventType,
      hero: 'Tanjiro',
      address: '0x0275FC2adfF11270F3EcC4D2F7Aa0a9784601Ca6',
    };
    const processEventSpy = jest.spyOn(eventsService, 'processEvent');
    const postEveryWebhookSpy = jest.spyOn(
      webhookDispatcherService,
      'postEveryWebhook',
    );
    const mockedWebhook = webhookWithStatsFactory({
      isActive: true,
      url: 'http://localhost',
      authorization: 'Basic QWxhZGRpbjpvcGVuIHNlc2FtZQ==',
      chains: ['1'],
      addresses: ['0x0275FC2adfF11270F3EcC4D2F7Aa0a9784601Ca6'],
      sendSafeCreations: true,
    });
    const getCachedActiveWebhooksSpy = jest
      .spyOn(webhookDispatcherService, 'getCachedActiveWebhooks')
      .mockImplementation(() => [mockedWebhook]);
    const postWebhookResponse: any = {
      data: {},
      status: 200,
      statusText: 'OK',
    };
    const postWebhookSpy = jest
      .spyOn(webhookDispatcherService, 'postWebhook')
      .mockImplementation(async () => postWebhookResponse);

    const isMessagePublished = await publishMessage(
      queueProvider.getAmqpUrl(),
      queueProvider.getExchangeName(),
      queueProvider.getQueueName(),
      msg,
    );
    expect(isMessagePublished).toBe(true);
    expect(processEventSpy).toHaveBeenCalledTimes(1);
    expect(processEventSpy).toHaveBeenCalledWith(JSON.stringify(msg));

    expect(postEveryWebhookSpy).toHaveBeenCalledTimes(1);
    expect(postEveryWebhookSpy).toHaveBeenCalledWith(msg);

    expect(getCachedActiveWebhooksSpy).toHaveBeenCalledTimes(1);

    expect(postWebhookSpy).toHaveBeenCalledTimes(1);
    expect(postWebhookSpy).toHaveBeenCalledWith(msg, mockedWebhook);
  });
});
