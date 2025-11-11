# Dual-Engine Repository Architecture

This document describes how Hyperpage routes persistence between SQLite and Postgres using repository factories, and how to validate correct behavior during sqlite-to-postgresql migration.

## Engine Detection

All repository factories use a single mechanism to detect the active engine:

- Use `getReadWriteDb()` (from `lib/database/connection.ts`) to obtain the primary drizzle instance.
- Inspect `db.$schema` via a safe runtime check.
- Decide Postgres vs SQLite implementation based on `$schema` object identity against `pg-schema` tables.

Example pattern (simplified):

- If `db.$schema?.userSessions === pgSchema.userSessions` then use Postgres implementation.
- Otherwise, fall back to SQLite implementation.

This pattern is implemented per repository and is the only supported engine selection mechanism.

## Repository Boundaries

Callers MUST NOT import `schema` or `pg-schema` directly for persistence.

All application code (APIs, services, jobs, components) MUST use the following factories/facades as the exclusive persistence boundary. Engine selection is always performed via `$schema` identity checks in these modules, not via `DB_ENGINE` flags in business logic.

### Sessions

- Factory: `getSessionRepository()` (`lib/database/session-repository.ts`)
- Responsibilities:
  - Provides methods to create, fetch, and delete sessions.
  - Chooses:
    - Postgres-backed session repository when `$schema.userSessions === pgSchema.userSessions`.
    - SQLite-backed repository otherwise.
- Tests:
  - `__tests__/unit/lib/database/session-repository.postgres.test.ts`:
    - Hermetic Postgres harness using `$schema.userSessions === pgSchema.userSessions`.
  - `__tests__/unit/lib/database/session-repository.postgres-and-sqlite.test.ts`:
    - Dual-engine verification via controlled `getReadWriteDb` wiring.
- Usage:
  - Use `getSessionRepository()` everywhere you need to persist or read sessions.
  - Do not call `pgSchema.userSessions` or `schema.userSessions` directly outside this module.

### App State

- Factory: `getAppStateRepository()` (`lib/database/app-state-repository.ts`)
- Responsibilities:
  - Encapsulates all reads/writes to app state.
  - Uses SQLite and Postgres-specific implementations behind a shared interface.
  - Uses `$schema.appState === pgSchema.appState` to select Postgres.
- Tests:
  - `__tests__/unit/lib/database/app-state-repository.postgres.test.ts`:
    - Hermetic FakePgDb targeting `PostgresAppStateRepository`.
  - `__tests__/unit/lib/database/app-state-repository.postgres-and-sqlite.test.ts`:
    - Contract-level dual-engine behavior:
      - Correct `getReadWriteDb` wiring.
      - Singleton semantics.
      - Non-Postgres-shaped DB does not yield Postgres repository.
- Usage:
  - Use `getAppStateRepository()` for all app-state operations.
  - Do not import `appState` tables directly in route handlers or services.

### OAuth Tokens

- Repository factory: `getOAuthTokenRepository()` (`lib/database/oauth-token-repository.ts`)
- Facade: `SecureTokenStorage` (`lib/oauth-token-store.ts`)
- Responsibilities:
  - Encapsulate all OAuth token persistence.
  - Select SQLite vs Postgres implementation based on `$schema.oauthTokens === pgSchema.oauthTokens`.
  - Provide a stable `OAuthTokenRepository` contract used by the rest of the codebase.
- Engine-specific behavior:
  - SQLite (`SqliteOAuthTokenRepository`):
    - Uses legacy `oauthTokens` table.
    - Stores access/refresh tokens using AES-256-GCM via `AesGcmCipher`.
    - Keeps encrypted-at-rest semantics compatible with existing behavior.
  - Postgres (`PostgresOAuthTokenRepository`):
    - Uses `pgSchema.oauthTokens`.
    - Maps:
      - `toolName` → `provider`
      - `scopes` ↔ `scope` (space-delimited text)
      - `metadata` and `refreshExpiresAt` into `raw` JSON.
    - Reads back `OAuthTokens` by decoding `scope` and `raw`.
- Tests:
  - `__tests__/unit/lib/database/oauth-token-repository.postgres.test.ts`:
    - Hermetic FakePgDb implementing only the operations used by `PostgresOAuthTokenRepository`.
    - Verifies:
      - Provider/scope/raw mappings.
      - `getTokens` roundtrip behavior.
      - `updateTokenExpiry` merge semantics.
      - `getExpiredTokens` / `cleanupExpiredTokens` contracts.
- Usage:
  - Application code should use `SecureTokenStorage` (or, in low-level code, `getOAuthTokenRepository()`).
  - Do not read/write `oauthTokens` tables directly.

### Jobs

- Factory: `getJobRepository()` (`lib/database/job-repository.ts`)
- Implementations:
  - `SqliteJobRepository`:
    - Uses `lib/database/schema.ts` `jobs` table via `getAppDatabase().drizzle`.
    - Preserves existing behavior for SQLite.
  - `PostgresJobRepository`:
    - Uses `NodePgDatabase<typeof pgSchema>` from `getReadWriteDb()`.
    - Persists jobs into `pgSchema.jobs`.
    - Persists metadata and external ID mapping into `pgSchema.jobHistory`.
    - Uses a `QueryAdapter` seam to decouple query predicates from Drizzle internals.
- Tests:
  - `__tests__/unit/lib/job-repository.postgres.test.ts`:
    - FakePgDb + FakeQueryAdapter mirroring production query shapes.
    - Asserts:
      - Insert writes jobs and jobHistory with externalId.
      - `exists` checks jobHistory externalId.
      - `loadActiveJobs` uses active status adapter.
      - `updateStatus` resolves by externalId and appends history.
      - `cleanupCompletedBefore` deletes via adapter and returns rowsAffected.
  - `__tests__/unit/lib/job-repository.sqlite.test.ts`:
    - Validates SQLite behavior/compatibility.
- Usage:
  - Use `getJobRepository()` for all job enqueue, status update, recovery, and cleanup logic.
  - Do not call `pgSchema.jobs` / `pgSchema.jobHistory` or SQLite `jobs` directly from business logic.

### Memory Job Queue

- Implementation: `lib/jobs/memory-job-queue.ts`
- Responsibilities:
  - Provides an in-memory priority queue with persistent backing storage.
  - Uses `getJobRepository()` exclusively:
    - `exists()` and `insert()` on enqueue.
    - `updateStatus()` on status changes.
    - `loadActiveJobs()` on startup recovery.
    - `cleanupCompletedBefore()` on cleanup.
- Guarantees:
  - No direct access to `jobs` or `jobHistory` tables.
  - Inherits dual-engine behavior entirely from the `JobRepository` factory.
- Tests:
  - `__tests__/unit/lib/memory-job-queue.integration.test.ts`:
    - Hermetic integration:
      - `vi.mock("lib/database/job-repository")` to inject a fake `JobRepository`.
      - Asserts the queue only uses the repository contract, never raw schemas.

## Rate Limits

- Repository: `RateLimitRepository` (`lib/database/rate-limit-repository.ts`)
- Implementations (engine-detected per call via `getReadWriteDb()`):
  - SQLite:
    - Uses `sqliteSchema.rateLimits`.
    - Maps to `NormalizedRateLimitRecord`.
    - `cleanupOlderThan` performs real deletes based on `lastUpdated`.
  - Postgres:
    - Uses `pgSchema.rateLimits`.
    - Keyed by `id` (e.g. `"github:global"`).
    - Persists `remaining`, `resetAt`, and `metadata` JSON (platform, limitTotal, lastUpdated).
    - `cleanupOlderThan` is intentionally a no-op (documented) because expiry/TTL is handled externally.
- Tests:
  - `__tests__/unit/lib/database/rate-limit-repository.test.ts`:
    - Contract-level behavior using minimal SQLite/Postgres-shaped fakes:
      - Ensures load/upsert do not throw for both engines.
      - Asserts Postgres `cleanupOlderThan` does not issue deletes.
- Usage:
  - Callers depend on the exported `rateLimitRepository` singleton.
  - No direct schema access or engine flags in callers.

## Tool Configs

- Repository: `ToolConfigRepository` (`lib/database/tool-config-repository.ts`)
- Singleton: `toolConfigRepository`
- Behavior:
  - Provides a normalized `NormalizedToolConfig` shape:
    - `toolName`, `enabled`, `config`, `refreshInterval`, `notifications`, `updatedAt`.
  - SQLite:
    - Uses `sqliteSchema.toolConfigs`.
    - Persists fields directly with `updatedAt` as epoch ms.
  - Postgres:
    - Uses `pgSchema.toolConfigs` scoped to:
      - `ownerType = "system"`, `ownerId = "global"` (current global behavior).
    - Stores merged configuration in `config` JSON:
      - `enabled`, `config`, `refreshInterval`, `notifications`.
    - Uses `key` as `toolName`, and maps `updatedAt` timestamp to epoch ms for consumers.
  - Engine detection:
    - Uses `$schema.toolConfigs === pgSchema.toolConfigs` as the only selector.
    - No `DB_ENGINE` flags inside the repository.
- Testing:
  - Intended to follow the same hermetic harness approach:
    - Minimal SQLite and Postgres-shaped fakes.
    - Contract-level assertions on normalization and owner scoping.
  - If additional tests are added, they MUST:
    - Avoid Drizzle internals/AST.
    - Use `$schema` identity checks only.
- Usage:
  - Higher-level services (e.g. `tool-config-manager`, tool registry) must use `toolConfigRepository`.
  - Do not access `toolConfigs` tables directly.

## Hermetic Postgres Harnesses

To validate Postgres behavior without relying on drizzle internals or real databases, the project uses hermetic, in-memory fakes that implement only the query shapes repositories rely on.

Key patterns (applied to AppState, OAuthTokens, Jobs, RateLimits, and ToolConfig where applicable):

- Harnesses expose:
  - `$schema` with the relevant `pgSchema` tables so engine detection works.
  - Minimal `insert/select/update/delete` chains with the exact fluent calls used in the repository.
- Tests assert:
  - That repositories call the expected query shapes.
  - That rows and mappings (e.g. job history, OAuth token scope/raw) are updated as expected.
- Examples:
  - `__tests__/unit/lib/job-repository.postgres.test.ts`:
    - FakePgDb + FakeQueryAdapter for `PostgresJobRepository`.
  - `__tests__/unit/lib/database/oauth-token-repository.postgres.test.ts`:
    - FakePgDb for `PostgresOAuthTokenRepository` using `$schema.oauthTokens`.

These harnesses avoid coupling to drizzle’s AST while providing deterministic verification of Postgres-specific behavior.

## Migration Guidance

When migrating from SQLite to Postgres:

1. Configure `getReadWriteDb()` to use a Postgres drizzle instance whose `$schema` includes:
   - `pgSchema.userSessions`
   - `pgSchema.appState`
   - `pgSchema.oauthTokens`
   - `pgSchema.jobs`, `pgSchema.jobHistory`

2. Rebuild and restart the application:
   - Repository factories automatically select Postgres implementations based on `$schema` identity.

3. Verify boundaries:
   - Confirm that non-repository, non-test code does not import:
     - `lib/database/schema`
     - `lib/database/pg-schema`
     - `oauthTokens`, `appState`, `userSessions`, `jobs`, `jobHistory`
   - All persistence must go through:
     - `getSessionRepository()`
     - `getAppStateRepository()`
     - `getOAuthTokenRepository()` / `SecureTokenStorage`
     - `getJobRepository()`

4. Testing:
   - Run the unit/integration suites, including:
     - Session repository dual-engine tests
     - App state repository Postgres tests
     - OAuth token repository Postgres harness tests
     - Job repository sqlite/postgres harness tests
     - Memory job queue integration tests
   - Treat repository test failures as contract issues in repository implementations or harnesses, not as reasons to bypass repository boundaries.

If these suites pass and your environment variables point to Postgres, the application will use the Postgres-backed repositories via the documented factories without requiring direct table usage in business logic.
