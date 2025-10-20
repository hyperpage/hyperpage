import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useActivityData } from '../../../app/components/hooks/useActivityData';

// Mock console.warn to avoid test noise
vi.spyOn(console, 'warn').mockImplementation(() => {});
vi.spyOn(console, 'error').mockImplementation(() => {});

// Global fetch mock
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('useActivityData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('returns correct initial state', () => {
      const { result } = renderHook(() => useActivityData());

      expect(result.current.activities).toEqual([]);
      expect(result.current.isLoading).toBe(true);
      expect(result.current.isRefreshing).toBe(false);
      expect(result.current.error).toBeNull();
    });

  describe('fetchActivities', () => {
    it('successfully fetches and transforms activity data on mount', async () => {
      const mockApiResponse = {
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
          {
            id: '2',
            tool: 'Jira',
            toolIcon: 'jira-icon',
            action: 'created',
            description: 'Created a ticket',
            author: 'jane-smith',
            time: '5 minutes ago',
            color: 'bg-blue-500',
            timestamp: '2025-01-15T12:30:00Z',
            url: 'https://company.atlassian.net/browse/PROJ-456',
            displayId: 'PROJ-456',
            assignee: 'john-doe',
            status: 'in-progress'
          }
        ]
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockApiResponse),
      });

      const { result } = renderHook(() => useActivityData());

      // Initially loading
      expect(result.current.isLoading).toBe(true);
      expect(result.current.activities).toEqual([]);

      // Wait for fetch to complete
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Check transformed data
      expect(result.current.activities).toHaveLength(2);
      expect(result.current.error).toBeNull();

      // Check first activity transformation
      const firstActivity = result.current.activities[0];
      expect(firstActivity.id).toBe('1');
      expect(firstActivity.tool).toBe('GitHub');
      expect(firstActivity.action).toBe('opened');
      expect(firstActivity.details).toBe('Opened a pull request');
      expect(firstActivity.author).toBe('john-doe');
      expect(firstActivity.time).toBe('2 hours ago');
      expect(firstActivity.color).toBe('bg-green-500');
      expect(firstActivity.timestamp).toBeInstanceOf(Date);
      expect(firstActivity.url).toBe('https://github.com/repo/pr/1');
      expect(firstActivity.displayId).toBe('#123');
      expect(firstActivity.repository).toBe('my-repo');
      expect(firstActivity.branch).toBe('main');
      expect(firstActivity.status).toBe('open');
      expect(firstActivity.labels).toEqual(['enhancement']);
    });

    it('handles fetch errors gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const { result } = renderHook(() => useActivityData());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.activities).toEqual([]);
      expect(result.current.error).toBe('Failed to fetch activity data');
    });

    it('handles network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useActivityData());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.activities).toEqual([]);
      expect(result.current.error).toBe('Network error');
    });

    it('handles empty activity array', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ activity: [] }),
      });

      const { result } = renderHook(() => useActivityData());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.activities).toEqual([]);
      expect(result.current.error).toBeNull();
    });

    it('handles missing activity field in response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ someOtherField: [] }),
      });

      const { result } = renderHook(() => useActivityData());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.activities).toEqual([]);
      expect(result.current.error).toBeNull();
    });

    it('transforms malformed timestamp to current date', async () => {
      const mockApiResponse = {
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
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockApiResponse),
      });

      const { result } = renderHook(() => useActivityData());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.activities).toHaveLength(1);
      expect(result.current.activities[0].timestamp).toBeInstanceOf(Date);
    });
  });

  describe('refreshActivities', () => {
    it('successfully refreshes activity data while keeping old data visible', async () => {
      // Initial data
      const initialResponse = {
        activity: [
          {
            id: '1',
            tool: 'GitHub',
            toolIcon: 'github-icon',
            action: 'opened',
            description: 'Initial PR',
            author: 'user1',
            time: '1 hour ago',
            color: 'bg-green-500',
            timestamp: '2025-01-15T11:00:00Z',
            url: 'https://github.com/repo/pr/1',
            displayId: '#123'
          }
        ]
      };

      // Refresh data
      const refreshResponse = {
        activity: [
          {
            id: '2',
            tool: 'Jira',
            toolIcon: 'jira-icon',
            action: 'updated',
            description: 'Updated ticket',
            author: 'user2',
            time: '5 minutes ago',
            color: 'bg-blue-500',
            timestamp: '2025-01-15T12:55:00Z',
            url: 'https://company.atlassian.net/browse/PROJ-789',
            displayId: 'PROJ-789',
            status: 'resolved'
          }
        ]
      };

      // Setup initial fetch
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(initialResponse),
      });

      const { result } = renderHook(() => useActivityData());

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.activities).toHaveLength(1);
      expect(result.current.activities[0].id).toBe('1');

      // Setup refresh fetch
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(refreshResponse),
      });

      // Trigger refresh
      await act(async () => {
        await result.current.refreshActivities();
      });

      expect(result.current.isRefreshing).toBe(false);
      expect(result.current.activities).toHaveLength(1);
      expect(result.current.activities[0].id).toBe('2'); // New data loaded
      expect(result.current.activities[0].tool).toBe('Jira');
      expect(result.current.error).toBeNull();
    });

    it('handles refresh errors without clearing existing data', async () => {
      const initialResponse = {
        activity: [
          {
            id: '1',
            tool: 'GitHub',
            toolIcon: 'github-icon',
            action: 'opened',
            description: 'Original PR',
            author: 'user1',
            time: '1 hour ago',
            color: 'bg-green-500',
            timestamp: '2025-01-15T11:00:00Z',
            url: 'https://github.com/repo/pr/1',
            displayId: '#123'
          }
        ]
      };

      // Setup initial fetch
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(initialResponse),
      });

      const { result } = renderHook(() => useActivityData());

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Setup failed refresh
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      // Trigger refresh
      await act(async () => {
        await result.current.refreshActivities();
      });

      // Old data should still be there
      expect(result.current.activities).toHaveLength(1);
      expect(result.current.activities[0].id).toBe('1');
      expect(result.current.error).toBe('Failed to refresh activity data');
      expect(result.current.isRefreshing).toBe(false);
    });

    it('prevents concurrent refresh operations', async () => {
      const initialResponse = {
        activity: [
          {
            id: '1',
            tool: 'GitHub',
            toolIcon: 'github-icon',
            action: 'opened',
            description: 'Test activity',
            author: 'user1',
            time: '30 minutes ago',
            color: 'bg-green-500',
            timestamp: '2025-01-15T12:00:00Z',
            url: 'https://github.com/repo/pr/1',
            displayId: '#123'
          }
        ]
      };

      // Setup initial fetch
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(initialResponse),
      });

      let refreshesStarted = 0;
      let refreshesCompleted = 0;

      const { result } = renderHook(() => useActivityData());

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Setup slow refresh that tracks calls
      let resolveRefresh: (value: any) => void;
      const refreshPromise = new Promise((resolve) => {
        resolveRefresh = resolve;
      });

      mockFetch.mockImplementationOnce(() => {
        refreshesStarted++;
        return refreshPromise.then(() => {
          refreshesCompleted++;
          return {
            ok: true,
            json: () => Promise.resolve({ activity: [] }),
          };
        });
      });

      // Start first refresh
      const firstRefreshPromise = result.current.refreshActivities();

      // Wait for isRefreshing to be set
      await waitFor(() => {
        expect(result.current.isRefreshing).toBe(true);
      });
      expect(refreshesStarted).toBe(1);

      // Try second refresh while first is still running - should be blocked
      const secondRefreshPromise = result.current.refreshActivities();

      // Wait a bit to ensure second call would have been blocked
      await new Promise(resolve => setTimeout(resolve, 50));

      // Only one refresh should have started
      expect(refreshesStarted).toBe(1);
      expect(result.current.isRefreshing).toBe(true);

      // Resolve first refresh
      resolveRefresh!({
        ok: true,
        json: () => Promise.resolve({ activity: [] }),
      });

      await firstRefreshPromise;

      // Now isRefreshing should be false
      expect(result.current.isRefreshing).toBe(false);
      expect(refreshesCompleted).toBe(1);
    });

    it('sets loading state correctly during refresh', async () => {
      const initialResponse = {
        activity: [
          {
            id: '1',
            tool: 'GitHub',
            toolIcon: 'github-icon',
            action: 'opened',
            description: 'Test activity',
            author: 'user1',
            time: '30 minutes ago',
            color: 'bg-green-500',
            timestamp: '2025-01-15T12:00:00Z',
            url: 'https://github.com/repo/pr/1',
            displayId: '#123'
          }
        ]
      };

      // Setup initial fetch
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(initialResponse),
      });

      const { result } = renderHook(() => useActivityData());

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Setup and trigger refresh
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ activity: [] }),
      });

      await act(async () => {
        await result.current.refreshActivities();
      });

      expect(result.current.isRefreshing).toBe(false);
    });
  });
});

  describe('data transformation', () => {
    it('correctly transforms optional fields', async () => {
      const mockApiResponse = {
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
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockApiResponse),
      });

      const { result } = renderHook(() => useActivityData());

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
      const mockApiResponse = {
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
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockApiResponse),
      });

      const { result } = renderHook(() => useActivityData());

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
});
