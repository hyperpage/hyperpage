# System Architecture

This document describes the core architecture of Hyperpage, including the registry-driven tool integration system, component patterns, and development principles.

## System Overview

```
                                   ┌─────────────────────────────────────┐
                   ┌──────────────► │ Hyperpage Portal (Web UI)         │
                   │               │ - Next.js 15 Application           │
                   │               │ - React Components + Tailwind     │
                   │               │ - User Dashboard & Management     │
                   │               └─────────────────────────────────────┘
                   │
┌──────────────────┴──────────────────┐
│                                     │
│      Kubernetes Cluster             │
│                                     │
├─────────────────┬───────────────────┤
│                 │                   │
│   Pod 1         │     Pod N         │ ◄── Horizontal Scaling (HPA 3-50)
│   • App Server  │     • App Server  │
│   • Session Mgr │     • Session Mgr │
│   • Coordinator │     • Coordinator │
├─────────────────┼───────────────────┤
│                 │                   │
│   Shared Redis  │   Coordinator     │ ◄── Auto Failover & Leader Election
│   ├─ Sessions   │   ├─ Job Balance  │
│   ├─ Caching    │   ├─ Cache Inval  │
│   └─ Pub/Sub    │   └─ Rate Sync    │
│                 │                   │
└─────────────────┴───────────────────┘
       ▲            ▲
       │            │
       ├────────────┼───────────────────────── External APIs
       ▼            ▼
Tool Registry    ┌───────────────────┐
• GitHub         │  GitHub API       │
• GitLab         │  ┌─────────────┐  │
• Jira          ─┼─►│ Rate Limits │  │
• CI/CD          │  └─────────────┘  │
                 └───────────────────┘
```

## Core Architecture Principles

### Registry-Driven Design

Hyperpage uses a **completely registry-driven architecture** where all tool integrations are discovered and configured automatically:

#### Tool Ownership Model
Each tool owns its complete integration:
- **API Handlers**: Server-side implementations
- **UI Components**: Widget definitions and appearance
- **Data Schemas**: Response structures and types
- **Capabilities**: What the tool can provide
- **Configuration**: Environment-based settings

#### Registry-Driven Architecture
- **Tool Registration**: Tools self-register with the central registry
- **Capability System**: Tools declare supported features automatically
- **Dynamic Discovery**: Aggregators find compatible tools by capability matching
- **Removal of Hardcoded Logic**: Switch cases converted to registry-based lookups where possible

### Capability-Based Integration

Tools declare capabilities for automatic discovery by aggregator services:

```typescript
interface ToolCapability {
  'pull-requests': 'GitHub PRs, GitLab MRs';
  'merge-requests': 'GitLab merge requests';
  'workflows': 'GitHub Actions workflows';
  'pipelines': 'GitLab CI/CD pipelines';
  'issues': 'Ticketing and issue management';
  'rate-limit': 'API rate limit monitoring';
}
```

**Aggregator Pattern:**
- **Code Reviews**: Discovers tools with `pull-requests` + `merge-requests` capabilities
- **CI/CD**: Combines `pipelines` + `workflows` from multiple providers
- **Ticketing**: Unifies `issues` across all configured tools

## Component Architecture

### Hook-First Pattern

All complex stateful logic is extracted into custom hooks before component implementation:

#### Data Management Hooks (React Query Integration)
- **`useToolQueries`**: Dynamic query management for tool widgets with selective refresh intervals
- **`useDarkMode`**: Theme switching with localStorage persistence
- **`useRateLimit`**: Rate limit monitoring across all enabled tools

#### React Query Benefits
**Automatic Caching & Background Updates:**
- Intelligent request deduplication reduces API calls
- Stale-while-revalidate pattern ensures fresh data with minimal loading states
- Background refetching keeps data current without visual disruption

**Built-in Error Handling & Retry Logic:**
- Configurable retry attempts (3 by default) with exponential backoff
- Automatic retry for network failures and intermittent issues
- Graceful error states without complex manual error handling

**Performance Optimizations:**
- Focus/window refetch automatically updates data when users return to the tab
- Request deduplication prevents multiple identical API calls
- Garbage collection prevents memory leaks from stale cached data

#### Component Responsibility
Components focus on presentation, with all business logic delegated to hooks:
- **Single Purpose**: Each component handles one clear responsibility
- **100-Line Limit**: Large components are decomposed into focused sub-components
- **Clean Separation**: UI logic in components, data logic in hooks

### Service Layer Architecture

#### ApiClient Pattern
Base HTTP client with consistent error handling:
```typescript
class ApiClient {
  async request(endpoint: string, options?: RequestOptions): Promise<ApiResponse> {
    // Consistent error handling, timeout management, retry logic
  }
}
```

#### ToolApiService & Rate Limiting Infrastructure
Centralized API operations with intelligent rate limiting:
- **Type Safety**: Full TypeScript support for all API responses
- **Rate Limiting Protection**: Platform-specific retry logic prevents API throttling
- **Registry-Driven Strategy**: Each tool defines its own rate limiting behavior
- **Exponential Backoff**: Smart retry timing (1s → 2s → 4s → max 60s cap)
- **Platform Awareness**: GitHub uses X-RateLimit headers, GitLab honors Retry-After, Jira uses 429 detection
- **Error Handling**: Graceful degradation with user-friendly messages
- **Isolation**: Each tool's API calls are scoped and sandboxed

### Performance Optimizations

#### React.memo Usage
Frequently re-rendering components are optimized:
- **PortalSearchResults**: Cached for expensive search operations

#### Loading Strategy
- **Background Refresh**: Data updates with minimal visual disruption
- **Request Deduplication**: API calls are cached to prevent redundancy

## Tool Integration System

### Tool Registry

Centralized registry manages all tool definitions:

```typescript
const toolRegistry: Record<string, Tool> = {};

export const registerTool = (slug: string, tool: Tool) => {
  toolRegistry[slug] = tool;
};
```

#### Self-Registration Pattern
Tools register themselves on module load:
```typescript
// tools/github/index.ts
export const githubTool: Tool = { /* complete definition */ };
registerTool('github', githubTool);

// tools/index.ts
import './github'; // Triggers self-registration
```

### Tool Definition Schema

```typescript
interface Tool {
  name: string;           // Display name
  slug: string;           // URL-safe identifier
  enabled: boolean;       // Environment-controlled
  capabilities: string[]; // Declared features

  ui: {                   // Visual properties
    color: string;        // Tailwind color classes
    icon: React.ReactNode; // Icon component
  };

  apis: Record<string, ApiSpec>;     // Endpoint specifications
  handlers: Record<string, Handler>;  // API implementations
  config: ToolConfig;                // Server-side settings
  widgets: ToolWidget[];             // UI definitions
}

export interface ToolWidget {
  title: string;
  type: "metric" | "chart" | "table" | "feed";
  data: ToolData[];
  headers?: string[];
  component?: React.ComponentType<ToolWidget>;
  dynamic?: boolean; // Indicates if widget data needs to be loaded dynamically
  refreshInterval?: number; // Auto-refresh interval in milliseconds
  displayName?: string; // Optional display name for widgets
  apiEndpoint?: string; // Specifies which API endpoint this widget consumes for data fetching
}
```

### URL Auto-Derivation

Tools declare URL formatting rules instead of hardcoded addresses:

```typescript
config: {
  formatApiUrl: (webUrl: string) => `${webUrl}/rest/api/3`, // Jira
  getWebUrl: () => process.env.JIRA_WEB_URL
}
```

**Benefits:**
- **Consistency**: Same pattern across all tools
- **Flexibility**: Supports custom domains and self-hosted instances
- **Maintenance**: Changes propagate automatically

## Security Architecture

### Server-Side Credential Isolation

**Complete client-server separation:**
```typescript
// ✅ Client receives safe data only
const clientTools = getEnabledClientTools();
// Result: { name, widgets, ui, capabilities }

// ❌ Server maintains sensitive data
const serverTools = toolRegistry;
// Contains: { handlers, config, tokens, credentials }
```

### Input Validation & Sanitization

All API parameters validated with strict regex:
```typescript
// Tool/endpoint validation prevents injection
const toolPattern = /^[a-zA-Z0-9_%\-\s]+$/;
const endpointPattern = /^[a-zA-Z0-9_%-]+$/;
```

### Error Handling Strategy

**Client-Side:** Generic error messages without sensitive information
```json
{ "error": "An error occurred while processing the request" }
```

**Server-Side:** Detailed logging for debugging
```
[ERROR] Failed to fetch Jira issues: Invalid credentials for user@domain.com
```

## Component Decomposition Strategy

### Size Limits & Separation
- **Component Limit**: 100 lines maximum per component
- **Responsibility Focus**: Single purpose per component
- **Interface Simplification**: Streamlined props interfaces

### Component Architecture

Components are built using shadcn/ui with Tailwind CSS for consistent styling and behavior.

| Component | Implementation | Technologies | Purpose |
|-----------|----------------|--------------|---------|
| `TopBar` | Custom component with shadcn/ui | shadcn/ui + Tailwind CSS | Navigation and tool controls |
| `DataTable` | shadcn/ui table component | shadcn/ui + Tailwind CSS | Data display and sorting |
| `Overview` | Dashboard layout | shadcn/ui + Tailwind CSS | Main portal interface |
| **All Components** | shadcn/ui framework | shadcn/ui + Tailwind CSS | Consistent design system |

## Rate Limit Monitoring System

### Unified Monitoring Architecture

Hyperpage implements **multi-platform rate limit monitoring** with unified API endpoints and intelligent UI feedback:

#### System Components
- **`lib/rate-limit-monitor.ts`**: Core monitoring logic with platform-specific transformations
- **`app/api/rate-limit/[platform]/route.ts`**: Platform-specific API endpoints with capability validation
- **`app/components/hooks/useRateLimit.ts`**: React hooks for rate limit state management
- **`app/components/ToolStatusRow.tsx`**: UI components with rich tooltips and status indicators
- **`lib/types/rate-limit.ts`**: Type-safe interfaces for universal rate limit data structures

#### Platform-Specific Implementations
Each tool integration defines rate limit monitoring through registered handlers:
```typescript
export const githubTool: Tool = {
  // ... basic configuration
  capabilities: ['rate-limit'], // Declares support

  apis: {
    'rate-limit': {
      method: 'GET',
      description: 'Monitor GitHub API rate limits',
      response: { dataKey: 'rateLimit' }
    }
  },

  handlers: {
    'rate-limit': async (request, config) => {
      const response = await fetch('https://api.github.com/rate_limit', {
        headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
      });
      return { rateLimit: await response.json() };
    }
  }
};
```

#### Data Transformation Pipeline
Raw platform responses are transformed to universal format:
```typescript
// GitHub: Multiple API limits (core, search, graphql)
transformGitHubLimits(data) → {
  github: {
    core: { limit, remaining, used, usagePercent, resetTime },
    search: { limit, remaining, used, usagePercent, resetTime },
    graphql: { limit, remaining, used, usagePercent, resetTime }
  }
}

// GitLab: Retry-after based (no explicit limit/remaining)
transformGitLabLimits(response, retryAfter) → {
  gitlab: {
    global: { resetTime: Date.now() + (retryAfter * 1000), retryAfter }
  }
}

// Jira: Instance-level limits (not exposed via API)
transformJiraLimits(data) → { jira: { global: { /* null values */ } } }
```

#### Intelligent Status Calculation
Overall health status derived from all platforms:
```typescript
calculateOverallStatus(limits) → 'normal' | 'warning' | 'critical' | 'unknown'
// normal: < 75% usage across all limits
// warning: 75-89% usage on any limit
// critical: 90%+ usage on any limit
```

#### UI Integration
Status displayed through visual indicators:
- **Badges**: Percentage usage (5%, 95%) with color-coded backgrounds
- **Icons**: Warning symbols for rates approaching limits
- **Tooltips**: Detailed platform-specific information on hover

#### Caching Strategy
- **5-minute TTL**: Balances fresh data with API rate limiting
- **Freshness Tracking**: UI indicates data age and freshness
- **Stale Data Handling**: Falls back to cached data after network failures

#### Benefits
- **Unified API**: Single endpoint per platform regardless of underlying API differences
- **Intelligent Caching**: Prevents excessive API calls while maintaining freshness
- **Rich UI Feedback**: Users understand API health without technical knowledge
- **Platform Awareness**: Optimized handling for different rate limit patterns
- **Error Resilience**: Graceful degradation when rate limit monitoring fails


Rate limit monitoring tracks API usage across all enabled platforms and displays status through the UI.

## Development Workflow

### PLAN → ACT Mode Transition

Following the team-developed workflow:
1. **PLAN Mode**: Discuss features, UI/UX decisions, architectural changes
2. **ACT Mode**: Implement components, code changes, testing
3. **Tool-First Tools**: Development workflow itself is tool-based

### Mode-Specific Guidelines

**PLAN Mode:**
- Architect solutions before implementation
- Gather requirements and explore approaches
- Document decision reasoning
- Create comprehensive checklists

**ACT Mode:**
- Implement following established patterns
- Use tool-first approach for state management
- Follow 100-line component size limits
- Maintain type safety and error boundaries

### Quality Standards

- **TypeScript Compliance**: Zero `any` types, strict type checking
- **ESLint Clean**: All warnings resolved, build succeeds
- **Component Size**: 100-line maximum with decomposition strategy
- **Performance**: Optimized rendering with React.memo where appropriate

## Testing & Quality Assurance

### Automated Quality Checks
- **TypeScript Compilation**: All interfaces properly defined
- **Build Success**: Production builds complete without errors
- **ESLint Compliance**: Clean code standards maintained
- **Import Organization**: Dependencies properly sorted and grouped

### Performance Considerations
- **Responsive Design**: Interface adapts from mobile to desktop
- **Memory Management**: Components clean up on unmount
- **API Optimization**: Request deduplication and caching


For implementation details and API specifications, see [`docs/api.md`](api.md).
