# Hyperpage

A comprehensive data aggregation portal that consolidates information from multiple external tools (GitHub, GitLab, Jira, etc.) into a unified, interactive interface. Built with Next.js, TypeScript, and Tailwind CSS.

## Overview

Hyperpage solves the challenge of scattered development data across multiple platforms. For development teams and project managers, it provides a single pane of glass to monitor code reviews, CI/CD pipelines, tickets, and project status from your entire toolchain.

### Key Features
- **Code Reviews**: GitHub PRs and GitLab MRs in one view
- **CI/CD Pipelines**: Consolidated pipeline status and workflows
- **Issue Tracking**: Jira tickets alongside GitHub/GitLab issues
- **Rate Limit Monitoring**: Real-time tracking of API usage across all platforms
- **Modern UI**: Clean design system using shadcn/ui components with Tailwind CSS
- **Theme System**: Light and dark mode support

### Quality Assurance & Design
✅ **TypeScript codebase** • ✅ **Build compiles successfully** • ✅ **Responsive design**  
✅ **Professional UI** • ✅ **Dark Mode Support** • ✅ **Focusing constraints for stability**

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

Open [http://localhost:3000](http://localhost:3000) to view your portal.

## Testing

Hyperpage includes automated testing to ensure stability.

**Available Test Commands:**

```bash
# Unit & Integration Tests
npm test                    # Run unit tests
npm run test:coverage      # With coverage report
npm run test:watch         # Watch mode development

# E2E Tests
npm run test:e2e           # Playwright E2E tests
npm run test:e2e:docker    # E2E tests in Docker containers
npm run test:e2e:ui        # Interactive E2E mode
```

**Testing Setup:**
- **Unit Tests**: Vitest + React Testing Library
- **E2E Tests**: Playwright framework
- **CI/CD Ready**: Tests run in automated pipelines

## Usage Examples

**Enable GitHub Integration:**
```env
ENABLE_GITHUB=true
GITHUB_TOKEN=github_pat_...
```

**View Unified Code Reviews:**
Once configured, the portal automatically aggregates PRs/MRs from all enabled platforms in the Code Reviews tab.

## Project Structure

```
hyperpage/
├── app/                 # Next.js 15 app directory
│   ├── api/            # API routes and handlers (REST & tool integrations)
│   ├── components/     # React components using shadcn/ui (Tailwind-based)
│   └── globals.css     # Tailwind CSS configuration
├── tools/              # Tool integrations registry (GitHub, GitLab, Jira, etc.)
├── __tests__/          # Automated testing suite
│   ├── api/           # API route tests
│   ├── components/    # Component tests
│   ├── e2e/          # End-to-end testing setup
│   └── lib/          # Utility function tests
├── docs/              # Documentation and guides
└── .clinerules/       # Development guidelines and workflows
```

## Documentation

- **[Installation & Setup](docs/installation.md)**: Detailed setup instructions and configuration
- **[Usage Guide](docs/usage.md)**: Portal features and navigation
- **[Testing Guide](docs/testing.md)**: Testing strategy and quality assurance
- **[API Documentation](docs/api.md)**: Technical API reference
- **[System Architecture](docs/architecture.md)**: Core design and integration patterns

## Contributing

See [CONTRIBUTING.md](docs/CONTRIBUTING.md) for development guidelines and workflow.

## Authors

Hyperpage is developed and maintained by data-minded developers who believe in unifying development workflows.
