import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { EventsService } from '../src/routes/events/events.service';
import { EXCHANGE, QUEUE } from '../src/routes/events/events.constants';
import { WebhookService } from '../src/routes/webhook/webhook.service';
import { Webhook } from '../src/routes/webhook/entities/webhook.entity';
import { connect as amqplibConnect, Connection } from 'amqplib';

async function publishMessage(msg: object): Promise<boolean> {
  const conn: Connection = await amqplibConnect('amqp://localhost:5672');
  const channel = await conn.createChannel();
  await channel.assertExchange(EXCHANGE, 'fanout', { durable: true });
  // Make sure queue is binded to the exchange, as this function can be called before subscribing
  await channel.assertQueue(QUEUE, { durable: true });
  const isMessagePublished = channel.publish(
    EXCHANGE,
    '',
    Buffer.from(JSON.stringify(msg)),
  );
  await channel.close();
  await conn.close();
  return isMessagePublished;
}

describe('Events handling', () => {
  let app: INestApplication;
  let eventsService: EventsService;
  let webhookService: WebhookService;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    eventsService = moduleFixture.get<EventsService>(EventsService);
    webhookService = moduleFixture.get<WebhookService>(WebhookService);

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(() => {
    // Nest.js Shutdown hooks are not triggered
    eventsService.disconnect();
  });

  it('Processes events', async () => {
    const msg = {
      test: 1,
      test2: 3,
    };
    const processEventSpy = jest.spyOn(eventsService, 'processEvent');
    const postEveryWebhookSpy = jest.spyOn(webhookService, 'postEveryWebhook');
    const mockedWebhook = new Webhook();
    mockedWebhook.url = 'http://localhost';
    mockedWebhook.isActive = true;
    const getCachedActiveWebhooksSpy = jest
      .spyOn(webhookService, 'getCachedActiveWebhooks')
      .mockImplementation(async () => [mockedWebhook]);
    const postWebhookSpy = jest
      .spyOn(webhookService, 'postWebhook')
      .mockImplementation(async () => new Response());

    const isMessagePublished = await publishMessage(msg);
    expect(isMessagePublished).toBe(true);
    expect(processEventSpy).toHaveBeenCalledTimes(1);
    expect(processEventSpy).toHaveBeenCalledWith(JSON.stringify(msg));

    expect(postEveryWebhookSpy).toHaveBeenCalledTimes(1);
    expect(postEveryWebhookSpy).toHaveBeenCalledWith(msg);

    expect(getCachedActiveWebhooksSpy).toHaveBeenCalledTimes(1);

    expect(postWebhookSpy).toHaveBeenCalledTimes(1);
    expect(postWebhookSpy).toHaveBeenCalledWith(msg, mockedWebhook.url);
  });
});
