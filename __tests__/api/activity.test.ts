import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET as getActivityData } from '../../app/api/tools/activity/route';

// Mock the tools registry - using the correct import path from the activity route
const mockGetEnabledToolsByCapability = vi.fn();
const mockGetToolByName = vi.fn();

vi.mock('../../../../tools', () => ({
  getEnabledToolsByCapability: (...args: any) => mockGetEnabledToolsByCapability(...args),
  getToolByName: (...args: any) => mockGetToolByName(...args),
}));

describe('GET /api/tools/activity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('successful aggregation', () => {
    it('aggregates and sorts activity from multiple tools', async () => {
      const mockGithubTool = {
        name: 'GitHub',
        slug: 'github',
        enabled: true,
        config: {
          formatApiUrl: () => 'https://api.github.com',
        },
        handlers: {
          activity: async (_request: any, _config: any) => ({
            activity: [
              {
                id: 'gh1',
                tool: 'GitHub',
                toolIcon: 'github-icon',
                action: 'opened',
                description: 'Opened PR #123',
                author: 'john-doe',
                time: '1 hour ago',
                color: 'bg-green-500',
                timestamp: '2025-01-15T13:00:00Z',
                url: 'https://github.com/org/repo/pull/123',
                displayId: '#123',
                repository: 'my-repo',
                branch: 'feature-x',
                status: 'open',
              },
              {
                id: 'gh2',
                tool: 'GitHub',
                toolIcon: 'github-icon',
                action: 'merged',
                description: 'Merged PR #100',
                author: 'jane-smith',
                time: '3 hours ago',
                color: 'bg-purple-500',
                timestamp: '2025-01-15T11:00:00Z',
                url: 'https://github.com/org/repo/pull/100',
                displayId: '#100',
                status: 'merged',
              },
            ],
          }),
        },
      };

      const mockJiraTool = {
        name: 'Jira',
        slug: 'jira',
        enabled: true,
        config: {
          formatApiUrl: () => 'https://company.atlassian.net/rest/api/3',
        },
        handlers: {
          activity: vi.fn((request, config) => Promise.resolve({
            activity: [
              {
                id: 'jira1',
                tool: 'Jira',
                toolIcon: 'jira-icon',
                action: 'created',
                description: 'Created PROJ-456',
                author: 'dev-user',
                time: '30 minutes ago',
                color: 'bg-blue-500',
                timestamp: '2025-01-15T13:30:00Z',
                url: 'https://company.atlassian.net/browse/PROJ-456',
                displayId: 'PROJ-456',
                assignee: 'john-doe',
                status: 'in-progress',
                labels: ['high-priority'],
              },
            ],
          })),
        },
      };

      mockGetEnabledToolsByCapability.mockReturnValue([mockGithubTool, mockJiraTool]);

      const response = await getActivityData();
      const data = await response.json();

      expect(response.status).toBe(200);

      // Should have 3 activities total, limited to 50 most recent
      expect(data.activity).toHaveLength(3);
      expect(data.sources).toBe(2);

      // Activities should be sorted by timestamp (most recent first)
      expect(data.activity[0].author).toBe('dev-user'); // 13:30:00
      expect(data.activity[1].author).toBe('john-doe'); // 13:00:00
      expect(data.activity[2].author).toBe('jane-smith'); // 11:00:00

      // Check transformation and metadata preservation
      const recentActivity = data.activity[0];
      expect(recentActivity.repository).toBeUndefined(); // Jira doesn't have repository
      expect(recentActivity.assignee).toBe('john-doe');
      expect(recentActivity.labels).toEqual(['high-priority']);
    });

    it('limits results to 50 most recent activities', async () => {
      const mockActivityArray = Array.from({ length: 60 }, (_, i) => ({
        id: `activity${i}`,
        tool: 'TestTool',
        toolIcon: 'test-icon',
        action: 'test',
        description: `Activity ${i}`,
        author: `user${i % 3}`,
        time: `${i} hours ago`,
        color: 'bg-blue-500',
        timestamp: `2025-01-15T${String(14 - i).padStart(2, '0')}:00:00Z`,
        url: `https://test.com/${i}`,
        displayId: `#${i}`,
      }));

      const mockTool = {
        name: 'TestTool',
        slug: 'test',
        enabled: true,
        config: {
          formatApiUrl: () => 'https://test.com/api',
        },
        handlers: {
          activity: vi.fn((request, config) => Promise.resolve({
            activity: mockActivityArray,
          })),
        },
      };

      mockGetEnabledToolsByCapability.mockReturnValue([mockTool]);

      const response = await getActivityData();
      const data = await response.json();

      expect(data.activity).toHaveLength(50);
      // Should be the most recent activities (lowest timestamps first in the mock)
      expect(data.activity[0].id).toBe('activity0'); // Most recent
      expect(data.activity[49].id).toBe('activity49');
    });

    it('handles empty activity data from tools gracefully', async () => {
      const mockTool = {
        name: 'EmptyTool',
        slug: 'empty',
        enabled: true,
        config: {
          formatApiUrl: () => 'https://empty.com/api',
        },
        handlers: {
          activity: vi.fn((request, config) => Promise.resolve({
            activity: [],
          })),
        },
      };

      mockGetEnabledToolsByCapability.mockReturnValue([mockTool]);

      const response = await getActivityData();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.activity).toEqual([]);
      expect(data.sources).toBe(1);
      expect(data.message).toBe('No recent activity found');
    });
  });

  describe('error handling and edge cases', () => {
    it('returns empty activity when no tools provide activity capability', async () => {
      mockGetEnabledToolsByCapability.mockReturnValue([]);

      const response = await getActivityData();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.activity).toEqual([]);
      expect(data.message).toBe('No tools providing activity data are currently enabled');
    });

    it('handles individual tool failures gracefully', async () => {
      const failingTool = {
        name: 'FailingTool',
        slug: 'fail',
        enabled: true,
        config: {
          formatApiUrl: () => 'https://fail.com/api',
        },
        handlers: {
          activity: vi.fn((request, config) => Promise.reject(new Error('API down'))),
        },
      };

      const workingTool = {
        name: 'WorkingTool',
        slug: 'work',
        enabled: true,
        config: {
          formatApiUrl: () => 'https://work.com/api',
        },
        handlers: {
          activity: vi.fn((request, config) => Promise.resolve({
            activity: [
              {
                id: 'work1',
                tool: 'WorkingTool',
                toolIcon: 'work-icon',
                action: 'test',
                description: 'Working activity',
                author: 'success-user',
                time: '1 hour ago',
                color: 'bg-green-500',
                timestamp: '2025-01-15T13:00:00Z',
                url: 'https://work.com/1',
                displayId: 'W-1',
              },
            ],
          })),
        },
      };

      mockGetEnabledToolsByCapability.mockReturnValue([failingTool, workingTool]);

      const response = await getActivityData();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.activity).toHaveLength(1);
      expect(data.activity[0].author).toBe('success-user');
      expect(data.sources).toBe(2);
    });

    it('handles missing activity handler in tools', async () => {
      const incompleteTool = {
        name: 'IncompleteTool',
        slug: 'incomplete',
        enabled: true,
        config: {
          formatApiUrl: () => 'https://incomplete.com/api',
        },
        handlers: {}, // No activity handler
      };

      mockGetEnabledToolsByCapability.mockReturnValue([incompleteTool]);

      const response = await getActivityData();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.activity).toEqual([]);
      expect(data.sources).toBe(1);
    });

    it('handles tools returning non-array activity data', async () => {
      const brokenTool = {
        name: 'BrokenTool',
        slug: 'broken',
        enabled: true,
        config: {
          formatApiUrl: () => 'https://broken.com/api',
        },
        handlers: {
          activity: vi.fn((request, config) => Promise.resolve({
            activity: 'not-an-array', // Invalid format
          })),
        },
      };

      mockGetEnabledToolsByCapability.mockReturnValue([brokenTool]);

      const response = await getActivityData();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.activity).toEqual([]);
      expect(data.sources).toBe(1);
    });

    it('transforms and validates activity item fields correctly', async () => {
      const mockTool = {
        name: 'TestTool',
        slug: 'test',
        enabled: true,
        config: {
          formatApiUrl: () => 'https://validation-test.com/api',
        },
        handlers: {
          activity: vi.fn((request, config) => Promise.resolve({
            activity: [
              {
                id: null, // Invalid id
                tool: undefined, // Should get default
                action: '',
                description: null, // Invalid description
                author: '',
                time: null, // Invalid time
                color: null, // Invalid color
                timestamp: 'invalid-date', // Invalid timestamp
                url: null, // Invalid url
                displayId: null, // Invalid displayId
                // Additional fields
                repository: 'test-repo',
                branch: 'main',
                commitCount: '5', // Should be converted to number
                status: 'in-progress',
                assignee: 'user@example.com',
                labels: 'label1,label2', // Should be array but is string
              },
            ],
          })),
        },
      };

      mockGetEnabledToolsByCapability.mockReturnValue([mockTool]);

      const response = await getActivityData();
      const data = await response.json();

      expect(data.activity[0]).toEqual({
        id: '',
        tool: 'TestTool', // Gets default from tool.name
        toolIcon: 'TestTool', // Gets default from tool.name.toLowerCase()
        action: '',
        description: '',
        author: '',
        time: '',
        color: 'blue', // Gets default color
        timestamp: expect.any(String), // Non-empty timestamp
        url: '',
        displayId: '',
        repository: 'test-repo',
        branch: 'main',
        commitCount: 0, // Failed to parse as number
        status: 'in-progress',
        assignee: 'user@example.com',
        labels: expect.any(Array), // Should be converted to array
      });
    });
  });

  describe('error cases', () => {
    it('returns 500 error on unexpected exceptions', async () => {
      mockGetEnabledToolsByCapability.mockImplementation(() => {
        throw new Error('Unexpected database error');
      });

      const response = await getActivityData();

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe('Failed to fetch activity data');
    });
  });

  describe('sorting and limits', () => {
    it('sorts activities by timestamp in descending order', async () => {
      const mockTool = {
        name: 'SortTool',
        slug: 'sort',
        enabled: true,
        config: {
          formatApiUrl: () => 'https://sort.com/api',
        },
        handlers: {
          activity: vi.fn((request, config) => Promise.resolve({
            activity: [
              { id: '1', timestamp: '2025-01-10T10:00:00Z' },
              { id: '2', timestamp: '2025-01-15T10:00:00Z' },
              { id: '3', timestamp: '2025-01-01T10:00:00Z' },
            ].map(item => ({
              ...item,
              tool: 'SortTool',
              toolIcon: 'sort-icon',
              action: 'test',
              description: 'Test activity',
              author: 'test-user',
              time: 'test time',
              color: 'bg-blue-500',
              url: 'https://test.com',
              displayId: '#test',
            })),
          })),
        },
      };

      mockGetEnabledToolsByCapability.mockReturnValue([mockTool]);

      const response = await getActivityData();
      const data = await response.json();

      // Should be sorted most recent first
      expect(data.activity[0].id).toBe('2'); // 2025-01-15
      expect(data.activity[1].id).toBe('1'); // 2025-01-10
      expect(data.activity[2].id).toBe('3'); // 2025-01-01
    });

    it('handles invalid timestamps in sorting', async () => {
      const mockTool = {
        name: 'InvalidTimestampTool',
        slug: 'invalid',
        enabled: true,
        config: {
          formatApiUrl: () => 'https://invalid.com/api',
        },
        handlers: {
          activity: vi.fn((request, config) => Promise.resolve({
            activity: [
              { id: '1', timestamp: null },
              { id: '2', timestamp: '2025-01-15T10:00:00Z' },
              { id: '3', timestamp: undefined },
            ].map(item => ({
              ...item,
              tool: 'InvalidTimestampTool',
              toolIcon: 'invalid-icon',
              action: 'test',
              description: 'Test activity',
              author: 'test-user',
              time: 'test time',
              color: 'bg-blue-500',
              url: 'https://test.com',
              displayId: '#test',
            })),
          })),
        },
      };

      mockGetEnabledToolsByCapability.mockReturnValue([mockTool]);

      const response = await getActivityData();
      const data = await response.json();

      // Should handle invalid timestamps gracefully
      expect(data.activity).toHaveLength(3);
      // Items with valid timestamps should be sorted correctly
    });
  });
});
