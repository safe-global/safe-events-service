import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';
import { QueueProvider } from '../src/datasources/queue/queue.provider';
import { EventsService } from '../src/routes/events/events.service';
import { Server } from 'tls';
import { TxServiceEventType } from '../src/routes/events/event.dto';
import EventSource = require('eventsource');

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
  }, 10000);

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
    const validSafeAddress = '0x8618ce407F169ABB1388348A19632AaFA857CCB9';
    const notValidAddress = '0x8618CE407F169ABB1388348A19632AaFA857CCB9';
    const sseAuthToken = 'aW5mcmFAc2FmZS5nbG9iYWw6YWJjMTIz';
    const sseAuthorizationHeader = `Basic ${sseAuthToken}`;

    it('should be protected by an Authorization token', () => {
      const url = `/events/sse/${validSafeAddress}`;
      const expected = {
        statusCode: 403,
        message: 'Forbidden resource',
        error: 'Forbidden',
      };
      return request(app.getHttpServer()).get(url).expect(403).expect(expected);
    });
    it('should subscribe and receive Server Side Events', () => {
      const msg = {
        chainId: '1',
        type: 'SAFE_CREATED' as TxServiceEventType,
        hero: 'Tatsumaki',
        address: validSafeAddress,
      };

      const path = `/events/sse/${validSafeAddress}`;

      // Supertest cannot be used, as it does not support EventSource
      const server = app.getHttpServer();
      server.listen();
      const port = server.address().port;
      const protocol = server instanceof Server ? 'https' : 'http';
      const url = protocol + '://127.1.0.1:' + port + path;

      const eventSource = new EventSource(url, {
        headers: { Authorization: sseAuthorizationHeader },
      });
      // Use an empty promise so test has to wait for it, and do the cleanup there
      const messageReceived = new Promise((resolve) => {
        eventSource.onmessage = (event) => {
          expect(event.type).toBe('message');
          const parsedData = JSON.parse(event.data);
          expect(parsedData).toStrictEqual(msg);
          // Stop EventSource and server
          eventSource.close();
          server.close();
          resolve(null);
        };
      });

      // Wait a little to send the message
      setTimeout(() => {
        eventsService.pushEventToEventsObservable(msg);
      }, 1000);

      return messageReceived;
    });
    it('should return a 400 if safe address is not EIP55 valid', () => {
      const url = `/events/sse/${notValidAddress}`;
      const expected = {
        statusCode: 400,
        message: 'Not valid EIP55 address',
        error: `${notValidAddress} is not a valid EIP55 Safe address`,
      };
      return request(app.getHttpServer())
        .get(url)
        .set('Authorization', sseAuthorizationHeader)
        .expect(400)
        .expect(expected);
    });
  });
});
