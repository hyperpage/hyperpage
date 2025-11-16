# Scaling & High Availability Notes

Hyperpage runs happily on a single node, but parts of the codebase provide hooks for multi-process deployments. This document captures what is implemented today and which ideas remain experimental.

## 1. Session Management (Shipped)

`SessionManager` (`lib/sessions/session-manager.ts`) stores UI state, tool authentication metadata, and request context. Key details:

- **Primary store**: Redis (configurable via `REDIS_URL`).
- **Fallback**: In-memory map for local development or when Redis is unavailable. Expect resets on server restart.
- **API surface**: `/api/sessions` implements `GET`, `POST`, `PATCH`, and `DELETE` handlers with strict parameter validation.
- **Data shape**: See the `SessionData` interface inside the manager for fields such as `preferences`, `uiState`, `toolConfigs`, and `authenticatedTools`.
- **TTL**: 24 hours. Cleanup runs hourly when Redis is connected.

When deploying multiple application instances, ensure all pods/servers point to the same Redis instance so session IDs remain valid across requests.

## 2. Pod Coordinator (Experimental)

`lib/coordination/pod-coordinator.ts` implements a Redis Pub/Sub helper plus a simple leader-election loop. It is not wired into the runtime yet, but you can experiment with it if you need coordinated background jobs.

Capabilities:

- Broadcast or pod-targeted messages using Redis channels (`hyperpage:coord:*`).
- Leader election using a shared Redis key + heartbeat cadence.
- Message handlers per event type (cache invalidation, rate-limit sync, etc.).

Limitations:

- No environment flag enables it today; you have to instantiate and integrate it manually.
- Throughput and failure-handling characteristics have not been validated in production.
- There are no provided Kubernetes manifests or Helm charts—bring your own orchestration if you need cluster-wide coordination.

Treat this module as a reference implementation. If you decide to deploy it, add monitoring, wrap it in feature flags, and update this document with real-world lessons.

## 3. Deployment Considerations

- **Redis**: Whether you deploy via Docker Compose, managed Redis, or another host, keep latency low. The session manager writes synchronously.
- **PostgreSQL**: Use a managed instance or container. All persistence flows through Drizzle; there is no SQLite fallback.
- **Docker Compose**: `docker-compose.prod.yml` / `docker-compose.staging.yml` wire the app, Postgres, and Redis for single-node setups. Scale horizontally by running multiple app containers against the same Postgres + Redis stack and putting a load balancer in front.
- **Monitoring**: `/api/metrics` exposes gauges/counters for cache size, rate limits, and connection pools. Scrape it to detect coordination failures or session spikes.

## 4. Future Work

- Wire the PodCoordinator into background jobs or cache invalidation flows once the behaviour is validated.
- Provide tested deployment guides for managed Kubernetes or Nomad clusters if the project adopts them. Until then, remove any references to non-existent manifests.
- Expand automated tests that simulate multiple Node processes sharing Redis to ensure session locking behaves as expected.

This file will evolve as the scaling story matures. If you remove or add functionality (session TTLs, coordination hooks), describe the new behaviour here so operators know what to expect.
