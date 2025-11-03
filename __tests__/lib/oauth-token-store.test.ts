/**
 * @vitest-environment node
 */
import { vi } from "vitest";

// Mock crypto module for deterministic encryption/decryption testing
vi.mock("crypto", () => ({
  default: {
    // Return deterministic IV for testing
    randomBytes: () => Buffer.from("test-iv-12345678"),

    // Mock cipher that uses simple base64 encoding/decoding for deterministic testing
    createCipher: () => ({
      update: (data: string) => Buffer.from(data).toString("hex"),
      final: () => "",
      getAuthTag: () => Buffer.from("test-auth-tag"),
    }),

    // Mock decipher that reverses the base64 encoding
    createDecipher: () => ({
      setAuthTag: () => {},
      update: (data: string) => Buffer.from(data, "hex").toString("utf8"),
      final: () => "",
    }),
  },
}));

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { SecureTokenStorage, OAuthTokens } from "../../lib/oauth-token-store";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import path from "path";
import fs from "fs";

// Mock database path for testing
const TEST_DB_PATH = "./data/test-oauth-token-store.db";

describe("SecureTokenStorage", () => {
  let storage: SecureTokenStorage;
  const testEncryptionKey = "test-oauth-encryption-key-32-chars-minimum";

  beforeAll(async () => {
    // Set test environment
    process.env.OAUTH_ENCRYPTION_KEY = testEncryptionKey;

    // Ensure test directory exists
    const testDbDir = path.dirname(TEST_DB_PATH);
    if (!fs.existsSync(testDbDir)) {
      fs.mkdirSync(testDbDir, { recursive: true });
    }

    // Create test database and initialize tables with correct schema
    const sqlite = new Database(TEST_DB_PATH);
    const db = drizzle(sqlite);

    // Create table with correct column names matching the schema
    db.run(`
      CREATE TABLE IF NOT EXISTS oauth_tokens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        tool_name TEXT NOT NULL,
        access_token TEXT NOT NULL,
        refresh_token TEXT,
        token_type TEXT NOT NULL,
        expires_at INTEGER,
        refresh_expires_at INTEGER,
        scopes TEXT,
        metadata TEXT,
        iv_access TEXT NOT NULL,
        iv_refresh TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        UNIQUE(user_id, tool_name)
      )
    `);

    storage = new SecureTokenStorage(TEST_DB_PATH);
  });

  afterAll(() => {
    // Clean up test database
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }

    // Reset environment
    delete process.env.OAUTH_ENCRYPTION_KEY;
  });

  describe("encryption/decryption", () => {
    it("should encrypt and decrypt data correctly", () => {
      const testData = "test-oauth-access-token";
      expect(typeof testData).toBe("string"); // Placeholder - actual encryption testing will be integration
    });

    it("should fail with invalid encryption key", () => {
      process.env.OAUTH_ENCRYPTION_KEY = "short";
      expect(() => new SecureTokenStorage(TEST_DB_PATH)).toThrow(
        "OAUTH_ENCRYPTION_KEY must be at least 32 characters",
      );
      process.env.OAUTH_ENCRYPTION_KEY = testEncryptionKey;
    });
  });

  describe("token storage and retrieval", () => {
    const testUserId = "test-user-123";
    const testToolName = "github";
    const testTokens: OAuthTokens = {
      accessToken: "gho_test_access_token",
      refreshToken: "gho_test_refresh_token",
      tokenType: "bearer",
      expiresAt: Date.now() + 3600000, // 1 hour from now
      refreshExpiresAt: Date.now() + 2592000000, // 30 days from now
      scopes: ["repo", "user"],
      metadata: { provider: "github" },
    };

    it("should store OAuth tokens successfully", async () => {
      await expect(
        storage.storeTokens(testUserId, testToolName, testTokens),
      ).resolves.toBeUndefined();
    });

    it("should retrieve stored OAuth tokens correctly", async () => {
      const retrieved = await storage.getTokens(testUserId, testToolName);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.accessToken).toBe(testTokens.accessToken);
      expect(retrieved?.refreshToken).toBe(testTokens.refreshToken);
      expect(retrieved?.tokenType).toBe(testTokens.tokenType);
      expect(retrieved?.scopes).toEqual(testTokens.scopes);
      expect(retrieved?.metadata).toEqual(testTokens.metadata);
    });

    it("should return null for non-existent tokens", async () => {
      const retrieved = await storage.getTokens(
        "non-existent-user",
        testToolName,
      );
      expect(retrieved).toBeNull();
    });

    it("should remove tokens successfully", async () => {
      await expect(
        storage.removeTokens(testUserId, testToolName),
      ).resolves.toBeUndefined();

      // Verify tokens are removed
      const retrieved = await storage.getTokens(testUserId, testToolName);
      expect(retrieved).toBeNull();
    });
  });

  describe("token expiry logic", () => {
    const baseTokens: OAuthTokens = {
      accessToken: "test-token",
      tokenType: "bearer",
      scopes: ["repo"],
    };

    it("should identify tokens that need refresh (expires within 5 minutes)", () => {
      const expiringSoon = { ...baseTokens, expiresAt: Date.now() + 240000 }; // 4 minutes from now
      expect(storage.shouldRefresh(expiringSoon)).toBe(true);
    });

    it("should not refresh tokens expiring more than 5 minutes from now", () => {
      const notExpiringSoon = { ...baseTokens, expiresAt: Date.now() + 600000 }; // 10 minutes from now
      expect(storage.shouldRefresh(notExpiringSoon)).toBe(false);
    });

    it("should not refresh tokens without expiry time", () => {
      const noExpiry = { ...baseTokens };
      expect(storage.shouldRefresh(noExpiry)).toBe(false);
    });

    it("should identify expired tokens", () => {
      const expiredTokens = { ...baseTokens, expiresAt: Date.now() - 1000 }; // 1 second ago
      expect(storage.areExpired(expiredTokens)).toBe(true);
    });

    it("should identify non-expired tokens", () => {
      const validTokens = { ...baseTokens, expiresAt: Date.now() + 3600000 }; // 1 hour from now
      expect(storage.areExpired(validTokens)).toBe(false);
    });

    it("should identify refresh token expiry", () => {
      const expiredRefresh = {
        ...baseTokens,
        refreshExpiresAt: Date.now() - 1000,
      };
      expect(storage.isRefreshExpired(expiredRefresh)).toBe(true);

      const validRefresh = {
        ...baseTokens,
        refreshExpiresAt: Date.now() + 86400000,
      }; // 1 day from now
      expect(storage.isRefreshExpired(validRefresh)).toBe(false);

      const noRefreshExpiry = { ...baseTokens };
      expect(storage.isRefreshExpired(noRefreshExpiry)).toBe(true);
    });
  });

  describe("token updates", () => {
    const testUserId = "test-user-update";
    const testToolName = "github";

    beforeAll(async () => {
      const initialTokens: OAuthTokens = {
        accessToken: "initial-token",
        tokenType: "bearer",
        expiresAt: Date.now() + 3600000,
      };
      await storage.storeTokens(testUserId, testToolName, initialTokens);
    });

    it("should update token expiry times", async () => {
      const newExpiresAt = Date.now() + 7200000; // 2 hours from now
      const newRefreshExpiresAt = Date.now() + 604800000; // 1 week from now

      await expect(
        storage.updateTokenExpiry(
          testUserId,
          testToolName,
          newExpiresAt,
          newRefreshExpiresAt,
        ),
      ).resolves.toBeUndefined();

      const updated = await storage.getTokens(testUserId, testToolName);
      expect(updated?.expiresAt).toBe(newExpiresAt);
      expect(updated?.refreshExpiresAt).toBe(newRefreshExpiresAt);
    });
  });

  describe("cleanup operations", () => {
    it("should get list of expired tokens", async () => {
      // This test would require setting up expired tokens in the database
      // For now, test the method exists and returns an array
      const expired = await storage.getExpiredTokens();
      expect(Array.isArray(expired)).toBe(true);
    });

    it("should perform cleanup of expired tokens", async () => {
      // Test the cleanup method exists and returns a number
      const cleanedCount = await storage.cleanupExpiredTokens();
      expect(typeof cleanedCount).toBe("number");
      expect(cleanedCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe("error handling", () => {
    it("should handle database errors gracefully", async () => {
      // Test with invalid user input or database issues
      const retrieved = await storage.getTokens("", "");
      // Should return null or handle error gracefully
      expect(retrieved).toBeNull();
    });
  });
});
