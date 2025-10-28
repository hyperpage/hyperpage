# Coding Style - Hyperpage

This document outlines the coding standards and style guidelines for the Hyperpage project.

## Code Standards

- Use TypeScript for all new code
- Follow React best practices for component structure
- Implement responsive design with Tailwind CSS
- Maintain type safety across interfaces and components
- Use descriptive variable and function names

## Component Development

- Create reusable, modular components
- Support dark/light themes using Tailwind's `dark:` classes
- Ensure responsive behavior for mobile to desktop
- Include proper TypeScript interfaces for props
- Add loading and error states where appropriate

## State Management

- Use React hooks for component-level state
- Avoid complex global state for simple widgets
- Design components for easy data source integration

## Testing and Quality

- Test responsive design across devices
- Verify dark mode compatibility
- Ensure cross-browser functionality
- Validate component behavior with real tool API data
- Test empty state handling when no tools are enabled
- Verify tool widget loading and error states

## Dashboard-Specific Rules

### Component Structure
- **shadcn/ui Components**: Use shadcn/ui components built on Radix UI primitives for consistent design system
- **Modular Design**: Keep components focused on single responsibilities. Widget components should be reusable and configurable.
- **Dark Mode Support**: All components must properly support both light and dark themes using CSS custom properties and theme-aware styling.
- **Responsive Design**: Components should adapt from mobile (1 column) to desktop (4+ column) layouts using Tailwind's responsive prefixes.
- **TypeScript**: All components and interfaces must be fully typed with proper TypeScript interfaces.
- **Consistent Styling**: Use the established color palette and design tokens throughout the application.
- **Integration Status Colors**: Tool status indicators in the sidebar use fixed teal color (bg-teal-600) for connected state to maintain consistent visual design across theme switches, separate from shadcn primary colors that change with themes.
- **Clean Implementation**: Code compiles successfully with TypeScript and builds without errors. ESLint is configured to ignore build artifacts (`.next/` directory, `next-env.d.ts`) while maintaining source code quality standards, following all TypeScript best practices for const declarations and unused variable removal.

### Layout and Spacing
- **Encapsulated Padding**: Main content areas (grids, feeds) should be wrapped with `<div className="p-6">` at the portal level instead of applying `pt-6` or padding directly to individual components.
- **Consistent Tab Spacing**: All tab content (overview, tools, etc.) should have uniform spacing from the tab bar through portal-level padding encapsulation.
- **Component Spacing**: Components should not manage their own top padding for portal integration - this should be handled at the container level.

## Next.js Patterns

### Hydration Handling
- **Environment Variables**: Access `process.env` in server components/pages only, not client components.
- **Props Pattern**: Pass environment-dependent data as props from server components to client components.
- **No Client-Side Environment Access**: Avoid reading environment variables in `"use client"` components during render.
- **SSR Consistency**: Ensure server-rendered HTML matches client hydration to prevent recovery errors.

### Route Handler API
- **Next.js 15 Route Handlers**: Use async parameter destructuring for dynamic routes. Import and use `NextRequest` instead of `Request`.
- **Parameter Access**: Access dynamic params via `context.params` Promise: `const { paramName } = await context.params;`
- **Function Signature**: Use `(request: NextRequest, context: { params: Promise<{ ... }> }) => ...` instead of interface-based destructuring
- **Consistency**: All dynamic routes in `/api/tools/` follow this pattern for type safety and Next.js 15 compatibility.
