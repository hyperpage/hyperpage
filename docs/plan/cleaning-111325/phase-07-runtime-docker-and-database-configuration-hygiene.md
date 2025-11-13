# Phase 07 – Runtime, Docker & Database Configuration Hygiene

## Objective

Establish a **coherent, minimal, and secure runtime configuration** across:

- Local development
- Automated tests (unit, integration, e2e, performance)
- Staging / production-like environments

Key focus areas:

- Docker & docker-compose files
- Environment variables (`.env.sample`, `.env.testing`, etc.)
- Database initialization, migrations & dual-engine behavior
- Alignment with tool registry and API patterns (Phases 04–05)

This phase removes configuration drift, dead services, and hidden environment coupling.

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
- `docker-compose.dev.yml`
- `docker-compose.testing.yml`
- `docker-compose.staging.yml`
- `docker-compose.prod.yml`
- `__tests__/e2e/docker-compose.e2e.yml`
- `Dockerfile`
- Any additional Docker-related scripts in `docs/docker/**` and `scripts/**`.

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
- `.env.testing`
- Any documented `.env.local.sample`
- `docs/config-management.md`
- `docs/installation.md`

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
   - Tool integrations (JIRA_*, GITHUB_*, GITLAB_*, etc.).
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
     - Single source of truth for env vars.
   - Reference:
     - Required vs optional.
     - Environment-specific expectations (dev/test/stage/prod).

---

## 3. Database Configuration & Lifecycle

### 3.1 Inventory

Targets:

- `lib/database/**`
- `lib/connection-pool.ts`
- `lib/database/migrations/index.ts`
- `lib/database/migrations/000_init_pg_schema.ts`
- `init-hyperpage.sql/**`
- Any migration/DB scripts under `scripts/` (e.g., migration helpers)
- `.env.testing` (DB config for tests)
- Docker services for DBs (Postgres, SQLite usage patterns)

### 3.2 Migration & Schema Source of Truth

Enforce:

1. Single migration system as canonical schema definition:
   - Prefer TypeScript migrations in `lib/database/migrations/**`.
   - `init-hyperpage.sql` used only for bootstrapping where needed.
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

---

## 4. Runtime Profiles: Dev, Test, Staging, Prod

### 4.1 Dev Environment

1. Define:
   - Minimal required services for local dev:
     - Next.js app.
     - DB (if not in-memory).
     - Optional mock tool services if required.
2. Ensure:
   - `docker-compose.dev.yml` (if used) matches docs.
   - `npm run dev` is enough for most work, with clear notes when DB/compose is required.

### 4.2 Test Environment

1. Standardize:
   - `docker-compose.testing.yml` or e2e-specific compose is the only supported test stack.
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

---

## 8. Validation & Exit Criteria

This phase is complete only when:

- [ ] Docker & compose:
  - [ ] All referenced files are in active use or explicitly deprecated.
  - [ ] Service names, ports, and dependencies are consistent and documented.
- [ ] Env vars:
  - [ ] No real secrets committed.
  - [ ] `.env.sample` (and friends) match actual usage.
  - [ ] `ENABLE_*` flags are documented and govern tool enablement.
- [ ] Database:
  - [ ] Migrations are the canonical schema.
  - [ ] `init-hyperpage.sql` (if kept) aligns with migrations or is scoped clearly.
  - [ ] Dual-engine behavior is either fully supported and tested or clearly constrained.
- [ ] Runtime profiles:
  - [ ] Dev/test/stage/prod setups are documented and reproducible.
  - [ ] E2E and integration tests have a clear, working environment story.
- [ ] Scripts:
  - [ ] Only working, relevant migration/runtime scripts remain.
- [ ] Security:
  - [ ] No accidental exposure of secrets or internal-only surfaces through Docker/env.
- [ ] Documentation:
  - [ ] `docs/config-management.md`, `docs/persistence.md`, and Docker/ops docs accurately reflect the final state.

With runtime, Docker, and database configs clean and aligned, finish with **Phase 08 – Documentation & Script Pruning and Final Consistency Pass** to complete the overall cleaning initiative.
