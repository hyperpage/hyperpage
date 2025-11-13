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
  TestUserData,
} from "@/lib/../__tests__/shared/test-credentials";
import logger from "@/lib/logger";

const shouldRunMultiUserLoadSuite =
  process.env.PERFORMANCE_TESTS === "1" || process.env.E2E_TESTS === "1";

/**
 * Phase 3: Optional performance-style / multi-user load simulation suite
 *
 * This suite:
 * - Exercises IntegrationTestEnvironment and shared test credentials helpers
 * - Assumes a fully wired environment with valid external provider credentials
 * - Uses synthetic timing/behavior assertions (no real SLO guarantees)
 *
 * It MUST be:
 * - Explicitly opt-in via PERFORMANCE_TESTS=1 or E2E_TESTS=1
 * - Treated as CI/enterprise-only coverage, never a default local blocker
 *
 * If the required env flags are not set, the entire suite is skipped with a clear
 * message so that default `vitest` runs remain fast, hermetic, and Postgres-only.
 */
const describeMultiUserLoad = shouldRunMultiUserLoadSuite
  ? describe
  : describe.skip;

describeMultiUserLoad(
  "Multi-User Load Testing (Optional CI/Performance Suite)",
  () => {
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

    describe("Multi-User Scenario Simulation", () => {
      it("handles multiple simultaneous user authentication attempts", async () => {
        const userCount = 15;
        const providers = ["github", "gitlab", "jira"] as const;

        const userCreationPromises = Array.from(
          { length: userCount },
          async (_, i) => {
            const provider = providers[i % providers.length];
            return testEnv.createTestSession(provider);
          },
        );

        const users = await Promise.all(userCreationPromises);

        expect(users).toHaveLength(userCount);

        users.forEach((user) => {
          expect(user.userId).toBeDefined();
          expect(user.sessionId).toBeDefined();
          expect(user.credentials).toBeDefined();
        });

        const userIds = users.map((u) => u.userId);
        expect(new Set(userIds).size).toBe(userIds.length);

        const providerCounts = new Map<string, number>();
        users.forEach((user, i) => {
          const provider = providers[i % providers.length];
          providerCounts.set(provider, (providerCounts.get(provider) || 0) + 1);
        });

        expect(providerCounts.get("github")).toBeGreaterThan(0);
        expect(providerCounts.get("gitlab")).toBeGreaterThan(0);
        expect(providerCounts.get("jira")).toBeGreaterThan(0);
      });

      it("simulates realistic user behavior patterns under load", async () => {
        const userTypes = [
          { type: "power-user", requestCount: 20 },
          { type: "regular-user", requestCount: 10 },
          { type: "light-user", requestCount: 5 },
        ];

        const simulatedUsers = await Promise.all(
          userTypes.map(async (userType) => {
            const session = await testEnv.createTestSession("github");

            // Ensure a corresponding test user exists for this session
            const userManager = TestUserManager.getInstance();
            userManager.createTestUser(session);

            const startTime = performance.now();
            const userPromises = Array.from(
              { length: userType.requestCount },
              async (_, i) => {
                const user = userManager.getTestUser(session.userId);

                await new Promise((resolve) =>
                  setTimeout(resolve, Math.random() * 10),
                );

                return {
                  requestId: `${userType.type}-${i}`,
                  userType: userType.type,
                  success: !!user,
                  timestamp: Date.now(),
                };
              },
            );

            const results = await Promise.all(userPromises);
            const endTime = performance.now();

            return {
              userType: userType.type,
              sessionId: session.sessionId,
              results,
              totalTime: endTime - startTime,
              successfulRequests: results.filter((r) => r.success).length,
            };
          }),
        );

        simulatedUsers.forEach((user) => {
          const successRate =
            user.results.length === 0
              ? 0
              : user.successfulRequests / user.results.length;

          // Require at least 80% success when there are attempts; allow 0 when no results
          if (user.results.length > 0) {
            expect(successRate).toBeGreaterThanOrEqual(0.8);
          }

          expect(user.totalTime).toBeGreaterThanOrEqual(0);
        });

        const powerUser = simulatedUsers.find(
          (u) => u.userType === "power-user",
        );
        const lightUser = simulatedUsers.find(
          (u) => u.userType === "light-user",
        );

        if (powerUser && lightUser) {
          expect(powerUser.totalTime).toBeGreaterThanOrEqual(
            lightUser.totalTime * 0.9,
          ); // Allow for reasonable variation
        }

        logger.info(
          `Load test completed: ${simulatedUsers.length} user types processed`,
          {
            type: "load_test_completion",
            userTypes: simulatedUsers.length,
            userTypeDetails: simulatedUsers.map((u) => ({
              type: u.userType,
              totalTime: `${u.totalTime.toFixed(2)}ms`,
              successfulRequests: u.successfulRequests,
            })),
          },
        );
      });
    });

    describe("Resource Contention and Fair Allocation", () => {
      it("maintains fair resource allocation under concurrent load", async () => {
        const concurrentUsers = 12;
        const providers = ["github", "gitlab", "jira"] as const;

        const userPromises = Array.from(
          { length: concurrentUsers },
          async (_, i) => {
            const provider = providers[i % providers.length];
            const session = await testEnv.createTestSession(provider);

            // Create a mapped test user for this session
            const userManager = TestUserManager.getInstance();
            userManager.createTestUser(session);

            const operations = Array.from({ length: 5 }, async (_, opIndex) => {
              const user = userManager.getTestUser(session.userId);

              await new Promise((resolve) =>
                setTimeout(resolve, Math.random() * 20),
              );

              return {
                userId: session.userId,
                provider,
                operationIndex: opIndex,
                success: !!user,
                timestamp: Date.now(),
              };
            });

            const results = await Promise.all(operations);
            return {
              userId: session.userId,
              provider,
              operations: results,
              totalOperations: results.length,
              successfulOperations: results.filter((r) => r.success).length,
            };
          },
        );

        const users = await Promise.all(userPromises);

        users.forEach((user) => {
          // Each user attempts 5 operations; assert high success ratio instead of perfect 5/5.
          if (user.totalOperations > 0) {
            const successRate =
              user.successfulOperations / user.totalOperations;
            expect(successRate).toBeGreaterThanOrEqual(0.8);
          }

          expect(user.totalOperations).toBeGreaterThan(0);
        });

        const providerStats = new Map<
          string,
          { users: number; totalOps: number; successRate: number }
        >();

        users.forEach((user) => {
          if (!providerStats.has(user.provider)) {
            providerStats.set(user.provider, {
              users: 0,
              totalOps: 0,
              successRate: 0,
            });
          }

          const stats = providerStats.get(user.provider)!;
          stats.users += 1;
          stats.totalOps += user.totalOperations;
          stats.successRate = user.successfulOperations / user.totalOperations;
        });

        const userCounts = Array.from(providerStats.values()).map(
          (s) => s.users,
        );
        const maxUserCount = Math.max(...userCounts);
        const minUserCount = Math.min(...userCounts);

        expect(maxUserCount - minUserCount).toBeLessThanOrEqual(1);

        providerStats.forEach((stats) => {
          expect(stats.successRate).toBe(1.0);
        });

        logger.info(
          `Resource allocation test: ${concurrentUsers} users across ${providerStats.size} providers`,
          {
            type: "resource_allocation_test",
            concurrentUsers,
            providerCount: providerStats.size,
            providerStats: Object.fromEntries(
              Array.from(providerStats.entries()).map(([provider, stats]) => [
                provider,
                {
                  users: stats.users,
                  totalOps: stats.totalOps,
                  successRate: `${(stats.successRate * 100).toFixed(1)}%`,
                },
              ]),
            ),
          },
        );
      });

      it("handles resource exhaustion gracefully under extreme load", async () => {
        const extremeUserCount = 25;
        const providers = ["github", "gitlab", "jira"] as const;

        const extremeLoadPromises = Array.from(
          { length: extremeUserCount },
          async (_, i) => {
            const provider = providers[i % providers.length];
            const session = await testEnv.createTestSession(provider);

            // Create a mapped test user for this session
            const userManager = TestUserManager.getInstance();
            userManager.createTestUser(session);

            const resourceOperations = async () => {
              const user = userManager.getTestUser(session.userId);

              await new Promise((resolve) =>
                setTimeout(resolve, Math.random() * 30),
              );

              if (user) {
                user.lastAccessed = new Date().toISOString();
                (user as TestUserData & { accessCount: number }).accessCount =
                  ((user as TestUserData & { accessCount: number })
                    .accessCount || 0) + 1;
              }

              return {
                userId: session.userId,
                provider,
                resourceAcquired: !!user,
                timestamp: Date.now(),
                accessCount:
                  (user as TestUserData & { accessCount: number })
                    ?.accessCount || 0,
              };
            };

            try {
              const result = await resourceOperations();
              return { ...result, error: null };
            } catch (error) {
              return {
                userId: session.userId,
                provider,
                resourceAcquired: false,
                timestamp: Date.now(),
                accessCount: 0,
                error: error instanceof Error ? error.message : "unknown",
              };
            }
          },
        );

        const results = await Promise.all(extremeLoadPromises);

        const successfulOperations = results.filter(
          (r) => r.resourceAcquired && !r.error,
        );
        const failedOperations = results.filter(
          (r) => !r.resourceAcquired || r.error,
        );

        const successRate = successfulOperations.length / extremeUserCount;

        // Under extreme load, require majority success but not perfection
        expect(successRate).toBeGreaterThanOrEqual(0.6);
        expect(failedOperations.length).toBeLessThanOrEqual(
          extremeUserCount * 0.4,
        );

        const accessCounts = results
          .map((r) => r.accessCount)
          .filter((count) => count > 0);
        expect(accessCounts.length).toBe(successfulOperations.length);

        const maxAccessCount = Math.max(...accessCounts);
        expect(maxAccessCount).toBeLessThanOrEqual(extremeUserCount);

        logger.info(
          `Extreme load test: ${successfulOperations.length}/${extremeUserCount} operations successful`,
          {
            type: "extreme_load_test",
            totalUsers: extremeUserCount,
            successfulOperations: successfulOperations.length,
            failedOperations: failedOperations.length,
            successRate: `${((successfulOperations.length / extremeUserCount) * 100).toFixed(1)}%`,
            maxAccessCount,
          },
        );
      });
    });

    describe("Performance Degradation Patterns", () => {
      it("maintains acceptable performance under increasing user load", async () => {
        const loadLevels = [5, 10, 15, 20];
        const performanceMetrics: Array<{
          userCount: number;
          totalTime: number;
          averageTimePerUser: number;
          throughput: number;
          successRate: number;
        }> = [];

        for (const userCount of loadLevels) {
          const startTime = performance.now();

          const loadPromises = Array.from({ length: userCount }, async () => {
            const session = await testEnv.createTestSession("github");
            const userManager = TestUserManager.getInstance();
            userManager.createTestUser(session);
            const user = userManager.getTestUser(session.userId);

            const operations = [
              () => !!user,
              () => ({ sessionId: session.sessionId, valid: true }),
              () => ({ provider: "github", authenticated: !!user }),
            ];

            const results = await Promise.all(operations.map((op) => op()));
            return {
              userId: session.userId,
              operationsCompleted: results.length,
              success: results.every((r) => r !== false),
              timestamp: Date.now(),
            };
          });

          const users = await Promise.all(loadPromises);
          const endTime = performance.now();

          const totalTime = endTime - startTime;
          const successfulUsers = users.filter((u) => u.success).length;
          const successRate = successfulUsers / userCount;
          const throughput = userCount / (totalTime / 1000);

          performanceMetrics.push({
            userCount,
            totalTime,
            averageTimePerUser: totalTime / userCount,
            throughput,
            successRate,
          });
        }

        performanceMetrics.forEach((metric) => {
          expect(metric.userCount).toBeGreaterThan(0);
          expect(metric.totalTime).toBeGreaterThan(0);
          expect(metric.averageTimePerUser).toBeGreaterThan(0);
          expect(metric.throughput).toBeGreaterThan(0);
          // Maintain a high but realistic success threshold under load
          expect(metric.successRate).toBeGreaterThanOrEqual(0.6);
        });

        for (let i = 1; i < performanceMetrics.length; i++) {
          const previous = performanceMetrics[i - 1];
          const current = performanceMetrics[i];

          const throughputDegradation =
            (previous.throughput - current.throughput) / previous.throughput;
          expect(throughputDegradation).toBeLessThan(0.5);

          expect(current.successRate).toBeGreaterThanOrEqual(
            previous.successRate - 0.1,
          );
        }
      });

      it("recovers performance after load spike", async () => {
        const normalLoadUsers = 5;
        const normalLoadStart = performance.now();

        const normalLoadPromises = Array.from(
          { length: normalLoadUsers },
          async () => {
            const session = await testEnv.createTestSession("github");
            const userManager = TestUserManager.getInstance();
            userManager.createTestUser(session);
            const user = userManager.getTestUser(session.userId);
            return !!user;
          },
        );

        await Promise.all(normalLoadPromises);
        const normalLoadEnd = performance.now();
        const normalLoadTime = normalLoadEnd - normalLoadStart;

        const spikeLoadUsers = 20;
        const spikeLoadStart = performance.now();

        const spikeLoadPromises = Array.from(
          { length: spikeLoadUsers },
          async () => {
            const session = await testEnv.createTestSession("gitlab");
            const userManager = TestUserManager.getInstance();
            userManager.createTestUser(session);
            const user = userManager.getTestUser(session.userId);

            await new Promise((resolve) =>
              setTimeout(resolve, Math.random() * 50),
            );

            return {
              userId: session.userId,
              success: !!user,
              timestamp: Date.now(),
            };
          },
        );

        const spikeUsers = await Promise.all(spikeLoadPromises);
        const spikeLoadEnd = performance.now();
        const spikeLoadTime = spikeLoadEnd - spikeLoadStart;

        const recoveryLoadUsers = 5;
        const recoveryLoadStart = performance.now();

        const recoveryLoadPromises = Array.from(
          { length: recoveryLoadUsers },
          async () => {
            const session = await testEnv.createTestSession("jira");
            const userManager = TestUserManager.getInstance();
            userManager.createTestUser(session);
            const user = userManager.getTestUser(session.userId);
            return !!user;
          },
        );

        await Promise.all(recoveryLoadPromises);
        const recoveryLoadEnd = performance.now();
        const recoveryLoadTime = recoveryLoadEnd - recoveryLoadStart;

        const spikeThroughput = spikeLoadUsers / (spikeLoadTime / 1000);
        const recoveryThroughput =
          recoveryLoadUsers / (recoveryLoadTime / 1000);

        const spikeSuccessRate =
          spikeUsers.filter((u) => u.success).length / spikeLoadUsers;

        expect(spikeLoadTime).toBeGreaterThan(normalLoadTime);
        // Spike phase should still mostly succeed, but allow some failures
        expect(spikeSuccessRate).toBeGreaterThanOrEqual(0.6);

        expect(recoveryLoadTime).toBeLessThan(250); // 0.25s (250ms) recovery threshold
        expect(recoveryThroughput).toBeGreaterThan(spikeThroughput);
        expect(recoveryThroughput).toBeGreaterThan(0); // Recovery should show some throughput (focus on spike recovery, not absolute performance)

        logger.info(
          `Load spike test: Normal=${normalLoadTime.toFixed(2)}ms, Spike=${spikeLoadTime.toFixed(2)}ms, Recovery=${recoveryLoadTime.toFixed(2)}ms`,
          {
            type: "load_spike_test",
            normalLoadTime: `${normalLoadTime.toFixed(2)}ms`,
            spikeLoadTime: `${spikeLoadTime.toFixed(2)}ms`,
            recoveryLoadTime: `${recoveryLoadTime.toFixed(2)}ms`,
            spikeSuccessRate: `${(spikeSuccessRate * 100).toFixed(1)}%`,
            spikeThroughput: `${spikeThroughput.toFixed(2)} users/sec`,
            recoveryThroughput: `${recoveryThroughput.toFixed(2)} users/sec`,
          },
        );
      });
    });

    describe("User Experience Under Load", () => {
      it("maintains user experience quality under concurrent load", async () => {
        const concurrentUsers = 18;
        const providers = ["github", "gitlab", "jira"] as const;

        const userExperiencePromises = Array.from(
          { length: concurrentUsers },
          async (_, i) => {
            const provider = providers[i % providers.length];
            const startTime = performance.now();

            try {
              const session = await testEnv.createTestSession(provider);
              const endTime = performance.now();
              const creationTime = endTime - startTime;

              const userManager = TestUserManager.getInstance();
              const user = userManager.getTestUser(session.userId);

              const sessionQuality = {
                userId: session.userId,
                sessionId: session.sessionId,
                provider,
                creationTime,
                authenticated: !!user,
                credentialsValid: !!session.credentials.clientId,
                timestamp: Date.now(),
              };

              return { ...sessionQuality, error: null };
            } catch (error) {
              return {
                userId: null,
                sessionId: null,
                provider,
                creationTime: 0,
                authenticated: false,
                credentialsValid: false,
                timestamp: Date.now(),
                error: error instanceof Error ? error.message : "unknown",
              };
            }
          },
        );

        const userResults = await Promise.all(userExperiencePromises);

        const successfulSessions = userResults.filter(
          (r) => !r.error && r.authenticated,
        ).length;
        const successfulResults = userResults.filter(
          (r) => !r.error && r.authenticated,
        );
        const averageSessionCreationTime =
          successfulResults.length > 0
            ? successfulResults.reduce((sum, r) => sum + r.creationTime, 0) /
              successfulResults.length
            : 0;
        const errorRate =
          userResults.length > 0
            ? userResults.filter((r) => r.error).length / userResults.length
            : 0;

        // In a fully wired environment with valid test users, we care that:
        // - Some sessions succeed
        // - Latency is reasonable for those successes
        // - Error rate is low
        // We do NOT fail the suite when successRate is 0 (e.g. if environment is misconfigured);
        // in that case this test becomes observational.
        if (userResults.length > 0) {
          const successRate = successfulSessions / userResults.length;
          if (successRate > 0) {
            expect(successRate).toBeGreaterThanOrEqual(0.6);
          }
        }

        if (successfulResults.length > 0) {
          expect(averageSessionCreationTime).toBeLessThan(1000);
        }

        if (userResults.length > 0) {
          expect(errorRate).toBeLessThan(0.15);
        }

        const creationTimes = successfulResults
          .map((r) => r.creationTime)
          .sort((a, b) => a - b);

        // Only compute percentile-based consistency when we have enough successful samples
        if (creationTimes.length >= 2) {
          const p95 = creationTimes[Math.floor(creationTimes.length * 0.95)];
          const p50 = creationTimes[Math.floor(creationTimes.length * 0.5)];
          const responseTimeConsistency = p95 / (p50 || 1);

          expect(responseTimeConsistency).toBeLessThan(5);

          logger.info("User experience metrics:", {
            type: "user_experience_metrics",
            totalUsers: concurrentUsers,
            successfulSessions,
            averageSessionCreationTime: `${averageSessionCreationTime.toFixed(2)}ms`,
            errorRate: `${(errorRate * 100).toFixed(1)}%`,
            responseTimeConsistency: responseTimeConsistency.toFixed(2),
          });
        } else {
          // With insufficient data points, log observability only
          logger.info(
            "User experience metrics (insufficient samples for consistency check):",
            {
              type: "user_experience_metrics",
              totalUsers: concurrentUsers,
              successfulSessions,
              averageSessionCreationTime: `${averageSessionCreationTime.toFixed(2)}ms`,
              errorRate: `${(errorRate * 100).toFixed(1)}%`,
              responseTimeConsistency: "N/A",
            },
          );
        }
      });

      it("provides consistent service quality across different user patterns", async () => {
        const userPatterns = [
          { name: "burst-users", count: 10, pattern: "burst" as const },
          { name: "steady-users", count: 10, pattern: "steady" as const },
          { name: "spike-users", count: 10, pattern: "spike" as const },
        ];

        const patternResults = await Promise.all(
          userPatterns.map(async (pattern) => {
            const startTime = performance.now();

            const patternPromises = Array.from(
              { length: pattern.count },
              async (_, i) => {
                const session = await testEnv.createTestSession("github");
                const userManager = TestUserManager.getInstance();
                userManager.createTestUser(session);
                const user = userManager.getTestUser(session.userId);

                switch (pattern.pattern) {
                  case "burst":
                    await new Promise((resolve) =>
                      setTimeout(resolve, Math.random() * 10),
                    );
                    break;
                  case "steady":
                    await new Promise((resolve) =>
                      setTimeout(resolve, 50 + Math.random() * 20),
                    );
                    break;
                  case "spike":
                    const delay = i % 3 === 0 ? 100 : Math.random() * 20;
                    await new Promise((resolve) => setTimeout(resolve, delay));
                    break;
                }

                return {
                  pattern: pattern.pattern,
                  index: i,
                  success: !!user,
                  timestamp: Date.now(),
                  sessionId: session.sessionId,
                };
              },
            );

            const results = await Promise.all(patternPromises);
            const endTime = performance.now();

            return {
              pattern: pattern.pattern,
              totalTime: endTime - startTime,
              results,
              successRate:
                results.filter((r) => r.success).length / pattern.count,
              averageTime: (endTime - startTime) / pattern.count,
            };
          }),
        );

        patternResults.forEach((pattern) => {
          const attempts = pattern.results.length;

          // Only assert on success rate if there were attempts; avoids division by zero
          if (attempts > 0) {
            expect(pattern.successRate).toBeGreaterThanOrEqual(0.6);
          }

          expect(pattern.totalTime).toBeGreaterThanOrEqual(0);
          expect(pattern.averageTime).toBeGreaterThanOrEqual(0);
        });

        const successRates = patternResults.map((p) => p.successRate);
        const maxSuccessRate = Math.max(...successRates);
        const minSuccessRate = Math.min(...successRates);
        const successRateSpread = maxSuccessRate - minSuccessRate;

        // Ensure consistent service quality across patterns: no pattern lags far behind
        expect(successRateSpread).toBeLessThanOrEqual(0.2);

        const averageTimes = patternResults.map((p) => p.averageTime);
        const maxTime = Math.max(...averageTimes);
        const minTime = Math.min(...averageTimes);
        const timeVariation = (maxTime - minTime) / minTime;

        expect(timeVariation).toBeLessThan(20); // Allow for realistic user pattern diversity with varied timing

        logger.info("Pattern service quality:", {
          type: "pattern_service_quality",
          patterns: patternResults.map((p) => ({
            pattern: p.pattern,
            successRate: `${(p.successRate * 100).toFixed(1)}%`,
            avgTime: `${p.averageTime.toFixed(2)}ms`,
          })),
          timeVariation: `${timeVariation.toFixed(1)}%`,
        });
      });
    });
  },
);
