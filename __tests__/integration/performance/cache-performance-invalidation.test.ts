import {
  describe,
  it,
  expect,
  vi,
  beforeAll,
  afterAll,
  beforeEach,
} from "vitest";

import {
  IntegrationTestEnvironment,
  TestUserManager,
} from "@/lib/../__tests__/shared/test-credentials";
import logger from "@/lib/logger";

// Synthetic TTL-based cache entry types scoped to tests only
interface CacheDataEntry {
  data: unknown;
  timestamp: number;
  ttl: number;
  staleThreshold?: number;
}

interface CacheData {
  [key: string]: CacheDataEntry;
}

interface TestUser extends Record<string, unknown> {
  cacheData?: CacheData;
}

/**
 * NOTE:
 * These tests model cache invalidation semantics in a deterministic way using
 * fake timers, without making performance guarantees or exercising the full
 * cache stack. They are intentionally synthetic and scoped to TTL behavior.
 *
 * Phase 3: This suite is treated as optional CI/enterprise coverage:
 * - Requires a fully wired IntegrationTestEnvironment
 * - MUST be explicitly enabled via PERFORMANCE_TESTS=1 or E2E_TESTS=1
 * - MUST NOT block default local `vitest` runs if environment is not configured
 */
const shouldRunCacheInvalidationSuite =
  process.env.PERFORMANCE_TESTS === "1" || process.env.E2E_TESTS === "1";

const describeCacheInvalidation = shouldRunCacheInvalidationSuite
  ? describe
  : describe.skip;

describeCacheInvalidation(
  "Cache Invalidation Accuracy and Timing (synthetic TTL behavior, Optional CI/Performance Suite)",
  () => {
    let testEnv: IntegrationTestEnvironment;

    beforeAll(async () => {
      testEnv = await IntegrationTestEnvironment.setup();
    });

    afterAll(async () => {
      await testEnv.cleanup();
    });

    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(0);
      vi.clearAllMocks();
    });

    it("marks an entry as invalid after its TTL elapses", async () => {
      const session = await testEnv.createTestSession("github");
      const userManager = TestUserManager.getInstance();
      const user = userManager.getTestUser(session.userId) as
        | TestUser
        | undefined;

      const cacheKey = "invalidation_test";
      const cacheTimeout = 100; // ms

      expect(user).toBeDefined();
      if (!user) return;

      // Deterministic setup: timestamps aligned with fake timers (t = 0)
      user.cacheData = {
        [cacheKey]: {
          data: "initial_data",
          timestamp: 0,
          ttl: cacheTimeout,
        },
      };

      const access = () => {
        const cacheEntry = user.cacheData?.[cacheKey];
        if (!cacheEntry) {
          return { cacheHit: false };
        }
        const age = Date.now() - cacheEntry.timestamp;
        const cacheHit = age < cacheEntry.ttl;
        return { cacheHit, age };
      };

      // t = 0: should be a hit
      const initial = access();
      expect(initial.cacheHit).toBe(true);

      // Advance just beyond TTL: should be a miss
      vi.setSystemTime(cacheTimeout + 1);
      const expired = access();
      expect(expired.cacheHit).toBe(false);

      logger.info("Synthetic TTL invalidation test executed", {
        type: "cache_invalidation_timing_synthetic",
        cacheKey,
        ttl: cacheTimeout,
      });
    });

    it("expires keys with different TTLs in the expected order", async () => {
      const session = await testEnv.createTestSession("gitlab");
      const userManager = TestUserManager.getInstance();
      const user = userManager.getTestUser(session.userId) as
        | TestUser
        | undefined;

      expect(user).toBeDefined();
      if (!user) return;

      // Ensure we start from a clean, controlled cacheData
      user.cacheData = {
        short_ttl: {
          data: "short_lived_data",
          timestamp: 0,
          ttl: 50,
        },
        medium_ttl: {
          data: "medium_lived_data",
          timestamp: 0,
          ttl: 100,
        },
        long_ttl: {
          data: "long_lived_data",
          timestamp: 0,
          ttl: 200,
        },
      };

      const status = () => {
        const cache = user.cacheData;
        const now = Date.now();
        return {
          shortValid:
            !!cache?.short_ttl &&
            now - cache.short_ttl.timestamp < cache.short_ttl.ttl,
          mediumValid:
            !!cache?.medium_ttl &&
            now - cache.medium_ttl.timestamp < cache.medium_ttl.ttl,
          longValid:
            !!cache?.long_ttl &&
            now - cache.long_ttl.timestamp < cache.long_ttl.ttl,
        };
      };

      // t = 0: all valid (timestamps are 0 and system time is 0 from beforeEach)
      let s = status();
      expect(s.shortValid).toBe(true);
      expect(s.mediumValid).toBe(true);
      expect(s.longValid).toBe(true);

      // t = 60: short expired, others valid
      vi.setSystemTime(60);
      s = status();
      expect(s.shortValid).toBe(false);
      expect(s.mediumValid).toBe(true);
      expect(s.longValid).toBe(true);

      // t = 120: short+medium expired, long still valid
      vi.setSystemTime(120);
      s = status();
      expect(s.shortValid).toBe(false);
      expect(s.mediumValid).toBe(false);
      expect(s.longValid).toBe(true);

      // t = 220: all expired
      vi.setSystemTime(220);
      s = status();
      expect(s.shortValid).toBe(false);
      expect(s.mediumValid).toBe(false);
      expect(s.longValid).toBe(false);

      logger.info("Synthetic selective TTL invalidation test executed", {
        type: "selective_cache_invalidation_synthetic",
      });
    });

    it("reflects updates immediately and treats updated entries as stale after TTL", async () => {
      const session = await testEnv.createTestSession("jira");
      const userManager = TestUserManager.getInstance();
      const user = userManager.getTestUser(session.userId) as
        | TestUser
        | undefined;

      const cacheKey = "update_invalidation_test";
      const ttl = 500;

      expect(user).toBeDefined();
      if (!user) return;

      // Initial value at t = 0
      user.cacheData = {
        [cacheKey]: {
          data: { value: "original", version: 1 },
          timestamp: 0,
          ttl,
        },
      };

      const read = () => user.cacheData?.[cacheKey];

      // Initial read: ensure entry was set correctly
      const v1 = read();
      expect(v1).toBeDefined();
      expect((v1!.data as { version: number }).version).toBe(1);

      // Update data at t = 0: should be visible immediately
      user.cacheData = {
        ...user.cacheData,
        [cacheKey]: {
          data: { value: "updated", version: 2 },
          timestamp: 0,
          ttl,
        },
      };

      const v2 = read();
      expect(v2).toBeDefined();
      expect((v2!.data as { version: number }).version).toBe(2);

      // Advance beyond TTL for updated entry
      vi.setSystemTime(ttl + 1);
      const stale = read();

      if (stale) {
        const age = Date.now() - stale.timestamp;
        const valid = age < stale.ttl;
        expect(valid).toBe(false);
      }

      logger.info("Synthetic update + TTL invalidation test executed", {
        type: "cache_update_invalidation_synthetic",
        cacheKey,
      });
    });
  },
);
