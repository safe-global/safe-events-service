#!/bin/bash

# Make sure databases and rabbitmq are clean and no web instances are running
docker compose down

# Start required docker instances
docker compose up -d db db-migrations rabbitmq

# Ensure services are up
sleep 10
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Clean up
docker compose down
