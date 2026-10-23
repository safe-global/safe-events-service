import { ConfigModule, ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import {
  configModuleOptions,
  Environment,
  EnvironmentVariables,
  LogLevel,
  validate,
} from './environment';

const REQUIRED = {
  NODE_ENV: 'production',
  DATABASE_URL: 'psql://postgres:postgres@localhost:5432/test',
  AMQP_URL: 'amqp://localhost:5672',
  ADMIN_EMAIL: 'admin@safe',
  ADMIN_PASSWORD: 'password',
  ADMIN_COOKIE_SECRET: 'cookie-secret',
  ADMIN_SESSION_SECRET: 'session-secret',
  ADMIN_WEBHOOK_AUTH: 'webhook-token',
};

describe('validate environment', () => {
  it('applies defaults when only required variables are set', () => {
    const config = validate(REQUIRED);

    expect(config).toMatchObject({
      NODE_ENV: Environment.Production,
      URL_BASE_PATH: '',
      LOG_LEVEL: LogLevel.Info,
      AMQP_EXCHANGE: 'safe-transaction-service-events-with-topics',
      AMQP_QUEUE: 'safe-events-service',
      AMQP_PREFETCH_MESSAGES: 100,
      DATABASE_SSL_ENABLED: false,
      EVENTS_LOG_ENABLED: true,
      HTTP_TIMEOUT: 5_000,
      HTTP_MAX_RETRIES: 2,
      HTTP_CLIENT_TTL: 600_000,
      WEBHOOK_AUTO_DISABLE: false,
      WEBHOOK_FAILURE_THRESHOLD: 90,
      WEBHOOK_MAX_RESPONSE_BYTES: 10_000,
    });
    expect(config.HTTP_CONNECTIONS_PER_HOST).toBeUndefined();
    expect(config.DATABASE_CA_PATH).toBeUndefined();
  });

  it.each(Object.keys(REQUIRED))('fails when %s is missing', (key) => {
    const config: Record<string, string> = { ...REQUIRED };
    delete config[key];

    expect(() => validate(config)).toThrow(key);
  });

  it('treats an empty required value as missing', () => {
    expect(() => validate({ ...REQUIRED, ADMIN_WEBHOOK_AUTH: '' })).toThrow(
      'ADMIN_WEBHOOK_AUTH',
    );
  });

  it('treats an empty optional value as unset', () => {
    const config = validate({
      ...REQUIRED,
      HTTP_TIMEOUT: '  ',
      HTTP_CONNECTIONS_PER_HOST: '',
    });

    expect(config.HTTP_TIMEOUT).toBe(5_000);
    expect(config.HTTP_CONNECTIONS_PER_HOST).toBeUndefined();
  });

  it('converts numbers', () => {
    const config = validate({
      ...REQUIRED,
      HTTP_TIMEOUT: '1000',
      HTTP_MAX_RETRIES: '0',
      HTTP_CONNECTIONS_PER_HOST: '8',
      WEBHOOK_FAILURE_THRESHOLD: '12.5',
    });

    expect(config.HTTP_TIMEOUT).toBe(1_000);
    expect(config.HTTP_MAX_RETRIES).toBe(0);
    expect(config.HTTP_CONNECTIONS_PER_HOST).toBe(8);
    expect(config.WEBHOOK_FAILURE_THRESHOLD).toBe(12.5);
  });

  it.each([
    ['HTTP_TIMEOUT', 'abc'],
    ['HTTP_TIMEOUT', '0'],
    ['HTTP_TIMEOUT', '1.5'],
    ['HTTP_MAX_RETRIES', '-1'],
    ['HTTP_CONNECTIONS_PER_HOST', '0'],
    ['WEBHOOK_FAILURE_THRESHOLD', '101'],
    ['AMQP_PREFETCH_MESSAGES', 'ten'],
    ['AMQP_PREFETCH_MESSAGES', '0'],
  ])('fails when %s is %s', (key, value) => {
    expect(() => validate({ ...REQUIRED, [key]: value })).toThrow(key);
  });

  it.each([
    ['true', true],
    ['TRUE', true],
    [' True ', true],
    ['false', false],
    ['False', false],
  ])('parses boolean %s as %s', (value, expected) => {
    const config = validate({
      ...REQUIRED,
      WEBHOOK_AUTO_DISABLE: value,
      EVENTS_LOG_ENABLED: value,
      DATABASE_SSL_ENABLED: value,
    });

    expect(config.WEBHOOK_AUTO_DISABLE).toBe(expected);
    expect(config.EVENTS_LOG_ENABLED).toBe(expected);
    expect(config.DATABASE_SSL_ENABLED).toBe(expected);
  });

  it.each(['yes', '1', 'off'])('fails on boolean value %s', (value) => {
    expect(() =>
      validate({ ...REQUIRED, WEBHOOK_AUTO_DISABLE: value }),
    ).toThrow('WEBHOOK_AUTO_DISABLE');
  });

  it.each(['prod', 'staging'])('fails on NODE_ENV %s', (value) => {
    expect(() => validate({ ...REQUIRED, NODE_ENV: value })).toThrow(
      'NODE_ENV',
    );
  });

  it('lowercases LOG_LEVEL', () => {
    expect(validate({ ...REQUIRED, LOG_LEVEL: ' LOG ' }).LOG_LEVEL).toBe(
      LogLevel.Log,
    );
  });

  it('fails on an unknown LOG_LEVEL', () => {
    expect(() => validate({ ...REQUIRED, LOG_LEVEL: 'verbose' })).toThrow(
      'LOG_LEVEL',
    );
  });

  it.each(['/v1', '/internal/events'])('accepts URL_BASE_PATH %s', (value) => {
    expect(validate({ ...REQUIRED, URL_BASE_PATH: value }).URL_BASE_PATH).toBe(
      value,
    );
  });

  it.each(['v1', '/v1/', '/', '/v1?x', '/v1#a', '/a b'])(
    'fails on URL_BASE_PATH %s',
    (value) => {
      expect(() => validate({ ...REQUIRED, URL_BASE_PATH: value })).toThrow(
        'URL_BASE_PATH',
      );
    },
  );

  it('does not print secret values in the error', () => {
    expect(() =>
      validate({ ...REQUIRED, NODE_ENV: 'super-secret-value' }),
    ).toThrow(expect.not.stringContaining('super-secret-value'));
  });
});

describe('ConfigService with configModuleOptions', () => {
  const keys = [...Object.keys(REQUIRED), 'HTTP_CONNECTIONS_PER_HOST'];
  let saved: Record<string, string | undefined>;

  beforeEach(() => {
    saved = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
    Object.assign(process.env, REQUIRED);
  });

  afterEach(() => {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it('returns undefined, not the raw string, for an empty optional value', async () => {
    process.env.HTTP_CONNECTIONS_PER_HOST = '';
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot(configModuleOptions)],
    }).compile();
    const configService =
      moduleRef.get<ConfigService<EnvironmentVariables, true>>(ConfigService);

    expect(
      configService.get('HTTP_CONNECTIONS_PER_HOST', { infer: true }),
    ).toBeUndefined();
    expect(configService.get('HTTP_TIMEOUT', { infer: true })).toBe(5_000);
  });
});
