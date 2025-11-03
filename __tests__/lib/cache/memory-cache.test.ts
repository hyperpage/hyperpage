import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MemoryCache, generateCacheKey, defaultCache } from '../../../lib/cache/memory-cache';

describe('Memory Cache', () => {
  let cache: MemoryCache;
  const cacheKey = 'test-key';
  const testData = { message: 'Hello, World!' };

  beforeEach(() => {
    vi.useFakeTimers();
    cache = new MemoryCache({ maxSize: 100, enableLru: false });
  });

  describe('Basic Operations', () => {
    it('should store and retrieve data', async () => {
      await cache.set(cacheKey, testData, 1000);
      const result = await cache.get(cacheKey);
      expect(result).toEqual(testData);
    });

    it('should return undefined for non-existent keys', async () => {
      const result = await cache.get('non-existent');
      expect(result).toBeUndefined();
    });

    it('should handle TTL expiration', async () => {
      await cache.set(cacheKey, testData, 10); // 10ms TTL
      expect(await cache.get(cacheKey)).toEqual(testData);

      // Advance timers to expire the entry
      vi.advanceTimersByTime(15);
      expect(await cache.get(cacheKey)).toBeUndefined();
    });

    it('should check if key exists and is valid', async () => {
      await cache.set(cacheKey, testData, 1000);
      expect(await cache.has(cacheKey)).toBe(true);
      expect(await cache.has('non-existent')).toBe(false);
    });

    it('should delete entries', async () => {
      await cache.set(cacheKey, testData, 1000);
      expect(await cache.has(cacheKey)).toBe(true);

      const deleted = await cache.delete(cacheKey);
      expect(deleted).toBe(true);
      expect(await cache.has(cacheKey)).toBe(false);

      expect(await cache.delete('non-existent')).toBe(false);
    });

    it('should clear all entries', async () => {
      await cache.set('key1', { data: 1 }, 1000);
      await cache.set('key2', { data: 2 }, 1000);
      expect(cache.size).toBe(2);

      await cache.clear();
      expect(cache.size).toBe(0);
    });

    it('should enforce maximum size with FIFO eviction', async () => {
      const smallCache = new MemoryCache({ maxSize: 3, enableLru: false });

      await smallCache.set('key1', 'data1', 60000);
      await smallCache.set('key2', 'data2', 60000);
      await smallCache.set('key3', 'data3', 60000);
      expect(smallCache.size).toBe(3);

      // This should evict key1 (fifo)
      await smallCache.set('key4', 'data4', 60000);
      expect(smallCache.size).toBe(3);
      expect(await smallCache.has('key1')).toBe(false);
      expect(await smallCache.has('key2')).toBe(true);
    });

    it('should provide statistics', async () => {
      expect(await cache.getStats()).toEqual({
        size: 0,
        hits: 0,
        misses: 0,
        expiries: 0,
        evictions: 0,
        backend: 'memory',
      });

      await cache.set(cacheKey, testData, 1000);
      await cache.get(cacheKey); // hit
      await cache.get('miss');   // miss

      const stats = await cache.getStats();
      expect(stats.size).toBe(1);
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
    });

    it('should cleanup expired entries', async () => {
      await cache.set('expired', testData, 10);
      await cache.set('valid', { data: 'valid' }, 60000);
      expect(cache.size).toBe(2);

      // Advance timers to expire the entry
      vi.advanceTimersByTime(15);

      // Accessing expired entry should trigger cleanup
      expect(await cache.get('expired')).toBeUndefined();
      expect(cache.size).toBe(1); // only valid entry remains
      expect((await cache.getStats()).expiries).toBe(1);
    });

    it('should manually cleanup expired entries', async () => {
      await cache.set('expired1', testData, 10);
      await cache.set('expired2', { data: 2 }, 20);
      await cache.set('valid', { data: 'valid' }, 60000);
      expect(cache.size).toBe(3);

      // Advance timers to expire the entries
      vi.advanceTimersByTime(25);

      const removed = await cache.cleanupExpired();
      expect(removed).toBe(2);
      expect(cache.size).toBe(1);
    });
  });

  describe('Cache Key Generation', () => {
    it('should generate consistent hash keys', () => {
      const key1 = generateCacheKey('github', 'issues', { state: 'open', page: 1 });
      const key2 = generateCacheKey('github', 'issues', { state: 'open', page: 1 });
      const key3 = generateCacheKey('github', 'issues', { state: 'closed', page: 1 });

      expect(key1).toBe(key2);
      expect(key1).not.toBe(key3);
      expect(key1).toMatch(/github:issues:.*/);
    });

    it('should handle string query params', () => {
      const key = generateCacheKey('gitlab', 'merge-requests', 'state=opened&scope=all');
      expect(key).toMatch(/gitlab:merge-requests:.*/);
    });

    it('should sort object keys for consistent hashing', () => {
      const key1 = generateCacheKey('tool', 'endpoint', { b: 2, a: 1, c: 3 });
      const key2 = generateCacheKey('tool', 'endpoint', { c: 3, a: 1, b: 2 });
      expect(key1).toBe(key2);
    });
  });

  describe('Default Cache Instance', () => {
    it('should be available as default export', () => {
      expect(defaultCache).toBeInstanceOf(MemoryCache);
    });
  });

  describe('Concurrent Access', () => {
    it('should handle concurrent set and get operations', async () => {
      const promises = [];

      // Concurrent sets
      for (let i = 0; i < 100; i++) {
        promises.push(
          Promise.resolve().then(async () =>
            await cache.set(`key${i}`, { value: i }, 60000)
          )
        );
      }

      // Concurrent gets
      for (let i = 0; i < 50; i++) {
        promises.push(
          Promise.resolve().then(async () =>
            await cache.get(`key${Math.floor(Math.random() * 50)}`)
          )
        );
      }

      await Promise.all(promises);
      // Should not crash and maintain reasonable state
      expect(typeof cache.size).toBe('number');
    });
  });

  describe('Edge Cases', () => {
    it('should handle null/undefined data', async () => {
      await cache.set('null', null, 1000);
      await cache.set('undefined', undefined, 1000);

      expect(await cache.get('null')).toBeNull();
      expect(await cache.get('undefined')).toBeUndefined();
    });

    it('should handle zero ttl', async () => {
      await cache.set(cacheKey, testData, 0);
      expect(await cache.get(cacheKey)).toBeUndefined();
    });

    it('should handle negative ttl', async () => {
      await cache.set(cacheKey, testData, -1000);
      expect(await cache.get(cacheKey)).toBeUndefined();
    });

    it('should handle very large data', async () => {
      const largeData = {
        array: new Array(10000).fill('x'),
        nested: { deep: { value: 'test' } }
      };
      await cache.set('large', largeData, 1000);
      expect(await cache.get('large')).toEqual(largeData);
    });

    it('should handle non-object data types', async () => {
      await cache.set('string', 'text', 1000);
      await cache.set('number', 42, 1000);
      await cache.set('boolean', true, 1000);
      await cache.set('array', [1, 2, 3], 1000);

      expect(await cache.get('string')).toBe('text');
      expect(await cache.get('number')).toBe(42);
      expect(await cache.get('boolean')).toBe(true);
      expect(await cache.get('array')).toEqual([1, 2, 3]);
    });
  });
});
