## Project Overview

`safe-events-service` consumes Safe indexing events from the Transaction Service (via RabbitMQ) and delivers them as HTTP webhooks.

## Team and Project Context

- **Team**: Platform
- **Repository**: `safe-global/safe-events-service`

## Linear Guidelines

- Create issues under team **Platform**
- **Tags**: `Backend`, `Events Service`

## Toolchain & commands

- **Node 24** (`>=24.0.0`), **pnpm 10** via corepack. Install: `corepack enable && pnpm install --frozen-lockfile`.
- Build: `pnpm build` (`nest build`). Run: `pnpm start` / `pnpm start:dev` (watch).
- Lint: `pnpm lint` (eslint `--fix`). Format: `pnpm format` (prettier).
- Tests need RabbitMQ + Postgres up and **`web` must NOT be running** (it would consume the queue messages the tests assert on).
  - One-shot: `bash ./scripts/run_tests.sh` (brings up `rabbitmq db db-migrations`, runs the suite).
  - Manual: `docker compose up -d rabbitmq db db-migrations` then `pnpm test` (unit) / `pnpm test:e2e` (e2e config at `test/jest-e2e.json`).
  - Single test: `pnpm test -- src/modules/webhook/webhookDispatcher.service.spec.ts` or `pnpm test -- -t "partial test name"`.
- Tests run under `NODE_OPTIONS=--experimental-vm-modules` (ESM deps like AdminJS) — keep that when invoking jest directly.

## Migrations

The unit-test DB uses `synchronize` (no migrations); the dockerized **migrations DB** is the one migrations target. After adding/changing a TypeORM entity, register it in `src/datasources/db/database.options.ts`, then generate:

```bash
bash ./scripts/db_generate_migrations.sh MIGRATION_NAME
```

## Architecture

The whole service is one NestJS app (`src/app.module.ts`). The core data flow lives in three modules:

- **`datasources/queue`** — `QueueProvider` connects to RabbitMQ via `amqp-connection-manager`, asserts a **fanout** exchange + durable queue, sets `prefetch` (`AMQP_PREFETCH_MESSAGES`), and exposes `subscribeToEvents(handler)`. The consumer awaits the handler, then `ack`s (manual ack, in a `finally`).
- **`modules/events`** — `EventsService.processEvent()` is the handler: it parses/validates the JSON `TxServiceEvent`, pushes it into an in-memory RxJS `Subject` (for the SSE endpoint), and returns `webhookDispatcher.postEveryWebhook(event)`. Because the consumer awaits this, **a message is only acked after every matching webhook for that event has settled.**
- **`modules/webhook`** — `WebhookDispatcherService` holds an in-memory `Map` of active webhooks, refreshed every minute (`@Cron`). `postEveryWebhook` iterates the cached webhooks, filters by `Webhook.isEventRelevant` (per-`chainId` + per-event-type flags like `sendMultisigTxs`, `sendEtherTransfers`, … stored on the entity), and fires the matches in parallel via `Promise.all`. HTTP is done with **undici** `RetryAgent` (the agent is provided via the `UNDICI_AGENT` DI token in `webhook.module.ts`).

Key behaviors worth knowing before changing the dispatch path:

- **Retries are awaited inline.** `RetryAgent` retries (`HTTP_MAX_RETRIES`, default 2) with backoff *inside* the single `agent.request` await, so a slow/failing target holds its prefetch slot for the whole retry chain — `(retries+1) × HTTP_TIMEOUT + backoff` — and blocks that message's ack. This couples one slow URL to overall consumer throughput (head-of-line blocking). Retryable set is an explicit allow-list of status codes (5xx) and undici error codes in `webhook.module.ts` — note undici's HTTP/2 stream-timeout error (`UND_ERR_INFO`) is **not** retryable.
- **undici negotiates HTTP/2 by default** (undici 8 sets `allowH2` true at the connector); targets that advertise `h2` via ALPN get HTTP/2 even though the code never sets it.
- **Webhook health / auto-disable** (`checkWebhooksHealth`, also on the minute cron): tracks per-webhook success/failure stats over `WEBHOOK_HEALTH_MINUTES_WINDOW`; if failure rate exceeds `WEBHOOK_FAILURE_THRESHOLD` it disables the webhook **only when `WEBHOOK_AUTO_DISABLE=true`** (off by default — otherwise it just logs a warning).
- Response bodies are read with a byte cap (`WEBHOOK_MAX_RESPONSE_BYTES`) — they're only used for logging.

## Endpoints & admin

- `/health` (Terminus), `/events/sse/{CHECKSUMMED_SAFE_ADDRESS}` (server-sent events, filtered from the RxJS subject; gated by `SSE_AUTH_TOKEN` Basic auth when set), and `/admin` (**AdminJS** panel over the DB models, ESM-only, mounted via `modules/admin/adminjs.ts`).
- AdminJS sits behind proxy middleware (`middleware/admin-proxy.middleware.ts`, `reverse-proxy.middleware.ts`) that rewrites asset paths so the panel works under `URL_BASE_PATH`. AdminJS assets live under a `.pnpm` dotfile dir, so static serving must allow dotfiles (`dotfiles: 'allow'`) or the assets 404 under pnpm.

## Conventions

- Config is **env-only** via `@nestjs/config`; the full list with defaults is the table in `README.md`. Read config through `ConfigService.get(KEY, default)` rather than hard-coding.
- Event payloads are deliberately **minimal** (a signal to re-query the Transaction Service, not a source of truth) and events are sent **without waiting for block confirmation** (no reorg-revert notifications). Don't add fields to event DTOs to "save a query" — that's an explicit product decision.
- Licensing cut-over: code up to 2026-02-16 is MIT (`sef-mit-final` tag); newer code is FSL-1.1. See `LICENSE`/`NOTICE`.
