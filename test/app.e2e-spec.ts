import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';
import { EventsService } from '../src/routes/events/events.service';

/* eslint-disable */
const { version } = require('../package.json');
/* eslint-enable */

describe('AppController (e2e)', () => {
  let app: INestApplication;
  let eventsService: EventsService;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    eventsService = moduleFixture.get<EventsService>(EventsService);

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(() => {
    // Nest.js Shutdown hooks are not triggered
    eventsService.disconnect();
  });

  it('/about (GET)', () => {
    const expected = { name: 'Safe Events Service', version: version };
    return request(app.getHttpServer())
      .get('/about')
      .expect(200)
      .expect(expected);
  });
});
