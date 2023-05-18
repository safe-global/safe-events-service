import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';

/* eslint-disable */
const { version } = require('../package.json');
/* eslint-enable */

describe('AppController (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/about (GET)', () => {
    const expected = { name: 'Safe Events Service', version: version };
    return request(app.getHttpServer())
      .get('/about')
      .expect(200)
      .expect(expected);
  });
});
