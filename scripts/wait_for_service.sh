#!/bin/bash

if [ -z "$1" ]; then
  echo "Usage: $0 <service_name>"
  exit 1
fi

SERVICE_NAME=$1

TIMEOUT=60
ELAPSED=0


echo "Waiting for $SERVICE_NAME to become healthy..."
# Wait for service until TIMEOUT in seconds
until [ "$(docker inspect --format '{{.State.Health.Status}}' $(docker-compose ps -q $SERVICE_NAME))" == "healthy" ]; do
  if [ $ELAPSED -ge $TIMEOUT ]; then
    echo "Timeout reached. $SERVICE_NAME is not healthy!"
    exit 1
  fi
  echo "Waiting for $SERVICE_NAME..."
  sleep 5
  ((ELAPSED+=5))
done

echo "$SERVICE_NAME is healthy!"
