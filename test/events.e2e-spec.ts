import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { EventsService } from '../src/routes/events/events.service';
import { WebhookService } from '../src/routes/webhook/webhook.service';
import { Webhook } from '../src/routes/webhook/entities/webhook.entity';
import { QueueProvider } from '../src/datasources/queue/queue.provider';
import { TxServiceEventType } from '../src/routes/events/event.dto';
import { publishMessage } from './util';

describe('Events handling', () => {
  let app: INestApplication;
  let eventsService: EventsService;
  let queueProvider: QueueProvider;
  let webhookService: WebhookService;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    eventsService = moduleFixture.get<EventsService>(EventsService);
    queueProvider = moduleFixture.get<QueueProvider>(QueueProvider);
    webhookService = moduleFixture.get<WebhookService>(WebhookService);

    // Wait for queue provider connection to be established, as it could take a little
    const { channel } = await queueProvider.getConnection();
    if (channel !== undefined) await channel.waitForConnect();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    // Nest.js Shutdown hooks are not triggered
    await queueProvider.disconnect();
  });

  it('Processes events', async () => {
    const msg = {
      chainId: '1',
      type: 'SAFE_CREATED' as TxServiceEventType,
      hero: 'Tanjiro',
      address: '0x0275FC2adfF11270F3EcC4D2F7Aa0a9784601Ca6',
    };
    const processEventSpy = jest.spyOn(eventsService, 'processEvent');
    const postEveryWebhookSpy = jest.spyOn(webhookService, 'postEveryWebhook');
    const mockedWebhook = new Webhook();
    mockedWebhook.url = 'http://localhost';
    mockedWebhook.authorization = 'Basic QWxhZGRpbjpvcGVuIHNlc2FtZQ==';
    mockedWebhook.isActive = true;
    mockedWebhook.chains = ['1'];
    mockedWebhook.sendSafeCreations = true;
    const getCachedActiveWebhooksSpy = jest
      .spyOn(webhookService, 'getCachedActiveWebhooks')
      .mockImplementation(async () => [mockedWebhook]);
    const postWebhookResponse: any = {
      data: {},
      status: 200,
      statusText: 'OK',
    };
    const postWebhookSpy = jest
      .spyOn(webhookService, 'postWebhook')
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
    expect(postWebhookSpy).toHaveBeenCalledWith(
      msg,
      mockedWebhook.url,
      mockedWebhook.authorization,
    );
  });
});
