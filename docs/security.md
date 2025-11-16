# Security Practices

Hyperpage is designed to be factual about its security posture. This document captures what is implemented today and calls out the areas that remain on the backlog.

## Core Principles

- **Server-side ownership** – external API calls, OAuth flows, and credential handling always execute on the server.
- **Deterministic validation** – API routes validate tool names, endpoint segments, and session IDs with strict regex helpers before touching business logic.
- **Minimal exposure** – the client receives only sanitized tool metadata (`ClientSafeTool`) and never sees handler implementations or secrets.
- **Documented gaps** – features that are not implemented (PKCE, token-at-rest encryption, Kubernetes manifests) are tracked explicitly so nobody misinterprets the docs.

## Authentication & Authorization

### OAuth Flows (Current State)

- `/api/auth/oauth/[provider]` implements the Authorization Code flow for GitHub, GitLab, and Jira.
- CSRF is mitigated with state cookies created via `createOAuthStateCookie` and validated in the callback handler.
- Tokens are exchanged through `exchangeCodeForTokens` with provider-specific scopes defined in each tool registry entry.
- **Not yet implemented**: PKCE. The current implementation does not send `code_challenge`/`code_verifier`, so public clients should treat OAuth as a trusted-server integration. PKCE support is tracked in the roadmap.

### Personal Access Tokens

- You can configure PATs via `.env` for GitHub/GitLab/Jira. They remain server-only and are never surfaced in client bundles.

### Session Management

- `SessionManager` uses Redis with an in-memory fallback to persist UI preferences, authenticated tool metadata, and request context.
- The API validates session IDs with `SESSION_ID_REGEX` and returns standardized error envelopes.
- Sessions expire after 24 hours by default. The cleanup job runs hourly when Redis is available.

## Data Protection

### Token Storage

- OAuth tokens are stored in PostgreSQL via `PostgresOAuthTokenRepository` and surfaced through `SecureTokenStorage`.
- **Current behaviour**: tokens are stored in plain columns inside `pgSchema.oauthTokens`. There is no AES-256-GCM layer today.
- **Planned**: encrypt tokens at rest using AES-256-GCM once key management is finalized. Until then, keep Postgres access restricted.

### Database Access

- All repositories share the `getReadWriteDb()` helper, so you can enforce TLS/host-based rules centrally.
- The Vitest harness drops/recreates the test database automatically, preventing stale state.

### Configuration Secrets

- `.env.sample` lists every supported variable. Only template files are committed; real secrets stay in `.env.dev`, `.env.test`, etc.
- `CONFIG_ENV_FILE` and `NEXT_PUBLIC_ENV_FILE` let Docker/PM2 deployments mount the correct env file explicitly.

## API Security Controls

- Path segments are validated using explicit regexes (see `SESSION_ID_REGEX` and validators inside `/api/tools/[tool]/[endpoint]`).
- Error responses are normalized via `createErrorResponse` / `validationErrorResponse` so clients never receive stack traces or internal error objects.
- `/api/batch` and `/api/metrics` add metadata headers (e.g., `X-Batch-Error`, `X-Compression-Ratio`) for debugging without revealing secrets.

## Monitoring & Auditing

- Pino logs include structured context for OAuth failures, session errors, and batch execution metadata.
- `/api/metrics` exposes Prometheus gauges/counters for rate limits, cache health, HTTP connection pools, and widget errors.
- Grafana dashboards can scrape the metrics endpoint; see `docs/monitoring.md` for setup details.

## Known Gaps / Future Work

| Area                      | Status                                                                                                  |
| ------------------------- | ------------------------------------------------------------------------------------------------------- |
| PKCE support for OAuth    | **Planned**. Requires storing/verifying `code_challenge` per session.                                   |
| Token encryption at rest  | **Planned**. Will add AES-256-GCM in `SecureTokenStorage` once key handling is in place.                |
| Kubernetes manifests      | **Not provided**. Generate your own secrets/configmaps instead of relying on non-existent `k8s/` files. |
| Automated secret rotation | **Not implemented**. Rely on your deployment platform for rotation until hooks land in Hyperpage.       |

Track these items in the roadmap or cleaning plan before claiming they are complete.
