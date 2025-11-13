# Testing Guide

## Overview

This guide documents how to run Hyperpage tests in the Phase 1+ PostgreSQL-only model, including:
- The canonical Postgres-backed testing stack
- Test suite taxonomy and environment flags
- How the Postgres test harness provisions and validates schema
- How to opt into optional/legacy suites safely

All instructions assume:
- PostgreSQL is the only supported runtime and test database backend
- SQLite is legacy/migration-only and exercised only via explicitly gated suites

---

## Canonical Testing Stack (Postgres-only)

### 1. Environment files

Use the provided testing configuration:

- `.env.testing`
  - Defines `DATABASE_URL` that points at the dedicated testing Postgres instance
  - Provides any non-sensitive test configuration
- `.env.testing` is used by:
  - `vitest.setup.ts` to derive connections and manage the test database
  - `docker-compose.testing.yml` as the environment for the testing stack

Values in `.env.testing` must be treated as examples/placeholders in documentation. Do not rely on or commit real credentials.

Recommended values for the docker-based stack:

```env
# .env.testing
DATABASE_URL=postgresql://postgres:password@postgres:5432/hyperpage-testing
```

When running against a locally installed Postgres (no docker-compose), use:

```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/hyperpage-testing
```

### 2. Docker testing stack

Use the testing compose file (layered on the base compose) to bring up a self-contained Postgres for tests:

- `docker-compose.yml` + `docker-compose.testing.yml`
  - Runs the testing Postgres service (e.g. `hyperpage-testing-postgres`)
  - Ensures `DATABASE_URL` (from `.env.testing`) can reach Postgres using host `postgres` inside the compose network

Examples from repo root:

- Start Postgres for tests:

  ```bash
  docker-compose -f docker-compose.yml -f docker-compose.testing.yml up -d postgres
  ```

- Stop stack:

  ```bash
  docker-compose -f docker-compose.yml -f docker-compose.testing.yml down -v
  ```

If you prefer a locally running Postgres instead of docker:

- Ensure the local instance is running
- Ensure `DATABASE_URL` uses `localhost` and a database/user with permission to:
  - Create/drop the `hyperpage-testing` database
  - Run migrations

---

## vitest.setup.ts – Postgres Test Harness

`vitest.setup.ts` is the single source of truth for Postgres test DB wiring.

### Core invariants

- `DATABASE_URL` is **required at module load**.
  - If missing, setup fails fast with clear guidance.
- All Postgres-backed tests run against a **single dedicated test database** derived from `DATABASE_URL`.
- There is no separate `TEST_DATABASE_URL`; everything flows through `DATABASE_URL`.

### How the harness works

Given `DATABASE_URL=postgresql://USER:PASS@HOST:PORT/DB_NAME`:

1. **Derive names and URLs**
   - `dbName` = `DB_NAME` from `DATABASE_URL`.
   - `adminUrl` = same host/port/credentials, but database fixed to `postgres`.
     - Used only for create/drop operations.

2. **Global lifecycle**

   On first use (guarded by an internal `setupPromise`):

   - Drop the test database:
     - Connect via `adminUrl`
     - Terminate active connections to `dbName`
     - `DROP DATABASE IF EXISTS "dbName"`
   - Create the test database:
     - `CREATE DATABASE "dbName"`
   - Initialize:
     - A dedicated `pg.Pool` pointed at `DATABASE_URL`
     - A drizzle `NodePgDatabase` bound to `pg-schema.ts`
   - Run migrations (see below)
   - Seed deterministic test data

   On global teardown:

   - Close the pool
   - Drop the test database via `adminUrl` (best-effort; failures are logged)

3. **Migrations: primary + fallback**

   `TestDatabaseManager.runMigrations()`:

   1. Ensures `lib/database/migrations/meta/_journal.json` exists for drizzle.
   2. Requires `this.db` to be initialized.
   3. Calls drizzle migrator:

      ```ts
      await migrate(this.db, {
        migrationsFolder: "./lib/database/migrations",
      });
      ```

   4. Verifies migration effect using `app_state` as a canary:

      - Executes:

        ```sql
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'public'
          AND tablename = 'app_state';
        ```

      - If `rowCount === 0`:
        - Logs a warning that `migrate()` likely loaded no migrations from `./lib/database/migrations`.
        - Dynamically imports:

          ```ts
          const {
            MIGRATIONS_REGISTRY,
            getMigrationNames,
          } = await import("./lib/database/migrations");
          ```

        - For each name from `getMigrationNames()`:
          - Executes `MIGRATIONS_REGISTRY[name].up(this.db as never)`
        - Re-checks `app_state`; if still missing:
          - Throws a clear error pointing at migration definitions.

   **Authority and compatibility:**

   - `000_init_pg_schema.ts` (drizzle-style, Postgres-only) is the canonical schema migration.
   - `lib/database/migrations/index.ts` exposes:

     ```ts
     export const MIGRATIONS_REGISTRY = {
       "000_init_pg_schema": { up, down },
     };
     ```

     and `getMigrationNames()`; this is used by the fallback.
   - Legacy SQLite migrations (`001_initial_schema.ts`, `002_oauth_auth_tables.ts`) and `lib/database/migrate.ts`:
     - Are **explicitly legacy**.
     - Are **not** used by the Postgres harness.
     - Remain available only for historical SQLite tooling; they must not be added to the Postgres `MIGRATIONS_REGISTRY`.

4. **Seeding and table validation**

Before inserting any data, `seedTestData()`:

- Checks the presence of required tables via `pg_tables`:

  - `app_state`, `jobs`, `users`, `oauth_tokens`, `tool_configs`,
    `rate_limits`, `job_history`, `user_sessions`.

- If any are missing:
  - Logs:

    > Test DB seed preflight failed - migrations likely did not run

  - Throws:

    > Required table "<name>" is missing in test database. Check that drizzle migrations ran successfully before seeding.

Only after all required tables exist does it insert deterministic fixtures, using the strongly-typed `pg-schema` tables.

5. **Cleanup between tests**

`beforeEach`:

- Ensures the database is fully set up (reuses the same `setupPromise`).
- Calls `clearAllTables()`:
  - Enumerates `pg_tables` in `public`.
  - For each known schema table (jobs, job_history, rate_limits, tool_configs,
    app_state, users, oauth_tokens, user_sessions):
    - Deletes rows only if the table exists.
    - Logs warnings only for real delete errors (no noise if tables are absent).
- Calls `seedTestData()` again.

This guarantees:

- Stable schema (or a loud, early failure).
- Deterministic data for every test.
- No misleading cleanup errors when migrations have not run.

6. **Concurrency and workers**

- Within a single Vitest worker process:
  - The global `TestDatabaseManager` + `setupPromise` ensure:
    - Only one DROP/CREATE/migrate/seed sequence runs.
    - All hooks share the same initialized state.

- Across multiple workers:
  - Each worker process runs its own `vitest.setup.ts`, which would:
    - Try to manage the same database concurrently.
  - To avoid cross-worker contention on a global DB:
    - Run Postgres-backed suites in a single worker configuration for now, e.g.:
      - Configure Vitest to run these suites serially (`maxWorkers: 1` or a dedicated project).
    - This keeps behavior deterministic while retaining clear harness semantics.

---

## Test Suite Taxonomy and Flags

Default behavior:

- Running `vitest` (or `npx vitest`) with a valid Postgres `DATABASE_URL`:
  - Executes:
    - Unit tests
    - Hermetic integration tests
    - Postgres-backed repository and workflow tests that do not require external services
  - Skips:
    - E2E, performance, Grafana, and LEGACY SQLite suites (all are opt-in)

Optional suites are enabled via explicit env flags:

### 1. End-to-End and workflow suites

Flag: `E2E_TESTS=1`

Enables:

- `__tests__/e2e/*.spec.ts`
  - Portal flows, rate limit handling, tool integration E2E
- Selected integration/workflow suites that require a more complete stack.

Without `E2E_TESTS=1`, these suites are skipped via guard helpers.

### 2. Tool integration suites (external services)

Pattern:

- `E2E_TESTS=1`
- Plus provider-specific tokens/vars.

Examples:

- GitHub (`__tests__/integration/tools/github.spec.ts`)
  - Requires `E2E_TESTS=1` + `GITHUB_TOKEN` etc.
- GitLab (`__tests__/integration/tools/gitlab.spec.ts`)
  - Requires `E2E_TESTS=1` + `GITLAB_TOKEN` etc.
- Jira (`__tests__/integration/tools/jira.spec.ts`)
  - Requires `E2E_TESTS=1` + `JIRA_API_TOKEN` etc.

If flags/tokens are missing:

- Suites are guarded and skipped; they do not break default runs.

### 3. Performance suites

Flag: `PERFORMANCE_TESTS=1` (optionally with `E2E_TESTS=1`)

Location:

- `__tests__/performance/**`
- `__tests__/integration/performance/**`

Behavior:

- Heavy/timing-sensitive tests are:
  - Skipped by default.
  - Only executed when explicitly requested.

### 4. Grafana dashboard tests

Flags:

- `GRAFANA_TESTS=1` or `E2E_TESTS=1`

File:

- `__tests__/grafana/dashboard.test.ts`

Behavior:

- Validates Grafana dashboard JSON.
- Skipped unless explicitly enabled.

### 5. Legacy SQLite / dual-engine suites

Flag: `LEGACY_SQLITE_TESTS=1`

Purpose:

- Preserve historical/migration semantics for forensic use.
- Ensure they never run in default Postgres-only workflows.

Key suites:

- `__tests__/unit/lib/database/app-state-repository.postgres-and-sqlite.test.ts`
- `__tests__/unit/lib/database/persistence-recovery.test.ts`
- `__tests__/unit/lib/database/session-repository.sqlite.test.ts`
- `__tests__/unit/lib/job-repository.sqlite.test.ts`
- Any similar LEGACY-marked suites.

All such suites:

- Are clearly labeled as LEGACY.
- Use `describe.skip` guards unless `LEGACY_SQLITE_TESTS=1`.

---

## Recommended Commands

From the project root:

### Default Postgres-only run (fast, canonical)

```bash
docker-compose -f docker-compose.yml -f docker-compose.testing.yml up -d postgres
DATABASE_URL=postgresql://postgres:password@postgres:5432/hyperpage-testing npx vitest
```

Or, with `.env.testing` loaded (via direnv or similar) that sets `DATABASE_URL` accordingly:

```bash
docker-compose -f docker-compose.yml -f docker-compose.testing.yml up -d postgres
npx vitest
```

### Run E2E + external tool integrations

```bash
docker-compose -f docker-compose.yml -f docker-compose.testing.yml up -d postgres
E2E_TESTS=1 GITHUB_TOKEN=... GITLAB_TOKEN=... JIRA_API_TOKEN=... npx vitest
```

### Run performance suites

```bash
docker-compose -f docker-compose.yml -f docker-compose.testing.yml up -d postgres
PERFORMANCE_TESTS=1 npx vitest
```

### Run Grafana dashboard tests

```bash
GRAFANA_TESTS=1 npx vitest
```

### Run legacy SQLite/dual-engine suites (explicit, non-default)

```bash
LEGACY_SQLITE_TESTS=1 npx vitest
```

Intended only for migration/forensics, not normal CI.

---

## Invariants

- Postgres is the only supported runtime and canonical test database.
- `DATABASE_URL` is the single source of truth for the test harness:
  - Determines target DB name.
  - Determines host:
    - `postgres` for the docker-compose testing stack.
    - `localhost` for a locally running Postgres.
- The harness:
  - Drops/creates the test DB via the `postgres` admin database.
  - Applies migrations via drizzle migrator, with a verified fallback via `MIGRATIONS_REGISTRY`.
  - Validates schema via required-table checks before seeding.
  - Clears and reseeds between tests for deterministic behavior.
- Legacy SQLite semantics exist only in:
  - `lib/database/migrate.ts`
  - `001_initial_schema.ts`, `002_oauth_auth_tables.ts`
  - `LEGACY_SQLITE_TESTS`-gated suites.
- Optional suites (E2E, external tools, performance, Grafana, legacy SQLite) are:
  - Explicitly opt-in via env flags.
  - Structurally prevented from blocking default Postgres-only runs.

This document reflects the current, working harness and migration behavior for local development and CI in the Postgres-only model.
