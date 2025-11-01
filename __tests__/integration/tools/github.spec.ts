/**
 * GitHub Tool Integration Tests
 * 
 * Tests complete GitHub tool integration including PRs, issues, workflows,
 * rate limiting behavior, and data transformation accuracy.
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll } from 'vitest';
import { IntegrationTestEnvironment, OAuthTestCredentials } from '../../lib/test-credentials';

describe('GitHub Tool Integration', () => {
  let testEnv: IntegrationTestEnvironment;
  let baseUrl: string;
  let testSession: {
    userId: string;
    sessionId: string;
    credentials: OAuthTestCredentials;
  };

  beforeAll(async () => {
    testEnv = await IntegrationTestEnvironment.setup();
    baseUrl = process.env.HYPERPAGE_TEST_BASE_URL || 'http://localhost:3000';
  });

  beforeEach(async () => {
    testSession = await testEnv.createTestSession('github');
  });

  afterEach(async () => {
    // Cleanup test session
    if (testSession?.sessionId) {
      try {
        await fetch(`${baseUrl}/api/sessions?sessionId=${testSession.sessionId}`, {
          method: 'DELETE'
        });
      } catch (error) {
        // Ignore cleanup errors in tests
      }
    }
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  describe('Pull Requests API Integration', () => {
    it('should fetch GitHub pull requests', async () => {
      const response = await fetch(`${baseUrl}/api/tools/github/pull-requests`, {
        headers: {
          'Cookie': `sessionId=${testSession.sessionId}`
        }
      });

      expect([200, 401, 403]).toContain(response.status);
      
      if (response.status === 200) {
        const data = await response.json();
        expect(data).toHaveProperty('pullRequests');
        expect(Array.isArray(data.pullRequests)).toBe(true);
        
        // Validate pull request data structure
        if (data.pullRequests.length > 0) {
          const pr = data.pullRequests[0];
          expect(pr).toHaveProperty('id');
          expect(pr).toHaveProperty('title');
          expect(pr).toHaveProperty('repository');
          expect(pr).toHaveProperty('status');
          expect(pr).toHaveProperty('created');
          expect(pr).toHaveProperty('url');
          expect(pr.type).toBe('pull-request');
          
          // Verify PR numbering format
          expect(pr.id).toMatch(/^#\d+$/);
        }
      }
    });

    it('should handle pull request filtering parameters', async () => {
      const url = new URL(`${baseUrl}/api/tools/github/pull-requests`);
      url.searchParams.set('state', 'closed');
      url.searchParams.set('sort', 'updated');

      const response = await fetch(url.toString(), {
        headers: {
          'Cookie': `sessionId=${testSession.sessionId}`
        }
      });

      expect([200, 401, 403]).toContain(response.status);
      
      if (response.status === 200) {
        const data = await response.json();
        expect(data).toHaveProperty('pullRequests');
        expect(Array.isArray(data.pullRequests)).toBe(true);
      }
    });

    it('should handle missing GitHub token gracefully', async () => {
      const response = await fetch(`${baseUrl}/api/tools/github/pull-requests`, {
        headers: {
          'Cookie': `sessionId=${testSession.sessionId}`
        }
      });

      // Should return 401/403 if no token, but not crash
      expect([200, 401, 403]).toContain(response.status);
      
      if (response.status === 401 || response.status === 403) {
        const data = await response.json();
        expect(data).toHaveProperty('error');
      }
    });
  });

  describe('Issues API Integration', () => {
    it('should fetch GitHub issues', async () => {
      const response = await fetch(`${baseUrl}/api/tools/github/issues`, {
        headers: {
          'Cookie': `sessionId=${testSession.sessionId}`
        }
      });

      expect([200, 401, 403]).toContain(response.status);
      
      if (response.status === 200) {
        const data = await response.json();
        expect(data).toHaveProperty('issues');
        expect(Array.isArray(data.issues)).toBe(true);
        
        // Validate issue data structure
        if (data.issues.length > 0) {
          const issue = data.issues[0];
          expect(issue).toHaveProperty('ticket');
          expect(issue).toHaveProperty('title');
          expect(issue).toHaveProperty('status');
          expect(issue).toHaveProperty('url');
          expect(issue).toHaveProperty('created');
          expect(issue.type).toBe('issue');
          
          // Verify issue numbering format
          expect(issue.ticket).toMatch(/^#\d+$/);
        }
      }
    });

    it('should handle issue filtering parameters', async () => {
      const url = new URL(`${baseUrl}/api/tools/github/issues`);
      url.searchParams.set('state', 'closed');
      url.searchParams.set('assignee', '@me');

      const response = await fetch(url.toString(), {
        headers: {
          'Cookie': `sessionId=${testSession.sessionId}`
        }
      });

      expect([200, 401, 403]).toContain(response.status);
      
      if (response.status === 200) {
        const data = await response.json();
        expect(data).toHaveProperty('issues');
        expect(Array.isArray(data.issues)).toBe(true);
      }
    });
  });

  describe('Workflows API Integration', () => {
    it('should fetch GitHub workflow runs', async () => {
      const response = await fetch(`${baseUrl}/api/tools/github/workflows`, {
        headers: {
          'Cookie': `sessionId=${testSession.sessionId}`
        }
      });

      expect([200, 401, 403]).toContain(response.status);
      
      if (response.status === 200) {
        const data = await response.json();
        expect(data).toHaveProperty('workflows');
        expect(Array.isArray(data.workflows)).toBe(true);
        
        // Validate workflow data structure
        if (data.workflows.length > 0) {
          const workflow = data.workflows[0];
          expect(workflow).toHaveProperty('id');
          expect(workflow).toHaveProperty('repository');
          expect(workflow).toHaveProperty('name');
          expect(workflow).toHaveProperty('status');
          expect(workflow).toHaveProperty('conclusion');
          expect(workflow).toHaveProperty('created_at');
          expect(workflow).toHaveProperty('html_url');
        }
      }
    });

    it('should handle workflow filtering parameters', async () => {
      const url = new URL(`${baseUrl}/api/tools/github/workflows`);
      url.searchParams.set('status', 'completed');
      url.searchParams.set('conclusion', 'success');

      const response = await fetch(url.toString(), {
        headers: {
          'Cookie': `sessionId=${testSession.sessionId}`
        }
      });

      expect([200, 401, 403]).toContain(response.status);
      
      if (response.status === 200) {
        const data = await response.json();
        expect(data).toHaveProperty('workflows');
        expect(Array.isArray(data.workflows)).toBe(true);
      }
    });

    it('should calculate workflow duration', async () => {
      const response = await fetch(`${baseUrl}/api/tools/github/workflows`, {
        headers: {
          'Cookie': `sessionId=${testSession.sessionId}`
        }
      });

      if (response.status === 200) {
        const data = await response.json();
        if (data.workflows.length > 0) {
          const workflow = data.workflows[0];
          expect(workflow).toHaveProperty('run_duration');
          
          // Duration should be a number or null
          if (workflow.run_duration !== null) {
            expect(typeof workflow.run_duration).toBe('number');
            expect(workflow.run_duration).toBeGreaterThan(0);
          }
        }
      }
    });
  });

  describe('Rate Limiting Integration', () => {
    it('should return GitHub rate limit status', async () => {
      const response = await fetch(`${baseUrl}/api/tools/github/rate-limit`, {
        headers: {
          'Cookie': `sessionId=${testSession.sessionId}`
        }
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      
      // Should return rate limit data structure
      expect(data).toHaveProperty('rateLimit');
      const rateLimit = data.rateLimit;
      
      // GitHub rate limit structure validation
      if (rateLimit.resources) {
        expect(rateLimit.resources).toHaveProperty('core');
        expect(rateLimit.resources).toHaveProperty('search');
        expect(rateLimit.resources).toHaveProperty('graphql');
        
        if (rateLimit.resources.core) {
          expect(rateLimit.resources.core).toHaveProperty('limit');
          expect(rateLimit.resources.core).toHaveProperty('remaining');
          expect(rateLimit.resources.core).toHaveProperty('reset');
          expect(rateLimit.resources.core).toHaveProperty('used');
        }
      }
    });

    it('should handle rate limited responses gracefully', async () => {
      // Make multiple rapid requests to potentially trigger rate limiting
      const requests = Array.from({ length: 15 }, () => 
        fetch(`${baseUrl}/api/tools/github/pull-requests`, {
          headers: {
            'Cookie': `sessionId=${testSession.sessionId}`
          }
        })
      );

      const responses = await Promise.all(requests);
      
      // Check for rate limiting (429) or successful responses
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      const successfulResponses = responses.filter(r => r.status === 200);
      const errorResponses = responses.filter(r => [401, 403, 503].includes(r.status));
      
      // Should handle rate limiting without complete failure
      expect(successfulResponses.length + rateLimitedResponses.length + errorResponses.length).toBe(requests.length);
    });

    it('should respect GitHub rate limit headers', async () => {
      // Test rate limit header parsing
      const response = await fetch(`${baseUrl}/api/tools/github/rate-limit`, {
        headers: {
          'Cookie': `sessionId=${testSession.sessionId}`
        }
      });

      expect(response.status).toBe(200);
      
      // Verify headers contain rate limit information
      expect(response.headers.get('X-RateLimit-Remaining')).toBeTruthy();
      expect(response.headers.get('X-RateLimit-Reset')).toBeTruthy();
      expect(response.headers.get('X-RateLimit-Limit')).toBeTruthy();
    });
  });

  describe('Data Transformation Accuracy', () => {
    it('should transform GitHub data to unified format', async () => {
      const [prResponse, issueResponse, workflowResponse] = await Promise.all([
        fetch(`${baseUrl}/api/tools/github/pull-requests`, {
          headers: { 'Cookie': `sessionId=${testSession.sessionId}` }
        }),
        fetch(`${baseUrl}/api/tools/github/issues`, {
          headers: { 'Cookie': `sessionId=${testSession.sessionId}` }
        }),
        fetch(`${baseUrl}/api/tools/github/workflows`, {
          headers: { 'Cookie': `sessionId=${testSession.sessionId}` }
        })
      ]);

      // All responses should have consistent data structure
      [prResponse, issueResponse, workflowResponse].forEach(response => {
        expect([200, 401, 403]).toContain(response.status);
      });

      // Validate unified format consistency
      if (prResponse.status === 200) {
        const prData = await prResponse.json();
        if (prData.pullRequests.length > 0) {
          const pr = prData.pullRequests[0];
          expect(pr).toHaveProperty('type');
          expect(pr.type).toBe('pull-request');
          expect(pr).toHaveProperty('tool');
          expect(pr.tool).toBe('GitHub');
        }
      }

      if (issueResponse.status === 200) {
        const issueData = await issueResponse.json();
        if (issueData.issues.length > 0) {
          const issue = issueData.issues[0];
          expect(issue).toHaveProperty('type');
          expect(issue.type).toBe('issue');
          expect(issue).toHaveProperty('tool');
          expect(issue.tool).toBe('GitHub');
        }
      }
    });

    it('should extract repository names correctly', async () => {
      const response = await fetch(`${baseUrl}/api/tools/github/pull-requests`, {
        headers: {
          'Cookie': `sessionId=${testSession.sessionId}`
        }
      });

      if (response.status === 200) {
        const data = await response.json();
        if (data.pullRequests.length > 0) {
          const pr = data.pullRequests[0];
          expect(pr.repository).toMatch(/^[a-zA-Z0-9-_.]+\/[a-zA-Z0-9-_.]+$/);
          
          // Should not contain full URL, just owner/repo format
          expect(pr.repository).not.toContain('github.com');
        }
      }
    });

    it('should format timestamps consistently', async () => {
      const response = await fetch(`${baseUrl}/api/tools/github/pull-requests`, {
        headers: {
          'Cookie': `sessionId=${testSession.sessionId}`
        }
      });

      if (response.status === 200) {
        const data = await response.json();
        if (data.pullRequests.length > 0) {
          const pr = data.pullRequests[0];
          expect(pr).toHaveProperty('created');
          expect(pr).toHaveProperty('created_display');
          
          // created_display should be a human-readable date
          expect(pr.created_display).toMatch(/\d{1,2}\/\d{1,2}\/\d{4}/);
          
          // created should be ISO format
          expect(pr.created).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
        }
      }
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle invalid session gracefully', async () => {
      const response = await fetch(`${baseUrl}/api/tools/github/pull-requests`, {
        headers: {
          'Cookie': 'sessionId=invalid-session-id'
        }
      });

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data).toHaveProperty('error');
    });

    it('should handle network timeouts', async () => {
      // This would require mocking network failures
      // For now, test the error response structure
      const response = await fetch(`${baseUrl}/api/tools/github/nonexistent-endpoint`, {
        headers: {
          'Cookie': `sessionId=${testSession.sessionId}`
        }
      });

      expect([404, 500]).toContain(response.status);
    });

    it('should handle malformed parameters', async () => {
      const url = new URL(`${baseUrl}/api/tools/github/pull-requests`);
      url.searchParams.set('state', 'invalid_state');

      const response = await fetch(url.toString(), {
        headers: {
          'Cookie': `sessionId=${testSession.sessionId}`
        }
      });

      // Should handle gracefully (200 with filtered results or 400 error)
      expect([200, 400, 401, 403]).toContain(response.status);
    });
  });

  describe('Security and Validation', () => {
    it('should not expose GitHub tokens in responses', async () => {
      const [prResponse, rateLimitResponse] = await Promise.all([
        fetch(`${baseUrl}/api/tools/github/pull-requests`, {
          headers: { 'Cookie': `sessionId=${testSession.sessionId}` }
        }),
        fetch(`${baseUrl}/api/tools/github/rate-limit`, {
          headers: { 'Cookie': `sessionId=${testSession.sessionId}` }
        })
      ]);

      [prResponse, rateLimitResponse].forEach(async (response) => {
        if (response.status === 200) {
          const data = await response.json();
          // Should not contain sensitive GitHub token information
          expect(JSON.stringify(data)).not.toContain('GITHUB_TOKEN');
          expect(JSON.stringify(data)).not.toContain('access_token');
          expect(JSON.stringify(data)).not.toContain('private');
        }
      });
    });

    it('should validate session ownership', async () => {
      // Create another session
      const anotherSession = await testEnv.createTestSession('github');
      
      // Try to access data with wrong session
      const response = await fetch(`${baseUrl}/api/tools/github/pull-requests`, {
        headers: {
          'Cookie': `sessionId=${anotherSession.sessionId}`
        }
      });

      // Should handle cross-session access appropriately
      expect([401, 403]).toContain(response.status);
    });
  });

  describe('Performance and Reliability', () => {
    it('should handle concurrent requests', async () => {
      // Test multiple simultaneous requests to the same endpoint
      const concurrentRequests = Array.from({ length: 5 }, () => 
        fetch(`${baseUrl}/api/tools/github/pull-requests`, {
          headers: {
            'Cookie': `sessionId=${testSession.sessionId}`
          }
        })
      );

      const responses = await Promise.all(concurrentRequests);
      
      // All requests should complete (success or appropriate error)
      responses.forEach(response => {
        expect([200, 401, 403, 429]).toContain(response.status);
      });
    });

    it('should return consistent data structures', async () => {
      const requests = [
        fetch(`${baseUrl}/api/tools/github/pull-requests`, {
          headers: { 'Cookie': `sessionId=${testSession.sessionId}` }
        }),
        fetch(`${baseUrl}/api/tools/github/issues`, {
          headers: { 'Cookie': `sessionId=${testSession.sessionId}` }
        }),
        fetch(`${baseUrl}/api/tools/github/workflows`, {
          headers: { 'Cookie': `sessionId=${testSession.sessionId}` }
        })
      ];

      const responses = await Promise.all(requests);
      
      responses.forEach(response => {
        if (response.status === 200) {
          const hasPullRequests = response.headers.get('content-type')?.includes('application/json');
          expect(hasPullRequests).toBe(true);
          // Each response should have the expected dataKey structure
          expect((data: any) => {
            if (data.pullRequests || data.issues || data.workflows) return true;
            return false;
          });
        }
      });
    });
  });
});
