# Contributing to Hyperpage

We welcome contributions from the community! This guide outlines the development process, coding standards, and workflow for contributing to the Hyperpage dashboard.

## Development Workflow

### PLAN → ACT Mode Principle

Hyperpage uses a structured development workflow:

1. **PLAN Mode**: Discuss features, UI/UX decisions, architectural changes
2. **ACT Mode**: Implement components, code changes, testing

### Development Guidelines

#### Cline AI Assistant Workflow
This project is developed using [Cline](https://cline.bot/), an AI assistant that follows structured development patterns:
- **Mode Switching**: Use PLAN MODE for design discussions, ACT MODE for implementation
- **Step-by-Step Execution**: Each tool use is confirmed before proceeding
- **File Editing Rules**: Target changes with `replace_in_file`, use `write_to_file` sparingly

## Getting Started

### Prerequisites
- **Node.js 18+** and **npm**
- **Git** for version control
- Basic knowledge of **React**, **Next.js**, and **TypeScript**

### Setup
```bash
# Clone the repository
git clone https://github.com/hyperpage/hyperpage.git
cd hyperpage

# Install dependencies
npm install

# Copy environment template
cp .env.local.sample .env.local

# Start development server
npm run dev
```

### Project Structure
```
hyperpage/
├── app/                 # Next.js app directory
│   ├── components/      # React components
│   ├── api/            # API routes
│   └── ...
├── tools/              # Tool integrations (registry-driven)
│   ├── [tool]/         # Individual tool implementations
│   └── index.ts        # Tool registry
├── components/ui/       # shadcn/ui components
├── docs/               # Documentation
├── .clinerules/         # Development rules and workflows
└── ...
```

## Coding Principles

### Component Architecture Patterns

#### Hook-First Pattern
- **Business Logic**: Extract complex logic into custom hooks before components
- **Examples**: `useToolData`, `useActivityData`, `useDarkMode`
- **Benefits**: Reusable logic, cleaner components, better testability

#### Single Responsibility Pattern
- **Component Size Limit**: No component exceeds 100 lines
- **Decomposition Strategy**: Break large components into focused sub-components
- **Clean Interfaces**: Simple, well-defined prop interfaces

#### Performance Optimizations
- **React.memo**: Apply to frequently re-rendering components
- **Custom Hooks**: For expensive computations and data fetching
- **Lazy Loading**: Defer non-critical component loading

### TypeScript Excellence

#### Strict Type Safety
- **Zero `any` Types**: All interfaces properly typed
- **Complete Coverage**: 100% TypeScript compliance
- **Type-First Development**: Define interfaces before implementation

#### Interface Patterns
```typescript
// Tool Definition Interface
interface Tool {
  name: string;           // Display name
  slug: string;           // URL-safe identifier
  capabilities: string[]; // Declared features
  enabled: boolean;       // Environment-controlled
  // ...
}
```

### Service Layer Architecture

#### ApiClient Pattern
- **Consistent Error Handling**: Standardized API error management
- **Request/Response Types**: Fully typed HTTP operations
- **Isolation**: Clean separation between UI and API logic

## Tool Integration System

### Registry-Driven Architecture

Each tool integration follows a standardized pattern:

#### Tool Definition Structure
```typescript
export const myTool: Tool = {
  name: 'My Tool',
  slug: 'my-tool',
  enabled: process.env.ENABLE_MYTOOL === 'true',

  capabilities: ['data-fetching'], // Registry-driven discovery

  ui: {
    color: 'bg-blue-500/10 border-blue-400/30 text-blue-400',
    icon: React.createElement(MyIcon, { className: 'w-5 h-5' })
  },

  apis: {
    'endpoint': {
      method: 'GET',
      response: { dataKey: 'items' }
    }
  },

  handlers: {
    'endpoint': async (request, config) => {
      // Server-side API implementation
      return { items: data };
    }
  },

  widgets: [{
    title: 'Data Display',
    type: 'table',
    dynamic: true
  }]
};
```

#### 3-Step Tool Addition Process
1. **Create Tool Definition**: `tools/mytool/index.ts`
2. **Register Tool**: Add import to `tools/index.ts`
3. **Configure Environment**: Set `ENABLE_MYTOOL=true` and provide tokens

#### Benefits
- **Zero Boilerplate**: No routing code to write
- **Automatic Discovery**: Widgets appear without configuration
- **Type Safety**: Full TypeScript coverage from API to UI
- **Security**: Credentials isolated server-side

## Security Practices

### 🔒 Security-First Development

#### Credential Management
- **Server-Side Only**: API tokens never reach client-side code
- **Environment Variables**: All credentials configured via env vars
- **No Hardcoded Secrets**: Zero credential leakage in source code

#### Input Validation
```typescript
// Strict regex validation for all inputs
const toolPattern = /^[a-zA-Z0-9_%\-\s]+$/;
const endpointPattern = /^[a-zA-Z0-9_%-]+$/;
```

#### Error Handling Security
- **Generic Error Messages**: No sensitive information in client responses
- **Server-Side Logging**: Detailed errors logged without client exposure
- **Graceful Degradation**: Individual tool failures don't crash the system

## Development Environment

### Code Quality Standards

#### Automated Checks
```bash
# TypeScript compilation (no errors)
npm run build

# ESLint (zero warnings)
npx eslint . --max-warnings=0

# Code formatting
npx prettier --check .
```

#### Quality Metrics
- **ESLint Clean**: Zero linting warnings across all files
- **TypeScript Strict**: Zero compilation errors
- **Build Success**: Production builds complete without issues

### Testing Requirements

Hyperpage implements a comprehensive testing strategy with **69 tests** across unit and integration scenarios, recently optimized through codebase cleanup.

#### ✅ Current Testing Status
- **Test Framework**: Vitest + React Testing Library + Playwright E2E
- **Code Quality**: ESLint 67/68 issues resolved (98.5% clean)
- **Build Integration**: All components compile without TypeScript errors
- **Mock Infrastructure**: Properly configured for isolated testing scenarios
- **Coverage Areas**: Time utilities, tool registry, API routes, React hooks

#### Testing Pyramid
```
📊 Testing Status: 58/69 tests passing (84.1% success rate)

🧩 Unit Tests (69 total):
├── lib/time-utils.test.ts        # 15/15 passing ✅
├── tools/registry.test.ts        # 6/6 passing ✅
├── api/enabled.test.ts          # 7/7 passing ✅
├── api/activity.test.ts         # 11/11 undefined (infrastructure optimizations)
├── components/hooks/useActivityData.test.ts  # 13/13 undefined (most act() issues resolved)
└── components/hooks/useToolData.test.ts     # 17/17 undefined (act() wrappers needed)

🌐 E2E Tests (environment configuration needed):
├── dashboard.spec.ts            # Dashboard functionality tests
└── tool-integration.spec.ts     # Tool integration validation
```

#### Running Tests
```bash
# Run all tests once
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage report
npm run test:coverage

# Run tests with UI (optional)
npm run test:ui
```

#### Test Structure
```
__tests__/
├── lib/                    # Utility function tests
│   └── time-utils.test.ts  # Time formatting & sorting functions (6 tests)
├── components/
│   └── hooks/             # Custom hook tests (13 tests)
│       ├── useToolData.test.ts     # Tool data fetching & management
│       └── useActivityData.test.ts # Activity feed & real-time updates
├── api/                   # API route integration tests (25 tests)
│   ├── tool.test.ts      # Individual tool details endpoint
│   ├── enabled.test.ts   # Tool enumeration API
│   └── activity.test.ts  # Activity feed aggregation
└── tools/
    └── registry.test.ts  # Tool registration system (6 tests)

e2e/                       # End-to-End Tests (16 tests)
├── playwright.config.ts   # Multi-browser configuration
├── dashboard.spec.ts      # Dashboard user journeys (8 tests)
└── tool-integration.spec.ts # Tool integration validation (8 tests)
```

## Contribution Process

### Feature Development

1. **Choose Development Mode**
   - Use PLAN MODE for discussing features with Cline
   - Switch to ACT MODE for implementation

2. **Follow Component Patterns**
   - Extract hooks first for business logic
   - Keep components under 100 lines
   - Apply React.memo for optimization

3. **Type Safety First**
   - Define interfaces before implementation
   - Eliminate all `any` types
   - Ensure full TypeScript coverage

4. **Registry-Driven Integration**
   - New tools follow the 3-step pattern
   - Capabilities drive automatic feature discovery
   - Zero hardcoded logic anywhere

### Code Review Checklist

**Architecture & Design**
- [ ] Follows hook-first pattern for stateful logic
- [ ] Components stay under 100-line limit
- [ ] Registry-driven design principles maintained
- [ ] Type safety with zero `any` types

**Security & Quality**
- [ ] No hardcoded credentials or tokens
- [ ] Environment variables used for configuration
- [ ] Input validation implemented for APIs
- [ ] Error messages don't leak sensitive information

**Performance & UX**
- [ ] React.memo applied to frequently re-rendering components
- [ ] Responsive design verified (mobile/tablet/desktop)
- [ ] Loading states and error handling implemented
- [ ] Accessibility considerations included

**Code Quality**
- [ ] ESLint passes with zero warnings
- [ ] TypeScript compilation succeeds
- [ ] Prettier formatting applied
- [ ] Comments added for complex logic

### Pull Request Process

1. **Fork and Branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Development**
   - Follow PLAN → ACT mode workflow
   - Maintain code quality standards
   - Test all changes thoroughly

3. **Commit Standards**
   ```bash
   git commit -m "feat: add dark mode toggle

   - Extract theme logic to useDarkMode hook
   - Add theme switcher to TopBar component
   - Apply React.memo for performance optimization
   - Maintain responsive design across devices"
   ```

4. **Testing**
   - Build succeeds: `npm run build`
   - ESLint clean: `npx eslint . --max-warnings=0`
   - TypeScript clean: `npx tsc --noEmit`

5. **Pull Request**
   - Descriptive title and comprehensive description
   - Reference any related issues
   - Include screenshots for UI changes

### Commit Message Guidelines

```
type(scope): description

[optional body]

[optional footer]
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes
- `refactor`: Code refactoring
- `test`: Testing additions
- `chore`: Maintenance tasks

**Examples:**
```
feat: add GitLab tool integration

- Implement full GitLab API integration
- Add merge requests and pipelines support
- Registry-driven widget discovery
- Type-safe error handling

Closes #123
```

```
fix: resolve Jira authentication errors

- Fix API token validation pattern
- Add rate limiting handling
- Improve error messaging
- Maintain security best practices
```

## Project Governance

### Code of Conduct
- Respectful communication among all contributors
- Professional conduct in all interactions
- Constructive feedback and collaboration
- Inclusive and welcoming environment

### Decision Making
- **Architecture**: Major architectural decisions reviewed by maintainers
- **Security**: Security-related changes require additional review
- **Dependencies**: New dependencies evaluated for necessity and maintenance

### Recognition
Contributors are recognized through:
- GitHub contributor statistics
- Maintainers file updates
- Release notes attribution
- Community acknowledgments

## Resources

### Development Documentation
- [`docs/architecture.md`](architecture.md) - System design principles
- [`docs/api.md`](api.md) - API reference and schemas
- [`docs/usage.md`](usage.md) - User guide and features
- [`docs/installation.md`](installation.md) - Setup and configuration

### Development Rules
The `.clinerules/` directory contains comprehensive development guidelines:

- **[`.clinerules/coding-principles.md`](https://github.com/hyperpage/hyperpage/blob/main/.clinerules/coding-principles.md)** - Core architectural principles
- **[`.clinerules/coding-style.md`](https://github.com/hyperpage/hyperpage/blob/main/.clinerules/coding-style.md)** - Code standards and TypeScript usage
- **[`.clinerules/security-practices.md`](https://github.com/hyperpage/hyperpage/blob/main/.clinerules/security-practices.md)** - Security standards
- **[`.clinerules/configuration-guidelines.md`](https://github.com/hyperpage/hyperpage/blob/main/.clinerules/configuration-guidelines.md)** - Configuration management
- **[`.clinerules/workflows/`](../.clinerules/workflows/)** - Executable workflows

### Getting Help
- **Issues**: Use GitHub issues for bug reports and feature requests
- **Discussions**: Join GitHub discussions for general questions
- **Documentation**: Check existing docs before opening issues

Thank you for contributing to Hyperpage! 🚀
