import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';
import { QueueProvider } from '../src/datasources/queue/queue.provider';
import { EventsService } from '../src/routes/events/events.service';

/* eslint-disable */
const { version } = require('../package.json');
/* eslint-enable */

describe('AppController (e2e)', () => {
  let app: INestApplication;
  let queueProvider: QueueProvider;
  let eventsService: EventsService;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    eventsService = moduleFixture.get<EventsService>(EventsService);
    queueProvider = moduleFixture.get<QueueProvider>(QueueProvider);
    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(() => {
    // Nest.js Shutdown hooks are not triggered
    queueProvider.disconnect();
  });

  it('/about (GET)', () => {
    const expected = { name: 'Safe Events Service', version: version };
    return request(app.getHttpServer())
      .get('/about')
      .expect(200)
      .expect(expected);
  });

  describe('/events/sse/:safe (GET)', () => {
    it('should subscribe to server side events', () => {
      const validSafeAddress = '0x8618ce407F169ABB1388348A19632AaFA857CCB9';
      const url = `/events/sse/${validSafeAddress}`;
      const expected = {};

      const result = request(app.getHttpServer())
        .get(url)
        .expect(200)
        .expect(expected);
      eventsService.completeEventsObservable();
      return result;
    });
    it('should return a 400 if safe address is not EIP55 valid', () => {
      const notValidAddress = '0x8618CE407F169ABB1388348A19632AaFA857CCB9';
      const url = `/events/sse/${notValidAddress}`;
      const expected = {
        statusCode: 400,
        message: 'Not valid EIP55 address',
        error: `${notValidAddress} is not a valid EIP55 Safe address`,
      };
      return request(app.getHttpServer()).get(url).expect(400).expect(expected);
    });
  });
});
