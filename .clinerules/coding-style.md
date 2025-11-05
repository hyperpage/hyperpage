# Code Standards - Hyperpage

This document outlines the coding standards, style guidelines, and implementation patterns for the Hyperpage project.

## Code Standards

- **TypeScript First**: Use TypeScript for all new code with proper type definitions
- **React Best Practices**: Follow established React patterns for component structure and lifecycle
- **Tailwind CSS**: Implement responsive design with Tailwind's utility classes
- **Type Safety**: Maintain strict type safety across interfaces and components
- **Descriptive Naming**: Use clear, descriptive variable and function names

## Component Development Standards

### Component Architecture

- **Single Responsibility**: Each component should have one clear purpose and responsibility
- **Component Size Limit**: No component should exceed 100 lines - decompose larger components
- **Presentation vs Logic**: UI components should focus on presentation; logic goes into custom hooks or services
- **React.memo Optimization**: Apply React.memo to components that render frequently to prevent unnecessary re-renders

### UI Component Guidelines

- **shadcn/ui Integration**: Use shadcn/ui components built on Radix UI primitives for consistent design system
- **Dark Mode Support**: All components must properly support both light and dark themes using CSS custom properties and theme-aware styling
- **Responsive Design**: Components should adapt from mobile (1 column) to desktop (4+ column) layouts using Tailwind's responsive prefixes
- **Modular Design**: Widget components should be reusable and configurable with proper TypeScript interfaces
- **Status Indicators**: Tool status indicators use fixed teal color (bg-teal-600) for consistent visual design across theme switches

### Layout and Spacing Patterns

- **Encapsulated Padding**: Main content areas (grids, feeds) should be wrapped with `<div className="p-6">` at the portal level
- **Consistent Tab Spacing**: All tab content should have uniform spacing from the tab bar through portal-level padding
- **Component Spacing**: Components should not manage their own top padding - handled at container level

## State Management

- **React Hooks**: Use React hooks for component-level state management
- **Custom Hooks**: Extract complex stateful logic into reusable custom hooks before component implementation
- **Avoid Global State**: Avoid complex global state for simple widgets
- **Data Integration**: Design components for easy data source integration

## Next.js Implementation Patterns

### Hydration and Environment Handling

- **Environment Variables**: Access `process.env` in server components/pages only, not client components
- **Props Pattern**: Pass environment-dependent data as props from server components to client components
- **SSR Consistency**: Ensure server-rendered HTML matches client hydration to prevent recovery errors

### API Route Handlers

- **Next.js 15 Compatibility**: Use async parameter destructuring for dynamic routes
- **Type Safety**: Import and use `NextRequest` instead of `Request`
- **Parameter Access**: Access dynamic params via `context.params` Promise: `const { paramName } = await context.params;`
- **Consistency**: All dynamic routes in `/api/tools/` follow this pattern for type safety

## Quality Assurance

### TypeScript & ESLint Prevention Framework

#### Pre-Implementation Validation

- **Type Check First**: Run `tsc --noEmit` before starting any component implementation
- **Interface Definition**: Define complete TypeScript interfaces before writing logic
- **ESLint Pre-Check**: Validate ESLint compliance before beginning development
- **Staged Development**: Follow validation checkpoints at 20-line intervals

#### Development Workflow

- **Stage 1 (Lines 1-20)**: Complete interface/types, validate compilation, no implicit `any`
- **Stage 2 (Lines 21-50)**: All parameters typed, return types explicit, ESLint compliant
- **Stage 3 (Lines 51-80)**: Props fully typed, hooks type-safe, error handling typed
- **Stage 4 (Completion)**: Full validation, no unused code, build success required

#### Automated Prevention

- **Pre-Commit Hooks**: Automatically validate TypeScript and ESLint before commits
- **IDE Integration**: Configure VS Code for real-time type checking and linting
- **Build Pipeline**: Integrate validation into development workflow
- **Quality Gates**: Require validation at each development milestone

### Code Quality

- **ESLint Compliance**: Follow established linting rules, ignore build artifacts (`.next/`, `next-env.d.ts`)
- **Build Success**: Code must compile successfully with TypeScript and build without errors
- **Type Safety**: Follow TypeScript best practices for const declarations and unused variable removal

### Testing Standards

- **Responsive Testing**: Test responsive design across devices and breakpoints
- **Theme Compatibility**: Verify dark mode compatibility across all components
- **Cross-Browser**: Ensure cross-browser functionality
- **Component Behavior**: Validate component behavior with real tool API data
- **Edge Cases**: Test empty state handling and error states

## Cross-References

### Depends On

- [Coding Principles](coding-principles.md) - Architectural patterns and component systems
- [Security Practices](security-practices.md) - Security standards and validation

### Extends

- **Core Standards**: Implements general coding standards for the Hyperpage project context
- **Component Patterns**: Extends basic coding principles with specific implementation guidelines

### See Also

- [Documentation Guidelines](documentation-guidelines.md) - Documentation standards and processes
- [Configuration Guidelines](configuration-guidelines.md) - Environment and setup configuration

## Quality Checklist

- [ ] TypeScript strict mode compliance
- [ ] Component size under 100 lines
- [ ] Proper TypeScript interfaces for all props
- [ ] Responsive design implementation
- [ ] Dark mode compatibility
- [ ] ESLint compliance
- [ ] Next.js 15 pattern adherence
- [ ] Test coverage for critical functionality

## Migration Notes

This document consolidates coding standards and style guidelines into a single authoritative source, replacing scattered style references across multiple files.
