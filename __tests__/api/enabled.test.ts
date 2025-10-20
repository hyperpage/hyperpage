import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET as getEnabledTools } from '../../app/api/tools/enabled/route';
import * as toolsModule from '../../tools';

// Mock the entire tools module to intercept getEnabledTools
vi.mock('../../tools', () => ({
  getEnabledTools: vi.fn(),
}));

const mockGetEnabledTools = vi.mocked(toolsModule.getEnabledTools);

describe('GET /api/tools/enabled', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('successful responses', () => {
    it('returns enabled tools with correct transformation', async () => {
      // Create simplified mock tools with minimum required properties
      const mockTools = [
        {
          name: 'GitHub',
          slug: 'github',
          enabled: true,
          ui: { color: 'bg-blue-500', icon: null as any } as any,
          widgets: [
            {
              title: 'Pull Requests',
              type: 'table' as const,
              data: [],
              headers: ['Title', 'Status'],
              dynamic: true,
            } as any,
            {
              title: 'Issues',
              type: 'card' as const,
              data: [],
              dynamic: false,
            } as any,
          ],
          apis: {
            pulls: {
              method: 'GET' as const,
              description: 'Get pull requests',
              parameters: [],
            },
            issues: {
              method: 'POST' as const,
              description: 'Update issue status',
              parameters: [{ name: 'status', type: 'string' }],
            },
          },
          handlers: {},
          capabilities: ['pull-requests'],
        } as any,
        {
          name: 'Jira',
          slug: 'jira',
          enabled: true,
          ui: { color: 'bg-green-500', icon: null as any } as any,
          widgets: [
            {
              title: 'Tickets',
              type: 'table' as const,
              data: [],
              headers: undefined,
              dynamic: true,
            } as any,
          ],
          apis: {
            issues: {
              method: 'GET' as const,
              description: 'Get issues',
              parameters: [{ name: 'assignee', type: 'string' }],
            },
          },
          handlers: {},
          capabilities: ['issues'],
        } as any,
      ];

      mockGetEnabledTools.mockReturnValue(mockTools);

      const response = await getEnabledTools();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.enabledTools).toHaveLength(2);
      expect(data.count).toBe(2);

      // Check first tool transformation
      expect(data.enabledTools[0]).toEqual({
        name: 'GitHub',
        enabled: true,
        widgets: [
          {
            title: 'Pull Requests',
            type: 'table',
            headers: ['Title', 'Status'],
            dynamic: true,
          },
          {
            title: 'Issues',
            type: 'card',
            dynamic: false,
          },
        ],
        apis: [
          {
            endpoint: 'pulls',
            method: 'GET',
            description: 'Get pull requests',
            parameters: [],
            url: '/api/tools/github/pulls',
          },
          {
            endpoint: 'issues',
            method: 'POST',
            description: 'Update issue status',
            parameters: [{ name: 'status', type: 'string' }],
            url: '/api/tools/github/issues',
          },
        ],
      });

      // Check API summary
      expect(data.apis).toHaveLength(3); // GitHub has 2 APIs, Jira has 1
      expect(data.apis[0]).toEqual({
        tool: 'GitHub',
        endpoint: 'pulls',
        method: 'GET',
        description: 'Get pull requests',
        parameters: [],
        url: '/api/tools/github/pulls',
      });
    });

    it('handles empty enabled tools array', async () => {
      mockGetEnabledTools.mockReturnValue([]);

      const response = await getEnabledTools();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.enabledTools).toEqual([]);
      expect(data.count).toBe(0);
      expect(data.apis).toEqual([]);
    });

    it('handles tools without APIs', async () => {
      const mockTools = [
        {
          name: 'GitLab',
          slug: 'gitlab',
          enabled: true,
          ui: { color: 'bg-orange-500', icon: null as any } as any,
          widgets: [{ title: 'Dashboard', type: 'card' as const, data: [], dynamic: true } as any],
          apis: undefined as any,
          handlers: {},
        } as any,
      ];

      mockGetEnabledTools.mockReturnValue(mockTools);

      const response = await getEnabledTools();
      const data = await response.json();

      expect(data.enabledTools[0].apis).toEqual([]);
      expect(data.apis).toEqual([]);
    });

    it('handles tools with null or empty widgets', async () => {
      const mockTools = [
        {
          name: 'TestTool',
          slug: 'test',
          enabled: true,
          ui: { color: 'bg-blue-500', icon: null as any } as any,
          widgets: null as any,
          apis: {
            test: {
              method: 'GET' as const,
              description: 'Test endpoint',
              parameters: [],
            },
          },
          handlers: {},
        } as any,
      ];

      mockGetEnabledTools.mockReturnValue(mockTools);

      const response = await getEnabledTools();
      const data = await response.json();

      expect(data.enabledTools[0].widgets).toEqual([]);
      expect(data.apis).toHaveLength(1);
    });

    it('correctly transforms widget headers (including undefined)', async () => {
      const mockTools = [
        {
          name: 'TestTool',
          slug: 'test',
          enabled: true,
          ui: { color: 'bg-blue-500', icon: null as any } as any,
          widgets: [
            { title: 'Widget1', type: 'table' as const, data: [], headers: ['A', 'B'], dynamic: true } as any,
            { title: 'Widget2', type: 'card' as const, data: [], dynamic: true } as any, // headers undefined
            { title: 'Widget3', type: 'table' as const, data: [], headers: [], dynamic: false } as any, // empty headers
          ],
          apis: {},
          handlers: {},
        } as any,
      ];

      mockGetEnabledTools.mockReturnValue(mockTools);

      const response = await getEnabledTools();
      const data = await response.json();

      expect(data.enabledTools[0].widgets).toEqual([
        { title: 'Widget1', type: 'table', headers: ['A', 'B'], dynamic: true },
        { title: 'Widget2', type: 'card', dynamic: true },
        { title: 'Widget3', type: 'table', headers: [], dynamic: false },
      ]);
    });
  });

  describe('error handling', () => {
    it('returns 500 error when getEnabledTools throws', async () => {
      mockGetEnabledTools.mockImplementation(() => {
        throw new Error('Database connection failed');
      });

      const response = await getEnabledTools();
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to get enabled tools');
    });

    it('handles unexpected tool structure gracefully', async () => {
      const mockTools = [
        { name: 'MalformedTool' } as any, // Missing required fields
        {
          name: 'ValidTool',
          slug: 'valid',
          enabled: true,
          ui: { color: 'bg-blue-500', icon: null as any } as any,
          widgets: [],
          apis: {},
          handlers: {},
        } as any,
      ];

      mockGetEnabledTools.mockReturnValue(mockTools);

      const response = await getEnabledTools();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.enabledTools).toHaveLength(2);
      // The malformed tool should not break the response
      expect(data.enabledTools[0].name).toBe('MalformedTool');
      expect(data.enabledTools[1].name).toBe('ValidTool');
    });
  });
});
