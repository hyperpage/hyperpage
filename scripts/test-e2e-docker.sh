#!/usr/bin/env bash

# Wrapper for dockerized Playwright/Next.js stack that always tears down containers.
# This lets `npm run test:e2e:docker` behave deterministically even when tests fail.

set -euo pipefail

COMPOSE_FILE="__tests__/e2e/docker-compose.e2e.yml"
COMPOSE_CMD=(docker compose -f "$COMPOSE_FILE" --profile e2e)

cleanup() {
  "${COMPOSE_CMD[@]}" down -v >/dev/null 2>&1 || true
}

trap cleanup EXIT

"${COMPOSE_CMD[@]}" up --abort-on-container-exit --build
