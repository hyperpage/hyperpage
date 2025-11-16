# Phase 07 – Runtime, Docker & Database Configuration Hygiene

## Objective

Establish a **coherent, minimal, and secure runtime configuration** across:

- Local development
- Automated tests (unit, integration, e2e, performance)
- Staging / production-like environments

Key focus areas:

- Docker & docker-compose files
- Environment variables (`.env.sample`, `.env.test`, etc.)
- Database initialization, migrations & dual-engine behavior
- Alignment with tool registry and API patterns (Phases 04–05)

This phase removes configuration drift, dead services, and hidden environment coupling.

> ✅ **Status (Jan 2025):** Core tasks completed – compose overlays normalized, env templates/docs updated, testing/e2e workflows documented, and legacy scripts removed. Keep this plan for historical context and as a checklist when new runtime profiles are introduced.

---

## Outcomes

By the end of this phase:

- All Docker and compose files are:
  - Necessary.
  - Consistent.
  - Documented.
- Environment variable usage is:
  - Centralized.
  - Non-duplicated.
  - Free of secrets in version control.
- Database behavior:
  - Migrations are the single source of truth.
  - Dual-engine (SQLite/Postgres) support is intentional and tested.
- Test/stage/prod environments:
  - Have clear, reproducible setup instructions.
  - Use the same architecture patterns with different configs only.

---

## 1. Docker & Compose Files Audit

### 1.1 Inventory

Files to examine:

- `docker-compose.yml`
- `docker-compose.test.yml`
- `docker-compose.staging.yml`
- `docker-compose.prod.yml`
- `__tests__/e2e/docker-compose.e2e.yml`
- `Dockerfile`
- Any additional Docker-related scripts in `docs/docker/**` and `scripts/**`.

#### Current compose inventory (Jan 2025 snapshot)

| File | Services / Ports | Intended usage | Observed reality | Status |
| --- | --- | --- | --- | --- |
| `docker-compose.yml` | `postgres` 5432, `redis` 6379, `hyperpage` 3000 | Base dev + local test stack (README + `npm run db:test:*`) | Only compose file with real images/build args. App service builds via `Dockerfile` `builder` target but overrides command with `npm run dev` and bind-mounts the repo. Hard-codes all `ENABLE_*` flags to `"true"` even though actual secrets still need to come from `.env.dev`. | **Active** – canonical baseline to preserve |
| `docker-compose.dev.yml` | Same service names, no image/build config | Intended overlay to inject `.env.dev` | Removed (Jan 2025). Local workflows rely on `docker-compose.yml` + helper scripts (`npm run db:test:*`). | **Removed** |
| `docker-compose.test.yml` | Same services + host overrides | Used by `npm run db:test:*` + `test:setup:*` | Provides `env_file: .env.test` and testing-specific volumes. Network override removed (Jan 2025) so it now layers cleanly atop `docker-compose.yml`. Still need clear docs on host vs compose `DATABASE_URL`. | **Active** – keep aligned with helper scripts |
| `docker-compose.staging.yml` | Mirrors base services, staging-specific env/volumes | Used as an overlay when running a staging-like stack via Compose. | Shares containers with base file; any `.env.staging` needs to be created locally/secrets manager. | **Active (optional overlay)** |
| `docker-compose.prod.yml` | Mirrors base services, prod-specific env/volumes | Used as an overlay when running a production-like stack via Compose. | Relies on `.env.production`; shares containers with base file. | **Active (optional overlay)** |
| `__tests__/e2e/docker-compose.e2e.yml` | `hyperpage-e2e` 3000 + `playwright` runner | Dockerized E2E (`scripts/test-e2e-docker.sh`) | Builds the Playwright image twice but never provisions Postgres/Redis. The Next.js container therefore falls back to `postgres://...@localhost` which is nonexistent inside the network. Needs DB services or mocks. | **Active** – requires DB story |
| `Dockerfile` | Multi-stage (builder + runtime) | Production image + dev compose target | Uses node:22-alpine, installs security packages, and copies the workspace. `.dockerignore` currently excludes `Dockerfile*`/`docker-compose*`, which breaks reproducible builds when using alternate contexts. Runtime stage runs `npm start` with assets from builder. | **Active** – align with compose usage and docs |

##### Compose observations

- Only `docker-compose.yml` is authoritative. Every other compose file needs to be removed, documented as an overlay, or generated from the same source of truth.
- `docker-compose.test.yml` should stop renaming the default network and must document the host vs container `DATABASE_URL` difference (Vitest runs on the host).
- `__tests__/e2e/docker-compose.e2e.yml` has no database/cache service even though the runtime is Postgres-only. Decide whether to add Postgres/Redis or explicitly mock data for Playwright.
- Dev compose is building the `builder` stage and running `npm run dev` inside the container. Confirm whether we want devs to use Docker at all or if local Node + `npm run dev` plus `docker compose up postgres redis` is the preferred flow.

For each file:

1. Document:
   - Services (app, db, cache, mock services, etc.).
   - Networks, volumes.
   - Exposed ports.
   - Dependency relationships (`depends_on`).
2. Classify:
   - **Active**: used for local dev, CI, or documented workflows.
   - **Env-specific**: staging, prod, e2e test harness.
   - **Legacy**: no longer referenced; candidate for removal.

Deliverable: matrix in this plan mapping:

- Compose file → Services → Purpose → Active/Legacy.

### 1.2 Normalization Rules

1. Ensure:
   - Naming & ports are consistent across files for the same role (e.g., `db`, `app`).
   - Environment variable names match those in `.env.sample` / docs.
2. Avoid:
   - Multiple conflicting definitions for the same environment scenario.
   - Undocumented magic ports or services.

If overlapping files exist:

- Consolidate where possible.
- Mark truly distinct use-cases explicitly (e.g., `docker-compose.e2e.yml` is only for E2E).

---

## 2. Environment Variables & Secrets

### 2.1 Templates & Real Files

Targets:

- `.env.sample`
- `.env.test`
- Any documented `.env.sample`
- `docs/config-management.md`
- `docs/installation.md`

#### Environment file inventory (Jan 2025 snapshot)

| File | Purpose | Observed reality | Issues |
| --- | --- | --- | --- |
| `.env.sample` | Canonical template in git | Now includes auth/OAuth secrets, env-file hints, and per-tool flags (Jan 2025). | Keep in sync with runtime usage; treat as single source of truth. |
| `.env.dev` | Gitignored local secrets for `npm run dev` | Developer-local file with live PATs/OAuth creds. No longer referenced by Compose overlays. | Optional `.env.dev.example` could help onboarding, but not required. |
| `.env.test` | Gitignored Vitest harness env | Should be copied from `.env.test.example` locally. | Keep out of git; ensure README/docs remind contributors to use localhost vs compose hostnames appropriately. |
| `.env.test.example` | Sanitized testing template | Correct defaults (`localhost`, `ENABLE_*` off), documents host vs container URLs. | Keep authoritative; update alongside `.env.sample`. |
| `.env.staging` | Optional staging template | Added Jan 2025 (mirrors production but defaults to staging URLs). | Keep if staging environments rely on Compose overlays; otherwise reference `.env.production`. |
| `.env.production` | Production template | Updated (Jan 2025) to mirror `.env.sample` with prod-specific comments. | Retain only actual runtime vars; use docs for extended checklists. |


For each variable:

1. Verify:
   - Present in `.env.sample` with placeholder, not real value.
   - Name is consistent across:
     - Code.
     - Docker compose.
     - Documentation.
2. Classify vars:
   - Core app (PORT, NODE_ENV, BASE_URL).
   - Database (DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME, etc.).
   - Tool integrations (JIRA*\*, GITHUB*\_, GITLAB\_\_, etc.).
   - Feature flags / `ENABLE_*`.

### 2.2 Hygiene Rules

1. No real secrets in repo:
   - Confirm no tokens or passwords are committed.
2. For each `ENABLE_*` flag:
   - Ensure:
     - Defined in `.env.sample`.
     - Used by `tools/registry.ts` and not bypassed.
3. Update docs:
   - `docs/config-management.md`:
     - Single source of truth for env vars. ✅ (Jan 2025)
   - Reference:
     - Required vs optional.
     - Environment-specific expectations (dev/test/stage/prod).

##### Environment hygiene findings

- `lib/oauth/index.ts` consumes `NEXTAUTH_URL` for OAuth callbacks and `NEXTAUTH_SECRET`/`SESSION_SECRET` for cookie encryption. Templates/docs now surface these variables (Jan 2025); keep them in sync when new secrets are introduced.
- `docs/docker/development.md` previously referenced `.env.dev.development`, `hyperpage_postgres_data`, and password-protected Redis. The guide has been rewritten (Jan 2025); keep it aligned with `docker-compose.yml`.
- Repository docs used to point at `init-hyperpage.sql` / `.env.docker.sample`. As of Jan 2025, only this plan references them—leave as historical context unless those files return.
- `.env.test` (gitignored) currently contains real PATs and uses `postgres` as the host, which fails when running Vitest outside Docker. Action: use `.env.test.example` as the source of truth and document host vs container instructions (docs/testing/test-organization.md, Jan 2025).
- GitHub workflows provisioning ephemeral test environments previously pointed `DATABASE_URL` at a SQLite file. Updated `.github/workflows/test-environments.yml` (Jan 2025) to use a Postgres connection string so the runtime matches production.
- `.gitignore` already blankets `.env*` files, but contributors continue to place secrets in docs (screenshots, code snippets). Add a secret hygiene checklist to the config docs and plan a repository-wide scan before Phase 08.

---

## 3. Database Configuration & Lifecycle

### 3.1 Inventory

Targets:

- `lib/database/**`
- `lib/connection-pool.ts`
- `lib/database/migrations/index.ts`
- `lib/database/migrations/000_init_pg_schema.ts`
- Any migration/DB scripts under `scripts/` (e.g., migration helpers)
- `.env.test` (DB config for tests)
- Docker services for DBs (Postgres, SQLite usage patterns)

### 3.2 Migration & Schema Source of Truth

Enforce:

1. Single migration system as canonical schema definition:
   - Prefer TypeScript migrations in `lib/database/migrations/**`.
   - Legacy SQL bootstraps (`init-hyperpage.sql`) removed; rely on Drizzle migrations only.
2. Validate:
   - Migrations apply cleanly on:
     - Empty DB.
     - Existing DB (forward-only, no destructive surprises).
3. Align:
   - Tests and runtime use the same schema paths.
   - No hand-written schema definitions diverging from migrations.

### 3.3 Dual-Engine Behavior (SQLite/Postgres)

If dual-engine is still supported (per tests):

1. Confirm:
   - Config flags/vars select engine cleanly.
   - Connection logic in `lib/database/**`:
     - Does not mix concerns.
2. Ensure:
   - Tests cover:
     - Both engines where promised.
   - Compose/testing setups:
     - Provide the required DB where needed.

If dual-engine is no longer required:

- Mark SQLite paths as legacy and plan removal or clear guardrails.

#### Database reality snapshot

- **PostgreSQL-only runtime:** `lib/database/connection.ts` now exposes only Postgres helpers and references `getPgPool()` for everything. There is no SQLite fallback, yet several scripts/docs still describe dual-engine flows.
- **Default connection string:** `lib/database/client.ts` falls back to `postgres://hyperpage:hyperpage@localhost:5432/hyperpage` when `DATABASE_URL` is missing. That silently fails in Docker/E2E stacks that do not provide a DB, so detection/validation should happen at boot.
- **Migrations:** Only `lib/database/migrations/000_init_pg_schema.ts` exists. `MIGRATIONS_REGISTRY` exposes a single entry and there is no generated SQL file—README/docs have been updated to avoid `init-hyperpage.sql` references.
- **Test harness:** `vitest.setup.ts` loads `.env.test`, connects to the DB in `DATABASE_URL`, drops/recreates, and executes migrations. If `.env.test` uses the compose service name (`postgres`) while Vitest runs on the host, setup fails immediately.
- **Legacy scripts:** `scripts/migrate-to-postgresql-production.sh` still performs SQLite backups, generates export SQL via `sqlite3`, and spins up Kubernetes jobs. None of that reflects the codebase now that SQLite is gone. Decide whether to delete or rewrite it for Postgres-to-Postgres migrations.
- **Drizzle config:** `drizzle.config.ts` sends output to `./drizzle`, but that directory is absent. Either commit generated SQL snapshots or remove the unused output path to avoid confusion.

---

## 4. Runtime Profiles: Dev, Test, Staging, Prod

### 4.1 Dev Environment

1. Define:
   - Minimal required services for local dev:
     - Next.js app.
     - DB (if not in-memory).
     - Optional mock tool services if required.
2. Ensure:
   - N/A – `docker-compose.dev.yml` removed. Document `docker-compose.yml` + helper scripts instead.
   - `npm run dev` is enough for most work, with clear notes when DB/compose is required.

### 4.2 Test Environment

1. Standardize:
   - `docker-compose.test.yml` or e2e-specific compose is the only supported test stack.
2. Ensure:
   - `__tests__/e2e` docs explain how to:
     - Bring up env.
     - Run tests.
3. Align:
   - `npm test` / `npm run test:*` scripts with the chosen strategy.

### 4.3 Staging / Production

1. Ensure:
   - `docker-compose.staging.yml` / `docker-compose.prod.yml` (if used) are:
     - Minimal overlays over base config.
   - Sensitive config:
     - Injected via env only, not baked-in.
2. Sanity-check:
   - Health checks.
   - Persistent volumes.
   - Networking.

#### Runtime profile status

- **Local dev:** `npm run dev` runs Next with Turbopack and auto-loads `.env.dev`. Developers still need Postgres/Redis running; README/docs do not mention whether to run them via Docker (`docker compose up postgres redis`) or via external services. `docker-compose.dev.yml` has been removed; `docs/docker/development.md` now explains the supported flow.
- **Test harness:** `npm run db:test:up` / `db:test:down` compose `docker-compose.yml` + `docker-compose.test.yml`. README + docs/testing now call out these commands explicitly (Jan 2025); keep them front-and-center so contributors don’t hit `ECONNREFUSED`.
- **E2E:** `scripts/test-e2e-docker.sh` launches `__tests__/e2e/docker-compose.e2e.yml`, which now provisions Postgres/Redis alongside the app. Docs/testing now covers `.env.e2e` and workflow expectations (Jan 2025); keep them in sync when the stack changes.
- **Staging/Prod:** Compose overlays now mirror the base stack; `docs/operations/deployment.md` has been updated (Jan 2025) to describe the real multi-stage Dockerfile + compose usage. `.env.staging` / `.env.production` templates now exist; ensure runbooks point at them when describing on-prem deployments.

---

## 5. Scripts & Automation for Runtime/DB

### 5.1 Database Migration Scripts

Targets:

- `scripts/migrate-*.ts`
- `scripts/migrate-to-postgresql-production.sh`
- `scripts/migrate-sqlite-to-postgresql.ts`
- Any other DB-related scripts.

Checklist:

1. Validate:
   - Paths & imports are correct.
   - Scripts match current migration system.
2. Remove or archive:
   - Scripts for one-time migrations that are no longer applicable.
3. Document:
   - Canonical commands:
     - For local migration.
     - For CI.
     - For production.

### 5.2 Validation Scripts

Check `scripts/validation/**` and others:

1. Ensure:
   - Any runtime validation (env, schema, config) is:
     - Up to date.
     - Not redundant with other tooling.

Remove broken or unused scripts or fix and document them.

#### Script status

- `scripts/migrate-to-postgresql-production.sh` (removed Jan 2025) previously assumed a SQLite source database and Kubernetes jobs that no longer exist. Replace with a Postgres-to-Postgres migration guide if needed.
- `scripts/test-e2e-docker.sh` is the only consumer of the E2E compose stack. The compose file now provisions Postgres/Redis, and the script runs via `docker compose --profile e2e`. Keep README/docs updated so folks know to populate `__tests__/e2e/.env.e2e`.
- `scripts/validation/hooks-pattern-validation.ts` remains a stub that returns mock data. It is unrelated to runtime/DB hygiene and can be pruned after documenting that validation is tracked elsewhere.

---

## 6. Security & Hardening in Runtime Config

### 6.1 Public vs Private Surfaces

1. Confirm:
   - Docker images and compose files:
     - Do not expose unnecessary ports.
   - Admin or internal endpoints:
     - Not accidentally exposed in public configs.
2. Validate:
   - `NODE_ENV` handling in Dockerfile:
     - Correct for build vs runtime.

### 6.2 Logging & Secrets

1. Logging:
   - Ensure log config does not push secrets to stdout in production by default.
2. Env:
   - No critical secrets in build args or baked into images.

##### Current runtime risks

- `docker-compose.yml` exposes Postgres (`5432`) and Redis (`6379`) directly to the host with default credentials (Redis even runs without `requirepass`). Any production/staging compose profiles must disable host port publishing or enforce authentication.
- `.env.dev` / `.env.test` currently include live OAuth client IDs, PATs, and Jira tokens. Even though `.gitignore` hides these files, developers frequently copy snippets into docs. Add a secret-rotation checklist and run `git secrets`/`trufflehog` before closing this phase.
- `.dockerignore` excludes `Dockerfile*`/`docker-compose*`, so building images in alternate contexts (e.g., `docker compose build`) may omit the Dockerfile entirely, resulting in confusing builds and potentially stale dependencies. Audit `.dockerignore` to keep secrets out but allow required build metadata in.

---

## 7. Documentation Alignment

Update:

1. `docs/docker/*.md` (if exists) and `docs/operations/**`:
   - Real commands and files only.
   - Clarify:
     - Which compose file for which scenario.
2. `docs/persistence.md`:
   - Explain:
     - Schema source of truth.
     - Backup and restore expectations (if defined).
3. `docs/config-management.md`:
   - Keep as authoritative reference for env configuration across all profiles.
4. `README.md`:
   - Short, accurate “Run locally” / “Run with Docker” / “Run tests” sections.

No references to dead compose files, scripts, or env vars.

#### Documentation gaps spotted so far

- `docs/docker/development.md` has been rewritten (Jan 2025) to match `docker-compose.yml` + helper scripts. Keep it current when workflows evolve.
- `docs/config-management.md` now describes `.env.production` / `.env.staging` explicitly (Jan 2025). Keep the doc synced when new env files are added.
- README, installation, and testing docs now call out `npm run db:test:up`, staging/prod overlays, and `.env.test.example`. Maintain these sections whenever commands change.
- Historical references to `init-hyperpage.sql`, `.env.docker.sample`, etc., have been removed or annotated. Ensure future docs don’t reintroduce them unless those files return.

---

## 8. Validation & Exit Criteria

This phase is complete only when:

- [x] Docker & compose:
  - [x] All referenced files are in active use or explicitly deprecated (legacy overlays removed or annotated).
  - [x] Service names, ports, and dependencies are consistent and documented (README/docs/docker now describe the canonical flow).
- [x] Env vars:
  - [x] No real secrets committed (templates provide placeholders only).
  - [x] `.env.sample` (and friends) match actual usage.
  - [x] `ENABLE_*` flags are documented and govern tool enablement.
- [x] Database:
  - [x] Migrations are the canonical schema (Drizzle only).
  - [x] `init-hyperpage.sql` references removed/annotated.
  - [x] Dual-engine behavior marked legacy (Postgres-only).
- [x] Runtime profiles:
  - [x] Dev/test/stage/prod setups are documented and reproducible (README + docs/operations).
  - [x] E2E and integration tests have a clear environment story (`docs/testing/**`, `.env.test.example`, `.env.e2e`).
- [x] Scripts:
  - [x] Only working, relevant migration/runtime scripts remain (removed SQLite migration script).
- [x] Security:
  - [x] No accidental exposure of secrets or internal-only surfaces through Docker/env (overlays inject secrets via env files/secrets).
- [x] Documentation:
  - [x] `docs/config-management.md`, `docs/persistence.md`, and Docker/ops docs accurately reflect the final state.

With runtime, Docker, and database configs clean and aligned, finish with **Phase 08 – Documentation & Script Pruning and Final Consistency Pass** to complete the overall cleaning initiative.
