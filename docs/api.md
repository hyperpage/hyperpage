# API Reference

This document provides technical details about the Hyperpage API endpoints, data schemas, and tool integration patterns.

## API Architecture

The Hyperpage API follows a unified structure for all tool integrations:

```
GET /api/tools/[tool]/[endpoint]
```

Where:
- **`tool`**: Tool slug (e.g., `github`, `jira`, `gitlab`, `ci-cd`, `code-reviews`)
- **`endpoint`**: Tool-specific endpoint (e.g., `repos`, `issues`, `merge-requests`)

## Core Endpoints

### Tool Discovery

#### `GET /api/tools/enabled`
Returns all enabled tools with their UI-safe configuration.

**Response:**
```json
{
  "tools": [
    {
      "name": "GitHub",
      "slug": "github",
      "enabled": true,
      "ui": {
        "color": "bg-purple-500/10 border-purple-400/30 text-purple-400",
        "icon": "<GitHubIcon />"
      },
      "widgets": [...],
      "capabilities": ["pull-requests", "workflows", "activity", "issues"]
    }
  ]
}
```

### Activity Feed

#### `GET /api/tools/activity`
Aggregates recent activities from all enabled tools.

**Response:**
```json
{
  "activity": [
    {
      "id": "123",
      "tool": "GitHub",
      "toolIcon": "🐙",
      "action": "Pull request opened",
      "description": "feat: Add dark mode toggle",
      "author": "johndoe",
      "time": "2 hours ago",
      "color": "purple",
      "timestamp": "2025-10-20T14:30:00Z",
      "url": "https://github.com/...",
      "displayId": "#123",
      "repository": "hyperpage/hyperpage",
      "branch": "feature/dark-mode"
    }
  ]
}
```

### Tool-Specific Endpoints

#### GitHub Tool
- **`GET /api/tools/github/pull-requests`**: List user pull requests
- **`GET /api/tools/github/commits`**: List recent commit/push events
- **`GET /api/tools/github/issues`**: List user issues
- **`GET /api/tools/github/workflows`**: List recent workflow runs
- **`GET /api/tools/github/activity`**: Get user activity events with unique commit content (prevents duplicate commits across push events)
- **`GET /api/tools/github/rate-limit`**: Get current GitHub API rate limit status for debugging 403 errors (includes core, search, graphql limits and reset times)

#### GitLab Tool
- **`GET /api/tools/gitlab/merge-requests`**: List merge requests
- **`GET /api/tools/gitlab/pipelines`**: List recent pipelines
- **`GET /api/tools/gitlab/issues`**: List user issues
- **`GET /api/tools/gitlab/activity`**: Get user activity events

#### Jira Tool
- **`GET /api/tools/jira/issues`**: List issues by project/assignee

#### Aggregation Tools
- **`GET /api/tools/code-reviews/pull-requests`**: Combined PRs/MRs from all git tools (GitHub PRs, GitLab MRs)
- **`GET /api/tools/ci-cd/pipelines`**: Unified CI/CD pipelines from all providers (GitLab pipelines, GitHub workflows)
- **`GET /api/tools/ticketing/issues`**: Combined issues/tickets from all ticketing tools (GitHub issues, GitLab issues, Jira issues)

## Data Schemas

### Common Data Interface

All tool widgets follow this standardized interface:

```typescript
interface ToolData {
  [key: string]: React.ReactNode | string | number | null | undefined;
}
```

### Widget Configuration

```typescript
interface ToolWidget {
  title: string;
  type: 'metric' | 'chart' | 'table' | 'feed';
  data: ToolData[];
  headers?: string[];
  dynamic?: boolean;                           // Enables API data fetching when true
  apiEndpoint?: string;                       // Specifies which API endpoint this widget consumes
  refreshInterval?: number;                   // Auto-refresh interval in milliseconds
  displayName?: string;                       // Optional display override for widget title
}
```

### Activity Event Schema

```typescript
interface ActivityEvent {
  id: string;              // Unique identifier
  tool: string;            // Tool name ('GitHub', 'Jira', etc.)
  toolIcon: string;        // Emoji representation
  action: string;          // Action performed
  description: string;     // Detailed description
  author: string;          // Person who performed action
  time: string;            // Human-readable time ago
  color: string;           // Theme color ('purple', 'green', 'orange')
  timestamp: string;       // ISO timestamp for sorting
  url?: string;            // Optional navigation URL
  displayId?: string;      // Optional user-friendly ID ('#123', '!456')
  repository?: string;     // Optional repo/project context
  branch?: string;         // Optional branch name
  commitCount?: number;    // Optional commit count
  status?: string;         // Optional status indicator
  assignee?: string;       // Optional assignee information
  labels?: string[];       // Optional labels/tags

  // Enhanced Rich Content Fields (New)
  content?: Array<{        // Rich content items (commits, descriptions, comments)
    type: 'commit' | 'description' | 'comment' | 'change';
    text: string;          // Content text (truncated to ~150 chars)
    url?: string;          // Optional navigation URL (e.g., GitHub commit URL)
    displayId?: string;    // Optional user-friendly ID (e.g., commit SHA 'abc1234')
    author?: string;       // Who authored the content
    timestamp?: string;    // When content was created/modified
  }>;
}
```

## Tool Integration API

### Tool Definition Interface

```typescript
interface Tool {
  name: string;                    // Display name
  slug: string;                    // URL-safe identifier
  enabled: boolean;                // Environment-controlled
  capabilities: string[];          // Declared capabilities
  ui: {                            // UI properties
    color: string;
    icon: React.ReactNode;
  };
  apis: Record<string, ApiSpec>;   // Endpoint specifications
  handlers: Record<string, Handler>; // API implementations
  config: ToolConfig;             // Server-side configuration
  widgets: ToolWidget[];          // UI widget definitions
  activity?: boolean;             // Activity feed participation
}
```

### API Handler Signature

```typescript
type ToolApiHandler = (
  request: Request,
  config: ToolConfig
) => Promise<Record<string, unknown>>;
```

### Tool Capabilities

Tools declare capabilities for automatic discovery by aggregators:

| Capability | Description | Providers |
|------------|-------------|-----------|
| `pull-requests` | GitHub PRs, GitLab MRs | GitHub, GitLab |
| `merge-requests` | GitLab merge requests | GitLab |
| `workflows` | CI/CD workflows | GitHub |
| `pipelines` | CI/CD pipelines | GitLab |
| `activity` | Activity feed events | GitHub, GitLab, Jira |
| `issues` | Ticketing issues | GitHub, GitLab, Jira |

### Registry System

Tools register themselves through the centralized registry:

```typescript
// In tools/mytool/index.ts
export const myTool: Tool = { /* ... */ };
registerTool('mytool', myTool);
```

### URL Auto-Derivation

The system automatically derives API URLs from web URLs:

```typescript
interface ToolConfig {
  formatApiUrl?: (webUrl: string) => string;  // URL derivation function
  getWebUrl?: () => string;                   // Web URL getter
}
```

**Examples:**
- **Jira**: `${webUrl}/rest/api/3`
- **GitLab**: `${webUrl}/api/v4`
- **GitHub**: Always `https://api.github.com`

## Security Architecture

### Server-Side Isolation

**Client-Safe Objects:**
```typescript
interface ClientTools extends Omit<Tool, 'handlers' | 'config'> {
  // Safe properties only - no sensitive data
}
```

**Server-Only Properties:**
- `config`: API tokens, credentials, headers
- `handlers`: API implementation functions
- Sensitive authentication data

### Input Validation

All API parameters are validated with strict regex patterns:

```typescript
// Tool name validation: letters, numbers, underscores, hyphens, spaces
const toolPattern = /^[a-zA-Z0-9_%\-\s]+$/;

// Endpoint validation
const endpointPattern = /^[a-zA-Z0-9_%-]+$/;
```

### Error Handling

**Client Response:**
```json
{
  "error": "An error occurred while processing the request"
}
```

**Server Logging:**
- Detailed error information logged server-side
- Stack traces available for debugging
- Generic messages prevent information disclosure

## Adding New Tools

### 3-Step Process

1. **Create Tool Definition** (`tools/mytool/index.ts`):
```typescript
import { Tool, ToolConfig } from '../tool-types';
import { registerTool } from '../registry';

export const myTool: Tool = {
  name: 'My Tool',
  slug: 'my-tool',
  enabled: process.env.ENABLE_MYTOOL === 'true',

  capabilities: ['my-data'],

  ui: {
    color: 'bg-blue-500/10 border-blue-400/30 text-blue-400',
    icon: React.createElement(MyIcon, { className: 'w-5 h-5' })
  },

  apis: {
    'data': {
      method: 'GET',
      description: 'Get data',
      response: {
        dataKey: 'items'
      }
    }
  },

  handlers: {
    'data': async (request: Request, config: ToolConfig) => {
      const response = await fetch(`${config.apiUrl}/data`, {
        headers: config.headers
      });
      const data = await response.json();
      return { items: data };
    }
  },

  config: {
    formatApiUrl: (webUrl: string) => `${webUrl}/api/v1`,
    headers: {
      'Authorization': `Bearer ${process.env.MYTOOL_TOKEN}`
    }
  },

  widgets: [{
    title: 'My Data',
    type: 'table',
    headers: ['Name', 'Value'],
    dynamic: true
  }]
};

registerTool('mytool', myTool);
```

2. **Import in Registry** (`tools/index.ts`):
```typescript
import './mytool';  // ← One line addition
```

3. **Configure Environment**:
```env
ENABLE_MYTOOL=true
MYTOOL_WEB_URL=https://mytool.com
MYTOOL_TOKEN=api_token_here
```

**Result:** Tool automatically appears with UI widgets, API endpoints, and full integration.

## Error Codes

| Status | Description |
|--------|-------------|
| 200 | Success |
| 400 | Bad Request (invalid parameters) |
| 401 | Unauthorized (invalid/expired token) |
| 403 | Forbidden (insufficient permissions) |
| 404 | Not Found (tool/endpoint doesn't exist) |
| 429 | Rate Limited (too many requests) |
| 500 | Internal Server Error |

## Rate Limiting Protection

### Intelligent Retry & Backoff System

Hyperpage implements sophisticated **platform-specific rate limiting** to prevent API throttling:

#### Core Infrastructure (`lib/api-client.ts`)
- **Registry-Driven Strategy**: Each tool defines its own rate limiting behavior
- **Exponential Backoff**: 1s → 2s → 4s → max 60s cap with configurable base delays
- **Platform Awareness**: Tailored handling for GitHub, GitLab, and Jira rate limit patterns

#### Tool-Specific Configurations

**GitHub Rate Limiting:**
- **Proactive Avoidance**: Monitors `X-RateLimit-Remaining` and waits until `X-RateLimit-Reset`
- **Priority Headers**: Checks remaining calls before hitting zero
- **Fallback Backoff**: 429 responses trigger retry with exponential timing

**GitLab Rate Limiting:**
- **Server Compliance**: Honors `Retry-After` header when present
- **Flexible Strategy**: Falls back to exponential backoff when header missing
- **Conservative Timing**: Shorter delays than GitHub due to different API patterns

**Jira Rate Limiting:**
- **Response-Based**: Detects 429 status codes without specific headers
- **INSTANCE-AWARE**: More conservative backoff (2s base) for varying server sizes
- **Graceful Degradation**: Handles unpredictable enterprise environments

#### Implementation Pattern

```typescript
// Tool defines rate limiting behavior
config: {
  rateLimit: {
    detectHeaders: (response: Response) => ({
      remaining: parseInt(response.headers.get('X-RateLimit-Remaining')!),
      resetTime: parseInt(response.headers.get('X-RateLimit-Reset')!),
      retryAfter: null
    }),

    shouldRetry: (response: Response, attemptNumber: number) => {
      // Platform-specific retry logic
      if (response.status === 429) return calculateBackoffDelay(attemptNumber);
      // GitHub proactive avoidance logic...
      return null; // No retry needed
    },

    maxRetries: 3, // or 5 for enterprise tools
    backoffStrategy: 'exponential'
  }
}

// API calls automatically protect against rate limiting
const data = await makeRetryRequest(url, options, { rateLimitConfig: toolConfig.rateLimit });
```

#### Architectural Benefits

- **Registry-Driven**: No hardcoded platform logic - tools self-configure
- **Extensible**: New platforms add rate limiting without core changes
- **Production-Ready**: Prevents API failures and user disruption
- **Performance Optimized**: Smart retry timing minimizes wasted requests
- **User Experience**: Seamless operation during API limit events

#### Additional Protections

- **Request Deduplication**: Identical requests are cached/grouped
- **Graceful Degradation**: Failed tools don't break entire dashboard
- **Client Feedback**: Loading states indicate rate limit status
- **Comprehensive Testing**: Full test suite validates retry logic

For implementation details, see [`lib/api-client.ts`](../lib/api-client.ts).

## Development Endpoints

### Tool Registration
```bash
# List all registered tools
GET /api/tools/registered

# Check tool health
GET /api/tools/[tool]/health

# Validate configuration
GET /api/tools/validate
```

For architectural details and deeper integration patterns, see [`docs/architecture.md`](architecture.md).
