# Performance Middleware & Monitoring

This document describes the performance features that exist in the codebase today and how to operate them. It focuses on deterministic behaviour rather than theoretical throughput claims.

## Current Capabilities

### 1. Response Compression (`lib/api/compression`)

- Applies to JSON responses only.
- Uses Brotli for payloads ≥2 KB when the client supports it; otherwise falls back to gzip.
- Skips compression for small responses (<1 KB) or when the negotiated encoding would not provide meaningful savings.
- Adds debugging headers (`X-Compression-Ratio`, `X-Uncompressed-Size`, `X-Compressed-Size`) so you can inspect effectiveness.
- Controlled in code; there is no separate CLI flag.

### 2. Batch Endpoint (`app/api/batch/route.ts` + `lib/api/batching`)

- Accepts `{ requests: BatchRequest[] }` and executes them sequentially or in parallel.
- Enforces limits (`maxRequests`, per-request timeouts, optional parallel execution) defined in `BatchingMiddleware`.
- Returns a single response with per-request status, headers, body, and duration metrics.
- Persists a low-priority job record summarising the batch execution for observability.

### 3. Adaptive Polling (`useToolQueries` + `lib/rate-limit-utils`)

- Each portal widget declares a base refresh interval.
- Runtime polling shortens or lengthens that interval based on two factors:
  - Rate-limit usage reported by `/api/rate-limit/[tool]` endpoints.
  - Tab visibility / recent user activity.
- Prevents aggressive polling when API quotas are nearly exhausted.

### 4. Metrics Endpoint (`app/api/metrics/route.ts`)

- Exposes Prometheus-compatible gauges/counters for:
  - Cache size, hits, misses, and evictions.
  - Rate-limit usage per tool.
  - HTTP connection-pool statistics.
  - Widget error counts + timestamps.
  - Performance dashboard snapshots.
- Use a metrics scraper or `curl` to inspect `/api/metrics`. Do not expose it publicly without authentication.

## Configuration Reference

```ts
// lib/api/batching/batching-middleware.ts
new BatchingMiddleware(baseUrl, {
  maxRequests: 20,
  defaultTimeout: 30_000,
  maxExecutionTime: 60_000,
  continueOnError: true,
  parallelExecution: true,
});

// lib/api/compression/compression-middleware.ts
ew CompressionMiddleware({
  minSize: 1024,
  level: 6,
  brotliThreshold: 2048,
  includeVaryHeader: true,
});
```

If you need different defaults, change them in code, keep documentation in sync, and add tests that assert the new behaviour.

## Monitoring Checklist

- **Batch endpoint** – log metadata is emitted via Pino; monitor for spikes in `BATCH_ENDPOINT_ERROR` responses.
- **Compression** – inspect the debug headers when debugging payload size. There is no separate counter.
- **Metrics endpoint** – scrape `/api/metrics` and feed into Grafana or another dashboarding tool.
- **Portal telemetry** – `PortalErrorSummary` and `WidgetTelemetryPanel` surface front-end errors; use them during manual testing.

## Future Work (Explicitly Not Implemented Yet)

- Advanced cache tagging or invalidation rules beyond what `CacheFactory` currently exposes.
- Horizontal autoscaling or service-mesh tuning; see `docs/operations/scaling.md` for design ideas.
- Formal throughput guarantees (requests/second). Any such claim would require repeatable benchmarks, which do not exist today.

Use this document as a practical reference for the middleware and telemetry already merged. Update it whenever you change compression defaults, batching limits, or metrics coverage.
