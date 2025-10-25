# System Architecture

This document describes the core architecture of Hyperpage, including the registry-driven tool integration system, component patterns, and development principles.

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

#### Zero Hardcoded Logic
- **No Switch Cases**: All tool routing uses registry lookup
- **No Manual Mapping**: Tools self-register capabilities
- **Automatic Discovery**: Aggregators find compatible tools dynamically
- **Self-Contained**: Each tool knows how to integrate

### Capability-Based Integration

Tools declare capabilities for automatic discovery by aggregator services:

```typescript
interface ToolCapability {
  'pull-requests': 'GitHub PRs, GitLab MRs';
  'merge-requests': 'GitLab merge requests';
  'workflows': 'GitHub Actions workflows';
  'pipelines': 'GitLab CI/CD pipelines';
  'activity': 'Activity feed events';
  'issues': 'Ticketing and issue management';
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
- **`useActivities`**: React Query-powered activity feed with 15s auto-polling and caching
- **`useToolQueries`**: Dynamic query management for tool widgets with selective refresh intervals
- **`useDarkMode`**: Theme switching with localStorage persistence

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

#### ToolApiService
Centralized API operations with proper error boundaries:
- **Type Safety**: Full TypeScript support for all API responses
- **Error Handling**: Graceful degradation with user-friendly messages
- **Isolation**: Each tool's API calls are scoped and sandboxed

### Performance Optimizations

#### React.memo Usage
Frequently re-rendering components are optimized:
- **ActivityItem**: Memoized to prevent unnecessary re-renders
- **DashboardSearchResults**: Cached for expensive search operations
- **MetricCard**: Optimized for real-time KPI updates

#### Smart Loading Strategies
- **Background Refresh**: Data updates without visual disruption
- **Virtual Scrolling**: Large data tables use efficient rendering
- **Request Deduplication**: Identical API calls are batched and cached
- **Lazy Loading**: Non-critical components load on demand

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

### Recent Improvements

Following component optimization and daisyUI integration:

| Component | Implementation | Technologies | Architecture Change |
|-----------|----------------|--------------|---------------------|
| `TopBar` | Custom component | DaisyUI + Tailwind CSS | Semantic HTML + component library |
| `DataTable` | Custom table component | DaisyUI + Tailwind CSS | Flexible data presentation |
| `Livefeed` | Rich content feed | DaisyUI + Tailwind CSS | Enhanced user experience |
| **All Components** | DaisyUI + custom | Tailwind CSS + component library | **Balanced framework approach** |

#### Key Refactoring Changes
- **Styling System**: Complete migration from OKLCH color palette to standard Tailwind gray-*, blue-*, etc.
- **Component Implementation**: Removed all variant systems, using direct HTML elements with utility classes
- **Bundle Size**: Eliminated shadcn/ui dependencies (clsx, class-variance-authority, tailwind-merge)
- **Theme Consistency**: Maintained exact visual design while removing framework abstractions

## Activity Feed Architecture

### Real-Time Data Aggregation

**Registry-Driven Activity Discovery:**
1. Tools with `activity` capability are discovered automatically
2. Activity endpoints are called in parallel
3. Results merged, sorted by timestamp, and filtered to recent items
4. Rich context information preserved from multiple sources

### Data Enrichment

Activity items include comprehensive metadata:
- **Repository/Project Context**: Shows where activity occurred
- **Branch Information**: Code-related activities show branch names
- **Commit Counts**: Push events display number of commits
- **Status Indicators**: Color-coded status badges (open/closed/merged)
- **Assignee Information**: Shows current assignees
- **Labels/Tags**: Applicable labels from issues/PRs
- **Navigation Links**: Direct links back to source platforms

### High-Performance Implementation

- **Limit of 50 Items**: Prevents UI overwhelm from excess data
- **Tab Visibility Refresh**: Automatically refreshes when user returns to tab
- **Background Loading**: Updates happen invisibly while preserving existing data
- **Graceful Degradation**: Individual tool failures don't break the entire feed

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

### Performance Benchmarks
- **Load Times**: Dashboard loads in under 3 seconds
- **Responsive Redesign**: Optimized for mobile to desktop experiences
- **Memory Efficiency**: Component unmounting prevents memory leaks
- **API Efficiency**: Request deduplication and intelligent caching


For implementation details and API specifications, see [`docs/api.md`](api.md).
