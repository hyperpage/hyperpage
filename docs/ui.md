# UI Documentation - Hyperpage

This document provides comprehensive documentation of Hyperpage's user interface architecture, design system, and interaction patterns.

## Overview

Hyperpage is a portal application that aggregates data from multiple development tools (GitHub, GitLab, Jira, etc.) into a unified, real-time interface. The UI is built with Next.js 15, Tailwind CSS, and custom component library, featuring a professional design system with full dark/light mode support.

### Design Philosophy

- **Minimalist Flat Design**: Clean, shadow-free interface that prioritizes content over visual effects, creating a modern flat aesthetic
- **Real-time Experience**: Seamless data updates with loading states and smooth transitions
- **Accessibility First**: WCAG-compliant components with comprehensive keyboard navigation
- **Cross-Platform Consistency**: Responsive design that works seamlessly across devices
- **Optimized Tailwind Architecture**: Modern design system built with Tailwind CSS configuration instead of CSS variables for better maintainability and performance

## Layout Structure

### Main Layout Components

#### Root Layout (`app/layout.tsx`)

- Top-level Next.js layout providing global styles and theme context
- Includes font loading (Inter, JetBrains Mono) and base CSS reset
- Manages dark mode initialization from localStorage and system preferences

#### Page Component (`app/page.tsx`)

- Main entry point that fetches enabled tools via `/api/tools/enabled`
- Conditionally renders either DashboardEmptyState (loading) or Dashboard component
- Manages tool configuration loading with error handling

#### Dashboard Container (`app/components/Dashboard.tsx`)

- Primary container component with fixed header layout
- Manages global state: dark mode, active tab, search query
- Coordinates data fetching via custom hooks (`useToolData`)
- Implements polling mechanisms for real-time updates

### Layout Hierarchy

```
┌─────────────────────────────────────────────────┐
│ TopBar (Fixed, 64px)                           │
│ ├─ Logo                                     │
│ ├─ Search Input                             │
│ ├─ Integrations Dropdown                    │
│ ├─ Notifications Button                     │
│ ├─ Global Refresh Button                    │
│ └─ Dark Mode Toggle                         │
├─────────────────────────────────────────────────┤
│ TabNavigation (Fixed, 48px)                   │
│ ├─ Overview Tab                              │
│ └─ Discovery Tab                             │
├─────────────────────────────────────────────────┤
│ Main Content (Scrollable, Full Remaining)     │
│ └─ Conditional Content:                       │
│    ├─ PortalOverview (Overview Tab)       │
│    └─ ToolConfiguration (Discovery Tab)      │
└─────────────────────────────────────────────────┘
```

### Fixed Positioning Strategy

The layout uses strategic fixed positioning to create an app-like experience:

- **TopBar**: `fixed top-0` with `z-50` and backdrop blur for premium feel
- **TabNavigation**: `fixed top-16` (64px offset) with `z-40`
- **Content Area**: `fixed top-28` (112px offset) with full height and overflow scrolling

This creates a persistent navigation experience while allowing content to scroll beneath the fixed headers.

## Component Architecture

### Page Components

#### DashboardOverview (`app/components/PortalOverview.tsx`)

- Renders tool widgets in responsive grid layout
- Implements real-time search across all widget data
- Handles loading states and data filtering
- Coordinates with ToolWidgetGrid for widget rendering

#### ToolWidgetGrid (`app/components/ToolWidgetGrid.tsx`)

- Responsive grid container for tool widgets
- Dynamic column sizing (1-4 columns based on screen size)
- Empty state handling when no tools are enabled
- Loading state coordination across widgets

### UI Primitive Components (Custom Tailwind Components)

All UI components are built with custom Tailwind CSS classes for consistency and accessibility:

- **Badge**: Status indicators, metadata tags, action labels
- **Button**: Primary actions, secondary actions, icon buttons
- **Card**: Content containers with optional headers/footers
- **Input**: Text inputs with focus states and validation styles
- **Table**: Data tables with sorting and pagination
- **Pagination**: Multi-page content navigation

## Design System

### Color System (Tailwind Configuration)

Hyperpage uses OkLCH color space for perceptually uniform colors and better theme adaptation, now properly configured through Tailwind CSS instead of CSS variables:

#### Tailwind Configuration (`tailwind.config.js`)

```javascript
colors: {
  background: 'oklch(1 0 0)',        /* Pure white */
  foreground: 'oklch(0.095 0 0)',    /* Near black text */
  primary: 'oklch(0.55 0.15 180)',   /* Blue primary (light) */
  'primary-foreground': 'oklch(0.985 0 0)',
  // ... additional semantic colors
},
dark: {
  background: 'oklch(0.145 0 0)',    /* Dark blue-gray */
  foreground: 'oklch(0.985 0 0)',    /* Near white text */
  primary: 'oklch(0.65 0.18 180)',   /* Bright blue primary (dark) */
  // ... dark theme variants
}
```

#### Design System Benefits

- **Standard Tailwind**: Colors integrate with Tailwind's utility classes
- **Maintainable**: Changes made in `tailwind.config.js` affect entire theme
- **Performance**: Smaller CSS bundle by eliminating 200+ custom variables
- **Developer Experience**: Standard Tailwind autocomplete and tooling support

#### Semantic Color Roles

- **Primary**: Interactive elements and call-to-actions
- **Secondary**: Supporting buttons and less important actions
- **Muted**: Subtle backgrounds and secondary text
- **Accent**: Highlight states and hover effects
- **Destructive**: Error states and destructive actions
- **Success/Warning/Info**: Status communication

### Typography System

#### Inter Font Family

- **Primary**: Regular weight for body text and UI elements
- **Medium**: Emphasized elements and secondary headings
- **Semi-Bold/Semi-Bold**: Primary headings and strong emphasis

#### Systematic Scale

```css
--text-xs: 0.75rem /* 12px - Captions, metadata */ --text-sm: 0.875rem
  /* 14px - Secondary text, labels */ --text-base: 1rem
  /* 16px - Body text, default UI */ --text-lg: 1.125rem
  /* 18px - Large body text */ --text-xl: 1.25rem /* 20px - Small headings */
  --text-2xl: 1.5rem /* 24px - Section headings */ --text-3xl: 1.875rem
  /* 30px - Large headings */;
```

### Spacing System

Consistent spacing scale integrated with Tailwind:

```css
--space-1: 0.25rem /* 4px  - Tight spacing */ --space-2: 0.5rem
  /* 8px  - Default component margin */ --space-3: 0.75rem
  /* 12px - Element separation */ --space-4: 1rem /* 16px - Card padding */
  --space-6: 1.5rem /* 24px - Section spacing */ --space-8: 2rem
  /* 32px - Page section margins */ --space-12: 3rem
  /* 48px - Major layout spacing */;
```

### Flat Design System

Hyperpage adopts a flat design approach without traditional shadows or elevation:

```css
--shadow-sm: 0 0 #0000 /* No elevation - flat design */ --shadow: 0 0 #0000
  /* Flat surfaces */ --shadow-md: 0 0 #0000 /* No hover elevation */
  --shadow-lg: 0 0 #0000 /* Flat modals and popups */ --shadow-xl: 0 0 #0000
  /* Flat maximum states */;
```

**Design Decision**: Shadows have been intentionally removed to create a clean, modern flat aesthetic that prioritizes content over visual effects. Visual hierarchy is achieved through color, typography, and spacing rather than elevation.

### Border Radius System

Systematic border radius scale for consistent corner styling:

```css
--radius-xs: 0.125rem /* 2px  - Sharp corners */ --radius-sm: 0.25rem
  /* 4px  - Subtle rounding */ --radius: 0.375rem
  /* 6px  - Default component rounding */ --radius-md: 0.5rem
  /* 8px  - Larger components */ --radius-lg: 0.75rem
  /* 12px - Cards, buttons */ --radius-xl: 1rem /* 16px - Large containers */
  --radius-2xl: 1.5rem /* 24px - Special elements */;
```

## Interactive Elements

### Search Functionality

Global search system integrated into TopBar:

- **Real-time Filtering**: Instant results as you type across all enabled tools
- **Multi-match Logic**: Boolean OR search across title, description, repository, branch, etc.
- **Visual Feedback**: Search query persistence with clear button
- **Empty States**: Helpful messaging when no results found

### Real-time Updates

Comprehensive data refreshing system:

- **Auto-polling**: Tool widgets refresh automatically (configurable intervals)
- **Manual Refresh**: Global refresh button in TopBar
- **Background Loading**: New data loads seamlessly without visual disruption
- **Loading Indicators**: Skeleton animations and shimmer effects during refreshes

### Status Indicators

Visual status communication throughout the interface:

- **Tool Integration Status**: Color-coded status badges (connected/disabled/error)
- **Content Status**: Action badges for activities (merged, closed, open)
- **Loading States**: Skeleton components and animated buttons
- **Error States**: Red accent colors and helpful error messages

## Responsive Design

### Breakpoint Strategy

Tailwind-based responsive design with semantic breakpoints:

- **Mobile** (`sm:768px`): Single column, collapsed navigation, stacked elements
- **Tablet** (`md:1024px`): Two-column grids, adjusted spacing, compact tool widgets
- **Desktop** (`lg:1280px`): Multi-column portals, expanded layouts, full feature set
- **Large Desktop** (`xl:1536px`): Optimized for wide displays, maximum information density

### Layout Adaptations

#### Mobile (< 768px)

- TopBar collapses with hamburger menu for secondary actions
- Tab navigation becomes bottom navigation or horizontal scroll
- Widget grid becomes single column
- Search input spans full width

#### Tablet (768px - 1024px)

- Compact TopBar with reduced spacing
- 2-column widget grid in overview
- Stacked items with condensed metadata

#### Desktop (1024px+)

- Full TopBar with all controls visible
- 3-4 column responsive widget grid
- Timeline layout for content presentation with expanded metadata

## Data Visualization

### Dashboard Overview

Widget-based data presentation system:

- **Grid Layout**: Responsive columns (1-4) based on available space
- **Customizable Widgets**: Each tool defines its own widget configuration
- **Dynamic Data**: Real-time data loading with fallback to mock data
- **Search Integration**: Real-time filtering of widget content

### Content Presentation

Rich, timeline-based content visualization:

- **Chronological Timeline**: Newest content at top with relative timestamps
- **Rich Metadata**: Repository, branch, tags, and classifications
- **Content Blocks**: Expandable sections for commits and descriptions
- **Interactive Elements**: Clickable navigation to external resources

### Loading & Empty States

Sophisticated state management for all data scenarios:

#### Loading States

- **Skeleton Components**: Content-shaped placeholders that match final layout
- **Shimmer Animation**: Subtle loading animation that moves across content
- **Progressive Disclosure**: Content loads in logical order (headlines first, details second)

#### Empty States

- **Helpful Messaging**: Clear instructions for resolving empty states
- **Action Buttons**: Direct users to enable tools or configure integrations
- **Contextual Design**: Empty states match the visual style of loaded content

## Accessibility & UX Patterns

### Keyboard Navigation

- **Tab Order**: Logical tab sequence through all interactive elements
- **Focus Management**: Visible focus indicators that meet WCAG contrast requirements
- **Keyboard Shortcuts**: Standard shortcuts (Ctrl+F for search, Esc to close modals)

### Screen Reader Support

- **ARIA Labels**: Comprehensive labeling for all interactive elements
- **Semantic Markup**: Proper use of headings, landmarks, and roles
- **Live Regions**: Screen reader announcements for dynamic content updates

### Performance Optimizations

#### Component Optimization

- **React.memo**: Applied to frequently re-rendering components (widgets)
- **Hook Dependencies**: Optimized dependency arrays in custom hooks
- **Conditional Rendering**: Components only render when data is available

#### Animation Performance

- **CSS-based Animations**: Hardware-accelerated transforms and opacity changes
- **Staggered Animations**: `delay-0.1s`, `delay-0.2s` classes for smooth reveals
- **Reduced Motion**: Respects `prefers-reduced-motion` user preference

#### Bundle Optimization

- **Next.js 15 Features**: React Server Components where appropriate
- **Dynamic Imports**: Lazy-loaded components for secondary routes
- **Component Size Limits**: <100 lines per component with decomposition strategy

## Theme System Architecture

### Dark/Light Mode Implementation

Complete theme system with automatic and manual controls:

#### Theme Detection

- **System Preference**: Automatic switching based on `prefers-color-scheme`
- **LocalStorage Persistence**: User selections saved across sessions
- **Runtime Switching**: Instant theme transitions without page reload

#### CSS Variable Strategy

- **Theme Variants**: Separate light/dark variable definitions
- **Cascade Inheritance**: Variables override based on presence of `.dark` class
- **Component Consistency**: All components use semantic variable names, not hardcoded colors

#### Icon & Asset Management

- **Theme-aware Icons**: Automatic switching based on theme context
- **HyperpageLogo**: Theme-aware component with `isDark` prop
- **Favicon**: Theme-appropriate favicon selection

## State Management Patterns

### Hook-first Architecture

Custom hooks as primary state management pattern:

#### useToolData Hook

```typescript
const {
  dynamicData, // Real-time data from APIs
  loadingStates, // Per-tool loading states
  refreshToolData, // Individual tool refresh
  refreshAllData, // Global refresh
  initializePolling, // Setup auto-refresh
} = useToolData({ enabledTools });
```

#### ContentState Hook

```typescript
const {
  refreshContent, // Manual content refresh
  isRefreshing, // Content refresh state
} = useContentState();
```

### Component State Patterns

- **Local Component State**: Simple boolean/selected states (activeTab, isDark)
- **Derived State**: Computed values from props (filtered data, search results)
- **Side Effects**: Optimized useEffect hooks for API calls and theme initialization

## Error Handling & Resilience

### User-friendly Error States

- **Generic Error Messages**: Security-conscious error display
- **Retry Mechanisms**: Automatic retry for transient failures
- **Graceful Degradation**: App remains functional during partial failures
- **User Guidance**: Clear next-steps when errors occur

### Data Resilience

- **Fallback Content**: Mock data when APIs are unavailable
- **Partial Loading**: Individual tool failures don't break entire portal
- **Offline Capability**: Basic functionality without network connectivity
- **Recovery Actions**: Manual refresh and reconnection options

## Development & Maintenance

### Component Guidelines

- **Single Responsibility**: Each component has one clear purpose
- **Type Safety**: Full TypeScript coverage with strict interfaces
- **Reusability**: Generic components that work across tools
- **Testing**: All components include corresponding test files

### Code Organization

- **Feature-based Structure**: Components grouped by domain (portal)
- **Shared Components**: Reusable UI primitives in `components/ui/`
- **Custom Hooks**: Business logic encapsulated in `hooks/` directory
- **Configuration Management**: Environment variables in `.env.local.sample`

### Testing Strategy

- **Component Tests**: Visual and interaction testing with Vitest
- **Integration Tests**: End-to-end workflows with Playwright
- **Accessibility Tests**: Automated a11y testing in CI pipeline
- **Performance Tests**: Bundle analysis and lighthouse scores

---

This documentation provides a foundation for understanding and extending Hyperpage's UI architecture. For implementation details on specific components, refer to the individual component files and their TypeScript interfaces.
