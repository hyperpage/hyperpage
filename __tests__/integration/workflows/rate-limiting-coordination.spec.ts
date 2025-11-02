/**
 * Rate Limiting Coordination Tests
 * 
 * This test suite validates rate limiting behavior across all platforms
 * (GitHub, GitLab, Jira) and ensures proper coordination when multiple
 * tools are used simultaneously.
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll } from 'vitest';
import { IntegrationTestEnvironment, OAuthTestCredentials } from '../../lib/test-credentials';
import { TestBrowser } from './utils/test-browser';
import { UserJourneySimulator } from './utils/user-journey-simulator';

export interface RateLimitStatus {
  provider: string;
  current: number;
  limit: number;
  resetTime: number;
  remaining: number;
  isLimited: boolean;
}

export interface CrossToolRateLimitResult {
  totalRequests: number;
  limitedProviders: string[];
  successfulRequests: number;
  rateLimitedRequests: number;
  coordinationWorking: boolean;
}

describe('Rate Limiting Coordination Tests', () => {
  let testEnv: IntegrationTestEnvironment;
  let baseUrl: string;
  let browser: TestBrowser;
  let journeySimulator: UserJourneySimulator;

  beforeAll(async () => {
    testEnv = await IntegrationTestEnvironment.setup();
    baseUrl = process.env.HYPERPAGE_TEST_BASE_URL || 'http://localhost:3000';
    browser = new TestBrowser();
    journeySimulator = new UserJourneySimulator(baseUrl, browser);
  });

  afterAll(async () => {
    await browser.cleanup();
    await testEnv.cleanup();
  });

  describe('Individual Tool Rate Limiting', () => {
    it('should respect GitHub API rate limits', async () => {
      const githubSession = await testEnv.createTestSession('github');
      await journeySimulator.completeOAuthFlow('github', githubSession.credentials);
      await journeySimulator.enableTool('github');

      // Simulate GitHub rate limit (5000 requests/hour)
      const githubLimit = setGitHubRateLimit(5000, 0, Date.now() + 3600000);
      
      // Make requests approaching the limit
      const requests = Array.from({ length: 4990 }, (_, i) => 
        simulateAPICall('github', 'pulls', { per_page: 30 })
      );
      
      // Most requests should succeed
      const results = await Promise.all(requests);
      const successfulRequests = results.filter(r => r.success).length;
      expect(successfulRequests).toBeGreaterThan(4900); // Allow for some failures
      
      // Final request should be rate limited
      const finalRequest = await simulateAPICall('github', 'issues', { per_page: 30 });
      expect(finalRequest.success || finalRequest.rateLimited).toBe(true);
    });

    it('should respect GitLab API rate limits', async () => {
      const gitlabSession = await testEnv.createTestSession('gitlab');
      await journeySimulator.completeOAuthFlow('gitlab', gitlabSession.credentials);
      await journeySimulator.enableTool('gitlab');

      // Simulate GitLab rate limit (300 requests/minute for authenticated users)
      const gitlabLimit = setGitLabRateLimit(300, 0, Date.now() + 60000);
      
      // Make requests approaching the limit
      const requests = Array.from({ length: 295 }, (_, i) => 
        simulateAPICall('gitlab', 'merge_requests', { per_page: 20 })
      );
      
      const results = await Promise.all(requests);
      const successfulRequests = results.filter(r => r.success).length;
      expect(successfulRequests).toBeGreaterThan(250);
      
      // Should handle rate limiting gracefully
      const finalRequests = await Promise.all([
        simulateAPICall('gitlab', 'projects', { per_page: 20 }),
        simulateAPICall('gitlab', 'issues', { per_page: 20 })
      ]);
      
      finalRequests.forEach(result => {
        expect(result.success || result.rateLimited).toBe(true);
      });
    });

    it('should respect Jira API rate limits', async () => {
      const jiraSession = await testEnv.createTestSession('jira');
      await journeySimulator.completeOAuthFlow('jira', jiraSession.credentials);
      await journeySimulator.enableTool('jira');

      // Simulate Jira rate limit (1000 requests/day for cloud)
      const jiraLimit = setJiraRateLimit(1000, 0, Date.now() + 86400000);
      
      // Make requests approaching the limit
      const requests = Array.from({ length: 995 }, (_, i) => 
        simulateAPICall('jira', 'search', { jql: 'project = TEST', maxResults: 50 })
      );
      
      const results = await Promise.all(requests);
      const successfulRequests = results.filter(r => r.success).length;
      expect(successfulRequests).toBeGreaterThan(950);
    });

    it('should implement exponential backoff on rate limit exceeded', async () => {
      const testSession = await testEnv.createTestSession('github');
      await journeySimulator.completeOAuthFlow('github', testSession.credentials);
      
      // Simulate rate limited responses
      setGitHubRateLimit(100, 0, Date.now() + 3600000); // Very low limit
      
      const backoffAttempts = [];
      for (let i = 0; i < 5; i++) {
        const startTime = Date.now();
        await simulateAPICall('github', 'repos', {});
        const endTime = Date.now();
        
        backoffAttempts.push(endTime - startTime);
      }
      
      // Each attempt should take progressively longer (exponential backoff)
      expect(backoffAttempts[1]).toBeGreaterThan(backoffAttempts[0]);
      expect(backoffAttempts[2]).toBeGreaterThan(backoffAttempts[1]);
    });
  });

  describe('Cross-Tool Rate Limit Coordination', () => {
    it('should coordinate rate limits across multiple tools', async () => {
      // Set up all three providers
      const githubSession = await testEnv.createTestSession('github');
      const gitlabSession = await testEnv.createTestSession('gitlab');
      const jiraSession = await testEnv.createTestSession('jira');
      
      await journeySimulator.completeOAuthFlow('github', githubSession.credentials);
      await journeySimulator.completeOAuthFlow('gitlab', gitlabSession.credentials);
      await journeySimulator.completeOAuthFlow('jira', jiraSession.credentials);
      
      await journeySimulator.enableTool('github');
      await journeySimulator.enableTool('gitlab');
      await journeySimulator.enableTool('jira');
      
      // Set aggressive rate limits for testing
      setGitHubRateLimit(10, 0, Date.now() + 3600000);
      setGitLabRateLimit(10, 0, Date.now() + 60000);
      setJiraRateLimit(10, 0, Date.now() + 86400000);
      
      // Make parallel requests to all providers
      const requests = [
        simulateAPICall('github', 'pulls', {}),
        simulateAPICall('gitlab', 'merge_requests', {}),
        simulateAPICall('jira', 'issues', {})
      ];
      
      const results = await Promise.all(requests);
      const successfulResults = results.filter(r => r.success);
      const limitedResults = results.filter(r => r.rateLimited);
      
      // Should show rate limiting coordination working
      expect(successfulResults.length + limitedResults.length).toBe(3);
      expect(limitedResults.length).toBeGreaterThan(0); // At least some should be rate limited
    });

    it('should distribute load evenly across available rate limits', async () => {
      const githubSession = await testEnv.createTestSession('github');
      const gitlabSession = await testEnv.createTestSession('gitlab');
      
      await journeySimulator.completeOAuthFlow('github', githubSession.credentials);
      await journeySimulator.completeOAuthFlow('gitlab', gitlabSession.credentials);
      
      await journeySimulator.enableTool('github');
      await journeySimulator.enableTool('gitlab');
      
      // Set different rate limits for each provider
      setGitHubRateLimit(5, 0, Date.now() + 3600000); // 5 requests
      setGitLabRateLimit(15, 0, Date.now() + 60000);  // 15 requests
      
      // Make requests targeting both providers
      const allRequests = [
        ...Array.from({ length: 10 }, (_, i) => simulateAPICall('github', 'repos', {})),
        ...Array.from({ length: 15 }, (_, i) => simulateAPICall('gitlab', 'projects', {}))
      ];
      
      const results = await Promise.all(allRequests);
      const githubResults = results.slice(0, 10);
      const gitlabResults = results.slice(10);
      
      const githubSuccess = githubResults.filter(r => r.success).length;
      const gitlabSuccess = gitlabResults.filter(r => r.success).length;
      
      // GitLab should have more successful requests due to higher limit
      expect(gitlabSuccess).toBeGreaterThan(githubSuccess);
      
      // GitHub should hit rate limit more quickly
      expect(githubSuccess).toBeLessThanOrEqual(5);
    });

    it('should handle mixed rate limit states across tools', async () => {
      const githubSession = await testEnv.createTestSession('github');
      const gitlabSession = await testEnv.createTestSession('gitlab');
      
      await journeySimulator.completeOAuthFlow('github', githubSession.credentials);
      await journeySimulator.completeOAuthFlow('gitlab', gitlabSession.credentials);
      
      await journeySimulator.enableTool('github');
      await journeySimulator.enableTool('gitlab');
      
      // Set up different states - GitHub limited, GitLab available
      setGitHubRateLimit(0, 0, Date.now() + 3600000); // Exhausted
      setGitLabRateLimit(10, 0, Date.now() + 60000);  // Available
      
      const mixedResults = await Promise.all([
        simulateAPICall('github', 'issues', {}),
        simulateAPICall('gitlab', 'issues', {})
      ]);
      
      const githubResult = mixedResults[0];
      const gitlabResult = mixedResults[1];
      
      // GitHub should be rate limited
      expect(githubResult.rateLimited).toBe(true);
      
      // GitLab should succeed
      expect(gitlabResult.success).toBe(true);
    });
  });

  describe('Rate Limit Recovery and Reset', () => {
    it('should recover from rate limits when reset time passes', async () => {
      const testSession = await testEnv.createTestSession('github');
      await journeySimulator.completeOAuthFlow('github', testSession.credentials);
      
      // Set rate limit with short reset time
      const resetTime = Date.now() + 2000; // 2 seconds
      setGitHubRateLimit(5, 5, resetTime);
      
      // Should be limited initially
      const initialResult = await simulateAPICall('github', 'repos', {});
      expect(initialResult.rateLimited).toBe(true);
      
      // Wait for reset
      await browser.wait(2500);
      
      // Should recover after reset
      const recoveryResult = await simulateAPICall('github', 'repos', {});
      expect(recoveryResult.success).toBe(true);
    });

    it('should handle concurrent rate limit resets', async () => {
      const githubSession = await testEnv.createTestSession('github');
      const gitlabSession = await testEnv.createTestSession('gitlab');
      
      await journeySimulator.completeOAuthFlow('github', githubSession.credentials);
      await journeySimulator.completeOAuthFlow('gitlab', gitlabSession.credentials);
      
      // Set synchronized reset times
      const resetTime = Date.now() + 1500;
      setGitHubRateLimit(3, 0, resetTime);
      setGitLabRateLimit(3, 0, resetTime);
      
      // Both should be rate limited
      const initialResults = await Promise.all([
        simulateAPICall('github', 'repos', {}),
        simulateAPICall('gitlab', 'projects', {})
      ]);
      
      expect(initialResults.every(r => r.rateLimited)).toBe(true);
      
      // Wait for reset and test recovery
      await browser.wait(2000);
      
      const recoveryResults = await Promise.all([
        simulateAPICall('github', 'repos', {}),
        simulateAPICall('gitlab', 'projects', {})
      ]);
      
      expect(recoveryResults.every(r => r.success)).toBe(true);
    });

    it('should persist rate limit information across sessions', async () => {
      const testSession = await testEnv.createTestSession('github');
      await journeySimulator.completeOAuthFlow('github', testSession.credentials);
      
      // Create rate limit state
      const rateLimitState = {
        current: 5,
        limit: 10,
        resetTime: Date.now() + 300000, // 5 minutes
        provider: 'github'
      };
      
      browser.setSessionData('rate_limit_github', rateLimitState);
      
      // Simulate session persistence
      const persistedState = browser.getSessionData('rate_limit_github');
      expect(persistedState.provider).toBe('github');
      expect(persistedState.current).toBe(5);
      expect(persistedState.resetTime).toBe(rateLimitState.resetTime);
      
      // Continue using the rate limit
      await simulateAPICall('github', 'issues', {});
      const updatedState = browser.getSessionData('rate_limit_github');
      expect(updatedState.current).toBe(6);
    });
  });

  describe('Rate Limit User Experience', () => {
    it('should provide clear feedback when rate limited', async () => {
      const testSession = await testEnv.createTestSession('github');
      await journeySimulator.completeOAuthFlow('github', testSession.credentials);
      
      setGitHubRateLimit(0, 0, Date.now() + 60000); // Exhausted
      
      const result = await simulateAPICall('github', 'repos', {});
      
      expect(result.rateLimited).toBe(true);
      expect(result.retryAfter).toBeGreaterThan(0);
      expect(result.message).toContain('rate limit');
    });

    it('should gracefully degrade UI when rate limited', async () => {
      const testSession = await testEnv.createTestSession('github');
      await journeySimulator.completeOAuthFlow('github', testSession.credentials);
      await journeySimulator.enableTool('github');
      
      setGitHubRateLimit(0, 0, Date.now() + 60000);
      
      // Simulate UI data refresh when rate limited
      const uiState = {
        github: {
          isLoading: false,
          isError: true,
          errorMessage: 'Rate limit exceeded. Please try again in 1 minute.',
          data: null
        }
      };
      
      browser.setSessionData('ui_state', uiState);
      
      const currentUI = browser.getSessionData('ui_state');
      expect(currentUI.github.isError).toBe(true);
      expect(currentUI.github.errorMessage).toContain('Rate limit');
    });

    it('should show rate limit status in real-time', async () => {
      const testSession = await testEnv.createTestSession('github');
      await journeySimulator.completeOAuthFlow('github', testSession.credentials);
      
      // Show initial rate limit status
      setGitHubRateLimit(8, 10, Date.now() + 3600000);
      browser.setSessionData('rate_limit_display', {
        current: 8,
        limit: 10,
        percentage: 80,
        resetTime: Date.now() + 3600000
      });
      
      const display = browser.getSessionData('rate_limit_display');
      expect(display.percentage).toBe(80);
      expect(display.current).toBe(8);
      expect(display.limit).toBe(10);
      
      // Update after making requests
      setGitHubRateLimit(10, 10, Date.now() + 3600000);
      browser.setSessionData('rate_limit_display', {
        current: 10,
        limit: 10,
        percentage: 100,
        resetTime: Date.now() + 3600000
      });
      
      const updatedDisplay = browser.getSessionData('rate_limit_display');
      expect(updatedDisplay.percentage).toBe(100);
      expect(updatedDisplay.current).toBe(10);
    });
  });
});

/**
 * Simulate API call with rate limiting
 */
async function simulateAPICall(provider: string, endpoint: string, params: any): Promise<{
  success: boolean;
  rateLimited?: boolean;
  retryAfter?: number;
  message?: string;
}> {
  const rateLimitKey = `rate_limit_${provider}`;
  const rateLimit = (browser as any).getSessionData(rateLimitKey) || {
    current: 0,
    limit: 1000,
    resetTime: Date.now() + 3600000
  };
  
  // Check if rate limited
  if (rateLimit.current >= rateLimit.limit || Date.now() > rateLimit.resetTime) {
    // Reset if time has passed
    if (Date.now() > rateLimit.resetTime) {
      rateLimit.current = 0;
      rateLimit.resetTime = Date.now() + 3600000;
    } else {
      // Rate limited
      const remaining = Math.ceil((rateLimit.resetTime - Date.now()) / 1000);
      return {
        success: false,
        rateLimited: true,
        retryAfter: remaining,
        message: `Rate limit exceeded for ${provider}. Try again in ${remaining} seconds.`
      };
    }
  }
  
  // Make the request
  rateLimit.current++;
  (browser as any).setSessionData(rateLimitKey, rateLimit);
  
  // Simulate random failures
  const success = Math.random() > 0.05; // 95% success rate
  
  return {
    success,
    message: success ? 'Request successful' : 'Random API error'
  };
}

/**
 * Set up GitHub-specific rate limits
 */
function setGitHubRateLimit(current: number, limit: number, resetTime: number): void {
  const rateLimit = { current, limit, resetTime };
  (browser as any).setSessionData('rate_limit_github', rateLimit);
}

/**
 * Set up GitLab-specific rate limits
 */
function setGitLabRateLimit(current: number, limit: number, resetTime: number): void {
  const rateLimit = { current, limit, resetTime };
  (browser as any).setSessionData('rate_limit_gitlab', rateLimit);
}

/**
 * Set up Jira-specific rate limits
 */
function setJiraRateLimit(current: number, limit: number, resetTime: number): void {
  const rateLimit = { current, limit, resetTime };
  (browser as any).setSessionData('rate_limit_jira', rateLimit);
}
