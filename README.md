[![CI](https://github.com/safe-global/safe-events-service/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/safe-global/safe-events-service/actions/workflows/ci.yml)
[![Coverage Status](https://coveralls.io/repos/github/safe-global/safe-events-service/badge.svg?branch=main)](https://coveralls.io/github/safe-global/safe-events-service?branch=main)
![Docker Image Version (latest by date)](https://img.shields.io/docker/v/safeglobal/safe-events-service?sort=date)
![Node required Version](https://img.shields.io/badge/node.js-v20-green)

# User documentation

## Description

Handle Safe indexing events from Transaction Service and deliver as HTTP webhooks.
This service should be connected to the [Safe Transaction Service](https://github.com/safe-global/safe-transaction-service):

- Transaction service sends events to RabbitMQ.
- Events service holds a database with services to send webhooks to, and some filters like `chainId` or `eventType` can be configured.
- Events service connects to RabbitMQ and susbscribes to the events. When an event matches filters for a service, a webhook is posted.

![Events Service Diagram](./docs/img/events.png)

## Endpoints

Available endpoints:

- /health/ -> Check health for the service.
- /admin/ -> Admin panel to edit database models.
- /events/sse/{CHECKSUMMED_SAFE_ADDRESS} -> Server side events endpoint. If `SSE_AUTH_TOKEN` is defined then authentication
  will be enabled and header `Authorization: Basic $SSE_AUTH_TOKEN` must be added to the request.

## How to integrate with the service

If you want to integrate with the events service, you need to:
- Build a REST API with an endpoint that can receive `json/application` requests (take a look at [Events Supported](#events-supported)).
- Endpoint need to answer with:
  - `HTTP 202` status
  - Nothing in the body.
  - It should answer **as soon as possible**, as events service will timeout in 2 seconds, if multiple timeouts are detected **service will stop sending requests** to your endpoint. So you should receive the event, return a HTTP response and then act upon it.
  - Configuring HTTP Basic Auth in your endpoint is recommended so a malicious user cannot post fake events to your service.

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
  "to": "<Ethereum checksummed address>",
  "type": "EXECUTED_MULTISIG_TRANSACTION",
  "safeTxHash": "<0x-prefixed-hex-string>",
  "failed": "true" | "false",
  "txHash": "<0x-prefixed-hex-string>",
  "chainId": "<stringified-int>"
}
```

### MultisigTransaction (proposed, not executed)

```json
{
  "address": "<Ethereum checksummed address>",
  "to": "<Ethereum checksummed address>",
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

### Incoming/Outgoing Ether

```json
{
  "address": "<Ethereum checksummed address>",
  "type": "INCOMING_ETHER" | "OUTGOING_ETHER",
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

### Reorg detected

```json
{
"type": "REORG_DETECTED",
"blockNumber": "<int>",
"chainId": "<stringified-int>"
}
```

### Delegates add/update/delete

```json
{
"address": "<Ethereum checksummed address>" | null,
"type": "NEW_DELEGATE" | "UPDATED_DELEGATE" | "DELETED_DELEGATE",
"delegate": "<Ethereum checksummed address>",
"delegator": "<Ethereum checksummed address>",
"label": "<string>",
"expiryDateSeconds": "<int>" | null,
"chainId": "<stringified-int>"
}
```

# FAQ

## Do you have a dashboard/status page?

Not currently.

## Do I need to set up this service to receive the events?

No, this event is only meant to be run by companies running the [Safe Transaction Service](https://github.com/safe-global/safe-transaction-service). You need to develop your own endpoint as explained in [How to integrate with the service](#how-to-integrate-with-the-service)

## Can you please share the delivery delay for the webhook?

Indexing can take 1-2 minutes in the worst cases and less than 15 seconds in good cases.

## Will the webhooks do retries?

Currently no, and please count on that maybe due to some network issues you can lose a webhook. We will work on resilience patterns like retrying or removing an integration if service cannot deliver webhooks for some time.

## Do you plan to have a way to trigger a backfill in case our systems go down?

In case our systems go down, messages should be stored in our queue and when the systems are up resending should be restored (unless queue is overflowed because services have been done for a while and some old messages are discarded).

## Is it available on all chains already?

Yes, and we can configure the [chains you want to get events from](https://docs.safe.global/safe-core-api/supported-networks).

## What safes do we get webhooks requests for?

You get webhooks for all Safes, it currently cannot be configured.

## Could you add more information to the webhook so we don’t have to query the transaction service?

No, we would like to keep webhook information minimal. Doing queries afterwards to the service is ok, but we are not planning on doing the webhooks the source of information for the service. The idea for webhooks is to remove the need for polling the services.

## One thing that could be useful is a unique id for the events:

https://github.com/safe-global/safe-events-service/issues/116

## How do you handle confirmed/unconfirmed blocks and reorgs. When do you send an event? After waiting for confirmation or immediately? If a transaction is removed due to a chain reorg, would you still send the event before it is confirmed?

We don't send notifications when a reorg happens. We send the events as soon as we detect them, no waiting for confirmations. So you should always come to the API and make sure the data is what you expect. This events feature is something built for notifying so we prevent people http polling our API, but it shouldn't be taking the events as a source of trust, only as a signal to come back to the API (that's why we don't send a lot of informations in the events).

# Developer documentation

## Installation

Node 20 LTS is required.

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
