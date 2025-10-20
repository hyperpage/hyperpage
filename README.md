# Hyperpage

A comprehensive data aggregation dashboard that consolidates information from multiple external tools (GitHub, GitLab, Jira, etc.) into a unified, interactive interface. Built with Next.js, TypeScript, and Tailwind CSS.

## Overview

Hyperpage solves the challenge of scattered development data across multiple platforms. For development teams and project managers, it provides a single pane of glass to monitor code reviews, CI/CD pipelines, tickets, and activity feeds from your entire toolchain.

Connect multiple tools and instantly gain unified visibility into:
- **Code Reviews**: GitHub PRs and GitLab MRs in one view
- **CI/CD Pipelines**: Consolidated pipeline status and workflows
- **Issue Tracking**: Jira tickets alongside GitHub/GitLab issues
- **Activity Feeds**: Real-time updates from all connected platforms

## Quick Start

```bash
# Clone and install
git clone https://github.com/hyperpage/hyperpage.git
cd hyperpage
npm install

# Configure environment
cp .env.local.sample .env.local
# Edit .env.local to enable your tools (see docs/installation.md)

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view your dashboard.

## Usage Examples

**Enable GitHub Integration:**
```env
ENABLE_GITHUB=true
GITHUB_TOKEN=github_pat_...
```

**Add Jira for Ticketing:**
```env
ENABLE_JIRA=true
JIRA_WEB_URL=https://your-domain.atlassian.net
JIRA_EMAIL=your_email@company.com
JIRA_API_TOKEN=ATATT3x...
```

**View Unified Code Reviews:**
Once configured, the dashboard automatically aggregates PRs/MRs from all enabled platforms in the Code Reviews tab.

## Build & Development

### Development Environment
- **Next.js 15.5** with Turbopack for fast development builds
- **TypeScript 5** for type safety
- **React 19** for component architecture
- **Tailwind CSS 4** for styling

### Build Status
✅ **Build Configuration Optimized**
- Production builds use Next.js Turbopack (faster than webpack)
- Development server uses Turbopack for hot reload speed
- All build conflicts resolved, zero configuration warnings

### Quick Commands
```bash
# Start development server (with Turbopack)
npm run dev

# Build for production (with Turbopack)
npm run build

# Start production server
npm run start
```

## Testing

This project maintains a comprehensive testing strategy with Vitest, React Testing Library, and Playwright E2E tests. The testing framework includes unit tests, integration tests, and end-to-end scenarios.

### Test Structure
- **69 unit tests** across components, utilities, and API routes
- **Framework optimization** completed (hardened mock infrastructure)
- **Code coverage reporting** available via `test:coverage`
- **Watch mode** for development workflow
- **E2E tests** ready with Playwright (requires environment setup)

### Current Test Results
**Test Status:** Active development framework
- ESLint quality: 67/68 issues resolved (98.5% clean)
- Build integration: All tests compile without errors
- Mock systems: Properly configured for isolation testing

### Running Tests

```bash
# Run unit & integration tests
npm test

# Run with coverage report
npm run test:coverage

# Run in watch mode during development
npm run test:watch

# Run tests with UI
npm run test:ui
```

### End-to-End Testing (Environment Configuration Needed)

```bash
# Install Playwright browsers (one-time setup)
npm run test:e2e:install

# Run E2E tests (requires dev server configuration)
npm run test:e2e

# Run E2E tests in debug mode
npm run test:e2e:debug

# Run E2E tests with visual interface
npm run test:e2e:ui
```

### Testing Frameworks

- **Unit Tests:** Vitest + React Testing Library
- **E2E Tests:** Playwright (headless browser testing)
- **Mocking:** Integrated vi.mock for API and component isolation
- **Coverage:** Code coverage analysis available

### Development Quality Assurance

**✅ Verified Components:**
- Next.js 15 API route compatibility
- React hook testing with proper act() wrappers
- Mock infrastructure for isolated testing
- Async state management validation

**🔄 Documented Optimizations Needed:**
- E2E test environment setup (dev server integration)
- Mock handler execution refinements
- Concurrent operation edge cases

### CI/CD Integration

All tests can run in automated pipelines with:
```bash
npm ci && npm test && npm run test:coverage
```

## Project Structure

```
hyperpage/
├── app/              # Next.js app directory
├── components/       # Shared UI components
├── tools/           # Tool integrations
├── docs/            # Detailed documentation
└── .clinerules/     # Development guidelines
```

## Contributing

See [CONTRIBUTING.md](docs/CONTRIBUTING.md) for development guidelines and workflow.
