# Registry-Driven Tool Integration System

This directory contains the **100% registry-driven tool integration system** for Hyperpage. Tools own their complete integration including API handlers and **capability declarations**, eliminating any manual routing or hardcoded logic.

## How It Works

- **Tool Ownership**: Each tool declares everything it needs (widgets, APIs, handlers, config, capabilities)
- **Registry-Driven**: All tool interactions flow through the centralized registry
- **Capability-Based**: Tools declare capabilities, aggregators discover and compose dynamically
- **Type-Safe**: Comprehensive TypeScript interfaces eliminate all `any` types
- **Zero Hardcoded Logic**: No tool name checks, switch cases, or manual mapping anywhere
- **Automatic Integration**: Adding tools automatically provides UI widgets, API endpoints, and status

## TypeScript Type System 🔷

The system implements a **comprehensive TypeScript type system** with zero `any` types, ensuring complete type safety across all tool integrations.

### **Distributed Type Ownership**

Each tool now owns its own TypeScript interfaces in dedicated `types.ts` files:

#### **Tool-Specific Type Files**
- **`tools/github/types.ts`**: GitHub API response interfaces
- **`tools/gitlab/types.ts`**: GitLab API response interfaces
- **`tools/jira/types.ts`**: Jira API response interfaces
- **`tools/tool-types.ts`**: Generic interfaces shared across tools

#### **Generic Interfaces (tools/tool-types.ts)**
```typescript
// Unified cross-tool types
interface TransformedIssue {
  ticket: string;
  id?: string; // Optional display ID for DataTable (added by ticketing aggregator)
  url: string;
  title: string;
  status: string;
  assignee: string;
  tool?: string; // Optional source tool name (added by ticketing aggregator)
  created: string;
  created_display: string;
  type: string;
}

interface ToolData {
  [key: string]: React.ReactNode | string | number | null | undefined;
}

interface ToolWidget {
  title: string;
  type: 'metric' | 'chart' | 'table' | 'feed';
  data: ToolData[];
  headers?: string[];
  component?: React.ComponentType<ToolWidget>;
  dynamic?: boolean;
  refreshInterval?: number;
  displayName?: string;
}

// Tool registry and configuration types
interface ToolConfig {
  apiUrl?: string;
  webUrl?: string;
  headers?: Record<string, string>;
  formatApiUrl?: (webUrl: string) => string;
  getWebUrl?: () => string;
  [key: string]: unknown;
}
```

#### **Handler Type Safety**
```typescript
interface ToolApiHandler {
  (request: Request, config: ToolConfig): Promise<Record<string, unknown>>;
}

interface ToolConfig {
  apiUrl?: string;
  webUrl?: string;
  headers?: Record<string, string>;
  formatApiUrl?: (webUrl: string) => string;
  getWebUrl?: () => string;
  [key: string]: unknown; // Extensible for tool-specific config
}
```

### **Type Safety Benefits**

- ✅ **Zero `any` Types**: All 35 ESLint `any` type violations eliminated
- ✅ **No Linting Warnings**: All ESLint warnings resolved (9 warnings fixed across codebase)
- ✅ **Build Success**: Production builds complete without errors
- ✅ **Compile-Time Safety**: TypeScript catches API response errors before runtime
- ✅ **API Contract Enforcement**: Handler functions must return properly typed responses
- ✅ **IntelliSense Support**: Full autocomplete for API response properties
- ✅ **Refactoring Confidence**: Type system prevents breaking changes
- ✅ **Documentation**: Types serve as living API documentation

### **Type Enforcement in Tools**

Each tool now imports and uses proper interface types:

```typescript
// Example: GitLab Tool Implementation
import { GitLabMergeRequest, GitLabProject, GitLabPipeline } from '../tool-types';

handlers: {
  'merge-requests': async (request: Request, config: ToolConfig) => {
    const response = await fetch(config.apiUrl + '/merge_requests');
    const data: GitLabMergeRequest[] = await response.json(); // ← Type-safe

    const transformedMRs = data.map((mr: GitLabMergeRequest) => ({ // ← Type-safe
      id: `!${mr.iid}`,
      title: mr.title, // IntelliSense shows available properties
      project: `${mr.project_id}`,
      status: mr.state, // TypeScript validates correct property usage
      author: mr.author?.name || 'Unknown',
      created: new Date(mr.created_at).toLocaleDateString(),
      url: mr.web_url
    }));

    return { mergeRequests: transformedMRs }; // ← Type-safe return
  }
}
```

### **Type-Safe Tool Addition**

When adding new tools, TypeScript ensures proper type contracts:

```typescript
export const myNewTool: Tool = {
  handlers: {
    'data': async (request: Request, config: ToolConfig): Promise<Record<string, unknown>> => {
      // TypeScript enforces handler return type
      return { items: [] }; // ✅ Must return Record<string, unknown>
      // return "invalid"; // ❌ TypeScript error: not a Record
    }
  },

  // Api responses now typed with dataKey structure
  apis: {
    'data': {
      response: {
        dataKey: 'items', // Components know to access result.items
        description: 'Type-safe data array'
      }
    }
  }
};
```

## Current Tools

### Individual Tools (Platform-Specific)
- **github/**: GitHub repositories, workflows, and data integration (GitHub icon)
- **jira/**: Jira backend integration and project management API (Kanban icon)
- **gitlab/**: GitLab merge requests and pipeline integration (GitLab icon)

### Aggregation Tools (Unified View Across Platforms)
- **code-reviews/**: Code review and pull request management (Git Branch icon) - *Combines PRs/MRs from GitHub + GitLab*
- **ci-cd/**: Unified CI/CD pipelines and workflows (Play icon) - *Combines pipelines from GitLab + GitHub Actions*
- **ticketing/**: Unified ticketing and issue management (Ticket icon) - *Combines issues from Jira, GitHub, and GitLab*

### Aggregated Tool UI Display
Aggregation tools automatically display small icons of the contributing tools instead of text labels in their widget cards. This provides immediate visual indication of which platforms are being aggregated:

- **Code Reviews** card shows GitHub + GitLab icons
- **CI/CD** card shows GitHub + GitLab icons
- **Ticketing** card shows Jira + GitHub + GitLab icons
- Icons are automatically sized and styled to match the dashboard theme
- Tooltips explain that data is aggregated from multiple sources

## Server-Side Tool Loading 🔧

**Server-Side Loading**: All tools are loaded on the server side and self-enable based on environment variables. This approach provides:

- **Performance**: Objects are created once on module load
- **Reliability**: No race conditions or async loading issues
- **Simplicity**: Each tool manages its own enabled state
- **Security**: Server-side loading prevents client-side issues

**Environment Variables**:
```env
ENABLE_GITHUB=true       # GitHub tool enabled
ENABLE_JIRA=false        # Jira tool disabled (still created but inactive)
ENABLE_GITLAB=true       # GitLab tool enabled
ENABLE_CODE_REVIEWS=true # Code Reviews tool enabled

# Additional Configuration (Web URLs - API URLs auto-derived from web URLs)
JIRA_WEB_URL=https://your-domain.atlassian.net      # Web URL - API URL automatically derived as `${webUrl}/rest/api/3`
GITLAB_WEB_URL=https://gitlab.com                  # Web URL - API URL automatically derived as `${webUrl}/api/v4`
```

**How It Works**: All tools are imported statically on server startup. Each tool checks `process.env.ENABLE_* === 'true'` for its `enabled` property. Disabled tools exist as objects but don't register in the active UI or API routing.

## Capability-Based Architecture 🏗️

The system uses a **capability-based architecture** where tools declare what capabilities they provide, enabling dynamic discovery and interaction without hardcoded logic.

### **How Capabilities Work**
- **Declaration**: Each tool declares `capabilities: string[]` listing what it can do
- **Dynamic Discovery**: Aggregator tools query the registry for tools with specific capabilities
- **Extensible**: New tools automatically work by declaring capabilities
- **Zero Hardcoded Logic**: No tool name checks anywhere in the codebase

### **Current Tool Capabilities**

#### **Individual Platform Tools**
```typescript
// GitHub Tool Capabilities
capabilities: ['pull-requests', 'workflows', 'activity', 'issues']
// - pull-requests: Can fetch GitHub PRs
// - workflows: Can fetch GitHub Actions workflows
// - activity: Can fetch GitHub activity events
// - issues: Can fetch GitHub issues for ticketing unification

// GitLab Tool Capabilities
capabilities: ['merge-requests', 'pipelines', 'activity', 'issues']
// - merge-requests: Can fetch GitLab MRs
// - pipelines: Can fetch GitLab CI pipelines
// - activity: Can fetch GitLab activity events with enhanced URL construction
// - issues: Can fetch GitLab issues for ticketing unification

// GitLab Activity Handler Features:
// - Handles multiple event types: opened, closed, updated, approved, merged
// - Supports both WorkItem (issues) and MergeRequest event target types
// - Automatically constructs clickable URLs when GitLab API doesn't provide them
// - Fetches project details from GitLab API to resolve project_path for URL construction
// - Provides displayIds with ! prefix for MRs (# prefix for issues)

// Jira Tool Capabilities
capabilities: ['issues'] // Can fetch Jira issues
```

#### **Aggregator Tools (Query Capabilities)**
- **Code Reviews**: Queries `pull-requests` + `merge-requests` → Combines GitHub PRs + GitLab MRs
- **CI/CD**: Queries `pipelines` + `workflows` → Combines GitLab pipelines + GitHub Actions
- **Ticketing**: Queries `issues` → Combines Jira issues

### **Capability Discovery API**
```typescript
import { getEnabledToolsByCapability, getToolsByCapability } from './tools';

// Find all enabled tools that support pull requests
const prTools = getEnabledToolsByCapability('pull-requests'); // [githubTool]

// Find all enabled tools that support merging
const mrTools = getEnabledToolsByCapability('merge-requests'); // [gitlabTool]

// Find all enabled tools that provide CI/CD pipelines
const ciTools = getEnabledToolsByCapability('pipelines'); // [gitlabTool]
const workflowTools = getEnabledToolsByCapability('workflows'); // [githubTool]
```

### **Extensibility Example**
Adding a new Git platform like **Bitbucket**:
1. Create tool with `capabilities: ['pull-requests', 'pipelines']`
2. Code Reviews tool automatically discovers and uses it 🎉
3. CI/CD tool automatically discovers and uses it 🎉
4. Zero code changes needed in aggregator tools

### **Benefits**
- ✅ **Future-Proof**: New Git tools, CI/CD providers work automatically
- ✅ **Registry-Driven**: No hardcoded tool names or logic anywhere
- ✅ **Composable**: Tools compose dynamically based on capabilities
- ✅ **Maintainable**: Adding capabilities requires no changes to existing logic

## The Tool Addition Process (3 Steps Only!)

### 1. Create Tool Definition with Self-Registration

Create `tools/yourtool/index.ts`:

```typescript
import React from 'react';
import { NewToolIcon } from 'lucide-react';
import { Tool, ToolConfig } from '../tool-types';
import { registerTool } from '../registry';

export const yourTool: Tool = {
  name: 'YourTool',
  slug: 'your-tool',
  enabled: process.env.ENABLE_YOURTOOL === 'true',

  // Tool declares its own UI appearance
  ui: {
    color: 'bg-blue-500/10 border-blue-400/30 text-blue-400',
    icon: React.createElement(NewToolIcon, { className: 'w-5 h-5' })
  },

  // Declare capabilities this tool provides
  capabilities: ['your-data'], // ← Registry-driven capability declaration

  // Define widget appearance with auto-refresh interval
  widgets: [{
    title: 'Your Data',
    type: 'table',
    headers: ['Column 1', 'Column 2'],
    dynamic: true, // Enable API data loading
    refreshInterval: 300000, // Auto-refresh every 5 minutes (optional)
    data: [] // Will be filled by API handler

  // Declare API endpoints and response structure
  apis: {
    'data': {
      method: 'GET',
      description: 'Get your data',
      response: {
        dataKey: 'items', // ← Component knows to access data.items
        description: 'Array of data items'
      }
    }
  },

  // IMPORTANT: Tool owns its API handler - no external switch cases!
  handlers: {
    'data': async (request: Request, config: ToolConfig) => {
      const response = await fetch(`${config.apiUrl}/data`, {
        headers: config.headers
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      return { items: data }; // Handler controls response format
    }
  },

  config: {
    formatApiUrl: (webUrl: string) => process.env.YOURTOOL_FORMAT_API ?
      process.env.YOURTOOL_FORMAT_API.replace('{webUrl}', webUrl) : `${webUrl}/api/v1`, // Tool-owned URL formatting
    getWebUrl: () => process.env.YOURTOOL_WEB_URL || 'https://yourtool.com',
    headers: {
      // Headers will be set dynamically in handlers
    }
  }
};

registerTool('yourtool', yourTool); // Self-register in registry
export default yourTool;
```

### 2. Add Import Line to Registry

One line in `tools/index.ts`:
```typescript
// Dynamic imports of all tool modules - tools register themselves
import './github';      // registers itself as 'github'
import './jira';        // registers itself as 'jira'
import './yourtool';    // ← Only this import line to add!
```

### 3. Configure Environment

```env
ENABLE_YOURTOOL=true
YOURTOOL_WEB_URL=https://yourtool.com     # Web URL - API URL auto-derived via tool's formatApiUrl function
YOURTOOL_TOKEN=your_api_token
```

**URL Consolidation**: Tools now declare their URL formatting rules and API URLs are derived from web URLs:
- Each tool defines `formatApiUrl: (webUrl) => string` in its config
- The system automatically derives API URLs (e.g., `${webUrl}/api/v1`)
- Only web URLs need to be configured - API URLs are computed automatically

## 🎯 **That's It! Zero Other Changes Needed!**

After these 3 steps, your tool automatically gets:
- ✅ **UI Widget** appears on dashboard
- ✅ **API Endpoint** at `/api/tools/yourtool/data`
- ✅ **Sidebar Status** shows live connectivity
- ✅ **Discovery APIs** expose capabilities

## Tool Component Architecture

Each tool defines:

### **slug** - URL-Safe Identifier
```typescript
slug: string; // URL-safe identifier (e.g., 'ci-cd', 'github', 'jira')
```
- **Purpose**: Provides a URL-safe identifier separate from display names
- **Usage**: Used for API URL construction (e.g., `/api/tools/ci-cd/pipelines`)
- **Benefits**: Allows display names to contain special characters while ensuring valid URLs
- **Example**: Tool with `name: 'CI/CD'` has `slug: 'ci-cd'`

### **apis** - Endpoint Specifications
```typescript
apis: {
  'endpoint': {
    method: 'GET' | 'POST',
    description: 'What it does',
    response: { dataKey: 'arrayName' } // Components know how to access data
  }
}
```

### **handlers** - API Implementation
```typescript
handlers: {
  'endpoint': async (request, config) => {
    const response = await fetch(`${config.apiUrl}/endpoint`);
    return { arrayName: await response.json() }; // Controls response format
  }
}
```

### **widgets** - UI Configuration
```typescript
widgets: [{
  title: 'Display Name',
  type: 'table' | 'chart' | 'metric' | 'feed',
  headers: ['Column Names'],
  dynamic: true // Enables API data loading
}]
```

### **activity API** - Real-time Activity Feeds
Each tool can now provide an `activity` endpoint that contributes events to the dashboard's live activity feed:

```typescript
apis: {
  'activity': {
    method: 'GET',
    description: 'Get recent activity events from this tool',
    response: {
      dataKey: 'activity',
      description: 'Array of activity events with standardized format'
    }
  }
}
```

**Activity Event Standard Format:**
```typescript
{
  id: string,           // Unique identifier for the event
  tool: string,         // Tool name (e.g., 'GitHub', 'Jira')
  toolIcon: string,     // Emoji icon for the tool
  action: string,       // Action performed (e.g., 'Code pushed', 'Issue opened')
  description: string,  // Detailed description of the event
  author: string,       // Person who performed the action
  time: string,         // Human-readable time ago
  color: string,        // Theme color ('purple', 'green', 'orange', etc.)
  timestamp: string,    // ISO timestamp for sorting
  url?: string,         // Optional clickable URL for navigation
  displayId?: string,   // Optional display-friendly ID (e.g., '#123', '!456')
  repository?: string,  // Optional repository/project context
  branch?: string,      // Optional branch name for code events
  commitCount?: number, // Optional commit count for push events
  status?: string,      // Optional status for issue/PR states
  assignee?: string,    // Optional assignee information
  labels?: string[]     // Optional label/tag information
}
```

**Enhanced GitLab Activity Processing:**
- **URL Construction**: GitLab activity handler automatically constructs clickable URLs when GitLab events API doesn't provide them
- **Project Details Fetching**: Handler fetches project information using `project_id` when `project_path` is undefined
- **Event Type Support**: Handles `WorkItem` (issues), `MergeRequest`, and other GitLab event types
- **Display ID Generation**: Creates `#` prefix for issues and `!` prefix for merge requests
- **Fallback Patterns**: Uses GitLab web URL patterns (`{webUrl}/{project_path}/-/issues/{iid}` or `/-/merge_requests/{iid}`)

**Consolidated Activity Feed:**
- Dashboard aggregates activity from all enabled tools via `/api/tools/activity` endpoint
- Events are sorted by timestamp (most recent first)
- Limit of 50 most recent events shown to prevent overwhelming the UI
- **Overview widgets automatically sort data by time (most recent first)**: The dashboard overview tab applies time-based sorting to all widget data using common timestamp field detection (`updated_at`, `created_at`, `updated`, `created`, `timestamp`)
- Activity data flows through the Livefeed component instead of static mock data
- Loading states, error handling, and empty state messages implemented
- Errors from individual tools don't break the consolidated feed
- Tool-specific color coding maintains visual consistency

**Livefeed Component Changes:**
- Removed hardcoded mock activity data
- Integrated with real-time activity API
- Added skeleton loading UI during data fetch
- Implemented proper error boundaries and user-friendly messages
- Displays author information for each activity
- Maintains responsive design with tool-specific theming

## Example: Adding Slack Tool

**Step 1: Create `tools/slack/index.ts`:**
```typescript
import { Tool, ToolConfig } from '../tool-types';
import { registerTool } from '../registry';

export const slackTool: Tool = {
  name: 'Slack',
  slug: 'slack',
  enabled: process.env.ENABLE_SLACK === 'true',
  widgets: [{
    title: 'Recent Messages',
    type: 'table',
    headers: ['Channel', 'Message', 'Time'],
    dynamic: true,
    data: []
  }],
  apis: {
    'messages': {
      method: 'GET',
      description: 'Get recent messages',
      response: {
        dataKey: 'messages',
        description: 'Recent Slack messages'
      }
    }
  },
  handlers: {
    'messages': async (request: Request, config: ToolConfig) => {
      const response = await fetch(`${config.apiUrl}/conversations.history`, {
        headers: config.headers
      });

      const data = await response.json();
      return {
        messages: data.messages.map(msg => ({
          channel: '#general',
          message: msg.text,
          time: new Date(msg.ts * 1000).toLocaleString()
        }))
      };
    }
  },
  config: {
    apiUrl: 'https://slack.com/api',
    headers: {
      'Authorization': `Bearer ${process.env.SLACK_BOT_TOKEN}`
    }
  }
};

registerTool('slack', slackTool); // Self-register in registry
export default slackTool;
```

**Step 2: Add import line in `tools/index.ts`:**
```typescript
// Dynamic imports of all tool modules - tools register themselves
import './github';      // registers itself as 'github'
import './jira';        // registers itself as 'jira'
import './slack';       // ← Only this import line to add!
```

**Step 3: Set environment:**
```env
ENABLE_SLACK=true
SLACK_BOT_TOKEN=xoxb-your-slack-token
```

**🎉 Result**: Slack tool works instantly with full API routing, UI widgets, and status management!

## UI Properties System 🎨

The dashboard uses a **100% registry-driven UI properties system** where each tool declares its own appearance properties (icons and colors). This eliminates hardcoded mappings while ensuring consistent visual identity across the platform.

### **How It Works**

- **Tool Ownership**: Each tool declares its `ui` property containing color and icon
- **Registry-Driven**: UI properties are stored in the tool registry, not centralized maps
- **Automatic Consistency**: All tool UI properties are normalized and validated
- **Zero Hardcoded Logic**: No centralized `toolColorMap` or `toolIconMap` anywhere

### **Current Tool UI Properties**

| Tool | Color (Tailwind Classes) | Icon (Component) |
|------|------------|-------------|
| **GitHub** | `bg-purple-500/10 border-purple-400/30 text-purple-400` | GitHub (brand icon) |
| **Jira** | `bg-green-500/10 border-green-400/30 text-green-400` | Kanban |
| **GitLab** | `bg-orange-500/10 border-orange-400/30 text-orange-400` | GitLab (brand icon) |
| **Code Reviews** | `bg-indigo-500/10 border-indigo-400/30 text-indigo-400` | GitBranch |
| **CI/CD** | `bg-emerald-500/10 border-emerald-400/30 text-emerald-400` | Play |
| **Ticketing** | `bg-blue-500/10 border-blue-400/30 text-blue-400` | Ticket |

### **How UI Property Declaration Works**

Each tool now declares its appearance directly in its definition:

```typescript
// In tools/github/index.ts
import React from 'react';
import { Github } from 'lucide-react';

export const githubTool: Tool = {
  name: 'GitHub',
  slug: 'github',
  enabled: process.env.ENABLE_GITHUB === 'true',

  // Tool declares its own UI properties
  ui: {
    color: 'bg-purple-500/10 border-purple-400/30 text-purple-400',
    icon: React.createElement(Github, { className: 'w-5 h-5' })
  },

  // ... rest of tool definition
};
```

### **Registry-Driven UI Function**

UI properties are retrieved through registry functions in `tools/ui-props.ts`:

```typescript
import { toolRegistry } from './registry';

// Helper function to normalize tool name for registry lookup
const normalizeToolName = (name: string): string => {
  return name
    .toLowerCase()
    .replace(/%20/g, ' ') // Decode URL-encoded spaces
    .replace(/[\s]+/g, '-') // Convert spaces to hyphens (consistent with registration)
    .replace(/[^a-z0-9-]/g, ''); // Remove invalid characters
};

// Helper functions use same normalization as getToolByName
export const getToolIcon = (name: string): React.ReactNode => {
  const normalizedName = normalizeToolName(name);
  const tool = toolRegistry[normalizedName];
  return tool?.ui?.icon || React.createElement('span', { className: 'text-lg' }, '🔧');
};

export const getToolColor = (toolName: string): string => {
  const normalizedName = normalizeToolName(toolName);
  const tool = toolRegistry[normalizedName];
  return tool?.ui?.color || 'bg-gray-500/10 border-gray-400/30 text-gray-400';
};
```

### **Adding UI Properties for New Tools**

When adding a new tool, include the UI properties directly in the tool definition:

```typescript
export const yourNewTool: Tool = {
  name: 'YourNewTool',
  slug: 'your-new-tool',
  enabled: process.env.ENABLE_YOURNEWTOOL === 'true',

  // Define UI appearance for your tool
  ui: {
    color: 'bg-blue-500/10 border-blue-400/30 text-blue-400', // Your brand color
    icon: React.createElement(NewToolIcon, { className: 'w-5 h-5' })
  },

  // ... rest of tool definition
};
```

### **UI Property Selection Guidelines**

#### **Color Selection**
- **Brand Colors**: Use tool-specific colors when available (GitHub purple, GitLab orange)
- **Semantic Colors**: Choose meaning-appropriate colors:
  - Development: Blue, Indigo, Purple
  - Management: Green, Emerald
  - Communication: Cyan, Sky
  - Analytics: Orange, Yellow
- **Format**: Always use Tailwind RGBA format: `bg-color-500/10 border-color-400/30 text-color-400`

#### **Icon Selection**
- **Brand Tools**: Use brand-specific icons (GitHub, GitLab, Jira, Slack)
- **Generic Tools**: Use semantic icons:
  - **Git operations**: GitBranch, GitCommit
  - **CI/CD**: Play, Zap, Cog, Settings
  - **Tasks**: CheckSquare, List, Kanban
  - **Analytics**: BarChart3, TrendingUp, PieChart
- **Components**: Import from Lucide React and use `React.createElement(IconName, { className: 'w-5 h-5' })`

#### **Fallback Behavior**
- **Unknown Tools**: System provides gray color and wrench icon (`🔧`)
- **Missing UI**: Graceful degradation with appropriate defaults
- **Icon Loading**: Automatic fallback if icon component fails to render

### **Benefits of Registry-Driven UI**

- ✅ **Completely Registry-Driven**: No hardcoded mappings anywhere in the codebase
- ✅ **Tool Ownership**: Each tool controls its visual identity
- ✅ **Automatic Scaling**: UI properties expand with new tools
- ✅ **Type Safe**: UI properties are enforced by TypeScript interfaces
- ✅ **Consistent Normalization**: All name resolution uses same normalization logic
- ✅ **Zero Manual Maintenance**: Adding tools = automatic UI integration

## Tool Name Normalization 🔧

The system automatically normalizes tool names to handle various formats and ensure consistent API routing:

### **Normalization Rules**
- **Lowercase Conversion**: Tool names are case-insensitive (`CodeReviews` → `codereviews`)
- **Space Handling**: Spaces are converted to hyphens (`code reviews` → `code-reviews`)
- **URL Decoding**: URL-encoded characters are properly decoded (`%20` → ` ` then to `-`)
- **Invalid Character Removal**: Only alphanumeric, hyphens, underscores, and spaces allowed

### **Examples**
```javascript
// All of these resolve to the same tool:
"code-reviews"     // Registry key (direct match)
"Code Reviews"     // Display name with space (normalized)
"code%20reviews"   // URL-encoded from browser (decoded first)
"CODE_REVIEWS"     // Uppercase (converted to lowercase)
```

### **Implementation**
The normalization happens in the `getToolByName()` function in `tools/index.ts`:

```typescript
export const getToolByName = (name: string): Tool | undefined => {
  const normalizedName = name
    .toLowerCase()
    .replace(/%20/g, ' ') // Decode URL-encoded spaces
    .replace(/[\s]+/g, '-') // Convert spaces to hyphens
    .replace(/[^a-z0-9-]/g, ''); // Remove invalid characters

  return toolRegistry[normalizedName];
};
```

### **Input Validation**
API endpoints validate tool names according to the pattern: `^[a-zA-Z0-9_%\-\s]+$` allowing:
- Alphanumeric characters
- Percent signs, hyphens, underscores, and spaces
- URL-encoded characters (decoded by normalization)

**Benefits**:
- ✅ **User-Friendly URLs**: Tool names with spaces work in browsers
- ✅ **Consistent Routing**: All name variations resolve to same tool
- ✅ **Backward Compatible**: Existing tool registrations unchanged
- ✅ **Security Maintained**: Input validation prevents injection attacks

## Security Architecture

The tool integration system implements comprehensive security measures to protect sensitive credentials:

### **Client-Server Isolation**
The system enforces strict separation between client-side UI data and server-side credentials:

#### **Client-Safe Tool Objects**
```typescript
// Client components receive sanitized data only - NO SENSITIVE INFO
interface ClientTools extends Omit<Tool, 'handlers' | 'config'> {
  name: string;
  enabled: boolean;
  widgets: ToolWidget[];
  apis: Record<string, ToolApi>;
}

// Server maintains complete secure tool definitions
interface ServerTools extends Tool {
  config: ToolConfig; // ← Contains API tokens, never exposed to client
  handlers: Record<string, ToolApiHandler>; // ← Server-only API implementation
}
```

#### **Security Implementation**
```typescript
import { getEnabledClientTools } from './tools';

// ✅ SECURE: Client gets safe data only
const tools = getEnabledClientTools(); // No config, no handlers

// ❌ NEVER DO: Exposing credentials to client
const unsafeTools = getAllTools(); // Contains sensitive config!
```

#### **Registry Security Functions**
- **`getEnabledClientTools()`**: Returns tool metadata for UI components (safe)
- **`getAllTools()`**: Returns complete tool definitions (server-only use)
- **`getToolByName()`**: Direct access to tool (use carefully, server-side only)

### **API Security Features**
- **Input Validation**: Tool names validated with pattern `^[a-zA-Z0-9_%\-\s]+$` (allowing spaces, hyphens, underscores, and URL-encoded characters which are normalized server-side)
- **Endpoint Validation**: Endpoint names validated with pattern `^[a-zA-Z0-9_%-]+$_` (allowing hyphens, underscores, and URL-encoded characters)
- **Error Leakage Protection**: Generic error messages, detailed logging server-only
- **Authentication Isolation**: API tokens only processed server-side in handlers
- **Directory Traversal Prevention**: Parameter validation blocks malicious paths

### **Adding Tools Securely**

**Step 1: Define tool with secure server-side config:**
```typescript
export const myTool: Tool = {
  capabilities: ['my-data'], // ← Registry-driven capability declaration
  widgets: [...],  // ← Client-safe UI data
  config: {        // ← SERVER-SIDE ONLY - Never exposed to browser
    apiUrl: process.env.SECURE_API_URL,
    headers: {
      'Authorization': `Bearer ${process.env.SECURE_TOKEN}`
    }
  },
  handlers: {...}  // ← SERVER-SIDE ONLY - API implementation
};
```

**Step 2: Client components automatically get safe data:**
```typescript
// ✅ SECURE - Only gets UI-safe properties
const clientTools = getEnabledClientTools();
// Result: { name, enabled, widgets, apis } only - no config, no handlers
```

## Client/Server Architecture

The system properly separates client-side and server-side tool functionality:

### **When Adding a New Tool**
```typescript
// 1. Define complete tool (server-only file)
export const myTool: Tool = {
  widgets: [...],      // ← Client-safe UI data
  config: {...},       // ← SENSITIVE: Server-only credentials
  handlers: {...},     // ← SENSITIVE: Server-only API logic
};

// 2. Client components get sanitized data
const clientTools = getEnabledClientTools(); // No config, no handlers, no credentials
```

## Best Practices

- **Handler Ownership**: Keep all API logic within the tool's handler
- **Response Consistency**: Use declared `dataKey` for predictable data structure
- **Error Handling**: Handlers should throw errors for registry to catch
- **Client/Server Separation**: Use `getEnabledClientTools()` for UI components
- **TypeScript**: Define interfaces for your tool's data structures
- **Environment**: Always validate required environment variables

## Migration Notes

The new system **completely eliminates**:
- ❌ Manual API router switch cases
- ❌ Hardcoded tool name checks in components
- ❌ Disconnected API route files per tool
- ❌ Manual tool registration processes

**Everything is now registry-driven and self-contained per tool!**
