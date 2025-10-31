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

### Authentication API

Hyperpage provides OAuth authentication endpoints for secure tool integration. The authentication system supports GitHub, GitLab, and Jira with encrypted token storage and automatic refresh.

#### `GET /api/auth/status`
Checks the current authentication status for the user session.

**Response (200):**
```json
{
  "success": true,
  "authenticated": true,
  "user": {
    "id": "github:12345",
    "provider": "github",
    "username": "johndoe",
    "displayName": "John Doe",
    "email": "john@example.com",
    "avatarUrl": "https://avatars.githubusercontent.com/u/12345?v=4"
  },
  "authenticatedTools": {
    "github": { "connected": true, "connectedAt": "2025-10-30T11:00:00.000Z" },
    "jira": { "connected": false }
  }
}
```

#### `GET /api/auth/config`
Returns the OAuth configuration status for all supported tools.

**Response (200):**
```json
{
  "tools": {
    "github": { "configured": true },
    "gitlab": { "configured": true },
    "jira": { "configured": false, "reason": "Missing JIRA_OAUTH_CLIENT_SECRET" }
  }
}
```

#### `GET /api/auth/[tool]/initiate`
Initiates the OAuth flow for the specified tool (GitHub, GitLab, Jira).

**Parameters:**
- `tool`: The tool to authenticate with (`github`, `gitlab`, `jira`)

**Response (200):**
- Redirects to provider authorization URL (HTTP 302)

#### `GET /api/auth/[tool]/callback`
Handles the OAuth callback from the provider and exchanges the authorization code for tokens.

**Query Parameters:**
- `tool`: The tool being authenticated with
- `code`: Authorization code from provider
- `state`: CSRF protection state parameter

**Response (200):**
- Redirects to dashboard with success authentication

#### `GET /api/auth/[tool]/status`
Returns detailed authentication status for a specific tool.

**Parameters:**
- `tool`: The tool to check (`github`, `gitlab`, `jira`)

**Response (200):**
```json
{
  "authenticated": true,
  "user": {
    "id": "github:12345",
    "username": "johndoe",
    "displayName": "John Doe"
  },
  "connectedAt": "2025-10-30T11:00:00.000Z",
  "scopes": ["user", "repo"],
  "expiresAt": "2025-11-29T11:00:00.000Z"
}
```

#### `POST /api/auth/[tool]/disconnect`
Disconnects the specified tool for the current user session.

**Parameters:**
- `tool`: The tool to disconnect (`github`, `gitlab`, `jira`)

**Response (200):**
```json
{
  "success": true,
  "message": "Successfully disconnected from GitHub"
}
```

**Authentication Features:**
- **PKCE Support**: Proof Key for Code Exchange for enhanced security
- **AES-256-GCM Encryption**: All tokens encrypted with military-grade encryption
- **Automatic Refresh**: Access tokens automatically refreshed before expiration
- **CSRF Protection**: State parameter validation prevents cross-site request forgery
- **Secure Storage**: Tokens stored in SQLite database with server-side only access

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
      "capabilities": ["pull-requests", "workflows", "issues", "rate-limit"]
    }
  ]
}
```

### Tool-Specific Endpoints

#### GitHub Tool
- **`GET /api/tools/github/pull-requests`**: List user pull requests
- **`GET /api/tools/github/issues`**: List user issues
- **`GET /api/tools/github/workflows`**: List recent workflow runs
- **`GET /api/rate-limit/github`**: Unified rate limit monitoring endpoint (returns platform-specific limit structures)

#### GitLab Tool
- **`GET /api/tools/gitlab/merge-requests`**: List merge requests
- **`GET /api/tools/gitlab/pipelines`**: List recent pipelines
- **`GET /api/tools/gitlab/issues`**: List user issues

#### Jira Tool
- **`GET /api/tools/jira/issues`**: List issues by project/assignee
- **`POST /api/tools/jira/changelogs`**: Batch fetch changelogs for multiple Jira issues (rate limit optimized)
- **`GET /api/tools/jira/projects`**: Get Jira project metadata with 24-hour caching (rate limit optimized)

#### Aggregation Tools
- **`GET /api/tools/code-reviews/pull-requests`**: Combined PRs/MRs from all git tools (GitHub PRs, GitLab MRs)
- **`GET /api/tools/ci-cd/pipelines`**: Unified CI/CD pipelines from all providers (GitLab pipelines, GitHub workflows)
- **`GET /api/tools/ticketing/issues`**: Combined issues/tickets from all ticketing tools (GitHub issues, GitLab issues, Jira issues)

### Jira Smart Endpoints

#### `POST /api/tools/jira/changelogs`

Batch fetches changelog entries for multiple Jira issues with intelligent rate limiting. This endpoint is optimized to prevent API storms by chunking requests and implementing instance-aware delays.

**Parameters:**
- **`issueIds`** (array, required): Array of Jira issue IDs/keys to fetch changelogs for
- **`since`** (string, optional): ISO 8601 timestamp - only include changes since this date
- **`maxResults`** (number, optional, default: 10): Maximum changelog entries per issue

**Request Body:**
```json
{
  "issueIds": ["PROJ-123", "PROJ-456", "HOW-789"],
  "since": "2024-01-01T00:00:00Z"  // Optional
}
```

**Response (200):**
```json
{
  "changelogs": [
    {
      "issueId": "PROJ-123",
      "changelog": [
        {
          "id": "12345",
          "author": "John Doe",
          "created": "2024-01-15T10:30:00.000+0000",
          "items": [
            {
              "field": "status",
              "fieldtype": "jira",
              "from": "To Do",
              "to": "In Progress"
            }
          ]
        }
      ]
    },
    {
      "issueId": "PROJ-456",
      "changelog": [],
      "error": "Issue not found"
    }
  ]
}
```

**Rate Limiting Features:**
- **Adaptive Chunking**: 5-15 issues per batch based on Jira instance size
- **Instance-Aware Delays**: Conservative timing for large instances, progressive for cloud
- **Error Isolation**: Partial success with individual error reporting
- **Request Deduplication**: Automatic coordination via promise-based locking

#### `GET /api/tools/jira/projects`

Retrieves Jira project metadata with 24-hour intelligent caching. Optimized to significantly reduce API overhead through smart invalidation and cache-first lookups.

**Parameters:**
- **`projectKey`** (string, optional): Specific Jira project key (returns single project)
- **`includeDetails`** (boolean, optional, default: false): Include components, versions, roles, and issue types

**Response (200):**
```json
{
  "projects": [
    {
      "key": "PROJ",
      "name": "Project Name",
      "description": "Project description",
      "projectTypeKey": "software",
      "lead": "John Doe",
      "url": "https://company.atlassian.net/projects/PROJ",
      "category": "Development"
    }
  ]
}
```

**Caching Features:**
- **24-Hour TTL**: Intelligent cache expiration with automatic cleanup
- **Smart Keys**: Cache keys distinguish between basic and detailed requests
- **Cache-First Strategy**: Served from cache when available and fresh
- **Automatic Invalidation**: User-initiated refreshes bypass cache

**Performance Metrics:**
- **API Call Reduction**: ~90% fewer project metadata requests
- **Cache Hit Rate**: Intelligent caching maintains 95%+ hit rate
- **Concurrent Safety**: Advisory locking prevents duplicate requests

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
| `issues` | Ticketing issues | GitHub, GitLab, Jira |
| `rate-limit` | API rate limit monitoring | GitHub, GitLab, Jira |

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

#### GitLab Rate Limiting Details

**GitLab.com (SaaS) vs GitLab Premium/Silver Tiers:**

|
Tier | Rate Limit | Scope | Notes |
|-----|------------|------|-------|
| **GitLab.com** | 2000 requests/hour | Per user across all endpoints | All users have same limits regardless of billing tier |
| **GitLab Premium** | 2000 requests/hour | Per user across all endpoints | No API limit increase over Free tier |
| **GitLab Self-managed** | Configurable by administrator | Instance-wide or per-user | No default limits - entirely customizable |

**Key Differences from GitHub:**
- **No Tier Benefits**: Unlike GitHub (5,000 requests/hour for authenticated users), GitLab Premium does not provide increased API limits
- **No Explicit Limits**: GitLab doesn't expose rate limit counters like GitHub's `X-RateLimit-Remaining` headers
- **Retry-After Only**: Rate limiting detected solely through 429 responses and `Retry-After` headers
- **Instance Variability**: Self-managed instances may have completely different (or no) rate limiting
- **Conservative Backoff**: Hyperpage uses more conservative retry intervals compared to GitHub

**Implementation Notes:**
- **Configuration-Aware**: Tool automatically adapts to different GitLab instance types
- **Fallback Strategy**: Progressive backoff (1m→4m→16m→64m→128m) when no `Retry-After` header present
- **Jitter Implementation**: ±15% random jitter on retry delays to prevent thundering herd issues
- **Premium Awareness**: Code comments note that Premium tier doesn't increase API limits

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
- **Graceful Degradation**: Failed tools don't break entire portal
- **Client Feedback**: Loading states indicate rate limit status
- **Comprehensive Testing**: Full test suite validates retry logic

For implementation details, see [`lib/api-client.ts`](../lib/api-client.ts).

## Rate Limit Monitoring API

Hyperpage provides unified rate limit monitoring endpoints for all supported platforms:

### `GET /api/rate-limit/[platform]`

Retrieves current rate limit status for the specified platform (GitHub, GitLab, Jira).

**Platform Support:**
- **GitHub**: Core API, Search API, GraphQL API limits
- **GitLab**: Global instance limits (retry-after based)
- **Jira**: Instance-wide limits (varies by Jira deployment)

**Parameters:**
- **`platform`**: Platform identifier (`github`, `gitlab`, `jira`)

**Success Response (200):**
```json
{
  "platform": "github",
  "limits": {
    "github": {
      "core": {
        "limit": 5000,
        "remaining": 4990,
        "used": 10,
        "usagePercent": 0.2,
        "resetTime": 1640995200000,
        "retryAfter": null
      },
      "search": {
        "limit": 30,
        "remaining": 27,
        "used": 3,
        "usagePercent": 10,
        "resetTime": 1640995200000,
        "retryAfter": null
      },
      "graphql": {
        "limit": 5000,
        "remaining": 4995,
        "used": 5,
        "usagePercent": 0.1,
        "resetTime": 1640995200000,
        "retryAfter": null
      }
    }
  },
  "timestamp": 1640995200000
}
```

**Error Responses:**
- **400**: Platform doesn't support rate limiting or missing capability
- **500**: Internal error fetching rate limit data
- **501**: Platform transformation not implemented

**Caching:** Results are cached for 5 minutes to prevent excessive API calls.

**Usage in UI:** The portal automatically uses these endpoints to show rate limit status in tool status indicators and tooltips.

**Platform-Specific Details:**

**GitHub Rate Limits:**
```json
{
  "limits": {
    "github": {
      "core": { "limit": 5000, "remaining": 4990, "used": 10, "usagePercent": 0.2 },
      "search": { "limit": 30, "remaining": 27, "used": 3, "usagePercent": 10 },
      "graphql": { "limit": 5000, "remaining": 4995, "used": 5, "usagePercent": 0.1 }
    }
  }
}
```

**GitLab Rate Limits:**
```json
{
  "limits": {
    "gitlab": {
      "global": { "limit": null, "remaining": null, "usagePercent": null, "retryAfter": 60, "resetTime": 1640995200000 }
    }
  }
}
```

**Jira Rate Limits:**
```json
{
  "limits": {
    "jira": {
      "global": { "limit": null, "remaining": null, "usagePercent": null, "resetTime": null, "retryAfter": null }
    }
  }
}
```

## Session Management API

Hyperpage provides enterprise-grade session management for distributed pod deployments, ensuring persistent user state across scaling operations and pod failures.

### Session Endpoints

#### `GET /api/sessions`
Creates a new session or retrieves existing session data.

**Query Parameters:**
- `sessionId` (optional): Retrieve specific session by ID

**Success Response (200):**
```json
{
  "success": true,
  "sessionId": "abc123-def456-ghi789",
  "session": {
    "userId": "user123",
    "preferences": {
      "theme": "system",
      "timezone": "UTC",
      "language": "en",
      "refreshInterval": 300000
    },
    "uiState": {
      "expandedWidgets": ["github-issues", "jira-workflows"],
      "lastVisitedTools": ["github", "jira"],
      "dashboardLayout": "default",
      "filterSettings": {
        "github": { "state": "open" },
        "jira": { "project": "PROJ" }
      }
    },
    "toolConfigs": {
      "github": {
        "enabled": true,
        "settings": { "personal": true },
        "lastUsed": "2025-10-29T12:00:00.000Z"
      },
      "jira": {
        "enabled": true,
        "settings": { "project": "PROJ" },
        "lastUsed": "2025-10-29T12:30:00.000Z"
      }
    },
    "lastActivity": "2025-10-29T13:45:00.000Z",
    "metadata": {
      "ipAddress": "192.168.1.100",
      "userAgent": "Mozilla/5.0...",
      "created": "2025-10-29T12:00:00.000Z",
      "updated": "2025-10-29T13:45:00.000Z"
    }
  },
  "message": "New session created"
}
```

#### `POST /api/sessions`
Updates or creates a session with provided data.

**Request Body:**
```json
{
  "sessionId": "abc123-def456-ghi789",
  "updates": {
    "preferences": { "theme": "dark" },
    "uiState": { "expandedWidgets": ["jira-issues"] }
  }
}
```

**Or (complete session data):**
```json
{
  "sessionId": "abc123-def456-ghi789",
  "sessionData": {
    "preferences": { "theme": "light" }
    // ... full session object
  }
}
```

**Success Response (200):**
```json
{
  "success": true,
  "sessionId": "abc123-def456-ghi789",
  "message": "Session saved successfully"
}
```

#### `PATCH /api/sessions?sessionId=abc123-def456-ghi789`
Partial update of session properties without affecting other fields.

**Query Parameters:**
- `sessionId` (required): Session to update

**Request Body:** Partial SessionData object
```json
{
  "preferences": { "theme": "system" },
  "uiState": { "dashboardLayout": "compact" }
}
```

**Success Response (200):**
```json
{
  "success": true,
  "sessionId": "abc123-def456-ghi789",
  "message": "Session updated successfully"
}
```

#### `DELETE /api/sessions?sessionId=abc123-def456-ghi789`
Permanently removes a session and all associated data.

**Query Parameters:**
- `sessionId` (required): Session to delete

**Success Response (200):**
```json
{
  "success": true,
  "message": "Session deleted successfully"
}
```

### Session Data Schema

```typescript
interface SessionData {
  userId?: string;                    // Optional user identifier

  preferences: {
    theme: 'light' | 'dark' | 'system';  // UI theme preference
    timezone: string;                     // User timezone
    language: string;                     // UI language
    refreshInterval: number;              // Data refresh interval (ms)
  };

  uiState: {
    expandedWidgets: string[];         // IDs of expanded widgets
    lastVisitedTools: string[];        // Recently used tool slugs
    dashboardLayout: string;          // Layout preference
    filterSettings: Record<string, any>; // Tool-specific filters
  };

  toolConfigs: {
    [toolId: string]: {
      enabled: boolean;                // Tool enabled in UI
      settings: Record<string, any>;   // Tool-specific settings
      lastUsed: string;               // ISO date string
    };
  };

  lastActivity: Date;                  // Last user interaction
  metadata: {
    ipAddress: string;                 // Client IP
    userAgent: string;                 // Browser user agent
    created: Date;                     // Session creation time
    updated: Date;                     // Last modification time
  };
}
```

### Client Integration

#### React Hook Usage

```typescript
import { useSession } from 'app/components/hooks/useSession';

function DashboardComponent() {
  const {
    session,           // Current session data
    sessionId,         // Session identifier
    isLoading,         // Loading state
    error,             // Error message (if any)
    updateSession,     // Update session function
    refreshSession,    // Refresh from server
    clearSession       // Delete session
  } = useSession();

  // Update theme preference
  const handleThemeChange = (theme: string) => {
    updateSession({
      preferences: { theme }
    });
  };

  // Toggle widget expansion
  const toggleWidget = (widgetId: string) => {
    const expanded = session?.uiState.expandedWidgets || [];
    const newExpanded = expanded.includes(widgetId)
      ? expanded.filter(id => id !== widgetId)
      : [...expanded, widgetId];

    updateSession({
      uiState: { expandedWidgets: newExpanded }
    });
  };

  return (
    <div>
      <ThemeSelector value={session?.preferences.theme} onChange={handleThemeChange} />
      <WidgetPanel
        expandedWidgets={session?.uiState.expandedWidgets || []}
        onToggle={toggleWidget}
      />
    </div>
  );
}
```

### Configuration

```env
# Redis Configuration (required for distributed sessions)
REDIS_URL=redis://redis-service:6379

# Session Management Settings
SESSION_DEFAULT_TTL_SECONDS=86400  # 24 hours
SESSION_CLEANUP_INTERVAL_MINUTES=60

# Graceful fallbacks
SESSION_FALLBACK_TO_MEMORY=true
```

### Distributed Features

#### Horizontal Pod Scaling
- **Zero Session Loss**: Sessions persist across pod failures and deployments
- **Redis Clustering**: Supports Redis Cluster and Sentinel for high availability
- **Automatic Failover**: Sessions remain accessible during pod restarts

#### Performance Characteristics
- **Sub-Millisecond Reads**: Redis-based retrieval for active sessions
- **Background Sync**: Automatic session updates without blocking UI
- **Scalability**: Supports 100,000+ concurrent sessions
- **TTL Management**: Automatic cleanup of expired sessions

#### Multi-Region Deployment
- **Session Affinity**: Optional sticky sessions for regional deployments
- **Data Synchronization**: Optional cross-region session replication
- **Global Consistency**: Configurable consistency levels for distributed deployments

### Security Considerations

```typescript
// Server-side validation before session operations
const sessionId = validateSessionId(request.query.sessionId);
if (!sessionId) {
  return NextResponse.json({ error: 'Invalid session ID' }, { status: 400 });
}

// Rate limiting on session operations
// (Implemented automatically via existing rate limiting)

// Secure session ID generation
// Uses cryptographically secure random bytes
generateSessionId(): string {
  const timestamp = Date.now().toString(36);
  const random = window.crypto.getRandomValues(new Uint8Array(8));
  const hex = Array.from(random).map(b => b.toString(16).padStart(2, '0')).join('');
  return `${timestamp}-${hex}`;
}
```

### Monitoring & Observability

#### Session Metrics
```typescript
// Track session lifecycle
metrics.increment('sessions.created');
metrics.increment('sessions.updated');
metrics.increment('sessions.deleted');
metrics.gauge('active.sessions', sessionManager.getActiveSessionsCount());
```

#### Health Checks
```yaml
# Session health endpoint
readinessProbe:
  httpGet:
    path: /api/sessions/check
    port: 3000
  initialDelaySeconds: 5
  periodSeconds: 10
```

### Migration & Rollout

#### Zero-Downtime Deployment

```bash
# Deploy new version with session support
kubectl apply -f hyperpage-deployment-v2.yaml

# Enable Redis for existing pods
kubectl set env deployment/hyperpage REDIS_URL=redis://redis-service:6379

# Rolling restart enables session functionality
kubectl rollout restart deployment/hyperpage

# Verify session continuity
kubectl logs -f deployment/hyperpage | grep "Session Manager Redis connection"
```

#### Testing Session Continuity

```bash
# Test session persistence during scaling
curl -v "http://localhost:3000/api/sessions?sessionId=test-session"
kubectl scale deployment hyperpage --replicas=1  # Scale down
kubectl scale deployment hyperpage --replicas=5  # Scale up
# Session should still be accessible
curl -v "http://localhost:3000/api/sessions?sessionId=test-session"
```

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
