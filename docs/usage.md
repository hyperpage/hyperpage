# Usage Guide

This guide covers advanced usage of the Hyperpage dashboard, including navigation, features, and workflows.

## Dashboard Overview

The Hyperpage dashboard consolidates data from multiple developer tools into a unified interface with three main areas:

### Top Bar (64px, Fixed)
- **Logo**: Clickable link to refresh the dashboard
- **Global Search**: Search across all tool data (real-time filtering)
- **Settings Dropdown**: Configure integrations (notifications and theme toggles coming soon)
- **Theme Toggle**: Switch between light and dark modes

### Tab Navigation (48px, Fixed)
Three main tabs for different views:
- **Overview**: Real-time widgets showing tool data
- **Livefeed**: Activity stream from all connected platforms
- **Communication**: Unified messaging interface (planned)

### Main Content Area
Responsive grid layout that adapts from mobile (1 column) to desktop (2+ columns).

## Dashboard Tabs

### Overview Tab

The main dashboard view displaying real-time data from all enabled tools.

#### Widget System
- **Automatic Data Loading**: Widgets populate automatically when tools are enabled
- **Real-time Updates**: Data refreshes every 5 minutes (configurable per widget)
- **Responsive Grid**: Widgets stack on mobile, spread across columns on desktop
- **Tool Attribution**: Each widget clearly shows its source tool

#### Available Widgets

**Individual Tool Widgets:**
- **GitHub**: Repository list, recent commits, workflow status
- **GitLab**: Merge requests, pipelines, project activity
- **Jira**: Issues by status, sprint progress, team assignments

**Aggregated Views:**
- **Code Reviews**: Combined PRs/MRs from GitHub + GitLab
- **CI/CD**: Unified pipelines from GitLab + GitHub Actions
- **Ticketing**: Combined issues from Jira + GitHub + GitLab

#### Widget Features
- **Manual Refresh**: Click refresh icon to update data immediately
- **Loading States**: Smooth transitions with skeleton loading
- **Error Handling**: Failed loads show user-friendly messages with retry options
- **Time Sorting**: All timeline data sorted with newest items first

### Livefeed Tab

Real-time activity aggregation from all connected platforms featuring rich content cards.

#### Activity Features
- **1-Minute Auto-Refresh**: Activity updates automatically every minute
- **Cross-Platform Events**: Combines GitHub, GitLab, Jira, and future tools
- **Rich Content Cards**: Enhanced activity items showing actual content
- **Contextual Metadata**: Repository, branch, assignees, labels, and status
- **Navigation Links**: Click to open items in their original platforms
- **Status Indicators**: Color-coded badges for issue/MR states

#### Rich Content Enhancement
The livefeed now displays meaningful content instead of just basic action descriptions:

**Content Types:**
- **GitHub Commits** 🔵: Shows actual commit messages for each push event using GitHub Compare API (e.g., "Fix authentication bug in user registration")
- **GitLab Commits** 🟠: Displays commit messages using GitLab Compare API for push events
- **Jira Descriptions** 🟢: Displays issue descriptions extracted from Atlassian Document Format
- **Git Comments** 🟣: Future support for code review and issue comments
- **Change Details** 🟡: Future support for field change summaries

**Visual Design:**
- **Color-Coded Cards**: Different border colors and icons for each content type
- **Content Truncation**: Smart 150-character limits with ellipsis for readability
- **Author Attribution**: Shows who made commits or comments when available
- **Progressive Disclosure**: Up to 3 content items per activity with expansion option

#### Activity Types
- **Code Events**: Commits with message details, PRs/MRs with rich descriptions
- **Issue Updates**: Status changes with full issue context and descriptions
- **CI/CD Events**: Pipeline results with commit information linkage
- **Team Activity**: Member assignments with enhanced issue details

#### Filter & Search
- **Real-Time Search**: Filter activities by content, author, or tool
- **Result Counts**: See total matches as you type
- **Context Preservation**: Filters persist during tab switches
- **Performance**: Efficient pagination with large activity volumes

## Navigation & Search

### Global Search
Located in the top bar, provides instant search across all tool data:

- **Real-Time Filtering**: Results update as you type
- **Cross-Tool Search**: Find content from any enabled platform
- **Result Categories**: Grouped by tool and data type
- **Keyboard Navigation**: Arrow keys and enter to navigate results
- **Direct Links**: Click to open items in source platforms

### Tool Integration Status
- **Sidebar Indicators**: Green dots show connected tools
- **Connection Health**: Real-time status for each integration
- **Configuration Links**: Quick access to settings pages
- **Dependency Mapping**: See how tools relate across aggregations

## Responsive Design

### Mobile Experience (< 768px)
- **Single Column**: Widgets stack vertically for easy scrolling
- **Touch Optimized**: Large touch targets and swipe gestures
- **Collapsed Navigation**: Bottom tab bar matches iOS/Android patterns
- **Readable Text**: Appropriate sizing for mobile screens

### Tablet Experience (768px - 1024px)
- **Two Column Grid**: Balanced layout without crowding
- **Landscape Optimization**: Better use of wider screens
- **Navigation**: Fixed top bar with accessible tab switching

### Desktop Experience (> 1024px)
- **Multi-Column Layout**: 2-3 columns maximize information density
- **Hover States**: Enhanced interactions with mouse and keyboard
- **Extended Controls**: Additional configuration options
- **Performance**: Optimized rendering for large datasets

## Configuration & Customization

### Environment-Based Tool Management
- **Enable/Disable Tools**: Set `ENABLE_TOOL=true/false` in `.env.local`
- **Restart Required**: Changes take effect after server restart
- **Automatic Discovery**: New tools appear in UI without code changes

### Advanced Configuration Options
```env
# Tool-Specific Settings
ENABLE_CODE_REVIEWS=true  # Aggregated code review view
ENABLE_CICD=true         # Unified CI/CD pipeline view
ENABLE_TICKETING=true    # Combined ticketing dashboard

# Performance Tuning
DATA_REFRESH_INTERVAL=300000  # 5 minutes (milliseconds)
ACTIVITY_FEED_LIMIT=50       # Max activity items

# URL Configuration
JIRA_WEB_URL=https://your-domain.atlassian.net
GITLAB_WEB_URL=https://gitlab.com
```

### Security & Permissions
- **Server-Side Token Storage**: Credentials never reach client browser
- **Scope-Based Access**: Tools respect GitHub/GitLab permission levels
- **Audit Trail**: All API calls logged server-side for debugging
- **Token Rotation**: Easy to update tokens without downtime

## Data Management

### Real-Time Updates
- **Background Refresh**: Data updates without user interaction
- **Smart Polling**: Configurable intervals based on tool type
- **Change Detection**: Only fetches when new data is available
- **Offline Handling**: Graceful degradation during connectivity issues

### Data Privacy
- **Local Processing**: Sensitive data never leaves your infrastructure
- **API Direct Connection**: Dashboard connects directly to tool APIs
- **Token Isolation**: Each tool's credentials are sandboxed
- **Audit Compliance**: Server-side logging without client exposure

## Troubleshooting Common Issues

### Tools Not Appearing
1. Check `ENABLE_TOOL=true` in `.env.local`
2. Restart development server: `npm run dev`
3. Verify API credentials are correct
4. Check browser console for authentication errors

### Data Loading Slowly
1. Increase refresh intervals for less critical data
2. Disable unused tool integrations
3. Check network connectivity to tool APIs
4. Monitor server logs for rate limiting

### Search Not Working
1. Ensure at least one tool is enabled and configured
2. Check that tool APIs are responding
3. Verify search permissions in tool settings
4. Try specific tool searches if global search fails

### Theme Not Applying
1. Check browser localStorage settings
2. Verify Tailwind CSS is loading correctly
3. Test with different browser themes
4. Check for CSS conflicts with custom styles

## Advanced Features

### Registry-Driven Architecture
The dashboard uses a completely registry-driven architecture where:
- Tools declare their capabilities automatically
- Widgets appear without hardcoded logic
- New integrations extend the system without code changes
- All tool interactions flow through centralized registry

### Custom Integrations
Advanced users can add custom tool integrations by:
1. Creating tool definitions in `tools/` directory
2. Implementing standard interface contracts
3. Registering capabilities for automatic discovery
4. See `docs/api.md` for technical integration details

### Performance Optimization
- **Component Memoization**: Expensive renders are cached
- **Virtual Scrolling**: Large lists use efficient rendering
- **Request Deduplication**: Identical API calls are batched
- **Background Loading**: Non-critical data loads invisibly

## Getting Help

- **Browser Console**: Check for JavaScript errors and warnings
- **Network Tab**: Monitor API call success/failure
- **Server Logs**: Review backend responses and errors
- **Configuration Validation**: Use `npm run validate` for setup issues

For technical integration details and API documentation, see [`docs/api.md`](api.md).
