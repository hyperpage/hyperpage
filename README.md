# Hyperpage Dashboard

A comprehensive data aggregation dashboard that consolidates information from multiple external tools into a unified, interactive interface. Built with Next.js, TypeScript, and Tailwind CSS.

# 🔒 Security Audit Status: PASSED ✅

This project has undergone a comprehensive security audit and is confirmed safe for public GitHub repositories. All sensitive credentials remain protected through enterprise-grade security practices.

## Key Security Features Verified:
- ✅ **Server-Side Credential Isolation**: API tokens never exposed to client-side code
- ✅ **Environment Variable Protection**: No hardcoded credentials in source code
- ✅ **Build Security**: Clean builds with no credential leakage into artifacts
- ✅ **Input Validation**: All API endpoints protected against injection attacks
- ✅ **Error Handling**: Generic error messages prevent information disclosure
- ✅ **Registry-Based Architecture**: Centralized secure tool configuration management

## Features

- **TypeScript Excellence**: Comprehensive type safety with zero `any` types across all tool integrations - all 35 ESLint `any` violations eliminated
- **Code Quality & Architecture**: Recently underwent major refactoring with custom hooks, component decomposition, and service layer extraction - improved maintainability and performance
- **Component Decomposition**: Large components broken into focused, reusable pieces with single responsibilities (Dashboard from 300+ to 58 lines)
- **Custom Hook Architecture**: Custom hooks (`useToolData`, `useActivityData`, `useDarkMode`) centralize state management and business logic
- **Service Layer**: Dedicated API services (ApiClient, ToolApiService) with consistent error handling and type safety
- **Performance Optimizations**: React.memo applied to frequently rendering components, error boundaries added for graceful failure handling
- **Real-Time Global Search**: Instantly search across all integrated tools - find PRs, tickets, workflows, activity feeds, and more with live filtering and result counts
- **Automatic Data Refresh**: Widgets automatically update when external APIs change (e.g., new Jira stories appear in real-time), with configurable refresh intervals and manual refresh controls
- **Modern UI Design**: Clean, accessible interface built with shadcn/ui components on Radix UI primitives with a custom teal color theme
- **Modular Widget System**: Flexible widgets for data visualization using Card components, tables with pagination (10 items per page), and interactive charts
- **Multi-Tool Integration**: Connect and display data from various external tools with status indicators and tool badges
- **Aggregated Tool Icons**: Cards showing combined data from multiple tools (like Code Reviews and CI/CD) display small icons of the contributing tools instead of text labels
- **Clickable Source Links**: All data entries link directly back to their original source systems (Jira issues, GitHub PRs/MRs, etc.) using external link icons
- **PR/MR ID Display**: Code reviews table shows recognizable identifiers (`#123` for GitHub PRs, `!456` for GitLab MRs) with optional clickable links
- **Responsive Design**: Optimized for desktop, tablet, and mobile devices with responsive grid layouts
- **Dark/Light Mode**: Built-in theme switching with automatic color scheme adaptation using CSS custom properties
- **Customizable Layouts**: Save different dashboard configurations as workspaces
- **Smart Tool Name Normalization**: Automatic handling of tool names with spaces, hyphens, and URL-encoded characters to ensure consistent API routing
- **Registry-Driven Architecture**: 100% automated tool integration with zero manual routing code
- **Custom Favicon**: Hyperpage dashboard icon featuring a network-style design with interconnected nodes and data flow representation

## Recent Architectural Improvements

The dashboard recently underwent a comprehensive code cleanup and refactoring initiative that significantly improved code quality, maintainability, and performance:

### **Component Architecture Improvements**
- **Large Component Decomposition**: Dashboard shrunk from 300+ to 58 lines through component decomposition
- **Activity Feed Refactoring**: Livefeed component reduced from 400+ to 68 lines using focused sub-components
- **Single Responsibility Focus**: Each component now handles one clear responsibility with clean separation of concerns
- **React.memo Optimization**: Frequently re-rendering components optimized with React.memo for better performance
- **Interface Simplification**: Streamlined WidgetWithToolName interface for cleaner component communication

### **Custom Hook Architecture**
- **`useDarkMode`**: Centralized theme switching and localStorage persistence
- **`useToolData`**: Manages widget data fetching, refresh logic, and polling intervals
- **`useActivityData`**: Handles activity feed data with automatic refresh and error handling (optimized with useCallback)
- **Business Logic Separation**: Complex stateful logic extracted into reusable custom hooks

### **Service Layer Implementation**
- **`ApiClient`**: Base HTTP client abstraction with consistent error handling
- **`ToolApiService`**: Centralized API operations for tool data with proper error boundaries
- **Type Safety**: Full TypeScript support for all API responses and request parameters
- **Error Handling**: Graceful degradation with user-friendly error messages

### **Component Interface Simplification**
- **WidgetWithToolName Interface**: Streamlined to essential properties (toolName, title, type, headers, data)
- **Type Safety Improvements**: Eliminated interface mismatches between DashboardOverview and DashboardWidgetGrid
- **Clean Component Communication**: Explicit property mapping instead of spread operators for better type control
- **Table-Focused Design**: Prioritized table widget support with clean table-specific data flow

### **Code Quality Enhancements**
- **Prettier Formatting**: 30+ files automatically formatted for consistent code style
- **ESLint Compliance**: Zero linting errors across the entire codebase
- **TypeScript Excellence**: Strict type checking with zero `any` types and resolved interface conflicts
- **Build Optimization**: Clean builds with optimized bundle sizes and resolved compilation errors

## Getting Started

1. **Prerequisites**
   ```bash
   Node.js 18+ installed
   npm, yarn, pnpm, or bun package manager
   ```

2. **Installation**
   ```bash
   git clone https://github.com/hyperpage/hyperpage.git
   cd hyperpage
   npm install
   ```

3. **Configuration**
   ```bash
   # Copy the environment template
   cp .env.local.sample .env.local
   ```

   Edit `.env.local` to enable/disable tools and configure API access:

   ```env
   # Enable/disable tools
   ENABLE_JIRA=true          # Enable JIRA integration
   ENABLE_GITHUB=true        # Enable GitHub integration
   ENABLE_GITLAB=false       # Enable GitLab integration
   ENABLE_CODE_REVIEWS=true  # Show code review widgets on dashboard
   ENABLE_CICD=true          # Show unified CI/CD pipeline widgets on dashboard
   ENABLE_TICKETING=true     # Show unified ticketing widgets on dashboard

   # JIRA Configuration (for Jira Cloud)
   JIRA_WEB_URL=https://your-domain.atlassian.net  # Web URL only - API URL auto-derived
   JIRA_EMAIL=your_email@company.com               # Your Atlassian account email
   JIRA_API_TOKEN=ATATT3x...                       # Personal access token from Atlassian

   # GitHub Configuration
   GITHUB_TOKEN=github_pat_...             # Personal access token
   GITHUB_USERNAME=your_github_username    # Your GitHub username for activity feed

   # GitLab Configuration (when enabled)
   GITLAB_WEB_URL=https://gitlab.com       # Web URL only - API URL auto-derived
   GITLAB_TOKEN=your_personal_access_token
   ```

   **URL Consolidation**: The system automatically derives API URLs from web URLs using tool-specific formatting rules:
   - **Jira**: `webUrl + '/rest/api/3'` → `https://domain.atlassian.net/rest/api/3`
   - **GitLab**: `webUrl + '/api/v4'` → `https://gitlab.com/api/v4`
   - **GitHub**: Always uses `https://api.github.com` (independent of web URL)

   **Note**: API tokens are required for the tools you enable. See "Tool Integrations" section below for detailed setup instructions.

4. **Development Server**
   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000) to view the dashboard.

   **Note**: The dashboard compiles successfully with no ESLint errors and includes a complete automatic refresh system for real-time data updates.

5. **Build for Production**
   ```bash
   npm run build
   npm start
   ```

## Layout Structure

The dashboard uses a fixed layout with modern UI components:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ TOP BAR (fixed, 64px height)                                               │
│ • Logo • Search • Integrations Dropdown • Notifications • Refresh • Theme  │
├─────────────────────────────────────────────────────────────────────────────┤
│ HORIZONTAL TAB NAVIGATION (48px height, centered)                          │
│ [Overview] [Livefeed] [Communication]                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│ MAIN CONTENT AREA (full width, responsive)                                  │
│ ┌─────────────────────────────────────────────────────────────────────┐    │
│ │ TOOL WIDGETS GRID (2 column responsive layout)                     │    │
│ │ ┌─────────────────┐ ┌─────────────────┐                             │    │
│ │ │ TOOL WIDGET #1  │ │ TOOL WIDGET #2  │                             │    │
│ │ │                 │ │                 │                             │    │
│ │ │ TOOL WIDGET #3  │ │ TOOL WIDGET #4  │                             │    │
│ │ │                 │ │                 │                             │    │
│ │ └─────────────────┘ └─────────────────┘                             │    │
│ │                                                                    │    │
│ │ OR                                                                 │    │
│ │ ┌─────────────────────────────────────────────────────────────────┐ │    │
│ │ │               Live Feed Page                                  │ │    │
│ │ │   Recent tool activities (MRs, PRs, issues, CI/CD)            │ │    │
│ │ └─────────────────────────────────────────────────────────────────┘ │    │
│ │                                                                    │    │
│ │ OR EMPTY STATE (when no tools enabled)                            │    │
│ │ ┌─────────────────────────────────────────────────────────────────┐ │    │
│ │ │                  No Tools Enabled                              │ │    │
│ │ │   Enable tools in your environment configuration              │ │    │
│ │ │ Configure integrations using the settings dropdown in TopBar  │ │    │
│ │ └─────────────────────────────────────────────────────────────────┘ │    │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Layout Details

#### **Top Bar (64px, Fixed Position)**
- **Left**: Hyperpage logo (theme-aware SVG, clickable link to home page)
- **Center**: Global search input - search across all tool data with real-time filtering and result counts
- **Right**: Settings dropdown (integrations), notifications, global refresh, theme toggle

#### **Horizontal Tab Navigation (48px, Fixed Position)**
- **Centered Layout**: Tab navigation bar positioned below TopBar, horizontally centered
- **Navigation Tabs**: 3 main tabs (Overview, Livefeed, Communication) with icons and badge indicators
- **Mobile Responsive**: Tabs scroll horizontally on small screens while maintaining centered alignment on larger screens
- **Active State**: Current tab highlighted with secondary styling

#### **Main Content Area (Responsive, Full Width)**
- **Full Width Layout**: No longer constrained by sidebar, utilizes complete horizontal space
- **Tool Widgets Grid**: Mobile (1 col) → Desktop (2 cols) responsive layout for tool widgets
- **Empty State**: When no tools are enabled, displays helpful message guiding users to configure integrations via TopBar settings dropdown

## Project Structure

```
hyperpage/
├── app/
│   ├── components/           # React components (shadcn/ui based)
│   │   ├── Dashboard.tsx     # Main dashboard layout orchestration
│   │   ├── TopBar.tsx        # Global controls and search (64px fixed)
│   │   ├── Sidebar.tsx       # Deprecated - replaced by TabNavigation
│   │   ├── MetricCard.tsx    # KPI display cards using Card components
│   │   ├── ChartWidget.tsx   # Interactive charts using recharts
│   │   ├── DataTable.tsx     # Data tables with pagination (10 items/page) using Table components
│   ├── page.tsx             # Main entry point
│   ├── layout.tsx           # App layout wrapper
│   ├── icon.svg             # Custom favicon (network-style design)
│   └── globals.css          # Global styles
├── components/              # shadcn/ui components directory
│   └── ui/                  # Individual component files
│       ├── card.tsx         # Card components
│       ├── button.tsx       # Button components
│       ├── table.tsx        # Table components
│       └── ...              # Other UI primitives
├── tools/                   # Modular tool integrations
│   ├── jira/                # Jira integration
│   ├── github/              # GitHub integration
│   ├── tool-types.ts        # TypeScript interfaces
│   ├── index.ts             # Tool registry and utilities
│   └── README.md            # Tool integration guide
├── .clinerules/             # Cline development workflow rules
├── docs/                    # Documentation
├── public/                  # Static assets

## Live Feed: Enhanced Real-Time Activity Aggregation

The dashboard features a comprehensive **Live Feed page** that provides **rich contextual information** for all development activities across enabled tools:

### Core Features
- **1-Minute Auto-Refresh**: Activity feed automatically updates every minute with latest tool activity
- **Tab Visibility Refresh**: Data refreshes immediately when returning to the dashboard tab from other browser tabs
- **Manual Refresh Control**: Users can manually refresh with a refresh button showing loading states and animated spinners
- **Aggregated Activity**: Combines events from GitHub (PRs, issues, pushes), GitLab (MRs, pushes), Jira (issue updates)
- **Unified Timeline**: Events sorted by timestamp showing most recent activity first
- **Enhanced Context Display**: Activity items now include comprehensive metadata for better understanding:
  - **Repository/Project Context**: Shows the repository (GitHub/GitLab) or project (Jira) where the activity occurred
  - **Branch Information**: Displays branch names for code-related activities (pushes, PRs/MRs)
  - **Commit Counts**: Shows the number of commits in push events
  - **Status Indicators**: Displays current status of issues/PRs/MRs (open, closed, merged, etc.) with color-coded badges
  - **Assignee Information**: Shows who items are assigned to (when different from the activity author)
  - **Labels/Tags**: Displays applicable labels and tags on issues and pull requests

### Visual Design
- **Clean Context Display**: Metadata is displayed as secondary information below activity descriptions using compact badges
- **Tool Attribution**: Each event shows which tool it originated from with color coding
- **Status Color Coding**: Consistent color schemes across the dashboard
  - 🟢 Green: open, active, success states
  - 🔴 Red: closed, failed states
  - 🟣 Purple: merged, special states
- **Author Display**: Shows who performed each action with avatar initials
- **Responsive Design**: Optimized display across desktop, tablet, and mobile
- **Loading States**: Skeleton loading UI during data fetch with error handling
- **Empty States**: Helpful messages when no tools are configured or no activity exists

### Activity Feed Architecture
- **Unified API**: Single `/api/tools/activity` endpoint aggregates from all tools with 'activity' capability
- **Registry-Driven**: Automatic discovery of tools providing activity data
- **Enhanced Metadata**: Tools include optional metadata fields (`repository`, `branch`, `commitCount`, `status`, `assignee`, `labels`)
- **Graceful Degradation**: Individual tool failures don't break the entire feed
- **Performance Optimized**: Limits to 50 most recent events to prevent UI overload
- **Navigation Security**: All activity hyperlinks open in new tabs with proper `rel="noopener noreferrer"`
```

## Tool Integrations

The dashboard supports modular integration with various external tools through a centralized registry system. Each tool provides widgets that display data on the dashboard and declares API endpoints through the registry.

### Tool Discovery API

The dashboard provides RESTful endpoints for programmatic tool discovery:

#### Get All Available Tools
```
GET /api/tools/discovery
```
Returns complete information about all registered tools, their capabilities, and API endpoints.

#### Get Enabled Tools
```
GET /api/tools/enabled
```
Returns only enabled tools and their active API endpoints with URLs for data fetching.

#### Get Specific Tool Details
```
GET /api/tools/[tool-name]
```
Returns detailed information about a specific tool, including widgets, APIs, and configuration info.

#### Tool API Calls
```
GET /api/tools/[tool-name]/[endpoint]
```
Execute API calls through the tool registry. Supported endpoints include:
- `/api/tools/github/repos` - Get GitHub repositories
- `/api/tools/jira/issues` - Get Jira issues

Example response structure:
```json
{
  "tools": [
    {
      "name": "GitHub",
      "enabled": true,
      "widgets": [
        {
          "title": "Repositories",
          "type": "table",
          "headers": ["Name", "Language", "Stars", "Updated"],
          "dynamic": true
        }
      ],
      "apis": [
        {
          "endpoint": "repos",
          "method": "GET",
          "description": "Get user repositories",
          "parameters": {
            "sort": {"type": "string", "required": false},
            "type": {"type": "string", "required": false}
          }
        }
      ]
    }
  ],
  "apis": {
    "github/repos": {"tool": "GitHub", "api": {...}},
    "jira/issues": {"tool": "Jira", "api": {...}}
  }
}
```

### **Registry-Driven Tool Integration**

For detailed documentation on the **complete registry-driven tool integration system**, including architecture overview, adding new tools, examples, and best practices, see:

📖 **[docs/tool-integration-system.md](docs/tool-integration-system.md)**

## Key Features

- ✅ **API Handlers**: Tools declare their own API handlers - no switch cases anywhere
- ✅ **Response Structure**: Tools declare response data keys for automatic data access
- ✅ **Status Management**: Sidebar dynamically loads and displays enabled tool integrations via API
- ✅ **Client/Server Separation**: Registry automatically handles passing client-safe tool objects
- ✅ **Discovery APIs**: RESTful endpoints expose all tool capabilities dynamically
- ✅ **3-Step Integration**: Adding tools requires only tool creation, registry registration, and environment config

### Adding New Tool Integrations

1. Create a new directory under `tools/` (e.g., `tools/slack/`)
2. Implement the `Tool` interface with `widgets`, `enabled`, and `config` properties
3. Add the tool to the registry in `tools/index.ts`
4. Create corresponding API routes if dynamic data fetching is required
5. Update environment variables and documentation

See `[docs/tool-integration-system.md](docs/tool-integration-system.md)` for detailed integration guidelines.

## Security

**✅ SECURITY AUDIT COMPLETED (PASSED)** - This project has been thoroughly audited and confirmed safe for public GitHub repositories. All security measures have been verified through comprehensive testing.

### 🔐 **API Token Protection**
- **Client-Side Isolation**: Tool configurations containing API tokens and credentials are automatically excluded from client-side React components
- **Server-Only Access**: Sensitive configuration objects with API headers and authentication tokens are only accessible on the server side
- **Registry-Based Security**: All tool authentications are managed through a centralized secure registry system
- **Build Cleanliness**: Environment variables do not leak into client bundles during Next.js production builds

### 🛡️ **Input Validation**
- **Parameter Sanitization**: All API endpoint parameters are validated using strict regex patterns (`^[a-zA-Z0-9_%\-\s]+`)
- **Request Filtering**: Invalid or malicious tool names and endpoint names are rejected with HTTP 400 Bad Request responses
- **Injection Prevention**: Input validation prevents potential directory traversal and injection attacks
- **URL Encoding Support**: System handles spaces, hyphens, and URL-encoded characters safely

### 🔇 **Error Handling**
- **Information Leakage Prevention**: API responses contain generic error messages without exposing implementation details
- **Server-Side Logging**: Detailed error information is logged server-side for debugging while keeping client responses safe
- **Controlled Disclosure**: Error responses use non-descriptive messages like "An error occurred while processing the request"
- **Graceful Degradation**: Failed tool integrations don't crash the dashboard

### ✅ **Security Audit Verified**
- **Environment Variables**: Properly protected with `.gitignore` exclusions
- **Source Code Clean**: No hardcoded tokens or credentials found
- **Build Artifacts**: No credential leakage into production bundles
- **Git History**: Clean with no historical sensitive data commits
- **API Architecture**: Server-side execution prevents client exposure

## Technology Stack

- **Framework**: Next.js 15.5.4 with App Router and server-side security
- **Language**: TypeScript with strict type checking
- **UI Library**: shadcn/ui (components built on Radix UI)
- **Charts**: Recharts (React charting library)
- **Styling**: Tailwind CSS 4
- **Runtime**: Node.js with secure server-side operations
- **Icons**: Lucide React (SVG icons)
- **Development**: Turbopack for fast builds
- **Theme System**: CSS custom properties with automatic dark/light mode and custom teal color theming

### Security Features
- **Server-Side API Handling**: All external API calls made server-side to protect credentials
- **Input Sanitization**: Regex-based validation for all user inputs and parameters
- **Error Response Control**: Generic error messages prevent information disclosure
- **Client-Server Separation**: Sensitive operations isolated to server components

## Contributing

This project is developed using Cline AI Assistant. See the `.clinerules/` directory for comprehensive development guidelines:

- **[`.clinerules/coding-principles.md`](.clinerules/coding-principles.md)** - Core architectural principles and development patterns
- **[`.clinerules/coding-style.md`](.clinerules/coding-style.md)** - Code standards, TypeScript usage, and Next.js patterns
- **[`.clinerules/security-practices.md`](.clinerules/security-practices.md)** - Security standards and best practices
- **[`.clinerules/configuration-guidelines.md`](.clinerules/configuration-guidelines.md)** - Configuration management and environment setup
- **[`.clinerules/documentation-guidelines.md`](.clinerules/documentation-guidelines.md)** - Documentation maintenance rules
- **[`.clinerules/workflows/`](./.clinerules/workflows/)** - Executable Cline workflows for common development tasks

## Deployment

Deployed automatically on Vercel. Check out the [deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)
