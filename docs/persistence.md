# Persistence and Schema Guide

## Overview

This document describes how Hyperpage persists data in the **PostgreSQL-only** model, how the schema is defined, and how automated tests verify schema consistency.

Key points:

- PostgreSQL is the canonical and only supported database backend.
- SQLite migrations and helpers are **legacy** and only used in explicitly gated suites.
- The authoritative schema is defined and exercised via:
  - `lib/database/pg-schema.ts`
  - `lib/database/migrations/000_init_pg_schema.ts`
  - The Postgres test harness in `vitest.setup.ts`.

---

## Canonical PostgreSQL Schema

The PostgreSQL schema is defined by:

1. **Runtime types and table definitions**
   - `lib/database/pg-schema.ts`:
     - Exposes typed drizzle table definitions for:
       - `users`
       - `oauth_tokens`
       - `tool_configs`
       - `rate_limits`
       - `jobs`
       - `job_history`
       - `app_state`
       - `user_sessions`
     - These types are consumed across repositories and services as the single source of truth for runtime code.

2. **Drizzle migration**
   - `lib/database/migrations/000_init_pg_schema.ts`:
     - Drizzle-style, PostgreSQL-only migration.
     - Creates tables that match `pg-schema.ts`:
       - `users`: core user records
       - `oauth_tokens`: OAuth tokens per user/provider
       - `tool_configs`: tool configuration per owner
       - `rate_limits`: persisted rate limit state
       - `jobs`: background job queue
       - `job_history`: job execution audit log
       - `app_state`: global key/value state
       - `user_sessions`: session tokens bound to users
     - Includes appropriate primary keys, indexes, and timestamps.
   - This file is the **authoritative migration** for the Postgres schema.

3. **Migration registry**
   - `lib/database/migrations/index.ts`:
     - Exposes:

       ```ts
       export const MIGRATIONS_REGISTRY = {
         "000_init_pg_schema": { up, down },
       };

       export function getMigrationNames(): string[] {
         return Object.keys(MIGRATIONS_REGISTRY).sort();
       }
       ```

     - Provides a stable, programmatic API for applying known migrations.
     - Used by the Postgres test harness as a fallback when drizzle's file-based migrator cannot load `.ts` migrations directly.

---

## Legacy SQLite Migrations (Explicitly Isolated)

Legacy artifacts (kept only for historical reference):

- `lib/database/migrations/001_initial_schema.ts`
- `lib/database/migrations/002_oauth_auth_tables.ts`

Characteristics:

- Schema definitions use:
  - `TEXT` / `INTEGER` columns
  - `unixepoch()`-style timestamps
  - A `schema_migrations` table inside SQLite
- Designed for the original SQLite-based implementation and migration flow.

Current status:

- These files are **retained for historical and migration-only purposes**.
- They are **not used** by:
  - The Postgres runtime.
  - The Postgres test harness.
- They **must not** be added to the Postgres `MIGRATIONS_REGISTRY` or invoked by new tests.
- All active code and tests should rely exclusively on the Postgres schema.

This separation ensures the Postgres schema remains clean and unambiguous.

---

## Test Harness as Schema Guardian

The Postgres test harness (`vitest.setup.ts`) enforces schema consistency automatically.

### Single source of truth

- `DATABASE_URL`:
  - Controls which Postgres instance and database are used.
  - Is required at module load.
  - Drives:
    - The test database name (`dbName`).
    - The admin URL (same host/port, database `postgres`).

### Lifecycle

For Postgres-backed suites:

1. **Setup (once per worker process)**
   - Drop test database via admin URL (best-effort, with connection termination).
   - Create test database.
   - Initialize:
     - `pg.Pool` for `DATABASE_URL`
     - drizzle `NodePgDatabase` with `pg-schema`.
   - Run migrations and verification:
     - See below.

2. **Per-test isolation**
   - Before each test:
     - Clears known tables that exist.
     - Reseeds deterministic fixtures derived from `pg-schema`.
   - Ensures reproducible state for all tests.

3. **Teardown**
   - Closes the pool.
   - Drops the test database via admin URL (best-effort).

### Migrations: primary + fallback

The harness applies migrations in two stages:

1. **Primary: drizzle migrator**

   ```ts
   await migrate(db, { migrationsFolder: "./lib/database/migrations" });
   ```

   - This is the preferred path when the environment can load compiled migrations.

2. **Guardrail: MIGRATIONS_REGISTRY fallback**
   - After `migrate()` completes, the harness checks for a required table:

     ```sql
     SELECT tablename
     FROM pg_tables
     WHERE schemaname = 'public'
       AND tablename = 'app_state';
     ```

   - If `app_state` is missing:
     - Logs a targeted warning.
     - Dynamically imports `{ MIGRATIONS_REGISTRY, getMigrationNames }`.
     - Executes `migration.up` for each name (currently `000_init_pg_schema`) against the same `db`.
     - Re-checks `app_state`.
     - Throws a clear error if the table is still missing.

This design guarantees:

- In environments where drizzle migrator loads migrations correctly:
  - Registry fallback is effectively a no-op.
- In TS/Vitest environments where `.ts` discovery fails:
  - Registry fallback ensures the schema is applied deterministically.
- Any misconfiguration or broken migration surfaces as an explicit, early error.

---

## How Tests Verify Persistence Correctness

Several test suites validate persistence behavior against the canonical Postgres schema:

- Unit / integration suites that exercise:
  - Repositories backed by `pg-schema` tables.
  - Job queue persistence and recovery (`jobs`, `job_history`).
  - Rate limit storage (`rate_limits`).
  - Tool configuration management (`tool_configs`).
  - Application state (`app_state`).
  - Sessions and OAuth tokens (`user_sessions`, `oauth_tokens`).

The harness ensures that for these suites:

1. Schema is ensured via migrations + required table checks.
2. Only tables defined in `pg-schema.ts` are used and seeded.
3. Cleanup logic is schema aware:
   - Only deletes from tables that actually exist.
   - Produces actionable logs on real errors instead of noisy false positives.

This couples the automated tests directly to the same schema definitions used at runtime.

---

## Running With the Canonical Postgres Schema

### Docker-based testing stack

Recommended:

```bash
docker-compose -f docker-compose.yml -f docker-compose.testing.yml up -d postgres
DATABASE_URL=postgresql://postgres:password@postgres:5432/hyperpage-testing npx vitest
```

Or configure `.env.testing` with the same `DATABASE_URL` and run:

```bash
docker-compose -f docker-compose.yml -f docker-compose.testing.yml up -d postgres
npx vitest
```

Notes:

- Host `postgres` is correct inside the docker-compose network.
- The harness will:
  - Connect via `postgres` host.
  - Drop/create `hyperpage-testing`.
  - Apply `000_init_pg_schema` (via drizzle migrator and/or registry).
  - Seed fixtures.

### Local Postgres (no docker-compose)

If using a local Postgres instance:

1. Start local Postgres.
2. Set:

   ```env
   DATABASE_URL=postgresql://postgres:password@localhost:5432/hyperpage-testing
   ```

3. Run:

   ```bash
   npx vitest
   ```

Requirements:

- The user in `DATABASE_URL` must be allowed to create/drop `hyperpage-testing`.
- The harness behavior (drop/create/migrate/seed) is the same.

---

## Concurrency Considerations

Within a single Vitest worker process:

- `vitest.setup.ts` uses:
  - A shared `TestDatabaseManager` instance.
  - An internal `setupPromise` and `isSetupComplete` flag.
- This ensures:
  - Only one setup sequence (drop/create/migrate/seed).
  - All hooks await the same initialization.

Across multiple workers:

- Each worker process has its own `TestDatabaseManager`.
- To avoid concurrent DROP/CREATE of the same test database across workers:
  - Postgres-backed suites should be run in a configuration that effectively uses a single worker for those tests (e.g., project-level `maxWorkers: 1` or dedicated config).
- This is a Vitest configuration concern; the harness is deterministic given a single controlling process.

---

## Summary

- **Source of Truth**:
  - Schema: `pg-schema.ts` + `000_init_pg_schema.ts`.
  - Migration API: `MIGRATIONS_REGISTRY` (Postgres-only entries).
  - Test wiring: `vitest.setup.ts` using `DATABASE_URL`.

- **Legacy Separation**:
  - SQLite migrations and migrator are strictly legacy.
  - Only executed under explicit legacy flags/suites.

- **Safety Guarantees**:
  - Drizzle migrator used first.
  - Registry fallback ensures no-op migrations are detected and corrected.
  - Required-table checks (e.g., `app_state`) prevent silent drift.
  - Seed preflight enforces schema presence before inserting data.
  - Cleanup is schema-aware and quiet when tables are absent.

With these pieces combined, the Postgres-only model maintains a single, consistent schema across runtime and tests, and actively detects configuration or migration issues rather than allowing silent divergence.
