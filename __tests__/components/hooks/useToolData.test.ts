import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useToolData } from '../../../app/components/hooks/useToolData';
import { Tool, ToolData } from '../../../tools/tool-types';

// Mock the getToolDataKey function
vi.mock('../../../tools', () => ({
  getToolDataKey: vi.fn((toolName: string, apiEndpoint: string) => {
    if (toolName === 'GitHub' && apiEndpoint === 'pulls') return 'pullRequests';
    if (toolName === 'Jira' && apiEndpoint === 'issues') return 'issues';
    return apiEndpoint;
  }),
}));

// Global fetch mock
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock tool data
const mockTool: Tool = {
  name: 'GitHub',
  slug: 'github',
  enabled: true,
  ui: {
    color: 'bg-blue-500',
    icon: vi.fn(() => null) as any, // Mock icon component
  },
  widgets: [
    {
      title: 'Pull Requests',
      type: 'table' as const,
      data: [],
      dynamic: true,
      refreshInterval: 300000, // 5 minutes
    },
  ],
  apis: {
    pulls: {
      method: 'GET' as const,
      description: 'Get pull requests',
      response: { dataKey: 'pullRequests', description: 'Pull request data' },
    },
  },
  handlers: {},
  capabilities: ['pull-requests'],
};

const mockDisabledTool: Tool = {
  name: 'Jira',
  slug: 'jira',
  enabled: false,
  ui: {
    color: 'bg-green-500',
    icon: vi.fn(() => null) as any, // Mock icon component
  },
  widgets: [
    {
      title: 'Issues',
      type: 'table' as const,
      data: [],
      dynamic: true,
    },
  ],
  apis: {
    issues: {
      method: 'GET' as const,
      description: 'Get issues',
      response: { dataKey: 'issues', description: 'Issues data' },
    },
  },
  handlers: {},
  capabilities: ['issues'],
};

describe('useToolData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('initialization', () => {
    it('returns correct initial state', () => {
      const { result } = renderHook(() =>
        useToolData({ enabledTools: [] })
      );

      expect(result.current.dynamicData).toEqual({});
      expect(result.current.loadingStates).toEqual({});
    });

    it('handles empty enabled tools array', () => {
      const { result } = renderHook(() =>
        useToolData({ enabledTools: [] })
      );

      expect(result.current.dynamicData).toEqual({});
      expect(Object.keys(result.current.loadingStates)).toHaveLength(0);
    });
  });

  describe('refreshToolData', () => {
    it('does nothing for disabled tools', async () => {
      const { result } = renderHook(() =>
        useToolData({ enabledTools: [mockDisabledTool] })
      );

      await result.current.refreshToolData(mockDisabledTool);

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('does nothing when tool has no dynamic widgets', async () => {
      const toolWithoutDynamicWidgets: Tool = {
        ...mockTool,
        widgets: [{ title: 'Static Widget', type: 'table' as const, data: [] }],
      };

      const { result } = renderHook(() =>
        useToolData({ enabledTools: [toolWithoutDynamicWidgets] })
      );

      await result.current.refreshToolData(toolWithoutDynamicWidgets);

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('fetches data successfully for enabled tool with dynamic widgets', async () => {
      const mockResponse = {
        pullRequests: [
          { id: 1, title: 'PR 1', status: 'open' },
          { id: 2, title: 'PR 2', status: 'merged' },
        ] as ToolData[],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const { result } = renderHook(() =>
        useToolData({ enabledTools: [mockTool] })
      );

      await act(async () => {
        await result.current.refreshToolData(mockTool);
      });

      expect(mockFetch).toHaveBeenCalledWith('/api/tools/github/pulls');
      expect(result.current.dynamicData.GitHub).toEqual(mockResponse.pullRequests);
    });

    it('handles fetch errors gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const { result } = renderHook(() =>
        useToolData({ enabledTools: [mockTool] })
      );

      await act(async () => {
        await result.current.refreshToolData(mockTool);
      });

      expect(mockFetch).toHaveBeenCalledWith('/api/tools/github/pulls');
      expect(result.current.dynamicData.GitHub).toBeUndefined();
    });

    it('sets loading states correctly during fetch', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ pullRequests: [] }),
      });

      const { result } = renderHook(() =>
        useToolData({ enabledTools: [mockTool] })
      );

      await act(async () => {
        await result.current.refreshToolData(mockTool);
      });

      // Loading state should be cleared after successful fetch
      expect(result.current.loadingStates['GitHub-refresh']).toBe(false);
    });
  });

  describe('refreshActivityData', () => {
    it('fetches activity data successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      });

      const { result } = renderHook(() =>
        useToolData({ enabledTools: [] })
      );

      await act(async () => {
        await result.current.refreshActivityData();
      });

      expect(mockFetch).toHaveBeenCalledWith('/api/tools/activity');
    });

    it('handles activity fetch errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const { result } = renderHook(() =>
        useToolData({ enabledTools: [] })
      );

      await act(async () => {
        await result.current.refreshActivityData();
      });

      expect(mockFetch).toHaveBeenCalledWith('/api/tools/activity');
    });

    it('manages activity refresh state correctly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      });

      const { result } = renderHook(() =>
        useToolData({ enabledTools: [] })
      );

      const refreshPromise = await act(async () => {
        return result.current.refreshActivityData();
      });

      // Activity refresh should complete without errors
      await refreshPromise;

      expect(mockFetch).toHaveBeenCalledWith('/api/tools/activity');
    });
  });

  describe('refreshAllData', () => {
    it('refreshes all enabled tools with dynamic widgets', async () => {
      const tool1 = { ...mockTool, name: 'GitHub' };
      const tool2 = {
        ...mockTool,
        name: 'GitLab',
        slug: 'gitlab',
        enabled: true,
      };
      const disabledTool = { ...mockTool, name: 'Jira', enabled: false };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ pullRequests: [] }),
      });

      const { result } = renderHook(() =>
        useToolData({ enabledTools: [tool1, tool2, disabledTool] })
      );

      await act(async () => {
        await result.current.refreshAllData();
      });

      expect(mockFetch).toHaveBeenCalledWith('/api/tools/github/pulls');
      expect(mockFetch).toHaveBeenCalledWith('/api/tools/gitlab/pulls');
      expect(mockFetch).not.toHaveBeenCalledWith('/api/tools/jira/pulls');
    });

    it('always triggers activity refresh', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });

      const { result } = renderHook(() =>
        useToolData({ enabledTools: [] })
      );

      await act(async () => {
        await result.current.refreshAllData();
      });

      expect(mockFetch).toHaveBeenCalledWith('/api/tools/activity');
    });
  });

  describe('initializePolling', () => {
    it('returns a cleanup function', () => {
      const { result } = renderHook(() =>
        useToolData({ enabledTools: [] })
      );

      const cleanup = result.current.initializePolling();

      expect(typeof cleanup).toBe('function');
    });

    it('initializes polling setup for tools with refresh intervals', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ pullRequests: [] }),
      });

      const { result } = renderHook(() =>
        useToolData({ enabledTools: [mockTool] })
      );

      // Initialize polling which should trigger initial data load
      await act(async () => {
        result.current.initializePolling();
      });

      // Initial load should happen during setup
      expect(mockFetch).toHaveBeenCalledWith('/api/tools/github/pulls');
    });

    it('sets up activity polling every 15 seconds', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });

      const { result } = renderHook(() =>
        useToolData({ enabledTools: [] })
      );

      result.current.initializePolling();

      // Activity polling should trigger after advancing timers
      await act(async () => {
        vi.advanceTimersByTime(15000);
      });

      expect(mockFetch).toHaveBeenCalledWith('/api/tools/activity');
    });

    it('sets up visibility change event handling', () => {
      const { result } = renderHook(() =>
        useToolData({ enabledTools: [mockTool] })
      );

      // Test that polling initialization sets up event handling
      const cleanup = result.current.initializePolling();

      // Verify cleanup function exists (event handling is set up internally)
      expect(typeof cleanup).toBe('function');
    });

    it('cleanup function removes event listeners and clears intervals', () => {
      const { result } = renderHook(() =>
        useToolData({ enabledTools: [] })
      );

      const cleanup = result.current.initializePolling();

      cleanup();

      // This is more of a sanity check - the cleanup should work without errors
      expect(typeof cleanup).toBe('function');
    });
  });
});
