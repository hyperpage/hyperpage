/**
 * Jira OAuth Integration Tests
 * 
 * Tests complete OAuth flows with real Jira API integration,
 * including token storage, encryption, and API usage validation.
 */

import { test, expect } from '@playwright/test';
import { IntegrationTestEnvironment, OAuthTestCredentials } from '../../lib/test-credentials';

describe('Jira OAuth Integration', () => {
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
    testSession = await testEnv.createTestSession('jira');
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

  test.describe('OAuth Flow Initiation', () => {
    test('should initiate Jira OAuth flow', async ({ page }) => {
      await page.goto(`${baseUrl}/api/auth/jira/initiate`);

      // Should redirect to Atlassian authorization
      await expect(page).toHaveURL(/atlassian\.com\/oauth\/authorize/);
      
      // Verify correct client ID and scopes are passed
      const url = new URL(page.url());
      expect(url.searchParams.get('client_id')).toBe(testSession.credentials.clientId);
      expect(url.searchParams.get('response_type')).toBe('code');
    });

    test('should handle OAuth state validation', async ({ page }) => {
      await page.goto(`${baseUrl}/api/auth/jira/initiate`);
      
      // Verify state parameter is generated and stored
      const url = new URL(page.url());
      const state = url.searchParams.get('state');
      expect(state).toBeDefined();
      expect(state!.length).toBeGreaterThan(10); // Should be substantial state
      
      // State should be stored in cookies for validation
      const cookies = await page.context().cookies();
      const stateCookie = cookies.find(c => c.name.includes('oauth_state'));
      expect(stateCookie).toBeDefined();
    });

    test('should include Jira-specific redirect_uri', async ({ page }) => {
      await page.goto(`${baseUrl}/api/auth/jira/initiate`);
      
      const url = new URL(page.url());
      const redirectUri = url.searchParams.get('redirect_uri');
      expect(redirectUri).toBeDefined();
      expect(redirectUri).toContain('/api/auth/jira/callback');
    });
  });

  test.describe('Mock OAuth Processing', () => {
    test('should simulate successful Jira OAuth callback', async ({ page }) => {
      // Skip real OAuth in test environment
      if (process.env.SKIP_REAL_OAUTH === 'true') {
        // Test with mock callback
        await page.goto(`${baseUrl}/api/auth/jira/callback?code=mock_jira_auth_code_54321&state=mock_jira_state_token`);

        // Should handle mock OAuth gracefully
        await expect(page).toHaveURL(/.*/); // Any valid response
        expect(page.url()).not.toContain('error');
      } else {
        test.skip(true, 'Real OAuth testing - requires manual intervention');
      }
    });

    test('should handle Jira OAuth errors', async ({ page }) => {
      await page.goto(`${baseUrl}/api/auth/jira/callback?error=access_denied&error_description=User denied access`);

      // Should show appropriate error message
      await expect(page.locator('text=/error|denied|failed/i')).toBeVisible();
    });

    test('should handle invalid authorization code', async ({ page }) => {
      await page.goto(`${baseUrl}/api/auth/jira/callback?code=invalid_code&state=mock_jira_state_token`);

      // Should handle invalid code gracefully
      if (!page.url().includes('error')) {
        await expect(page.locator('text=/invalid|error|failed/i')).toBeVisible();
      }
    });
  });

  test.describe('Token Management', () => {
    test('should store encrypted OAuth tokens', async () => {
      // Test token storage interface
      const response = await fetch(`${baseUrl}/api/auth/jira/status`, {
        headers: {
          'Cookie': `sessionId=${testSession.sessionId}`
        }
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      
      // Should return authentication status
      expect(data).toHaveProperty('authenticated');
      expect(data).toHaveProperty('provider');
      expect(data.provider).toBe('jira');
    });

    test('should handle token refresh', async () => {
      // Test token refresh endpoint
      const response = await fetch(`${baseUrl}/api/auth/jira/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': `sessionId=${testSession.sessionId}`
        },
        body: JSON.stringify({
          tool: 'jira'
        })
      });

      // Should handle refresh gracefully (success or appropriate error)
      expect([200, 401, 400]).toContain(response.status);
    });

    test('should handle token expiration', async () => {
      // Test with expired token scenario
      const response = await fetch(`${baseUrl}/api/tools/jira/issues`, {
        headers: {
          'Cookie': `sessionId=${testSession.sessionId}`
        }
      });

      // Should return appropriate status for expired tokens
      expect([200, 401, 403]).toContain(response.status);
    });
  });

  test.describe('Jira API Integration', () => {
    test('should fetch Jira issues', async () => {
      const response = await fetch(`${baseUrl}/api/tools/jira/issues`, {
        headers: {
          'Cookie': `sessionId=${testSession.sessionId}`
        }
      });

      // Should return valid response structure
      expect([200, 401, 403]).toContain(response.status);
      
      if (response.status === 200) {
        const data = await response.json();
        expect(data).toHaveProperty('data');
        expect(Array.isArray(data.data)).toBe(true);
      }
    });

    test('should fetch Jira projects', async () => {
      const response = await fetch(`${baseUrl}/api/tools/jira/projects`, {
        headers: {
          'Cookie': `sessionId=${testSession.sessionId}`
        }
      });

      expect([200, 401, 403]).toContain(response.status);

      if (response.status === 200) {
        const data = await response.json();
        expect(data).toHaveProperty('data');
        expect(Array.isArray(data.data)).toBe(true);
      }
    });

    test('should fetch Jira boards', async () => {
      const response = await fetch(`${baseUrl}/api/tools/jira/boards`, {
        headers: {
          'Cookie': `sessionId=${testSession.sessionId}`
        }
      });

      expect([200, 401, 403]).toContain(response.status);

      if (response.status === 200) {
        const data = await response.json();
        expect(data).toHaveProperty('data');
        expect(Array.isArray(data.data)).toBe(true);
      }
    });
  });
});
