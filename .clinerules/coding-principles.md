# Coding Principles - Hyperpage

This document outlines the core architectural principles and development patterns for the Hyperpage project.

## Core Principles

- **Mode Switching**: Use PLAN MODE for UX design planning, feature discussions, and architectural decisions. Switch to ACT MODE for component implementation and code execution.
- **Tool Usage**: Tools are used step-by-step. Wait for user confirmation after each tool use before proceeding.
- **File Editing**: Use `replace_in_file` for precise edits; use `write_to_file` for entire rewrites or new files. Avoid modifying existing components without understanding their relationships.
- **Command Execution**: Prefix commands with `cd` if running outside the current working directory. Set `requires_approval` to true for potentially impactful operations like installing dependencies or running production builds.
- **Notifications**: The user is notified of every action and awaits their feedback before continuing. No parallel or unsubstantiated actions are taken.

## Component Architecture Patterns

### Custom Hooks for State Management (React Query Integration)
- **useActivities**: React Query-powered activity feed with automatic 15s polling and intelligent caching
- **useToolQueries**: Dynamic query management for tool widgets with selective refresh intervals and registry-driven data fetching
- **useDarkMode**: Handles theme switching with localStorage persistence
- **Hook-First Pattern**: Extract complex stateful logic into reusable custom hooks before component implementation

### Component Decomposition Strategy
- **Single Responsibility**: Each component should have one clear purpose and responsibility
- **Component Size Limit**: No component should exceed 100 lines - decompose larger components
- **Presentation vs Logic**: UI components should focus on presentation; logic goes into custom hooks or services
- **React.memo Optimization**: Apply React.memo to components that render frequently to prevent unnecessary re-renders

### Service Layer Architecture
- **ApiClient**: Base HTTP client with consistent error handling and request/response types
- **ToolApiService**: Centralized API operations for tool data with proper error boundaries
- **Service Pattern**: Extract all API logic into service classes to maintain separation of concerns
- **Error Handling**: Services include graceful error handling without exposing implementation details

### Performance Optimizations
- **React.memo**: Applied to frequently re-rendering components like ActivityItem and DashboardSearchResults
- **useMemo**: Used for expensive computations like data filtering and widget processing
- **Error Boundaries**: ErrorBoundary component catches and handles React errors gracefully
- **Memoization Strategy**: Balance performance benefits with code maintainability

## Widget System Architecture

- **Widget Requirements**: New widgets must include title, configurable data source, refresh capabilities, and appropriate loading/error states.
- **Dynamic Data Loading**: Widgets can be marked as `dynamic: true` to enable server-side API data fetching via Next.js API routes.
- **API Endpoint Specification**: **Critical**: All dynamic widgets must specify `apiEndpoint` property that matches a defined API handler in the tool's `apis` object. This property drives widget-driven data fetching rather than relying on dangerous fallback logic.
  - **Example**: `apiEndpoint: "pull-requests"` for Code Reviews, `apiEndpoint: "issues"` for Ticketing
  - **Fallback Prevented**: Without explicit `apiEndpoint`, widgets used Object.keys()[0] which could result in invalid endpoints like "0"
- **Auto-Refresh Configuration**: Widgets support configurable `refreshInterval` (in milliseconds) for automatic background polling - e.g., 300000ms for 5-minute intervals.
- **Manual Refresh**: All dynamic widgets include refresh buttons with loading indicators and error handling.
- **Data Integration**: Widgets should accept mock data initially, but be designed for easy integration with real API endpoints through the `dynamic` flag system.
- **Data Sorting**: All widgets in the overview dashboard automatically sort data by time with the most recent items displayed first. Time-based sorting detects common timestamp fields (`created_at`, `updated_at`, `created`, `updated`, `timestamp`) across different tools.
- **State Management**: Use React hooks for widget-specific state. Avoid global state for simple interactions.
- **Loading States**: Widgets implement smooth loading animations with shimmer effects and background refresh capability. Content remains visible during refresh operations to prevent visual disruption - users maintain interaction with existing data while updates load seamlessly.
- **Animation Framework**: Use custom CSS animations (`animate-shimmer`, `animate-fade-in-up`) for loading skeletons and content transitions. Staggered fade-in animations provide polished, professional loading experiences.
- **Performance**: Charts should support virtual scrolling for large datasets; data tables implement pagination (10 items per page) for efficient data browsing.
- **Real-time Updates**: Dashboard automatically refreshes data when browser tabs become visible again (comes back from other tabs).

## Tool Integration System

- **Registry-Driven Architecture**: All tool interactions are completely registry-driven with zero hardcoded logic anywhere in the codebase.
- **Server-Side Loading**: All tools are loaded server-side on startup - each tool checks its `ENABLE_*` environment variable to determine enabled state.
- **Tool Ownership Model**: Each tool owns its widgets, API specifications, response structures, API handler implementations, and TypeScript type definitions. Tool-specific interfaces are defined in `tools/[tool]/types.ts` files.
- **Automatic Integration**: Adding/generating a tool automatically provides UI widgets, API endpoints, sidebar status, and discovery capabilities.
- **Handler Functions**: Tools declare their own `handlers` object with functions that implement API logic, eliminating manual switch cases.
- **Environment Control**: Tool enablement is controlled by environment variables (e.g., `ENABLE_JIRA=true`) checked by each tool individually.
- **Data Structure Declaration**: Tools declare `response.dataKey` so components can automatically access the correct data structure.
- **Client/Server Separation**: UI components fetch enabled tools via API to avoid passing sensitive handlers and configs to client-side code.
- **Single API Router**: All tool API calls route through `/api/tools/[tool]/[endpoint]` which uses `tool.handlers[endpoint]` for execution.
- **Tool Addition**: New tools require ONLY 3 steps: create tool definition, import in tools/index.ts, and set environment variables.
- **UI Filtering**: Only enabled tools appear in the dashboard UI and sidebar; disabled tools don't register in active UI or API routing. Widgets are only displayed for enabled tools that have both widget definitions and API endpoints configured.
- **Refresh Configuration**: Tools can configure `refreshInterval` in widget definitions for automatic data polling (e.g., Jira refreshes every 5 minutes). Refresh intervals should be appropriate to data update frequency to balance real-time updates with API rate limits.

## Activity System & Livefeed

- **Realtime Activity Feed**: Activity feed automatically refreshes every 15 seconds with polling intervals, matching widget realtime behavior. Includes tab visibility refresh when returning to dashboard tab.
- **Enhanced Context Information**: Activity items now include comprehensive metadata for better understanding:
  - **Repository/Project Context**: Shows the repository (GitHub/GitLab) or project (Jira) where the activity occurred
  - **Branch Information**: Displays branch names for code-related activities (pushes, PRs/MRs)
  - **Commit Counts**: Shows the number of commits in push events
  - **Status Indicators**: Displays current status of issues/PRs/MRs (open, closed, merged, etc.) with color-coded badges
  - **Assignee Information**: Shows who items are assigned to (when different from the activity author)
  - **Labels/Tags**: Displays applicable labels and tags on issues and pull requests
- **Activity Handlers**: Tools that provide activity data (`capabilities: ['activity']`) should include `url` and `displayId` fields in activity responses for clickable navigation links, plus optional metadata fields (`repository`, `branch`, `commitCount`, `status`, `assignee`, `labels`). When GitLab's events API doesn't provide `target_url` or `project_path` fields, the system automatically constructs URLs using the web URL pattern (`https://gitlab.com/{project_path}/-/issues/{target_iid}` for issues, `/-/merge_requests/{target_iid}` for MRs) by fetching project details via the project ID.
- **Clean Context Display**: Metadata is displayed as secondary information below activity descriptions using compact badges, ensuring the main activity description remains readable while providing rich context.
- **Livefeed Navigation**: Activity items display hyperlinks on the right side for:
  - GitHub PR/issue numbers (**#123**)
  - GitLab MR/issue numbers (**!456**, **#789**)
  - Jira ticket keys (**PROJ-123**)
  Push events show descriptive text only (no hyperlinks) to avoid 404 errors from GitLab URL limitations.
- **Clean Descriptions**: Activity descriptions should not duplicate item identifiers - ticket keys are displayed as hyperlinks instead of prefixed text (e.g., use "Issue title" + **PROJ-456** hyperlink, not "PROJ-456: Issue title").
- **Navigation Security**: All activity hyperlinks open in new tabs with `target="_blank"` and `rel="noopener noreferrer"` for security.
- **Status Color Coding**: Status badges use consistent color schemes across the dashboard:
  - Green: open, active, success states
  - Red: closed, failed states
  - Purple: merged, special states
- **Tool-Specific Formatting**:
  - GitHub: `#` prefix for PR/issue numbers (**#123**)
  - GitLab: `!` prefix for merge requests, `#` prefix for issues (**!789**, **#123**)
  - Jira: Bare ticket keys (**PROJ-456**)
- **Loading Experience**: Livefeed features smooth, professional loading states with shimmer skeleton animations and background refresh functionality. Skeletons are displayed only during initial loading to provide visual feedback. During refresh operations (manual refresh, automatic polling, or tab visibility changes), activities remain fully visible and interactive to prevent jarring visual "flash" - users maintain full interaction capability while new data loads seamlessly in the background.

## Environment Configuration

- **Template File**: Use `.env.local.sample` as the template for environment variables (this file is committed to version control).
- **Local Setup**: Copy `.env.local.sample` to `.env.local` for local development (`.env.local` is ignored by git for security).
- **Tool Variables**: Add `ENABLE_TOOL_NAME=true/false` variables for each new tool in both `.env.local.sample` and `.env.local`.
- **API Credentials**: Include placeholder environment variables for API tokens, URLs, and authentication details when adding new tools.
- **Security**: Never commit real API keys or sensitive credentials - only placeholder values in `.env.local.sample`.
- **Server-Side Access**: Read environment variables in server components/pages only to avoid hydration mismatches.

## Development Process

1. **Planning Phase**: Use PLAN MODE to discuss new features, UI/UX changes, or integrations with additional tools.
2. **Implementation Phase**: Switch to ACT MODE to create components, update layouts, and test functionality.
3. **Tool Integration Phase**: Adding new tools requires ONLY 3 steps:
   - Create `tools/newtool/index.ts` with complete tool definition including handlers
   - Import and register in `tools/index.ts` (1 line)
   - Set environment variables (`ENABLE_NEWTOOL=true`)
4. **Testing Phase**: Verify responsive design, dark mode compatibility, and cross-browser functionality.
5. **Documentation Phase**: Update relevant documentation files with new features and usage instructions.

### Tool Addition Checklist
- ✅ Create tool definition with `apis`, `handlers`, `widgets`, and `types.ts` properties
- ✅ Define tool-specific TypeScript interfaces in `tools/[tool]/types.ts`
- ✅ Import local types in `tools/[tool]/index.ts`
- ✅ Register tool in `tools/index.ts`
- ✅ Set environment variables in `.env.local`
- ✅ Test API endpoints work at `/api/tools/[tool]/[endpoint]`
- ✅ Verify widgets appear in dashboard automatically
- ✅ Confirm sidebar fetches enabled tools from `/api/tools/enabled` endpoint

## Workflow Automation

To streamline development processes and ensure consistent implementation of these principles, executable Cline workflows are available in the `.clinerules/workflows/` directory:

- **`add-new-tool.md`**: Automates the complete tool integration process with proper registry-driven architecture, TypeScript interfaces, and security practices
- **`tool-review.md`**: Comprehensive validation checklist for newly added tools against all architectural requirements
- **`component-creation.md`**: Component development workflow following hook-first pattern, size limits, and responsive design standards

These workflows operationalize the above principles by:
- Enforcing proper PLAN/ACT mode transitions
- Implementing step-by-step tool usage with user confirmation
- Following the hook-first pattern for state management
- Applying the 100-line component size limit with decomposition strategies
- Ensuring proper Next.js patterns for hydration and routing
- Maintaining security practices throughout development
