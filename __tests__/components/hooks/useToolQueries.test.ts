import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useToolQueries } from '../../../app/components/hooks/useToolQueries';
import { Tool, ToolData } from '../../../tools/tool-types';

// Mock the getToolDataKey function
vi.mock('../../../tools', () => ({
  getToolDataKey: vi.fn((toolName: string, apiEndpoint: string) => {
    if (toolName === 'GitHub' && apiEndpoint === 'pulls') return 'pullRequests';
    if (toolName === 'Jira' && apiEndpoint === 'issues') return 'issues';
    return apiEndpoint;
  }),
}));

const mockHeaders = new Headers();
vi.mock('next/headers', () => ({
  headers: () => Promise.resolve(mockHeaders),
}));

describe('useToolQueries', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          gcTime: 0,
        },
      },
    });
  });

  const createWrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);

  it('initializes properly', () => {
    const { result } = renderHook(() =>
      useToolQueries({ enabledTools: [] }),
      { wrapper: createWrapper }
    );

    expect(result.current.dynamicData).toEqual({});
    expect(result.current.loadingStates).toEqual({});
  });
});
