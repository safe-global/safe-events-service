import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Webhook } from './repositories/webhook.entity';
import { WebhookService } from './webhook.service';
import {
  WebhookDispatcherService,
  UNDICI_AGENT,
} from './webhookDispatcher.service';
import { ConfigService } from '@nestjs/config';
import { EnvironmentVariables } from '../../config/environment';
import { WebhooksController } from './webhook.controller';
import { Agent, Dispatcher, RetryAgent } from 'undici';

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

/**
 * Without `HTTP_CONNECTIONS_PER_HOST` the pool is uncapped, and undici opens one
 * connection per concurrent request. Concurrency per host is already bounded by
 * `AMQP_PREFETCH_MESSAGES`: the consumer acks a message only after its fan-out
 * settles, so a host sees at most one request per in-flight event.
 */
function createWebhookAgent(
  configService: ConfigService<EnvironmentVariables, true>,
): Dispatcher {
  const timeout = configService.get('HTTP_TIMEOUT', { infer: true });
  const maxRetries = configService.get('HTTP_MAX_RETRIES', { infer: true });
  const keepAliveTimeout = configService.get('HTTP_KEEP_ALIVE_TIMEOUT', {
    infer: true,
  });
  const connectionsPerHost =
    configService.get('HTTP_CONNECTIONS_PER_HOST', { infer: true }) ?? null;
  const clientTtl = configService.get('HTTP_CLIENT_TTL', { infer: true });

  // Requests target the webhook hostname, so each host has its own pool and
  // TLS servername, and Node picks the address family on connect, falling back
  // to IPv4 when IPv6 is unreachable. Rewriting the origin to a resolved IP, as
  // undici's DNS interceptor does, loses both.
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
    // Retire sockets periodically. A long-lived socket pins a busy host to a
    // single IP, so a load balancer rotating instances is never noticed.
    clientTtl,
  });

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
  imports: [TypeOrmModule.forFeature([Webhook]), CacheModule.register()],
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
