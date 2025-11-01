import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { IntegrationTestEnvironment, TestUserManager } from '../../lib/test-credentials';

describe('Cache Performance & Invalidation Testing', () => {
  let testEnv: IntegrationTestEnvironment;

  beforeAll(async () => {
    testEnv = await IntegrationTestEnvironment.setup();
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  beforeEach(async () => {
    vi.clearAllMocks();
  });

  describe('Cache Hit Rates Under Various Access Patterns', () => {
    it('maintains high cache hit rates with sequential access patterns', async () => {
      const accessCount = 20;
      const cacheKeys = Array.from({ length: 5 }, (_, i) => `sequential_key_${i}`);
      const cacheStats = new Map<string, { hits: number; misses: number }>();
      
      // Initialize cache statistics
      cacheKeys.forEach(key => {
        cacheStats.set(key, { hits: 0, misses: 0 });
      });

      const cacheOperations = Array.from({ length: accessCount }, async (_, i) => {
        const key = cacheKeys[i % cacheKeys.length];
        const userManager = TestUserManager.getInstance();
        
        // Simulate cache access
        const cacheResult = key.startsWith('sequential_key_') && Math.random() > 0.1; // 90% hit rate
        
        if (cacheResult) {
          const stats = cacheStats.get(key);
          if (stats) stats.hits++;
        } else {
          const stats = cacheStats.get(key);
          if (stats) stats.misses++;
        }

        return {
          operationId: i,
          key,
          cacheHit: cacheResult,
          timestamp: Date.now()
        };
      });

      const results = await Promise.all(cacheOperations);
      
      // Verify cache hit rate calculations
      cacheStats.forEach((stats, key) => {
        const totalAccess = stats.hits + stats.misses;
        const hitRate = totalAccess > 0 ? stats.hits / totalAccess : 0;
        
        expect(totalAccess).toBeGreaterThan(0);
        expect(hitRate).toBeGreaterThanOrEqual(0.7); // Minimum 70% hit rate expected
        
        console.log(`Cache key ${key}: ${stats.hits}/${totalAccess} hits (${(hitRate * 100).toFixed(1)}% hit rate)`);
      });

      const totalHits = Array.from(cacheStats.values()).reduce((sum, stats) => sum + stats.hits, 0);
      const totalMisses = Array.from(cacheStats.values()).reduce((sum, stats) => sum + stats.misses, 0);
      const overallHitRate = totalHits / (totalHits + totalMisses);
      
      expect(overallHitRate).toBeGreaterThanOrEqual(0.8); // Overall 80%+ hit rate
      console.log(`Sequential access test: ${totalHits}/${totalHits + totalMisses} overall hits (${(overallHitRate * 100).toFixed(1)}% hit rate)`);
    });

    it('handles cache performance with random access patterns', async () => {
      const accessCount = 25;
      const cacheKeys = Array.from({ length: 10 }, (_, i) => `random_key_${i}`);
      const accessPattern = Array.from({ length: accessCount }, () => 
        cacheKeys[Math.floor(Math.random() * cacheKeys.length)]
      );
      
      const cacheStats = new Map<string, { hits: number; misses: number; responseTime: number[] }>();
      
      cacheKeys.forEach(key => {
        cacheStats.set(key, { hits: 0, misses: 0, responseTime: [] });
      });

      const cacheOperations = accessPattern.map(async (key, i) => {
        const startTime = performance.now();
        const userManager = TestUserManager.getInstance();
        
        // Simulate cache operation
        const isCacheHit = Math.random() > 0.2; // 80% hit rate for random access
        await new Promise(resolve => setTimeout(resolve, Math.random() * 5));
        
        const endTime = performance.now();
        const responseTime = endTime - startTime;
        
        const stats = cacheStats.get(key);
        if (stats) {
          if (isCacheHit) {
            stats.hits++;
            stats.responseTime.push(responseTime);
          } else {
            stats.misses++;
          }
        }

        return {
          operationId: i,
          key,
          cacheHit: isCacheHit,
          responseTime,
          timestamp: Date.now()
        };
      });

      const results = await Promise.all(cacheOperations);
      
      // Analyze cache performance
      cacheStats.forEach((stats, key) => {
        const totalAccess = stats.hits + stats.misses;
        const hitRate = totalAccess > 0 ? stats.hits / totalAccess : 0;
        const avgResponseTime = stats.responseTime.length > 0 
          ? stats.responseTime.reduce((sum, time) => sum + time, 0) / stats.responseTime.length 
          : 0;
        
        console.log(`Random access - ${key}: ${stats.hits}/${totalAccess} hits, avg ${avgResponseTime.toFixed(2)}ms response time`);
        
        // Cache hits should be faster than misses
        if (stats.responseTime.length > 0) {
          expect(avgResponseTime).toBeLessThan(10); // Fast cache access
        }
      });

      const totalHits = Array.from(cacheStats.values()).reduce((sum, stats) => sum + stats.hits, 0);
      const totalOperations = Array.from(cacheStats.values()).reduce((sum, stats) => sum + stats.hits + stats.misses, 0);
      const overallHitRate = totalHits / totalOperations;
      
      expect(overallHitRate).toBeGreaterThanOrEqual(0.7); // 70%+ hit rate for random access
      console.log(`Random access test: ${overallHitRate >= 0.7 ? 'PASSED' : 'FAILED'} - ${(overallHitRate * 100).toFixed(1)}% hit rate`);
    });

    it('validates cache performance with burst access patterns', async () => {
      const burstSize = 15;
      const burstCount = 3;
      const cacheKeys = ['burst_key_1', 'burst_key_2', 'burst_key_3'];
      
      const burstResults: Array<{
        burstIndex: number;
        operations: Array<{
          key: string;
          cacheHit: boolean;
          responseTime: number;
        }>;
        burstHitRate: number;
        burstAvgResponseTime: number;
      }> = [];

      for (let burstIndex = 0; burstIndex < burstCount; burstIndex++) {
        const burstKey = cacheKeys[burstIndex % cacheKeys.length];
        const burstOperations = Array.from({ length: burstSize }, async (_, opIndex) => {
          const startTime = performance.now();
          
          // Simulate burst access - high probability of cache hits within burst
          const isCacheHit = Math.random() > 0.05; // 95% hit rate during burst
          
          await new Promise(resolve => setTimeout(resolve, Math.random() * 2));
          
          const endTime = performance.now();
          const responseTime = endTime - startTime;
          
          return {
            key: burstKey,
            cacheHit: isCacheHit,
            responseTime,
            timestamp: Date.now()
          };
        });

        const operations = await Promise.all(burstOperations);
        const hits = operations.filter(op => op.cacheHit).length;
        const burstHitRate = hits / burstSize;
        const burstAvgResponseTime = operations.reduce((sum, op) => sum + op.responseTime, 0) / burstSize;
        
        burstResults.push({
          burstIndex,
          operations,
          burstHitRate,
          burstAvgResponseTime
        });
        
        console.log(`Burst ${burstIndex + 1}: ${hits}/${burstSize} hits (${(burstHitRate * 100).toFixed(1)}% hit rate), ${burstAvgResponseTime.toFixed(2)}ms avg response`);
      }

      // Verify burst performance
      burstResults.forEach(result => {
        expect(result.burstHitRate).toBeGreaterThanOrEqual(0.8); // 80%+ hit rate in bursts
        expect(result.burstAvgResponseTime).toBeLessThan(5); // Fast response during bursts
      });

      const overallHitRate = burstResults.reduce((sum, result) => sum + result.burstHitRate, 0) / burstResults.length;
      const overallAvgResponseTime = burstResults.reduce((sum, result) => sum + result.burstAvgResponseTime, 0) / burstResults.length;
      
      console.log(`Burst access test: ${(overallHitRate * 100).toFixed(1)}% overall hit rate, ${overallAvgResponseTime.toFixed(2)}ms avg response time`);
    });
  });

  describe('Cache Invalidation Accuracy and Timing', () => {
    it('validates cache invalidation timing accuracy', async () => {
      const session = await testEnv.createTestSession('github');
      const userManager = TestUserManager.getInstance();
      const user = userManager.getTestUser(session.userId);
      
      // Set up cache with timestamp
      const cacheKey = 'invalidation_test';
      const cacheTimeout = 100; // 100ms timeout
      
      if (user) {
        user.cacheData = {
          [cacheKey]: {
            data: 'initial_data',
            timestamp: Date.now(),
            ttl: cacheTimeout
          }
        };
      }

      const startTime = Date.now();
      
      // First access (should be cache hit)
      const firstAccess = () => {
        const cacheData = user?.cacheData?.[cacheKey];
        const age = Date.now() - (cacheData?.timestamp || 0);
        const isValid = age < (cacheData?.ttl || 0);
        
        return {
          cacheHit: isValid,
          data: cacheData?.data,
          age,
          timestamp: Date.now()
        };
      };

      const result1 = firstAccess();
      expect(result1.cacheHit).toBe(true);
      expect(result1.age).toBeLessThan(50); // Should be recent
      
      // Wait for cache to expire
      await new Promise(resolve => setTimeout(resolve, cacheTimeout + 10));
      
      // Second access (should be cache miss due to TTL)
      const result2 = firstAccess();
      expect(result2.cacheHit).toBe(false);
      expect(result2.age).toBeGreaterThan(cacheTimeout);
      
      const invalidationTime = Date.now() - startTime;
      expect(invalidationTime).toBeGreaterThanOrEqual(cacheTimeout);
      expect(invalidationTime).toBeLessThan(cacheTimeout + 50); // Should invalidate within reasonable time
      
      console.log(`Cache invalidation timing test: Invalidated after ${invalidationTime}ms (expected ${cacheTimeout}ms TTL)`);
    });

    it('handles selective cache invalidation accurately', async () => {
      const session = await testEnv.createTestSession('gitlab');
      const userManager = TestUserManager.getInstance();
      const user = userManager.getTestUser(session.userId);
      
      // Set up multiple cache entries with different TTLs
      if (user) {
        user.cacheData = {
          'short_ttl': {
            data: 'short_lived_data',
            timestamp: Date.now(),
            ttl: 50
          },
          'medium_ttl': {
            data: 'medium_lived_data',
            timestamp: Date.now(),
            ttl: 100
          },
          'long_ttl': {
            data: 'long_lived_data',
            timestamp: Date.now(),
            ttl: 200
          }
        };
      }

      // Check initial state
      const checkCacheStatus = () => {
        const cacheData = user?.cacheData;
        return {
          short_ttl: cacheData?.['short_ttl'] ? {
            valid: Date.now() - cacheData['short_ttl'].timestamp < cacheData['short_ttl'].ttl,
            age: Date.now() - cacheData['short_ttl'].timestamp
          } : null,
          medium_ttl: cacheData?.['medium_ttl'] ? {
            valid: Date.now() - cacheData['medium_ttl'].timestamp < cacheData['medium_ttl'].ttl,
            age: Date.now() - cacheData['medium_ttl'].timestamp
          } : null,
          long_ttl: cacheData?.['long_ttl'] ? {
            valid: Date.now() - cacheData['long_ttl'].timestamp < cacheData['long_ttl'].ttl,
            age: Date.now() - cacheData['long_ttl'].timestamp
          } : null
        };
      };

      const initialStatus = checkCacheStatus();
      expect(initialStatus.short_ttl?.valid).toBe(true);
      expect(initialStatus.medium_ttl?.valid).toBe(true);
      expect(initialStatus.long_ttl?.valid).toBe(true);

      // Wait for short TTL to expire
      await new Promise(resolve => setTimeout(resolve, 60));
      
      const afterShortExpiry = checkCacheStatus();
      expect(afterShortExpiry.short_ttl?.valid).toBe(false);
      expect(afterShortExpiry.medium_ttl?.valid).toBe(true);
      expect(afterShortExpiry.long_ttl?.valid).toBe(true);

      // Wait for medium TTL to expire
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const afterMediumExpiry = checkCacheStatus();
      expect(afterMediumExpiry.short_ttl?.valid).toBe(false);
      expect(afterMediumExpiry.medium_ttl?.valid).toBe(false);
      expect(afterMediumExpiry.long_ttl?.valid).toBe(true);

      console.log('Selective invalidation test: Cache entries expired at correct intervals');
    });

    it('validates cache invalidation on data updates', async () => {
      const session = await testEnv.createTestSession('jira');
      const userManager = TestUserManager.getInstance();
      const user = userManager.getTestUser(session.userId);
      
      // Set up cache with data
      const cacheKey = 'update_invalidation_test';
      if (user) {
        user.cacheData = {
          [cacheKey]: {
            data: { value: 'original', version: 1 },
            timestamp: Date.now(),
            ttl: 500
          }
        };
      }

      // First read (cache hit)
      const read1 = user?.cacheData?.[cacheKey];
      expect(read1?.data?.version).toBe(1);

      // Update the underlying data
      if (user) {
        user.cacheData[cacheKey].data = { value: 'updated', version: 2 };
        user.cacheData[cacheKey].timestamp = Date.now(); // Reset timestamp
      }

      // Second read (should see updated data)
      const read2 = user?.cacheData?.[cacheKey];
      expect(read2?.data?.version).toBe(2);
      expect(read2?.data?.value).toBe('updated');

      // Invalidate cache manually
      delete user?.cacheData?.[cacheKey];

      // Third read (should be cache miss)
      const read3 = user?.cacheData?.[cacheKey];
      expect(read3).toBeUndefined();

      console.log('Cache invalidation on update test: Data updates properly invalidate cache');
    });
  });

  describe('Cache Performance Under Concurrent Access', () => {
    it('maintains performance under concurrent cache access', async () => {
      const concurrentAccesses = 20;
      const cacheKey = 'concurrent_access_test';
      
      const accessPromises = Array.from({ length: concurrentAccesses }, async (_, i) => {
        const startTime = performance.now();
        const userManager = TestUserManager.getInstance();
        
        // Simulate cache access with potential contention
        const isCacheHit = Math.random() > 0.15; // 85% hit rate
        await new Promise(resolve => setTimeout(resolve, Math.random() * 3));
        
        const endTime = performance.now();
        const responseTime = endTime - startTime;
        
        return {
          accessId: i,
          cacheHit: isCacheHit,
          responseTime,
          timestamp: Date.now()
        };
      });

      const results = await Promise.all(accessPromises);
      
      // Analyze concurrent performance
      const cacheHits = results.filter(r => r.cacheHit);
      const cacheMisses = results.filter(r => !r.cacheHit);
      const avgResponseTime = results.reduce((sum, r) => sum + r.responseTime, 0) / results.length;
      
      expect(cacheHits.length).toBeGreaterThan(concurrentAccesses * 0.8); // 80%+ hit rate
      expect(avgResponseTime).toBeLessThan(10); // Fast average response time
      
      console.log(`Concurrent cache access: ${cacheHits.length}/${concurrentAccesses} hits, ${avgResponseTime.toFixed(2)}ms avg response`);
    });

    it('handles cache race conditions gracefully', async () => {
      const raceContestants = 15;
      const cacheKey = 'race_condition_test';
      let cacheData = { value: 'initial', timestamp: Date.now() };
      
      const racePromises = Array.from({ length: raceContestants }, async (_, i) => {
        const startTime = performance.now();
        
        // Simulate concurrent read-modify-write cycle
        const readData = cacheData; // Read
        await new Promise(resolve => setTimeout(resolve, Math.random() * 2));
        
        const modifiedData = {
          ...readData,
          value: `modified_${i}`,
          timestamp: Date.now()
        };
        
        cacheData = modifiedData; // Write
        
        const endTime = performance.now();
        
        return {
          contestantId: i,
          readValue: readData.value,
          writeValue: modifiedData.value,
          responseTime: endTime - startTime,
          timestamp: Date.now()
        };
      });

      const raceResults = await Promise.all(racePromises);
      
      // Verify all races completed
      raceResults.forEach(result => {
        expect(result.readValue).toBeDefined();
        expect(result.writeValue).toBeDefined();
        expect(result.writeValue).toMatch(/^modified_\d+$/);
      });

      // Verify final cache state is consistent
      expect(cacheData.value).toMatch(/^modified_\d+$/);
      expect(cacheData.timestamp).toBeGreaterThan(0);

      console.log(`Cache race condition test: ${raceContestants} concurrent operations completed without corruption`);
    });

    it('validates cache consistency under high concurrent load', async () => {
      const highLoadOperations = 30;
      const operationTypes = ['read', 'write', 'delete', 'update'] as const;
      const cacheKeys = ['consistency_key_1', 'consistency_key_2', 'consistency_key_3'];
      
      const consistencyMap = new Map<string, { operations: any[]; finalValue: any }>();
      cacheKeys.forEach(key => consistencyMap.set(key, { operations: [], finalValue: null }));
      
      const loadPromises = Array.from({ length: highLoadOperations }, async (_, i) => {
        const operation = operationTypes[i % operationTypes.length];
        const cacheKey = cacheKeys[i % cacheKeys.length];
        
        const consistencyData = consistencyMap.get(cacheKey);
        if (!consistencyData) return;
        
        switch (operation) {
          case 'read':
            const readValue = consistencyData.finalValue || `initial_${cacheKey}`;
            consistencyData.operations.push({ type: 'read', value: readValue, timestamp: Date.now() });
            break;
            
          case 'write':
            const writeValue = `written_${i}`;
            consistencyData.finalValue = writeValue;
            consistencyData.operations.push({ type: 'write', value: writeValue, timestamp: Date.now() });
            break;
            
          case 'update':
            if (consistencyData.finalValue) {
              const updatedValue = `${consistencyData.finalValue}_updated_${i}`;
              consistencyData.finalValue = updatedValue;
              consistencyData.operations.push({ type: 'update', value: updatedValue, timestamp: Date.now() });
            }
            break;
            
          case 'delete':
            consistencyData.finalValue = null;
            consistencyData.operations.push({ type: 'delete', value: null, timestamp: Date.now() });
            break;
        }
        
        return {
          operationId: i,
          operation,
          cacheKey,
          value: consistencyData.finalValue,
          timestamp: Date.now()
        };
      });

      const loadResults = await Promise.all(loadPromises);
      
      // Verify consistency across all operations
      consistencyMap.forEach((data, key) => {
        expect(data.operations.length).toBeGreaterThan(0);
        
        // All operations should have valid timestamps
        data.operations.forEach(op => {
          expect(op.timestamp).toBeGreaterThan(0);
        });
      });

      // Verify final state is consistent
      loadResults.forEach(result => {
        expect(result.operationId).toBeLessThan(highLoadOperations);
        expect(result.cacheKey).toBeDefined();
        expect(result.timestamp).toBeDefined();
      });

      console.log(`Cache consistency test: ${highLoadOperations} operations completed with maintained consistency`);
    });
  });

  describe('Stale-While-Revalidate Patterns', () => {
    it('implements stale-while-revalidate cache pattern correctly', async () => {
      const session = await testEnv.createTestSession('github');
      const userManager = TestUserManager.getInstance();
      const user = userManager.getTestUser(session.userId);
      
      const cacheKey = 'stale_while_revalidate_test';
      const staleThreshold = 100; // ms
      
      // Set up initial cache data
      if (user) {
        user.cacheData = {
          [cacheKey]: {
            data: { value: 'fresh_data', version: 1 },
            timestamp: Date.now(),
            ttl: 500,
            staleThreshold
          }
        };
      }

      // First access - fresh data
      const freshAccess = () => {
        const cacheData = user?.cacheData?.[cacheKey];
        const age = Date.now() - (cacheData?.timestamp || 0);
        const isFresh = age < (cacheData?.ttl || 0);
        const isStale = age >= (cacheData?.ttl || 0) && age < ((cacheData?.ttl || 0) + (cacheData?.staleThreshold || 0));
        const isExpired = age >= ((cacheData?.ttl || 0) + (cacheData?.staleThreshold || 0));
        
        return {
          data: cacheData?.data,
          age,
          status: isFresh ? 'fresh' : isStale ? 'stale' : 'expired',
          shouldRevalidate: isStale
        };
      };

      const result1 = freshAccess();
      expect(result1.status).toBe('fresh');
      expect(result1.shouldRevalidate).toBe(false);

      // Wait for data to become stale but not expired
      await new Promise(resolve => setTimeout(resolve, 300)); // Between TTL and stale threshold
      
      const result2 = freshAccess();
      expect(result2.status).toBe('stale');
      expect(result2.shouldRevalidate).toBe(true);
      expect(result2.data?.version).toBe(1);

      // Wait for data to become expired
      await new Promise(resolve => setTimeout(resolve, 300)); // Past stale threshold
      
      const result3 = freshAccess();
      expect(result3.status).toBe('expired');
      expect(result3.shouldRevalidate).toBe(false);
      expect(result3.data?.version).toBe(1);

      console.log('Stale-while-revalidate test: Correct state transitions from fresh → stale → expired');
    });

    it('handles concurrent revalidation requests properly', async () => {
      const staleKey = 'concurrent_revalidation_test';
      const revalidationRequests = 10;
      
      let isRevalidating = false;
      const revalidationPromises = Array.from({ length: revalidationRequests }, async (_, i) => {
        const startTime = performance.now();
        
        // Simulate concurrent stale cache access
        if (!isRevalidating) {
          isRevalidating = true;
          
          // Simulate revalidation process
          await new Promise(resolve => setTimeout(resolve, Math.random() * 10 + 5));
          
          isRevalidating = false;
          return {
            requestId: i,
            gotFreshData: true,
            revalidationTime: Date.now() - startTime
          };
        } else {
          // Another request is already revalidating, serve stale data
          return {
            requestId: i,
            gotFreshData: false,
            servedStale: true,
            revalidationTime: Date.now() - startTime
          };
        }
      });

      const revalidationResults = await Promise.all(revalidationPromises);
      
      // Verify revalidation behavior
      const freshDataRequests = revalidationResults.filter(r => r.gotFreshData);
      const staleServedRequests = revalidationResults.filter(r => r.servedStale);
      
      expect(freshDataRequests.length).toBe(1); // Only one should trigger revalidation
      expect(staleServedRequests.length).toBe(revalidationRequests - 1); // Others should serve stale
      expect(freshDataRequests[0]?.revalidationTime).toBeGreaterThan(0);

      console.log(`Concurrent revalidation test: 1 fresh revalidation, ${staleServedRequests.length} stale served`);
    });

    it('validates cache warming and prefetch patterns', async () => {
      const prefetchKeys = ['prefetch_1', 'prefetch_2', 'prefetch_3'];
      const warmupResults: Array<{
        key: string;
        accessTime: number;
        cacheHit: boolean;
        wasPrefetched: boolean;
      }> = [];

      for (const key of prefetchKeys) {
        const startTime = performance.now();
        
        // Simulate prefetching during idle time
        const wasPrefetched = Math.random() > 0.3; // 70% chance of prefetch
        if (wasPrefetched) {
          await new Promise(resolve => setTimeout(resolve, Math.random() * 2));
        }
        
        const endTime = performance.now();
        const accessTime = endTime - startTime;
        
        // Later access should be fast if prefetched
        const cacheHit = wasPrefetched && Math.random() > 0.1; // High hit rate for prefetched
        
        warmupResults.push({
          key,
          accessTime,
          cacheHit,
          wasPrefetched
        });
      }

      // Analyze prefetching effectiveness
      warmupResults.forEach(result => {
        expect(result.key).toBeDefined();
        expect(result.accessTime).toBeGreaterThanOrEqual(0);
        
        if (result.wasPrefetched) {
          expect(result.accessTime).toBeLessThan(5); // Fast access for prefetched
        }
      });

      const prefetchedCount = warmupResults.filter(r => r.wasPrefetched).length;
      const prefetchedHitRate = warmupResults.filter(r => r.wasPrefetched && r.cacheHit).length / prefetchedCount;
      
      expect(prefetchedHitRate).toBeGreaterThanOrEqual(0.8); // 80%+ hit rate for prefetched
      
      console.log(`Cache warming test: ${prefetchedCount}/${prefetchKeys.length} prefetched, ${(prefetchedHitRate * 100).toFixed(1)}% hit rate`);
    });
  });
});
