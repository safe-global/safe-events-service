## Description

Handle Safe indexing events from Transaction Service and deliver as HTTP webhooks

## Installation

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

```bash
cp .env.sample .env

docker compose up -d

# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```
