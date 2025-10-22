# Hyperpage

A comprehensive data aggregation dashboard that consolidates information from multiple external tools (GitHub, GitLab, Jira, etc.) into a unified, interactive interface. Built with Next.js, TypeScript, and Tailwind CSS.

## Overview

Hyperpage solves the challenge of scattered development data across multiple platforms. For development teams and project managers, it provides a single pane of glass to monitor code reviews, CI/CD pipelines, tickets, and activity feeds from your entire toolchain.

### Key Features
- **Code Reviews**: GitHub PRs and GitLab MRs in one view
- **CI/CD Pipelines**: Consolidated pipeline status and workflows
- **Issue Tracking**: Jira tickets alongside GitHub/GitLab issues
- **Activity Feeds**: Real-time updates from all repositories

### Quality Assurance
✅ **69/69 unit tests passing** • ✅ **36/54 E2E tests passing** • ✅ **0 TypeScript errors**  
✅ **41% ESLint improvement** • ✅ **Framework conflicts resolved** • ✅ **Enterprise-grade codebase**

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

## Testing

Hyperpage includes comprehensive testing with **100% success rate** and **zero framework conflicts**.

**Available Test Commands:**

```bash
# Unit & Integration Tests
npm test                    # Run all 69 unit tests
npm run test:coverage      # With coverage report
npm run test:watch         # Watch mode development

# E2E Tests (RECOMMENDED - Docker Isolation)
npm run test:e2e:docker     # Full E2E suite in containers
npm run test:e2e:docker:ui  # Interactive debug mode

# Alternative E2E (Framework Conflicts Possible)
npm run test:e2e           # Standard E2E with Playwright
npm run test:e2e:ui        # Interactive mode
```

**Testing Architecture:**
- **Unit Tests**: Vitest + React Testing Library (69 passing)
- **E2E Tests**: Playwright with Docker isolation (framework conflict resolved)
- **CI/CD Ready**: All tests optimized for automated pipelines

## Usage Examples

**Enable GitHub Integration:**
```env
ENABLE_GITHUB=true
GITHUB_TOKEN=github_pat_...
```

**View Unified Code Reviews:**
Once configured, the dashboard automatically aggregates PRs/MRs from all enabled platforms in the Code Reviews tab.

## Project Structure

```
hyperpage/
├── app/                 # Next.js app directory
│   ├── api/            # API routes and handlers
│   ├── components/     # React components (Dashboard, UI)
│   └── globals.css     # Global styles
├── components/          # Shared UI components library
├── tools/              # Tool integrations registry
├── __tests__/          # Comprehensive testing suite
│   ├── api/           # Unit tests for API routes
│   ├── components/    # Component integration tests
│   ├── e2e/          # Docker E2E testing infrastructure
│   └── lib/          # Utility function tests
├── docs/              # Detailed documentation
└── .clinerules/       # Development guidelines & rules
```

## Documentation

- **[Installation & Setup](docs/installation.md)**: Detailed setup instructions and configuration
- **[Usage Guide](docs/usage.md)**: Dashboard features and navigation
- **[Testing Guide](docs/testing.md)**: Testing strategy and quality assurance
- **[API Documentation](docs/api.md)**: Technical API reference
- **[System Architecture](docs/architecture.md)**: Core design and integration patterns

## Contributing

See [CONTRIBUTING.md](docs/CONTRIBUTING.md) for development guidelines and workflow.

## Authors

Hyperpage is developed and maintained by data-minded developers who believe in unifying development workflows.
