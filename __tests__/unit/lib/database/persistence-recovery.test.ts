/**
 * LEGACY SQLITE PERSISTENCE TEST SUITE (PHASE 1 - SKIPPED)
 *
 * This suite exercised SQLite-based persistence and recovery semantics using:
 * - drizzle-orm/better-sqlite3
 * - lib/database/schema (SQLite schema)
 * - createTestDatabase / createTestDrizzle / closeAllConnections helpers
 *
 * In the Phase 1 PostgreSQL-only runtime:
 * - All active persistence goes through lib/database/connection.ts (Postgres only)
 * - SQLite and lib/database/schema.ts are migration/forensics references only
 * - better-sqlite3-backed helpers no longer exist in the runtime surface
 *
 * This file is retained ONLY as historical/legacy reference.
 * It MUST NOT be imported or relied on by active runtime code.
 * It is deliberately skipped in the main test suite.
 */

import { describe, it, expect } from "vitest";

const shouldRunLegacySqlite = process.env.LEGACY_SQLITE_TESTS === "1";
const describeLegacy = shouldRunLegacySqlite ? describe : describe.skip;

describeLegacy(
  "Persistence and Recovery System (LEGACY SQLITE - skipped in Phase 1)",
  () => {
    it("is documented as legacy-only and intentionally skipped in PostgreSQL-only Phase 1", () => {
      // This assertion ensures the suite has at least one test for Vitest.
      // The actual SQLite-based logic previously in this file depended on:
      // - better-sqlite3
      // - lib/database/schema.ts (SQLite schema)
      // - createTestDatabase/createTestDrizzle/closeAllConnections from lib/database/connection.ts
      //
      // Those helpers are removed from the active connection facade.
      // Keeping this file skipped prevents accidental coupling while preserving
      // historical intent for future migration/forensics work.
      expect(true).toBe(true);
    });
  },
);
