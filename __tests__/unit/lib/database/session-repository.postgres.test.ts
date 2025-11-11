/**
 * NOTE-ONLY STUB: PostgresSessionRepository harness (implementation intentionally reverted)
 *
 * Context:
 * - Previous attempts in this file introduced a FakePgDb harness that partially decoded
 *   drizzle-orm predicates without a fully verified contract, and then weakened tests
 *   to accept multiple outcomes. This conflicted with the project's requirement that
 *   tests act as strict contracts rather than fuzzy assertions.
 *
 * Current state:
 * - Production PostgresSessionRepository in lib/database/session-repository.ts remains
 *   stable and correct for runtime usage (uses pgSchema.userSessions and eq/lt).
 * - Cross-engine behavior for getSessionRepository() is covered in:
 *   - __tests__/unit/lib/database/session-repository.postgres-and-sqlite.test.ts
 *     which:
 *       - Verifies Postgres selection when $schema matches pgSchema.userSessions.
 *       - Verifies singleton behavior.
 *
 * This file is intentionally a documentation stub until a rigorously verified,
 * minimal, hermetic FakePgDb harness is implemented.
 *
 * Requirements for a future harness (unchanged from design notes):
 * - Test PostgresSessionRepository directly (no getSessionRepository, no singleton).
 * - Provide a FakePgDb that:
 *   - Exposes only the methods PostgresSessionRepository calls.
 *   - Implements condition handling ONLY for:
 *       eq(pgSchema.userSessions.sessionToken, value)
 *       lt(pgSchema.userSessions.expiresAt, value)
 *     using empirically verified shapes from the pinned drizzle-orm version.
 * - Maintain:
 *   - No eslint-disable-next-line.
 *   - No any.
 *   - No guessing about drizzle internals beyond explicitly documented shapes.
 *   - Strong assertions that match the real repository contract.
 */
