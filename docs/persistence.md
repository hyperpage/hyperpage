# Persistence Architecture Guide

## Overview

Hyperpage now uses a repository-first, dual-engine persistence architecture:

- All application code interacts with persistence exclusively through well-defined repository interfaces and facades.
- Dual-engine support (SQLite and PostgreSQL) is implemented behind those repositories.
- Engine selection is centralized via `getReadWriteDb()` and `$schema` identity checks against `pgSchema`.
- No application/business code should access `lib/database/schema` or `lib/database/pg-schema` directly; only repository modules and low-level DB wiring may use them.

This document describes:

- The repository interfaces and their dual-engine behavior.
- The valid boundaries for persistence usage.
- How this integrates with tools, jobs, and testing.

For migration details and implementation notes, see:
- `docs/sqlite-to-postgresql/dual-engine-repositories.md`

---

## Core Rules

1. Engine detection:
   - MUST be driven by:
     - `getReadWriteDb()` from `lib/database/connection.ts`
     - `$schema` identity checks against `pgSchema` for specific tables
   - MUST NOT be based on scattered `DB_ENGINE` flags or ad-hoc environment checks in business logic.

2. Repository-first:
   - Consumers MUST use the exported factories/facades:
     - `getSessionRepository()` from `lib/database/session-repository.ts`
     - `getAppStateRepository()` from `lib/database/app-state-repository.ts`
     - `getOAuthTokenRepository()` and `SecureTokenStorage` from `lib/database/oauth-token-repository.ts` / `lib/oauth-token-store.ts`
     - `getJobRepository()` from `lib/database/job-repository.ts`
     - `MemoryJobQueue` from `lib/jobs/memory-job-queue.ts` (which itself uses `JobRepository`)
     - `rateLimitRepository` from `lib/database/rate-limit-repository.ts`
     - `toolConfigRepository` from `lib/database/tool-config-repository.ts`
   - Direct reads/writes using drizzle schema objects in application code are prohibited.

3. Testability:
   - Repositories define clear contracts that can be faked in tests.
   - Engine-specific behavior is verified in repository-level tests.
   - Callers are tested hermetically via repository-shaped fakes (no real DB or schema coupling required).

---

## Database Engines and Schemas

### SQLite

- Schema defined in `lib/database/schema.ts`.
- Used by legacy/local deployments.
- Repositories provide compatible behavior against this schema.

### PostgreSQL

- Schema defined in `lib/database/pg-schema.ts`.
- Engine-specific implementations (e.g. `Postgres*Repository`) map repository contracts to PostgreSQL tables.
- Selection is performed by comparing the `$schema` object from `getReadWriteDb()` with `pgSchema` tables.

Repositories encapsulate the choice of engine; callers only see a unified interface.

---

## Repository Interfaces and Factories

### SessionRepository

File: `lib/database/session-repository.ts`

Interface (conceptual):

- `createSession(session)`
- `getSession(sessionToken)`
- `deleteSession(sessionToken)`
- `cleanupExpiredSessions(now?: Date | number)`

Factory:

- `getSessionRepository(): SessionRepository`
  - Uses `getReadWriteDb()` to obtain the current DB instance.
  - Detects engine by checking `$schema.userSessions === pgSchema.userSessions`.
  - Returns a singleton implementation:
    - SQLite path: explicit `SqliteSessionRepository` placeholder (non-Postgres) with clear logging, no guessing.
    - Postgres path: concrete `PostgresSessionRepository` using `pgSchema.userSessions`.

Callers:

- MUST obtain a repository via `getSessionRepository()`.
- MUST NOT import/inspect drizzle schema directly.

---

### AppStateRepository

File: `lib/database/app-state-repository.ts`

Interface (conceptual):

- `getState(key: string): Promise<string | null>`
- `setState(key: string, value: string): Promise<void>`
- `deleteState(key: string): Promise<void>`

Factory:

- `getAppStateRepository(): AppStateRepository`
  - Uses `getReadWriteDb()`.
  - Engine detection via `$schema.appState === pgSchema.appState`.
  - Returns singleton:
    - `SqliteAppStateRepository`:
      - Uses legacy SQLite `app_state` table with JSON-serialized values.
      - Acts as authoritative semantics for legacy deployments.
    - `PostgresAppStateRepository`:
      - Uses `pgSchema.appState`.
      - Implements upsert semantics and logging/error handling.

Callers:

- Use `getAppStateRepository()`; no direct `appState` table imports.

---

### OAuthTokenRepository and SecureTokenStorage

Files:
- `lib/database/oauth-token-repository.ts`
- `lib/oauth-token-store.ts`

Repository interface (conceptual):

- `storeTokens(...)`
- `getTokens(...)`
- `removeTokens(...)`
- `updateTokenExpiry(...)`
- `getExpiredTokens(...)`
- `cleanupExpiredTokens(...)`

Factory:

- `getOAuthTokenRepository(): OAuthTokenRepository`
  - Uses `getReadWriteDb()` and `$schema.oauthTokens === pgSchema.oauthTokens`.
  - Returns singleton:
    - `SqliteOAuthTokenRepository`:
      - Uses legacy SQLite `oauthTokens` table.
      - Encrypts sensitive fields with AES-256-GCM via `AesGcmCipher`.
    - `PostgresOAuthTokenRepository`:
      - Uses `pgSchema.oauthTokens`.
      - Maps:
        - `provider` (tool name)
        - `scope` field as `scopes`
        - `raw` JSON for metadata and `refreshExpiresAt`
      - Handles expiry and cleanup semantics at the DB level.

SecureTokenStorage:

- File: `lib/oauth-token-store.ts`
- Responsibilities:
  - Provide a higher-level API for token consumers.
  - Implement helper logic such as:
    - `shouldRefresh`
    - `areExpired`
    - derived expiration decisions.
- Persistence:
  - Delegates all storage operations to `getOAuthTokenRepository()`.
  - Contains no encryption or engine-selection logic.

Callers:

- Use `SecureTokenStorage` (preferred) or `getOAuthTokenRepository()` directly for low-level cases.
- MUST NOT store tokens via raw schema access.

---

### JobRepository and MemoryJobQueue

Files:
- `lib/database/job-repository.ts`
- `lib/jobs/memory-job-queue.ts`

JobRepository interface (conceptual):

- `insert(job)`
- `exists(jobId: string)`
- `loadActiveJobs()`
- `updateStatus(jobId: string, update)`
- `cleanupCompletedBefore(cutoffTime: Date | number)`

Factory:

- `getJobRepository(): JobRepository`
  - Uses `getReadWriteDb()` and `$schema.jobs === pgSchema.jobs`.
  - Returns singleton:
    - `SqliteJobRepository`:
      - Uses SQLite `jobs` table via `getAppDatabase().drizzle`.
    - `PostgresJobRepository`:
      - Uses `NodePgDatabase<typeof pgSchema>`.
      - Writes to `pgSchema.jobs`.
      - Writes mapping entries to `pgSchema.jobHistory`:
        - externalId
        - name
        - priority
        - tool
        - endpoint

MemoryJobQueue:

- File: `lib/jobs/memory-job-queue.ts`
- Behavior:
  - In-memory queue API for scheduling and tracking jobs.
  - Persists job state exclusively through `JobRepository`:
    - `enqueue` → `exists`/`insert`
    - status updates → `updateStatus`
    - recovery/load → `loadActiveJobs`
    - cleanup → `cleanupCompletedBefore`
- Guarantees:
  - No direct access to `jobs` or `jobHistory` schemas.
  - Hermetically testable via a `JobRepository`-shaped fake.

Callers:

- Use `MemoryJobQueue` for job orchestration.
- Rely on repository-level persistence, independent of underlying engine.

---

## Additional Persistence Components

The following modules implement or consume repository-first persistence:

- `lib/database/tool-config-repository.ts`
  - `ToolConfigRepository` / `toolConfigRepository`:
    - Dual-engine repository using `getReadWriteDb()` and `$schema.toolConfigs === pgSchema.toolConfigs`.
    - Normalizes configuration to `NormalizedToolConfig` for all callers.
- `lib/database/rate-limit-repository.ts`
  - `RateLimitRepository` / `rateLimitRepository`:
    - Dual-engine repository using `getReadWriteDb()` and `$schema.rateLimits === pgSchema.rateLimits`.
    - Defines documented SQLite vs Postgres semantics (including Postgres `cleanupOlderThan` no-op).
- `lib/tool-config-manager.ts`
  - Consumes `toolConfigRepository` as its persistence boundary.
- `lib/rate-limit-service.ts`
  - Consumes `rateLimitRepository` as its persistence boundary.

When evolving these modules:

- Preserve repository-first boundaries.
- Continue to implement dual-engine support via `getReadWriteDb()` + `$schema` checks only.
- Keep all schema usage inside repository implementations.

---

## Valid Persistence Boundaries

The only valid entry points for application/business code to interact with persistence are:

- `getSessionRepository()`
- `getAppStateRepository()`
- `getOAuthTokenRepository()` (usually via `SecureTokenStorage`)
- `getJobRepository()` (usually via `MemoryJobQueue`)
- Future repository factories that follow the same pattern.

Code outside repository and low-level DB wiring:

- MUST NOT import `lib/database/schema` or `lib/database/pg-schema`.
- MUST NOT branch on engine types.
- MUST depend on repository interfaces and documented facades.

---

## Testing Strategy

### Repository-Level Tests

- Engine-specific tests live under `__tests__/unit/lib/database/`.
- Responsibilities:
  - Verify dual-engine selection based on `getReadWriteDb()` and `$schema`.
  - Validate that each repository:
    - Maps to the correct tables/columns for SQLite and Postgres.
    - Implements documented semantics (e.g., token cleanup, job history writes).

### Hermetic Integration-Style Tests

- Consumers use minimal, shape-accurate fakes for repositories.

Example: `MemoryJobQueue` hermetic integration test

- File: `__tests__/unit/lib/memory-job-queue.integration.test.ts`
- Uses:
  - `vi.mock('lib/database/job-repository')` to:
    - Preserve actual exports.
    - Replace `getJobRepository` with an injectable fake.
- Ensures:
  - `enqueue` uses `exists` and `insert`.
  - `updateJobStatus` delegates to `updateStatus`.
  - `loadPersistedJobs` uses `loadActiveJobs`.
  - `cleanupOldJobs` uses `cleanupCompletedBefore`.
- No real DB or drizzle schemas are touched.

### Principles

- Prefer hermetic tests:
  - No network or real database dependencies.
- Test against repository interfaces:
  - Use fakes/mocks that match the contract.
- Keep ESLint/TypeScript strict:
  - No `eslint-disable-next-line`.
  - Type-safe shapes for all fakes and repositories.

For broader testing guidance, see:
- `docs/testing/testing.md`

---

## Migration and Dual-Engine Behavior

Key dual-engine behaviors (high-level):

- All engine decisions are localized in repository factories.
- Migrations from SQLite to PostgreSQL:
  - Application code remains unchanged as long as it uses repositories.
  - Repositories ensure data is read/written correctly in the active engine.
- For detailed migration flows and field-level mappings, refer to:
  - `docs/sqlite-to-postgresql/dual-engine-repositories.md`

---

## Security and Compliance

- Sensitive data:
  - Stored via dedicated repositories (e.g., `OAuthTokenRepository`) with proper encryption (SQLite) or structured columns (Postgres).
  - Never written directly via application code and raw schemas.
- Configuration:
  - Engine selection and credentials managed via environment variables and `getReadWriteDb()`.
- Observability:
  - Repositories are the natural hook points for logging and metrics around persistence.

---

By following these guidelines:

- The persistence layer remains consistent across SQLite and PostgreSQL.
- Call sites stay engine-agnostic and testable.
- Documentation accurately reflects the current dual-engine, repository-first design.
