# Tool Integration System

This document describes how tools integrate with the Hyperpage platform and provides guidance for adding new tool integrations.

## Overview

The Hyperpage tool integration system is designed around a **registry-driven architecture** where all tool interactions are completely driven by registry configurations with zero hardcoded logic.

## Architecture

### Registry-Driven Design

All tool interactions are completely registry-driven with zero hardcoded logic anywhere in the codebase. Each tool is defined as a registry entry that contains:

- **API Specifications**: Endpoints, request/response formats
- **Widget Definitions**: UI components and data display
- **Handler Functions**: Business logic for API operations
- **TypeScript Types**: Type-safe interfaces for all operations
- **Configuration**: Environment variables and authentication

### Tool Ownership Model

Each tool owns its complete integration:

- **Widgets**: UI components that display tool data
- **API Specifications**: Endpoint definitions and data structures
- **Handler Functions**: Business logic for API operations
- **TypeScript Interfaces**: Type definitions for all data
- **Configuration**: Environment setup and credentials

## Adding a New Tool

### Step 1: Create Tool Definition

Create `tools/newtool/index.ts` with complete tool definition:

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
      // Business logic implementation
      return { items: [] };
    },
  },

  // Optional: OAuth configuration for authentication
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

Add to `tools/index.ts`:

```typescript
export { newtool } from "./newtool";
```

And register in the tools registry:

```typescript
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

## Widget System

### Widget Requirements

All widgets must include:

- **Title**: Display name for the widget
- **Data Source**: Configurable data source with refresh capabilities
- **Loading States**: Appropriate loading and error states
- **Dynamic Loading**: Support for server-side API data fetching

### Dynamic Widgets

Widgets can be marked as `dynamic: true` to enable server-side API data fetching:

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

**Important**: All dynamic widgets must specify `apiEndpoint` property that matches a defined API handler in the tool's `apis` object.

### Auto-Refresh Configuration

Widgets support configurable `refreshInterval` (in milliseconds) for automatic background polling. Example intervals:

- GitHub/Jira: 300000ms (5 minutes)
- Performance monitoring: 60000ms (1 minute)
- System metrics: 30000ms (30 seconds)

## API Integration

### Server-Side Loading

All tools are loaded server-side on startup. Each tool checks its `ENABLE_*` environment variable to determine enabled state.

### Client/Server Separation

- **Server**: Handles all API calls, authentication, and sensitive operations
- **Client**: Receives only UI-safe data via API endpoints
- **Security**: Tool configurations are automatically excluded from client components

### Single API Router

All tool API calls route through `/api/tools/[tool]/[endpoint]` which uses `tool.handlers[endpoint]` for execution.

## OAuth Configuration

### Registry-Driven OAuth Architecture

The Hyperpage platform uses a **registry-driven OAuth architecture** where each tool owns its complete OAuth configuration. This approach eliminates hardcoded provider mappings and enables seamless addition of new OAuth providers.

### OAuth Configuration Structure

Each tool can define its complete OAuth configuration within its definition:

```typescript
export const tool: Tool = {
  // ... other properties
  config: {
    // Optional: Custom API URL formatter
    formatApiUrl: (webUrl: string) => `${webUrl}/api/v3`,

    // Complete OAuth configuration
    oauthConfig: {
      // OAuth URLs (absolute or relative for dynamic formatting)
      authorizationUrl: "https://provider.com/oauth/authorize",
      tokenUrl: "https://provider.com/oauth/token",
      userApiUrl: "/user", // or full URL for user profile

      // Required OAuth scopes
      scopes: ["read:data", "write:data", "admin:settings"],

      // Environment variable names for credentials
      clientIdEnvVar: "PROVIDER_OAUTH_CLIENT_ID",
      clientSecretEnvVar: "PROVIDER_OAUTH_CLIENT_SECRET",

      // User profile field mapping
      userMapping: {
        id: "id", // User's unique identifier
        email: "email", // User's email address
        username: "username", // User's username
        name: "full_name", // User's display name
        avatar: "avatar_url", // URL to user's avatar
      },

      // Authorization header format
      authorizationHeader: "Bearer", // or "token" for GitHub
    },
  },
};
```

### Dynamic URL Support

The OAuth system supports both absolute and relative URLs:

- **Absolute URLs**: Used by GitHub, GitLab - specified directly in configuration
- **Relative URLs**: Used by Jira - formatted dynamically with tool's base URL

```typescript
// GitLab - Absolute URLs
oauthConfig: {
  authorizationUrl: "https://gitlab.com/oauth/authorize",
  tokenUrl: "https://gitlab.com/oauth/token"
}

// Jira - Relative URLs (formatted with base URL)
oauthConfig: {
  authorizationUrl: "/rest/oauth2/latest/authorize",
  tokenUrl: "/rest/oauth2/latest/token"
}
```

### OAuth Environment Configuration

Add OAuth credentials to `.env.local.sample`:

```env
# Provider OAuth Configuration
ENABLE_PROVIDER=false
PROVIDER_OAUTH_CLIENT_ID=your_oauth_app_client_id
PROVIDER_OAUTH_CLIENT_SECRET=your_oauth_app_client_secret
```

### Centralized OAuth Configuration Access

The system provides centralized OAuth configuration lookup:

```typescript
// Get OAuth configuration from registry
const oauthConfig = getOAuthConfig("provider-name");
if (oauthConfig) {
  // Use for OAuth flow
  const authorizationUrl = buildAuthorizationUrl(oauthConfig, {
    state: generateSecureState(),
    scope: oauthConfig.scopes.join(" "),
  });
}
```

### User Profile Mapping

OAuth configurations include user profile field mapping to handle different API response structures:

```typescript
// GitHub response mapping
userMapping: {
  id: "id",                    // github_user_id
  email: "email",             // user@example.com
  username: "login",          // octocat
  name: "name",               // The Octocat
  avatar: "avatar_url"        // https://github.com/images/error/octocat_happy.gif
}

// Jira response mapping
userMapping: {
  id: "accountId",                          // 5b10ac8d82e05b22cc7d4ef5
  email: "emailAddress",                    // octocat@example.com
  username: "name",                         // The Octocat
  name: "displayName",                      // The Octocat
  avatar: "avatarUrls.48x48"               // https://avatar-url
}
```

### OAuth Flow Integration

OAuth configurations are automatically used by the authentication system:

1. **OAuth Initiation**: Uses `authorizationUrl` and `scopes`
2. **Token Exchange**: Uses `tokenUrl` for access/refresh tokens
3. **User Profile**: Uses `userApiUrl` and `userMapping`
4. **API Requests**: Uses `authorizationHeader` format

### Adding OAuth to New Tools

To add OAuth support to a new tool:

1. **Define OAuth Configuration** in tool definition
2. **Set Environment Variables** in `.env.local.sample`
3. **Register Tool** in tools registry (automatic integration)
4. **Test OAuth Flow** using provided authentication endpoints

**No additional code changes required** - OAuth is automatically available through the registry system.

## Best Practices

### Environment Variables

- Use `ENABLE_TOOL_NAME=true/false` for tool enablement
- Follow the existing pattern for API credentials
- Include both `.env.local.sample` (committed) and `.env.local` (ignored)

### Type Safety

- Define TypeScript interfaces for all API responses
- Use strict typing for widget props and API handlers
- Maintain type safety across the entire tool stack

### Performance

- Implement appropriate refresh intervals based on data update frequency
- Use caching strategies for expensive operations
- Monitor API rate limits and implement backoff strategies

### Error Handling

- Provide graceful error handling in all widget components
- Use loading states during API operations
- Implement retry logic for transient failures

## Tool Status and Discovery

### Automatic Integration

Adding/generating a tool automatically provides:

- UI widgets in the portal
- API endpoints for data access
- Sidebar status indicators
- Discovery capabilities

### UI Filtering

Only enabled tools appear in:

- Portal UI widgets
- Sidebar navigation
- API endpoint discovery
- User interface elements

## Testing and Validation

### API Endpoint Testing

Test API endpoints at `/api/tools/[tool]/[endpoint]`:

- Verify data structure matches TypeScript types
- Test error handling and edge cases
- Validate authentication and authorization

### Widget Testing

Verify widgets in the portal:

- Confirm widgets appear only for enabled tools
- Test dynamic data loading and refresh functionality
- Validate responsive design and error states

## Security Considerations

### Token Management

- All API tokens stored in environment variables
- Never exposed to client-side code
- Server-side authentication for all external API calls

### Input Validation

- All dynamic route parameters validated with strict regex
- Early validation in API routes
- Generic error messages without implementation details

---

## Cross-References

### Related Documentation

- **[Configuration Guidelines](configuration-guidelines.md)** - Environment setup and tool configuration
- **[Security Practices](security-practices.md)** - Security standards and validation
- **[Coding Principles](coding-principles.md)** - Architectural patterns and component systems

### Code Examples

- **[GitHub Tool](tools/github/)** - Example of OAuth integration
- **[Jira Tool](tools/jira/)** - Example of enterprise tool integration
- **[GitLab Tool](tools/gitlab/)** - Example of self-hosted deployment

---

**Last updated**: January 11, 2025
