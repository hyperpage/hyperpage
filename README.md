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
cp .env.sample .env.dev
# Edit .env.dev to enable your tools (see docs/installation.md)

# Apply PostgreSQL migrations
npm run db:migrate

# Start development server (loads .env.dev automatically)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view your portal. The dev script now sources `.env.dev`, so any changes to that file take effect after restarting the server. Run `npm run db:migrate` whenever migrations change to keep your local Postgres schema current.

## Configuration

### Environment Variables

Hyperpage uses environment variables for configuration. Copy `.env.sample` to `.env.dev` and configure the values you need.

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

### Staging / Production Compose Overlays

To run a staging-like stack locally:

```bash
cp .env.sample .env.staging
# fill in staging secrets/tokens
docker compose -f docker-compose.yml -f docker-compose.staging.yml --env-file .env.staging up -d
```

For a production-like stack (on-prem or self-hosted):

```bash
cp .env.sample .env.production
# fill in production secrets/tokens (or mount from secret manager)
docker compose -f docker-compose.yml -f docker-compose.prod.yml --env-file .env.production up -d
```

Both overlays reuse the base services and simply wire different env files/container names. Run `docker compose ... down` when finished.

## Testing

Hyperpage includes comprehensive automated testing to ensure stability across OAuth integrations, tool integrations, and cross-tool coordination.

**Quick start**

1. Copy `.env.test.example` to `.env.test` and adjust any secrets/tokens.
2. Boot the canonical Postgres/Redis stack once per session:

   ```bash
   npm run db:test:up
   ```

3. Ensure `DATABASE_URL` points at the running Postgres instance (see `.env.test`).
   - On the host, use `postgresql://...@localhost:5432/hyperpage-test`.
   - If you run tests **inside** the Compose network, use `postgres` as the host.
   - Vitest loads `.env.test` automatically via `vitest.global-setup.ts`, so keeping that file up to date is usually enough. Override variables in your shell only when you need a different Postgres instance.

**Available commands**

```bash
# Fast feedback
npm run test:unit          # JSdom unit/API/component tests (no external services)
npm run test:integration   # Postgres-backed integration suites (requires DATABASE_URL)
npm run test:integration:tools   # Provider-backed HTTP integration suites (requires Next dev server + tokens)

# Broader coverage
npm test                   # Full Vitest run (unit + integration + optional suites)
npm run test:perf          # PERFORMANCE_TESTS=1 timed suites (__tests__/performance/**)
npm run test:coverage      # Vitest with coverage output
npm run test:watch         # Interactive watch mode

# End-to-end
npm run test:e2e           # Playwright against local dev server (E2E_TESTS=1, requires running dev server or BASE_URL override)
npm run test:e2e:headed    # Same as above but headed browser sessions
npm run test:e2e:docker    # Dockerized Next.js + Playwright profile with automatic teardown

# Database helpers
npm run db:test:up         # Start Postgres + Redis (docker-compose.test.yml)
npm run db:test:down       # Stop stack and remove volumes (fresh state)
npm run db:test:reset      # Hard reset: down -v, volume prune, up
```

**Testing Setup Notes:**

- **Vitest harness**: `vitest.setup.ts` requires `DATABASE_URL` and will drop/create the referenced database, run drizzle migrations, and seed data before the first test runs.
- **Unit vs Integration**: Both `npm run test:unit` and `npm run test:integration` rely on the Postgres harness today because the API tests talk to repositories. Make sure the dockerized DB is running even for “unit” runs.
- **Runtime environments**: Vitest currently runs under the JSDOM environment to satisfy the API/component suites; backend tests still rely on the Postgres harness for data access.
- **Integration suites**: Tests under `__tests__/integration/**` and `__tests__/unit/lib/**` talk to the Postgres harness. Ensure `npm run db:test:up` (or equivalent) is active.
- **Tool integrations**: `npm run test:integration:tools` expects a running app server (e.g., `npm run dev -- --hostname 127.0.0.1`) reachable at `HYPERPAGE_TEST_BASE_URL` plus provider tokens (`GITHUB_TOKEN`, `GITLAB_TOKEN`, `JIRA_API_TOKEN`). Without both, the suites remain skipped.
- **Optional suites**: Performance and Grafana (plus any tool-integration suites) are opt-in behind explicit env flags (`PERFORMANCE_TESTS`, `GRAFANA_TESTS`, `E2E_TESTS`). They will report as skipped unless the flags are set.
- **OAuth E2E gating**: Provider-specific Playwright specs stay quarantined unless `E2E_OAUTH=1` is set. They require valid OAuth client IDs/secrets plus provider tokens set in `.env.test`.
- **E2E & OAuth**: `npm run test:e2e*` executes Playwright with `E2E_TESTS=1`. Supply provider tokens (GitHub/GitLab/Jira) via `.env.test` when exercising the OAuth-heavy specs.
- **E2E dev server**: `npm run test:e2e` expects a running dev or prod server that matches `BASE_URL`. When running locally, start `npm run dev -- --hostname 127.0.0.1` (or `npm run build && npm run start`) and set `BASE_URL=http://127.0.0.1:3000` before launching Playwright.
- **CI/CD**: `.github/workflows/ci-cd.yml` consumes the same npm scripts so local developers and CI run identical commands once the stack is configured.

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
