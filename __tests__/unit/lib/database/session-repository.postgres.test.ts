import { describe, it, expect } from "vitest";
import { getReadWriteDb } from "@/lib/database/connection";
import * as pgSchema from "@/lib/database/pg-schema";

/**
 * Postgres Session Repository Placeholder Test
 *
 * This file exists to:
 * - Ensure Vitest discovers a valid test suite (avoids "No test suite found").
 * - Document that session persistence is Postgres-backed via pgSchema.userSessions.
 *
 * Full behavioral tests for the session repository should be implemented
 * once the repository API is finalized for the Postgres-only architecture.
 */

describe("PostgresSessionRepository (placeholder)", () => {
  it("is wired against Postgres schema", () => {
    // Basic invariant: importing the schema and connection must not throw.
    expect(getReadWriteDb).toBeTypeOf("function");
    expect(pgSchema.userSessions).toBeDefined();
  });
});
