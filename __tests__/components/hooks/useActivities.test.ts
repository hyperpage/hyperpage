// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// This test file intentionally uses loose typing for mock objects to avoid complex Response type matching
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useActivities } from '../../../app/components/hooks/useActivities';

// Mock the headers to avoid console noise about headers
const mockHeaders = new Headers();
vi.mock('next/headers', () => ({
  headers: () => Promise.resolve(mockHeaders),
}));

// Proper global fetch mock typing for testing
global.fetch = vi.fn() as any;

describe('useActivities', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    // Create fresh QueryClient for each test
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false, // Disable retries for testing
          gcTime: 0, // Disable garbage collection
        },
      },
    });
  });

  const createWrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);

  describe('initial state', () => {
    it('returns correct initial state', () => {
      const { result } = renderHook(() => useActivities(), {
        wrapper: createWrapper,
      });

      expect(result.current.activities).toEqual([]);
      expect(result.current.isLoading).toBe(true);
      expect(result.current.isRefreshing).toBe(false);
      expect(result.current.error).toBeNull();
    });
  });

  describe('successful data fetching', () => {
    beforeEach(() => {
      // Mock successful API response
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            activity: [
              {
                id: '1',
                tool: 'GitHub',
                toolIcon: 'github-icon',
                action: 'opened',
                description: 'Opened a pull request',
                author: 'john-doe',
                time: '2 hours ago',
                color: 'bg-green-500',
                timestamp: '2025-01-15T10:00:00Z',
                url: 'https://github.com/repo/pr/1',
                displayId: '#123',
                repository: 'my-repo',
                branch: 'main',
                status: 'open',
                labels: ['enhancement']
              },
            ],
          }),
        } as any),
      );
    });

    it('successfully fetches and transforms activity data', async () => {
      const { result } = renderHook(() => useActivities(), {
        wrapper: createWrapper,
      });

      // Initially loading
      expect(result.current.isLoading).toBe(true);
      expect(result.current.activities).toEqual([]);

      // Wait for data to load
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Check transformed data
      expect(result.current.activities).toHaveLength(1);
      expect(result.current.error).toBeNull();

      const activity = result.current.activities[0];
      expect(activity.id).toBe('1');
      expect(activity.tool).toBe('GitHub');
      expect(activity.action).toBe('opened');
      expect(activity.details).toBe('Opened a pull request');
      expect(activity.author).toBe('john-doe');
      expect(activity.time).toBe('2 hours ago');
      expect(activity.color).toBe('bg-green-500');
      expect(activity.timestamp).toBeInstanceOf(Date);
      expect(activity.url).toBe('https://github.com/repo/pr/1');
      expect(activity.displayId).toBe('#123');
      expect(activity.repository).toBe('my-repo');
      expect(activity.branch).toBe('main');
      expect(activity.status).toBe('open');
      expect(activity.labels).toEqual(['enhancement']);
    });
  });

  describe('error handling', () => {
    it('handles fetch errors gracefully', async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ activity: [] }),
        } as any),
      );

      const { result } = renderHook(() => useActivities(), {
        wrapper: createWrapper,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.activities).toEqual([]);
      expect(result.current.error).toBe('Failed to fetch activity data');
    });

    it('handles network errors', async () => {
      global.fetch = vi.fn(() =>
        Promise.reject(new Error('Network error')),
      );

      const { result } = renderHook(() => useActivities(), {
        wrapper: createWrapper,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.activities).toEqual([]);
      expect(result.current.error).toBe('Network error');
    });

    it('transforms malformed timestamp to current date', async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            activity: [
              {
                id: '1',
                tool: 'GitLab',
                toolIcon: 'gitlab-icon',
                action: 'pushed',
                description: 'Pushed commits',
                author: 'dev-user',
                time: '1 hour ago',
                color: 'bg-purple-500',
                timestamp: null, // Invalid timestamp
                url: 'https://gitlab.com/project',
                displayId: '!789'
              }
            ]
          }),
        } as any),
      );

      const { result } = renderHook(() => useActivities(), {
        wrapper: createWrapper,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.activities).toHaveLength(1);
      expect(result.current.activities[0].timestamp).toBeInstanceOf(Date);
    });
  });

  describe('React Query caching and refetching', () => {
    it('uses cached data on subsequent renders', async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            activity: [
              {
                id: '1',
                tool: 'GitHub',
                toolIcon: 'github-icon',
                action: 'opened',
                description: 'Test activity',
                author: 'user1',
                time: '1 hour ago',
                color: 'bg-green-500',
                timestamp: '2025-01-15T11:00:00Z',
                url: 'https://github.com/repo/pr/1',
                displayId: '#123'
              }
            ]
          }),
        }),
      );

      const { result: result1 } = renderHook(() => useActivities(), {
        wrapper: createWrapper,
      });

      // Wait for first render to load
      await waitFor(() => {
        expect(result1.current.isLoading).toBe(false);
      });

      expect(result1.current.activities).toHaveLength(1);
      expect(global.fetch).toHaveBeenCalledTimes(1);

      // Second render should use cache (no additional fetch)
      const { result: result2 } = renderHook(() => useActivities(), {
        wrapper: createWrapper,
      });

      await waitFor(() => {
        expect(result2.current.isLoading).toBe(false);
      });

      expect(result2.current.activities).toHaveLength(1);
      // Should still be 1 fetch due to caching
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('supports manual refetch', async () => {
      // Create a fresh QueryClient for this test with no caching to force refetch
      const testQueryClient = new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
            gcTime: 0,
            staleTime: 0, // Force stale immediately
          },
        },
      });

      const testWrapper = ({ children }: { children: React.ReactNode }) =>
        React.createElement(QueryClientProvider, { client: testQueryClient }, children);

      let callCount = 0;
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => {
            callCount++;
            if (callCount === 1) {
              return Promise.resolve({
                activity: [
                  {
                    id: '1',
                    description: 'Initial activity',
                    timestamp: '2025-01-15T11:00:00Z',
                    tool: 'GitHub',
                    toolIcon: 'github-icon',
                    action: 'opened',
                    author: 'user1',
                    time: '1 hour ago',
                    color: 'bg-green-500',
                    url: 'https://github.com/repo/pr/1',
                    displayId: '#123'
                  }
                ]
              });
            } else {
              return Promise.resolve({
                activity: [
                  {
                    id: '2',
                    description: 'Updated activity',
                    timestamp: '2025-01-15T12:00:00Z',
                    tool: 'Jira',
                    toolIcon: 'jira-icon',
                    action: 'updated',
                    author: 'user2',
                    time: '5 minutes ago',
                    color: 'bg-blue-500',
                    url: 'https://company.atlassian.net/browse/PROJ-456',
                    displayId: 'PROJ-456'
                  }
                ]
              });
            }
          },
        })
      );

      const { result } = renderHook(() => useActivities(), {
        wrapper: testWrapper,
      });

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.activities).toHaveLength(1);
      expect(result.current.activities[0].id).toBe('1');
      expect(callCount).toBe(1);

      // Manually refetch
      await act(async () => {
        await result.current.refetch();
      });

      // Wait for refetch to complete
      await waitFor(() => {
        expect(result.current.activities[0].id).toBe('2');
      });

      expect(result.current.activities).toHaveLength(1);
      expect(result.current.activities[0].id).toBe('2'); // New data loaded
      expect(callCount).toBe(2);
    });
  });

  describe('data transformation', () => {
    it('correctly transforms optional fields', async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            activity: [
              {
                id: '1',
                tool: 'GitHub',
                toolIcon: 'github-icon',
                action: 'merged',
                description: 'Merged pull request',
                author: 'dev-user',
                time: '3 days ago',
                color: 'bg-purple-500',
                timestamp: '2025-01-15T10:00:00Z',
                url: 'https://github.com/org/repo/pull/123',
                displayId: '#123',
                repository: 'awesome-repo',
                branch: 'feature-branch',
                commitCount: 5,
                status: 'merged',
                assignee: 'reviewer-user',
                labels: ['enhancement', 'high-priority']
              }
            ]
          }),
        } as any),
      );

      const { result } = renderHook(() => useActivities(), {
        wrapper: createWrapper,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const activity = result.current.activities[0];
      expect(activity.repository).toBe('awesome-repo');
      expect(activity.branch).toBe('feature-branch');
      expect(activity.commitCount).toBe(5);
      expect(activity.status).toBe('merged');
      expect(activity.assignee).toBe('reviewer-user');
      expect(activity.labels).toEqual(['enhancement', 'high-priority']);
    });

    it('handles missing optional fields gracefully', async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            activity: [
              {
                id: '1',
                tool: 'GitLab',
                toolIcon: 'gitlab-icon',
                action: 'created',
                description: 'Created merge request',
                author: 'gitlab-user',
                time: '1 day ago',
                color: 'bg-orange-500',
                timestamp: '2025-01-15T10:00:00Z',
                url: 'https://gitlab.com/project/merge_requests/456',
                displayId: '!456'
                // No optional fields
              }
            ]
          }),
        }),
      );

      const { result } = renderHook(() => useActivities(), {
        wrapper: createWrapper,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const activity = result.current.activities[0];
      expect(activity.repository).toBeUndefined();
      expect(activity.branch).toBeUndefined();
      expect(activity.commitCount).toBeUndefined();
      expect(activity.status).toBeUndefined();
      expect(activity.assignee).toBeUndefined();
      expect(activity.labels).toBeUndefined();
    });
  });

  describe('React Query configuration', () => {
    it('configures query with correct parameters', () => {
      // Test that the hook uses the expected React Query configuration
      // This is more of an integration test to ensure the query is configured properly

      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ activity: [] }),
        }),
      );

      const { result } = renderHook(() => useActivities(), {
        wrapper: createWrapper,
      });

      // The hook should be configured to poll every 15 seconds
      // We can't easily test this without time mocking, but we can verify the hook interface
      expect(typeof result.current.refetch).toBe('function');
      expect(typeof result.current.isRefreshing).toBe('boolean');
    });
  });
});
