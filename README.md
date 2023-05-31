[![CI](https://github.com/safe-global/safe-events-service/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/safe-global/safe-events-service/actions/workflows/ci.yml)
[![Coverage Status](https://coveralls.io/repos/github/safe-global/safe-events-service/badge.svg?branch=main)](https://coveralls.io/github/safe-global/safe-events-service?branch=main)
![Docker Image Version (latest by date)](https://img.shields.io/docker/v/safeglobal/safe-events-service?sort=date)

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
