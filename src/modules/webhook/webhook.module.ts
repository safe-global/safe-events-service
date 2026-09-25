import { Module, Logger } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Webhook } from './repositories/webhook.entity';
import { WebhookService } from './webhook.service';
import {
  WebhookDispatcherService,
  UNDICI_AGENT,
} from './webhookDispatcher.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { WebhooksController } from './webhook.controller';
import { Agent, Dispatcher, RetryAgent, interceptors } from 'undici';

const WEBHOOK_RETRYABLE_STATUS_CODES = [500, 502, 503, 504];
const WEBHOOK_RETRYABLE_ERROR_CODES = [
  'ECONNRESET',
  'ECONNREFUSED',
  'ENOTFOUND',
  'ENETDOWN',
  'ENETUNREACH',
  'EHOSTDOWN',
  'ETIMEDOUT',
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_HEADERS_TIMEOUT',
  'UND_ERR_BODY_TIMEOUT',
  'UND_ERR_SOCKET',
];

const logger = new Logger('WebhookAgent');

/**
 * Every numeric option must reach undici as a real number. undici reads NaN as
 * unset and silently applies its own default, and a NaN retry limit is never
 * reached, so the request retries forever. A value that does not parse, or one
 * below `min`, falls back to `fallback` and is logged.
 */
function parseNumberConfig(
  key: string,
  value: string | undefined,
  fallback: number,
  min: number,
): number {
  if (value == null || value === '') {
    return fallback;
  }
  const parsed = Number(value);
  if (Number.isFinite(parsed) && parsed >= min) {
    return parsed;
  }
  logger.warn({
    message: 'Invalid numeric config, falling back to default',
    messageContext: { key, value, fallback, min },
  });
  return fallback;
}

/**
 * The DNS cache never evicts on a timer: an entry is only refreshed when its
 * host is looked up again. Once the cache is full new hosts are resolved on
 * every connect and never stored, so an unbounded cache is the default and a
 * limit is only worth setting to bound memory.
 */
function parseDnsCacheMaxItems(value: string | undefined): number {
  if (value == null || value === '') {
    return Infinity;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 1 ? parsed : Infinity;
}

/**
 * `null` leaves the pool uncapped, which undici reads as one connection per
 * concurrent request. Concurrency per host is already bounded by
 * `AMQP_PREFETCH_MESSAGES`: the consumer acks a message only after its fan-out
 * settles, so a host sees at most one request per in-flight event.
 */
function parseConnectionsPerHost(value: string | undefined): number | null {
  if (value == null || value === '') {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 1 ? parsed : null;
}

function createWebhookAgent(configService: ConfigService): Dispatcher {
  const timeout = parseNumberConfig(
    'HTTP_TIMEOUT',
    configService.get('HTTP_TIMEOUT'),
    5_000,
    1,
  );
  // 0 disables retries.
  const maxRetries = parseNumberConfig(
    'HTTP_MAX_RETRIES',
    configService.get('HTTP_MAX_RETRIES'),
    2,
    0,
  );
  const keepAliveTimeout = parseNumberConfig(
    'HTTP_KEEP_ALIVE_TIMEOUT',
    configService.get('HTTP_KEEP_ALIVE_TIMEOUT'),
    60_000,
    1,
  );
  const connectionsPerHost = parseConnectionsPerHost(
    configService.get('HTTP_CONNECTIONS_PER_HOST'),
  );
  // 0 keeps connections until they go idle.
  const clientTtl = parseNumberConfig(
    'HTTP_CLIENT_TTL',
    configService.get('HTTP_CLIENT_TTL'),
    600_000,
    0,
  );
  // 0 resolves on every connect.
  const dnsCacheTtl = parseNumberConfig(
    'HTTP_DNS_CACHE_TTL',
    configService.get('HTTP_DNS_CACHE_TTL'),
    60_000,
    0,
  );
  const dnsCacheMaxItems = parseDnsCacheMaxItems(
    configService.get('HTTP_DNS_CACHE_MAX_ITEMS'),
  );

  const agent = new Agent({
    connectTimeout: timeout,
    headersTimeout: timeout,
    bodyTimeout: timeout,
    // Sockets stay open between events. A target that receives events less
    // often than this reconnects on every delivery, paying DNS, TCP and TLS
    // each time. A target answering with `Keep-Alive: timeout=N` lowers it.
    keepAliveTimeout,
    // Optional cap on sockets per host. Capping queues requests behind a slow
    // host on top of the retry chain awaited inline before the ack, so it is
    // only worth setting under file descriptor pressure.
    connections: connectionsPerHost,
    // Retire sockets periodically. Long-lived sockets combined with the DNS
    // cache pin a busy host to a single IP, so a load balancer rotating
    // instances is never noticed.
    clientTtl,
  }).compose(
    // undici resolves the hostname on every new socket and caches nothing, so
    // each connect runs getaddrinfo on the libuv threadpool.
    interceptors.dns({ maxTTL: dnsCacheTtl, maxItems: dnsCacheMaxItems }),
  );

  return new RetryAgent(agent, {
    maxRetries,
    minTimeout: 1_000,
    maxTimeout: 5_000,
    timeoutFactor: 2,
    methods: ['POST'],
    statusCodes: WEBHOOK_RETRYABLE_STATUS_CODES,
    errorCodes: WEBHOOK_RETRYABLE_ERROR_CODES,
  });
}

@Module({
  imports: [
    TypeOrmModule.forFeature([Webhook]),
    CacheModule.register(),
    ConfigModule,
  ],
  controllers: [WebhooksController],
  providers: [
    WebhookService,
    WebhookDispatcherService,
    {
      provide: UNDICI_AGENT,
      inject: [ConfigService],
      useFactory: createWebhookAgent,
    },
  ],
  exports: [TypeOrmModule, WebhookService, WebhookDispatcherService],
})
export class WebhookModule {}
