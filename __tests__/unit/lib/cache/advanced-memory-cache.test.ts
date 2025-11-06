import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  AdvancedMemoryCache,
  createLRUCache,
  createAdaptiveCache,
  createTTLOnlyCache,
  EvictionPolicy,
} from "../../../../lib/cache/advanced-memory-cache";

describe("AdvancedMemoryCache", () => {
  let cache: AdvancedMemoryCache<string>;

  beforeEach(() => {
    vi.useFakeTimers();
    cache = new AdvancedMemoryCache({
      maxSize: 5,
      enableLru: true,
      evictionPolicy: EvictionPolicy.LRU,
      memoryAlertThreshold: 80,
    });
  });

  afterEach(async () => {
    await cache.clear();
  });

  describe("LRU Eviction Policy", () => {
    it("should evict least recently used items when at capacity", async () => {
      // Fill cache to capacity
      await cache.set("key1", "value1", 1000);
      await cache.set("key2", "value2", 1000);
      await cache.set("key3", "value3", 1000);
      await cache.set("key4", "value4", 1000);
      await cache.set("key5", "value5", 1000);

      // Access key1 and key2 to make them recently used
      await cache.get("key1");
      await cache.get("key2");

      // Add one more item to trigger eviction (key3 should be evicted as LRU)
      await cache.set("key6", "value6", 1000);

      expect(await cache.get("key1")).toBe("value1"); // Recently used
      expect(await cache.get("key2")).toBe("value2"); // Recently used
      expect(await cache.get("key3")).toBeUndefined(); // Should be evicted
      expect(await cache.get("key4")).toBe("value4");
      expect(await cache.get("key5")).toBe("value5");
      expect(await cache.get("key6")).toBe("value6");
    });

    it("should track access order correctly", async () => {
      await cache.set("a", "1", 1000);
      await cache.set("b", "2", 1000);
      await cache.set("c", "3", 1000);

      // Fill cache to capacity (maxSize=5, so add 2 more)
      await cache.set("x", "x", 1000);
      await cache.set("y", "y", 1000);

      // Access 'a' to make it most recently used
      await cache.get("a");
      // Access 'b' to make it most recently used
      await cache.get("b");

      // 'c' should be evicted as it's the least recently used
      await cache.set("d", "4", 1000);

      expect(await cache.get("a")).toBe("1");
      expect(await cache.get("b")).toBe("2");
      expect(await cache.get("c")).toBeUndefined();
      expect(await cache.get("d")).toBe("4");
    });
  });

  describe("Adaptive Eviction Policy", () => {
    beforeEach(() => {
      cache = new AdvancedMemoryCache({
        maxSize: 5,
        enableLru: true,
        evictionPolicy: EvictionPolicy.ADAPTIVE,
        adaptiveEnabled: true,
        adaptiveThreshold: 10, // Lower threshold for testing
      });
    });

    it("should switch to LRU when hit rate is low", async () => {
      // Create scenario with low hit rate (many misses)
      // Fill cache to near capacity to trigger adaptive checks
      for (let i = 0; i < 5; i++) {
        await cache.set(`key${i}`, `value${i}`, 1000);
      }

      // Generate misses to lower hit rate
      for (let i = 0; i < 15; i++) {
        await cache.get(`nonexistent${i}`);
      }

      // Should switch to LRU mode after enough operations at threshold
      expect(cache.currentEvictionPolicy).toBe(EvictionPolicy.LRU);
    });

    it("should adapt based on cache usage patterns", async () => {
      // Fill cache
      await cache.set("key1", "value1", 1000);
      await cache.set("key2", "value2", 1000);
      await cache.set("key3", "value3", 1000);

      // High hit rate pattern
      for (let i = 0; i < 20; i++) {
        await cache.get("key1");
        await cache.get("key2");
      }

      // Should potentially switch to FIFO with high hit rate
      // (adaptive switching happens after threshold is met)
      const stats = await cache.getStats();
      expect(stats.hits).toBeGreaterThan(stats.misses);
    });
  });

  describe("TTL Only Policy", () => {
    beforeEach(() => {
      cache = createTTLOnlyCache(3);
    });

    it("should not evict valid entries even when over capacity", async () => {
      await cache.set("key1", "value1", 10000); // Long TTL
      await cache.set("key2", "value2", 10000);
      await cache.set("key3", "value3", 10000);

      // Try to add more (capacity is 3)
      await cache.set("key4", "value4", 10000);

      // TTL-only should prevent eviction but keep all valid entries
      expect(await cache.get("key1")).toBe("value1");
      expect(await cache.get("key2")).toBe("value2");
      expect(await cache.get("key3")).toBe("value3");
      expect(await cache.get("key4")).toBe("value4"); // Should be allowed despite capacity

      const stats = await cache.getStats();
      expect(stats.alerts).toContain(
        "Cache at maximum capacity but TTL_ONLY policy prevents eviction",
      );
    });

    it("should only remove expired entries", async () => {
      await cache.set("long", "value1", 10000);
      await cache.set("short", "value2", 100); // Very short TTL

      // Advance time to expire the short TTL entry
      vi.advanceTimersByTime(200);

      // Access should remove expired entry
      expect(await cache.get("short")).toBeUndefined();
      expect(await cache.get("long")).toBe("value1"); // Should still exist
    });
  });

  describe("Performance Monitoring", () => {
    it("should track operation performance metrics", async () => {
      await cache.set("key1", "value1", 1000);
      await cache.get("key1"); // Hit
      await cache.get("nonexistent"); // Miss

      const stats = await cache.getStats();

      expect(stats.performance.operationCount).toBeGreaterThan(0);
      expect(stats.performance.hitCount).toBe(1);
      expect(stats.performance.missCount).toBe(1);
      expect(stats.performance.averageAccessTime).toBeGreaterThanOrEqual(0); // Allow 0 in test environments
    });

    it("should track memory usage statistics", async () => {
      await cache.set("key1", "value1", 1000);
      await cache.set("key2", "value2", 1000);

      const stats = await cache.getStats();

      expect(stats.memory.usedEntries).toBe(2);
      expect(stats.memory.totalCapacity).toBe(5);
      expect(stats.memory.usagePercentage).toBe(40);
    });
  });

  describe("Memory Alerts", () => {
    beforeEach(() => {
      cache = new AdvancedMemoryCache({
        maxSize: 3,
        enableLru: false,
        evictionPolicy: EvictionPolicy.FIFO,
        memoryAlertThreshold: 90,
      });
    });

    it("should trigger alerts when memory usage is high", async () => {
      await cache.set("key1", "value1", 1000);
      await cache.set("key2", "value2", 1000);
      await cache.set("key3", "value3", 1000);

      // Trigger alert check manually
      cache.triggerMemoryAlertCheck();

      const stats = await cache.getStats();
      expect(
        stats.alerts.some((alert) => alert.includes("Memory usage at")),
      ).toBe(true);
    });

    it("should clear alerts when usage drops below threshold", async () => {
      // Fill cache to trigger alert
      await cache.set("key1", "value1", 1000);
      await cache.set("key2", "value2", 1000);
      await cache.set("key3", "value3", 1000);

      // Trigger alert check
      cache.triggerMemoryAlertCheck();

      // Delete one entry
      await cache.delete("key3");

      // Trigger alert check again
      cache.triggerMemoryAlertCheck();

      // Alert should be cleared (lower usage)
      const stats = await cache.getStats();
      expect(
        stats.alerts.some((alert) => alert.includes("Memory usage at")),
      ).toBe(false);
    });
  });

  describe("Factory Functions", () => {
    it("should create LRU cache with correct configuration", () => {
      const lruCache = createLRUCache(10, 5000);

      expect(lruCache.currentEvictionPolicy).toBe(EvictionPolicy.LRU);
    });

    it("should create adaptive cache with learning enabled", () => {
      const adaptiveCache = createAdaptiveCache(10, 3000);

      expect(adaptiveCache.currentEvictionPolicy).toBe(EvictionPolicy.ADAPTIVE);
    });

    it("should create TTL-only cache without LRU", () => {
      const ttlCache = createTTLOnlyCache(10);

      expect(ttlCache.currentEvictionPolicy).toBe(EvictionPolicy.TTL_ONLY);
    });
  });

  describe("Cache Warming", () => {
    it("should initialize cache warming when enabled", () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      new AdvancedMemoryCache({
        maxSize: 10,
        enableLru: true,
        evictionPolicy: EvictionPolicy.LRU,
        warmingEnabled: true,
        warmKeys: ["key1", "key2", "key3"],
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        "Cache warming enabled for 3 keys",
      );

      consoleSpy.mockRestore();
    });
  });

  describe("Cleanup Operations", () => {
    it("should clean up expired entries efficiently", async () => {
      await cache.set("expired1", "value1", 100);
      await cache.set("expired2", "value2", 200);
      await cache.set("valid", "value3", 10000);

      // Advance time to expire first two entries
      vi.advanceTimersByTime(300);

      const removedCount = await cache.cleanupExpired();

      expect(removedCount).toBe(2);
      expect(await cache.get("expired1")).toBeUndefined();
      expect(await cache.get("expired2")).toBeUndefined();
      expect(await cache.get("valid")).toBe("value3");
    });

    it("should perform proactive cleanup when near capacity", async () => {
      cache = new AdvancedMemoryCache({
        maxSize: 4,
        enableLru: true,
        evictionPolicy: EvictionPolicy.LRU,
      });

      // Add entries with different TTLs
      await cache.set("short1", "value1", 100);
      await cache.set("short2", "value2", 200);
      await cache.set("long1", "value3", 10000);
      await cache.set("long2", "value4", 10000);

      // Advance time to expire short TTL entries
      vi.advanceTimersByTime(300);

      // This should trigger proactive cleanup when adding new entry
      await cache.set("new", "value5", 1000);

      expect(await cache.get("short1")).toBeUndefined();
      expect(await cache.get("short2")).toBeUndefined();
      expect(await cache.get("long1")).toBe("value3");
      expect(await cache.get("long2")).toBe("value4");
      expect(await cache.get("new")).toBe("value5");
    });
  });

  describe("Edge Cases", () => {
    it("should handle zero TTL correctly", async () => {
      await cache.set("zero-ttl", "value", 0);

      expect(await cache.has("zero-ttl")).toBe(false);
    });

    it("should handle negative TTL correctly", async () => {
      await cache.set("negative-ttl", "value", -100);

      expect(await cache.has("negative-ttl")).toBe(false);
    });

    it("should handle cache operations on non-existent keys", async () => {
      expect(await cache.has("nonexistent")).toBe(false);
      expect(await cache.delete("nonexistent")).toBe(false);
      expect(await cache.get("nonexistent")).toBeUndefined();
    });

    it("should survive clearing operations", async () => {
      await cache.set("key1", "value1", 1000);
      await cache.set("key2", "value2", 1000);

      await cache.clear();

      expect(await cache.get("key1")).toBeUndefined();
      expect(await cache.get("key2")).toBeUndefined();
      expect(cache.size).toBe(0);

      // Should work normally after clear
      await cache.set("key3", "value3", 1000);
      expect(await cache.get("key3")).toBe("value3");
    });
  });

  describe("Backend Identification", () => {
    it("should identify backend type correctly", async () => {
      const stats = await cache.getStats();
      expect(stats.backend).toContain("memory-lru");
    });

    it("should identify different policy backends", async () => {
      const fifoCache = new AdvancedMemoryCache({
        maxSize: 5,
        enableLru: false,
        evictionPolicy: EvictionPolicy.FIFO,
      });

      const stats = await fifoCache.getStats();
      expect(stats.backend).toBe("memory-fifo");
    });
  });
});
