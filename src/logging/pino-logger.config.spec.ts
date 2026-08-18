import {
  BadRequestException,
  Controller,
  Get,
  INestApplication,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { LoggerModule } from 'nestjs-pino';
import * as request from 'supertest';
import { Writable } from 'stream';
import { isIgnoredRequest, pinoHttpOptions } from './pino-logger.config';
/* eslint-disable */
const { version: packageVersion } = require('../../package.json');
/* eslint-enable */

@Controller()
class LogShapeTestController {
  @Get('ok')
  ok(): { hello: string } {
    return { hello: 'world' };
  }

  @Get('bad-request')
  badRequest(): never {
    throw new BadRequestException('Invalid payload');
  }

  @Get('boom')
  boom(): never {
    throw new Error('Something exploded');
  }
}

describe('pinoHttp request logging', () => {
  let app: INestApplication;
  let lines: Record<string, any>[];

  beforeEach(async () => {
    lines = [];
    const stream = new Writable({
      write(chunk, _encoding, callback) {
        for (const line of chunk.toString().split('\n')) {
          if (line.trim()) lines.push(JSON.parse(line));
        }
        callback();
      },
    });

    const moduleRef = await Test.createTestingModule({
      imports: [
        LoggerModule.forRoot({
          // The transport spawns a worker thread, which would swallow the
          // stream we assert on, so log straight into it.
          pinoHttp: [{ ...pinoHttpOptions, transport: undefined }, stream],
        }),
      ],
      controllers: [LogShapeTestController],
    }).compile();

    // Nest's default logger would print the /boom stack trace to the real
    // console; the assertions only care about the pino stream.
    app = moduleRef.createNestApplication({ logger: false });
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  /**
   * Fields shared by every request log line, whatever the status code.
   */
  function expectCommonShape(
    line: Record<string, any>,
    method: string,
    url: string,
  ): void {
    expect(line.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/);
    expect(line.context).toBe('RequestLoggerMiddleware');
    expect(line.appInfo).toStrictEqual({ version: packageVersion });
    expect(line.httpRequest).toStrictEqual({
      method,
      url,
      clientIp: expect.stringContaining('127.0.0.1'),
      origin: 'https://app.safe.global',
      requestId: 'test-request-id',
    });
    expect(typeof line.httpResponse.responseTime).toBe('number');
    // The raw pino/express objects must not leak into the output.
    expect(line.req).toBeUndefined();
    expect(line.res).toBeUndefined();
    expect(line.reqId).toBeUndefined();
    expect(line.responseTime).toBeUndefined();
    expect(line.err).toBeUndefined();
    expect(line.pid).toBeUndefined();
    expect(line.hostname).toBeUndefined();
    expect(line.time).toBeUndefined();
  }

  function get(path: string): request.Test {
    return request(app.getHttpServer())
      .get(path)
      .set('origin', 'https://app.safe.global')
      .set('x-request-id', 'test-request-id');
  }

  it('logs a 200 response at INFO', async () => {
    await get('/ok').expect(200);

    expect(lines).toHaveLength(1);
    const [line] = lines;
    expectCommonShape(line, 'GET', '/ok');
    expect(line.level).toBe('INFO');
    expect(line.message).toBe('GET /ok 200');
    expect(line.httpResponse.statusCode).toBe(200);
    expect(line.httpRequestError).toBeUndefined();
  });

  it('logs a 400 response at WARN', async () => {
    await get('/bad-request').expect(400);

    expect(lines).toHaveLength(1);
    const [line] = lines;
    expectCommonShape(line, 'GET', '/bad-request');
    expect(line.level).toBe('WARN');
    expect(line.message).toBe('GET /bad-request 400');
    expect(line.httpResponse.statusCode).toBe(400);
    // Nest's exception filter turns the exception into a 400 response, so
    // pino-http never sees an error for it.
    expect(line.httpRequestError).toBeUndefined();
  });

  it('logs a 500 response at ERROR with the error details', async () => {
    await get('/boom').expect(500);

    expect(lines).toHaveLength(1);
    const [line] = lines;
    expectCommonShape(line, 'GET', '/boom');
    expect(line.level).toBe('ERROR');
    expect(line.message).toBe('GET /boom 500');
    expect(line.httpResponse.statusCode).toBe(500);
    expect(line.httpRequestError.message).toEqual(expect.any(String));
    expect(line.httpRequestError.stackTrace).toEqual(expect.any(String));
  });

  it('reuses an incoming x-request-id and echoes it back', async () => {
    const response = await get('/ok').expect(200);

    expect(response.headers['x-request-id']).toBe('test-request-id');
    expect(lines[0].httpRequest.requestId).toBe('test-request-id');
  });

  it('generates a request id when the client does not send one', async () => {
    const response = await request(app.getHttpServer()).get('/ok').expect(200);

    expect(response.headers['x-request-id']).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
    expect(lines[0].httpRequest.requestId).toBe(
      response.headers['x-request-id'],
    );
  });

  it('omits origin when the client does not send one', async () => {
    await request(app.getHttpServer()).get('/ok').expect(200);

    expect(lines[0].httpRequest).not.toHaveProperty('origin');
  });

  describe('isIgnoredRequest', () => {
    it.each([
      ['/health', true],
      ['/health/', true],
      ['/health/liveness', true],
      ['/health?verbose=1', true],
      ['/admin', true],
      ['/admin/resources/Webhook', true],
      ['/healthz', false],
      ['/administrators', false],
      ['/v1/events', false],
      [undefined, false],
    ])('%s -> %s', (url, expected) => {
      expect(isIgnoredRequest(url as string | undefined)).toBe(expected);
    });
  });
});
