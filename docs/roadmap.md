# Roadmap

This roadmap tracks the practical work remaining after the multi-phase cleaning effort. It keeps the focus on verifiable improvements rather than aspirational marketing copy.

## Current Status – Q1 2025

Hyperpage is a self-hosted aggregation portal backed by Next.js 15, PostgreSQL, and optional Redis. Registry-driven tools (GitHub, GitLab, Jira, CI/CD, Ticketing) and the portal UX are stable, but several areas still need polish (OAuth hardening, documentation accuracy, and runtime ergonomics).

## Recently Completed

- **PostgreSQL-only persistence** – drizzle migrations, repositories, and the Vitest harness were consolidated on Postgres.
- **Registry governance** – tool definitions expose sanitized metadata for client consumption and server APIs share a consistent envelope.
- **Session management & coordination** – `/api/sessions` plus the Redis-based `PodCoordinator` allow multi-pod deployments without external state.
- **Testing clarity** – docs and scripts now document the Postgres-only test stack and docker-compose overlays.

## Near-Term Initiatives

1. **Documentation Accuracy (Phase 08)**
   - Ensure README + core docs match the real architecture and scripts.
   - Cross-link installation, testing, and configuration guides from the README.
   - Call out future-state content explicitly so it is not mistaken for implemented behaviour.

2. **OAuth Hardening**
   - Implement PKCE for public clients.
   - Encrypt stored tokens (AES-256-GCM) before persisting to Postgres.
   - Expand tests that cover `/api/auth/oauth/[provider]` and `SecureTokenStorage`.

3. **Runtime Ergonomics**
   - Offer a documented `npm run validate` + `npm run db:test:up` sequence for contributors and CI.
   - Ship sample manifests or guidance for Redis/Postgres in managed clouds instead of referencing nonexistent Kubernetes files.
   - Continue pruning scripts that referred to the old SQLite migration path.

4. **Monitoring & Alerts**
   - Finalise `/api/metrics` coverage (cache stats, rate-limit feeds, widget errors) and document how to scrape it.
   - Provide a curated Grafana dashboard JSON that matches the metrics emitted today.

## Medium-Term Ideas

These items are tracked but intentionally labeled as **Future Work** until the prerequisites above are finished:

- Workspace management and multi-tenant portal configurations.
- Per-user OAuth linking, including scoped rate limits per account.
- Expanded CI coverage for Playwright/docker flows once they are reliable locally.
- Packaging guidance for Kubernetes or other orchestration stacks.

## How to Use This Roadmap

- Update this file whenever a phase meaningfully changes scope or completes.
- Prefer short, factual bullets over long-term hype.
- Link to GitHub issues or cleaning-plan phases when work is scheduled.

_Last updated: January 2025_
