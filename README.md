[![CI](https://github.com/safe-global/safe-events-service/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/safe-global/safe-events-service/actions/workflows/ci.yml)
[![Coverage Status](https://coveralls.io/repos/github/safe-global/safe-events-service/badge.svg?branch=main)](https://coveralls.io/github/safe-global/safe-events-service?branch=main)
![Docker Image Version (latest by date)](https://img.shields.io/docker/v/safeglobal/safe-events-service?sort=date)
![Node required Version](https://img.shields.io/badge/node-%3E%3D18-green)

# User documentation

## Description

Handle Safe indexing events from Transaction Service and deliver as HTTP webhooks.
This service should be connected to the [Safe Transaction Service](https://github.com/safe-global/safe-transaction-service):

- Transaction service sends events to RabbitMQ.
- Events service holds a database with services to send webhooks to, and some filters like `chainId` or `eventType` can be configured.
- Events service connects to RabbitMQ and susbscribes to the events. When an event matches filters for a service, a webhook is posted.

![Events Service Diagram](./docs/img/events.png)

## Events supported

Some parameters are common to every event:

- `address`: Safe address.
- `type`: Event type.
- `chainId`: Chain id.

### Multisig Confirmation

```json
{
  "address": "<Ethereum checksummed address>",
  "type": "NEW_CONFIRMATION",
  "owner": "<Ethereum checksummed address>",
  "safeTxHash": "<0x-prefixed-hex-string>",
  "chainId": "<stringified-int>"
}
```

### MultisigTransaction (executed)

```json
{
  "address": "<Ethereum checksummed address>",
  "type": "EXECUTED_MULTISIG_TRANSACTION",
  "safeTxHash": "<0x-prefixed-hex-string>",
  "failed": <bool>,
  "txHash": "<0x-prefixed-hex-string>",
  "chainId": "<stringified-int>"
}
```

### MultisigTransaction (proposed, not executed)

```json
{
  "address": "<Ethereum checksummed address>",
  "type": "PENDING_MULTISIG_TRANSACTION",
  "safeTxHash": "<0x-prefixed-hex-string>",
  "chainId": "<stringified-int>"
}
```

## Multisig transaction deleted

```json
{
  "address": "<Ethereum checksummed address>",
  "type": "DELETED_MULTISIG_TRANSACTION",
  "safeTxHash": "<0x-prefixed-hex-string>",
  "chainId": "<stringified-int>"
}
```

### Incoming Ether

```json
{
  "address": "<Ethereum checksummed address>",
  "type": "INCOMING_ETHER",
  "txHash": "<0x-prefixed-hex-string>",
  "value": "<stringified-int>",
  "chainId": "<stringified-int>"
}
```

### Incoming/Outgoing token (ERC20)

```json
{
"address": "<Ethereum checksummed address>",
"type": "INCOMING_TOKEN" | "OUTGOING_TOKEN",
"tokenAddress": "<Ethereum checksummed address>",
"txHash": "<0x-prefixed-hex-string>",
"value": "<stringified-int>",
"chainId": "<stringified-int>"
}
```

### Incoming/Outgoing tokens (ERC721)

```json
{
"address": "<Ethereum checksummed address>",
"type": "INCOMING_TOKEN" | "OUTGOING_TOKEN",
"tokenAddress": "<Ethereum checksummed address>",
"txHash": "<0x-prefixed-hex-string>",
"tokenId": "<stringified-int>",
"chainId": "<stringified-int>"
}
```

### Message created/confirmed

```json
{
"address": "<Ethereum checksummed address>",
"type": "MESSAGE_CREATED" | "MESSAGE_CONFIRMATION",
"messageHash": "<0x-prefixed-hex-string>",
"chainId": "<stringified-int>"
}
```

# Developer documentation

## Installation

Node 18 LTS is required.

```bash
$ npm install
```

## Running the app

Docker compose is required to run RabbitMQ and Postgres

```bash
cp .env.sample .env

docker compose up -d

# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Test

Note: It's important that `web` is not running during tests, as it can consume messages
and tests will fail.

```bash
cp .env.sample .env
```

Simple way:

```bash
bash ./scripts/run_tests.sh
```

Manual way:

```bash
docker compose down
docker compose up -d rabbitmq db db-migrations
# unit tests
npm run test

# e2e tests
npm run test:e2e

# test coverage
npm run test:cov
```

## Creating database migrations

By default, the local dockerized migrations database will be used (test should not be used as it doesn't use migrations).
To use a custom database for migrations, set `MIGRATIONS_DATABASE_URL` environment variable.

Remember to add the new database entities to `./src/datasources/db/database.options.ts`

```bash
bash ./scripts/db_generate_migrations.sh RELEVANT_MIGRATION_NAME
```

## Endpoints

Available endpoints:

- /health/ -> Check health for the service.
- /admin/ -> Admin panel to edit database models.
- /events/sse/{CHECKSUMMED_SAFE_ADDRESS} -> Server side events endpoint. If `SSE_AUTH_TOKEN` is defined then authentication
  will be enabled and header `Authorization: Basic $SSE_AUTH_TOKEN` must be added to the request.
