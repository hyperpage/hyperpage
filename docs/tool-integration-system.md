# Tool Integration System

This document describes how tools integrate with the Hyperpage platform and provides guidance for adding new tool integrations.

## Overview

The Hyperpage tool integration system is built on two core pillars:

- A **registry-driven architecture** for tools, widgets, and APIs.
- A **repository-first, dual-engine persistence layer** that all tools and platform features rely on.

All tool interactions are driven by registry configurations with zero hardcoded per-tool logic in application flows, and all persistence is routed through well-defined repository interfaces.

---

## Architecture

### Registry-Driven Design

All tool interactions are completely registry-driven. Each tool is defined as a registry entry that contains:

- **API Specifications**: Endpoint definitions, parameters, and response metadata
- **Widget Definitions**: UI components and data display configuration
- **Handler Functions**: Business logic for API operations
- **TypeScript Types**: Type-safe interfaces for all operations
- **Configuration**: Environment variables and authentication/OAuth metadata

There is no ad-hoc branching on tool names scattered across the codebase. The registry is the single source of truth for tool capabilities.

### Tool Ownership Model

Each tool owns its complete integration:

- **Widgets**: UI components that display tool data
- **APIs and Handlers**: Endpoint specifications and implementations
- **Types**: Data contracts for its responses
- **Configuration**: Environment setup, credentials, OAuth configuration

The platform core reads these definitions from the registry to:

- Expose `/api/tools/[tool]/[endpoint]` routes
- Render widgets in the portal
- Drive discovery and status indicators

---

## Persistence Integration (Repository-First)

Tools and platform features MUST use the repository-first persistence layer described in `docs/persistence.md` and MUST NOT access drizzle schemas directly.

### Valid Persistence Boundaries for Tools

When a tool or its handlers need persistence, they MUST depend on:

- `getAppStateRepository()` for durable key/value state
- `getJobRepository()` (typically via `MemoryJobQueue`) for background jobs
- `getOAuthTokenRepository()` / `SecureTokenStorage` for OAuth tokens
- `getSessionRepository()` where applicable for session-related flows

Key rules:

- No direct imports of `lib/database/schema` or `lib/database/pg-schema` in tool handlers or widgets.
- No engine-specific branching (`if DB_ENGINE === ...`) in tool code.
- All dual-engine behavior is encapsulated inside repository factories via `getReadWriteDb()` + `$schema` identity checks.

This ensures:

- Tools remain engine-agnostic.
- Dual-engine migrations (SQLite → PostgreSQL) do not require changes in tool integrations.
- Tests for tools can rely on repository-shaped fakes.

For details, see:

- `docs/persistence.md`
- `docs/sqlite-to-postgresql/dual-engine-repositories.md`

---

## Adding a New Tool

### Step 1: Create Tool Definition

Create `tools/newtool/index.ts` with the complete tool definition:

```typescript
import { Tool } from "../tool-types";

export const newtool: Tool = {
  name: "New Tool",
  slug: "newtool",
  enabled: process.env.ENABLE_NEWTOOL === "true",

  // API endpoints
  apis: {
    data: {
      method: "GET",
      description: "Get data from new tool",
      parameters: {
        limit: {
          type: "number",
          required: false,
          description: "Maximum number of items to return",
        },
      },
      response: {
        dataKey: "items",
        description: "Array of data items",
      },
    },
  },

  // Widget definitions
  widgets: [
    {
      title: "New Tool Data",
      description: "Display of new tool data",
      size: "medium",
      dynamic: true,
      apiEndpoint: "data",
      refreshInterval: 300000, // 5 minutes
    },
  ],

  // API handlers
  handlers: {
    data: async (request: Request, config: ToolConfig) => {
      // Business logic implementation:
      // - Use tool config from registry/environment
      // - Call external APIs as needed
      // - Optionally use repository-first persistence (see below)
      return { items: [] };
    },
  },

  // Optional: OAuth + configuration
  config: {
    formatApiUrl: (webUrl: string) => `${webUrl}/api/v1`,
    oauthConfig: {
      authorizationUrl: "https://newtool.com/oauth/authorize",
      tokenUrl: "https://newtool.com/oauth/token",
      userApiUrl: "/user",
      scopes: ["read:data", "write:data"],
      clientIdEnvVar: "NEWTOOL_OAUTH_CLIENT_ID",
      clientSecretEnvVar: "NEWTOOL_OAUTH_CLIENT_SECRET",
      userMapping: {
        id: "id",
        email: "email",
        username: "username",
        name: "name",
        avatar: "avatar_url",
      },
      authorizationHeader: "Bearer",
    },
  },
};
```

### Step 2: Create TypeScript Types

Create `tools/newtool/types.ts`:

```typescript
export interface NewToolData {
  id: string;
  name: string;
  created_at: string;
}

export interface NewToolResponse {
  items: NewToolData[];
}
```

### Step 3: Register Tool

In `tools/index.ts`:

```typescript
export { newtool } from "./newtool";

export const tools = [
  // ... existing tools
  newtool,
];
```

### Step 4: Environment Configuration

Add to `.env.local.sample`:

```env
# New Tool Configuration
ENABLE_NEWTOOL=false
NEWTOOL_API_URL=https://api.newtool.com
NEWTOOL_API_TOKEN=your_api_token_here
```

---

## Widget System

### Widget Requirements

All widgets must include:

- **Title**: Display name
- **Data Source**: Configurable data source (API endpoint)
- **Loading/Error States**: Clear feedback for users
- **Dynamic Loading**: Server-side API data fetching when `dynamic: true`

### Dynamic Widgets and API Endpoints

Widgets can be marked as `dynamic: true` to enable server-side loading:

```typescript
widgets: [
  {
    title: "Dynamic Data",
    dynamic: true,
    apiEndpoint: "data",
    refreshInterval: 300000,
  },
];
```

Constraints:

- `apiEndpoint` MUST match an entry in the tool's `apis` and `handlers`.
- No fallback guessing of endpoints; configuration must be explicit.

### Auto-Refresh Configuration

Widgets support `refreshInterval` in milliseconds. Examples:

- GitHub/Jira: 300000 (5 minutes)
- Performance monitoring: 60000 (1 minute)
- System metrics: 30000 (30 seconds)

---

## API Integration

### Server-Side Loading

- Tools are registered server-side.
- Each tool reads its `ENABLE_*` flag from environment variables.
- Only enabled tools participate in routing and UI.

### Client/Server Separation

- All calls to external services and sensitive operations are server-side.
- Client components consume data via internal API routes:
  - Typically `/api/tools/[tool]/[endpoint]`.
- Tool configuration secrets never reach the client.

### Single API Router

All tool API calls are routed through:

- `/api/tools/[tool]/[endpoint]`

The router:

- Resolves the tool definition from the registry.
- Validates that `[endpoint]` exists in `tool.apis` and `tool.handlers`.
- Invokes `tool.handlers[endpoint]` with properly typed parameters.

---

## OAuth Configuration

### Registry-Driven OAuth

Each tool can define its OAuth configuration inside its definition. This:

- Avoids hardcoded provider logic.
- Enables adding/removing OAuth-capable tools via configuration.

Example structure:

```typescript
config: {
  formatApiUrl: (webUrl: string) => `${webUrl}/api/v3`,
  oauthConfig: {
    authorizationUrl: "https://provider.com/oauth/authorize",
    tokenUrl: "https://provider.com/oauth/token",
    userApiUrl: "/user",
    scopes: ["read:data"],
    clientIdEnvVar: "PROVIDER_OAUTH_CLIENT_ID",
    clientSecretEnvVar: "PROVIDER_OAUTH_CLIENT_SECRET",
    userMapping: {
      id: "id",
      email: "email",
      username: "username",
      name: "full_name",
      avatar: "avatar_url",
    },
    authorizationHeader: "Bearer",
  },
}
```

### Dynamic URL Support

- Absolute URLs (e.g. GitHub, GitLab) are specified directly.
- Relative URLs (e.g. Jira) are combined with the tool's base URL using `formatApiUrl`.

### OAuth Environment Configuration

`.env.local.sample`:

```env
ENABLE_PROVIDER=false
PROVIDER_OAUTH_CLIENT_ID=your_oauth_app_client_id
PROVIDER_OAUTH_CLIENT_SECRET=your_oauth_app_client_secret
```

### Centralized OAuth Lookup

OAuth configuration is resolved from the registry and consumed by the shared OAuth helpers. Tokens themselves are persisted via `SecureTokenStorage` / `OAuthTokenRepository` (repository-first, dual-engine).

---

## Best Practices

### Environment Variables

- Use `ENABLE_TOOL_NAME=true/false` for tool enablement.
- Declare all required variables in `.env.local.sample`.
- Do not commit real credentials.

### Type Safety

- Define TypeScript interfaces for all API responses.
- Type widget props and handlers strictly.
- Keep tool definitions strongly typed against `Tool` / registry types.

### Persistence (Critical)

- If a tool needs:
  - Durable configuration state → use `getAppStateRepository()`.
  - Background jobs → use `MemoryJobQueue` (which uses `getJobRepository()`).
  - OAuth tokens → use `SecureTokenStorage`.
- Do not import or write to drizzle schemas directly from tools.

### Performance and Error Handling

- Choose appropriate `refreshInterval` values.
- Handle rate limits and backoff in handlers.
- Provide clear loading and error states in widgets.
- Use repository boundaries as natural instrumentation points.

---

## Tool Status and Discovery

### Automatic Integration

Once registered, a tool automatically:

- Exposes API endpoints through the unified router.
- Provides widgets in the portal for enabled tools.
- Participates in sidebar/status/discovery components.

### UI Filtering

Only enabled tools appear in:

- Portal widgets
- Sidebar navigation
- Discovery endpoints

---

## Testing and Validation

### API Endpoint Testing

For `/api/tools/[tool]/[endpoint]`:

- Validate request/response shapes.
- Assert errors are handled correctly.
- Use mocks/fakes for external services.

### Widget Testing

- Ensure widgets appear only when the tool is enabled.
- Test dynamic data loading, refresh behavior, and failure modes.
- Verify responsive layout and dark mode behavior.

### Persistence and Dual-Engine Testing

- When tool behavior depends on persistence (e.g. jobs, tokens, state):
  - Test against repository interfaces using fakes (hermetic).
  - Repository-level tests cover engine-specific behavior separately.

---

## Security Considerations

### Token and Credential Management

- All external API tokens are environment-based.
- OAuth tokens are stored exclusively via `SecureTokenStorage` / `OAuthTokenRepository`.
- No secrets in client bundles or tool widgets.

### Input Validation

- Dynamic route parameters validated with strict patterns.
- API handlers return generic errors; internal details stay server-side.

---

## Cross-References

- **Persistence**: `docs/persistence.md`
- **Dual-Engine Repositories**: `docs/sqlite-to-postgresql/dual-engine-repositories.md`
- **Configuration Guidelines**: `configuration-guidelines.md`
- **Security Practices**: `security-practices.md`
- **Coding Principles**: `coding-principles.md`

**Last updated**: Reflects repository-first, dual-engine persistence integration.
