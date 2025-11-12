# Hyperpage

A comprehensive data aggregation portal that consolidates information from multiple external tools (GitHub, GitLab, Jira, etc.) into a unified, interactive interface. Built with Next.js, TypeScript, and Tailwind CSS.

## Development Principles

This project follows rigorous development standards to ensure accuracy and factual documentation:

[![Rule: Documentation Accuracy: Avoid Marketing Hype and False Metrics](https://img.shields.io/badge/Rule-Documentation_Accuracy-red?style=flat)](.clinerules/avoid-marketing-hype.md)

All documented claims must be verifiable against the actual codebase. No marketing hype, aspirational features presented as developed, or false performance metrics are allowed. See [`.clinerules/avoid-marketing-hype.md`](.clinerules/avoid-marketing-hype.md) for detailed guidelines.

## Overview

Hyperpage solves the challenge of scattered development data across multiple platforms. For development teams and project managers, it provides a single pane of glass to monitor code reviews, CI/CD pipelines, tickets, and project status from your entire toolchain.

### Key Features

- **Code Reviews**: GitHub PRs and GitLab MRs in one view
- **CI/CD Pipelines**: Consolidated pipeline status and workflows
- **Issue Tracking**: Jira tickets alongside GitHub/GitLab issues
- **Rate Limit Monitoring**: Real-time tracking of API usage across all platforms
- **Modern UI**: Clean design system using shadcn/ui components with Tailwind CSS
- **Theme System**: Light and dark mode support

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

## Configuration

### Environment Variables

Hyperpage uses environment variables for configuration. Copy `.env.local.sample` to `.env.local` and configure the values you need.

#### Required Variables

**Base Configuration:**

- `BASE_URL`: Internal API base URL (defaults to `http://localhost:3000`)
- `NEXT_PUBLIC_BASE_URL`: Public base URL accessible in client components

**Redis Configuration (Production):**

- `REDIS_URL`: Redis connection URL for persistent caching (optional, falls back to memory-only)

#### Tool Integration Variables

**Tool Enabling:**

- `ENABLE_CODE_REVIEWS`: Enable code review aggregations (`true`/`false`, default `false`)
- `ENABLE_CICD`: Enable CI/CD pipeline aggregations (`true`/`false`, default `false`)
- `ENABLE_TICKETING`: Enable issue/ticket aggregations (`true`/`false`, default `false`)

**Jira Configuration:**

- `ENABLE_JIRA`: Enable Jira integration (`true`/`false`)
- `JIRA_WEB_URL`: Jira instance URL (e.g., `https://your-domain.atlassian.net`)
- `JIRA_EMAIL`: Jira account email address
- `JIRA_API_TOKEN`: Jira personal access token

**GitHub Configuration:**

- `ENABLE_GITHUB`: Enable GitHub integration (`true`/`false`)
- `GITHUB_TOKEN`: GitHub personal access token (PAT)
- `GITHUB_USERNAME`: GitHub username associated with the token

**GitLab Configuration:**

- `ENABLE_GITLAB`: Enable GitLab integration (`true`/`false`)
- `GITLAB_WEB_URL`: GitLab instance URL (e.g., `https://gitlab.com`)
- `GITLAB_TOKEN`: GitLab personal access token

#### OAuth Authentication Variables

**Authentication Encryption:**

- `OAUTH_ENCRYPTION_KEY`: 32-character hex key for encrypting stored OAuth tokens (generate with `openssl rand -hex 32`)

**GitHub OAuth Application:**

- `GITHUB_OAUTH_CLIENT_ID`: GitHub OAuth app client ID
- `GITHUB_OAUTH_CLIENT_SECRET`: GitHub OAuth app client secret

**GitLab OAuth Application:**

- `GITLAB_OAUTH_CLIENT_ID`: GitLab OAuth app client ID
- `GITLAB_OAUTH_CLIENT_SECRET`: GitLab OAuth app client secret

**Jira OAuth Application:**

- `JIRA_OAUTH_CLIENT_ID`: Jira OAuth app client ID
- `JIRA_OAUTH_CLIENT_SECRET`: Jira OAuth app client secret

#### Configuration Examples

**Basic Setup (Anonymous Usage):**

```env
ENABLE_GITHUB=true
GITHUB_TOKEN=github_pat_...

ENABLE_JIRA=true
JIRA_WEB_URL=https://yourcompany.atlassian.net
JIRA_EMAIL=user@company.com
JIRA_API_TOKEN=jira_token_...
```

**With OAuth Authentication:**

```env
# Enable tools
ENABLE_GITHUB=true
ENABLE_JIRA=true

# OAuth encryption for secure token storage
OAUTH_ENCRYPTION_KEY=a1b2c3d4e5f678901234567890abcdef1234567890abcdef1234567890abcdef

# GitHub OAuth
GITHUB_OAUTH_CLIENT_ID=github_client_id_here
GITHUB_OAUTH_CLIENT_SECRET=github_client_secret_here

# Jira OAuth
JIRA_WEB_URL=https://yourcompany.atlassian.net
JIRA_OAUTH_CLIENT_ID=jira_client_id_here
JIRA_OAUTH_CLIENT_SECRET=jira_client_secret_here
```

## Production Deployment

For production deployments, use the provided Dockerfile and Docker Compose configuration to run Hyperpage with PostgreSQL and Redis.

## Testing

Hyperpage includes comprehensive automated testing to ensure stability across OAuth integrations, tool integrations, and cross-tool coordination.

**Available Test Commands:**

```bash
# All Tests
npm test                    # Run unit tests
npm run test:coverage      # With coverage report
npm run test:watch         # Watch mode development

# Integration Tests
npm test -- --run integration              # All integration tests
npm test -- --run integration/oauth        # OAuth integration tests
npm test -- --run integration/tools        # Tool integration tests

# Individual Tool Tests
npm test -- --run integration/tools/github           # GitHub integration
npm test -- --run integration/tools/gitlab           # GitLab integration
npm test -- --run integration/tools/jira             # Jira integration
npm test -- --run integration/tools/cross-tool       # Cross-tool aggregation

# E2E Tests
npm run test:e2e           # Playwright E2E tests
npm run test:e2e:docker    # E2E tests in Docker containers
npm run test:e2e:ui        # Interactive E2E mode
```

**Testing Setup:**

- **Unit Tests**: Vitest + React Testing Library for component isolation
- **OAuth Integration Tests**: Comprehensive testing for GitHub, GitLab, and Jira OAuth flows
- **Tool Integration Tests**: API endpoint validation, rate limiting, data transformation
- **Cross-Tool Aggregation Tests**: Multi-tool coordination and unified data format validation
- **E2E Tests**: Playwright framework for complete user journey validation
- **CI/CD Ready**: All tests run in automated pipelines with parallel execution

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
│   ├── integration/   # Integration test suites
│   └── lib/          # Utility function tests
├── docs/              # Documentation and guides
└── .clinerules/       # Development guidelines and workflows
```

## Session Management API

Hyperpage includes session management for distributed deployments, enabling persistent user state across requests and nodes.
