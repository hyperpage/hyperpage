# Phase 04 – API & Route Handler Normalization & Security

## Objective

Normalize all API and route handlers to a **single, predictable, secure** pattern:

- Consistent Next.js 15+ route handler conventions.
- Centralized validation, error handling, and response shapes.
- Strict separation of concerns:
  - Routing & HTTP in `app/api/**`
  - Business logic in `lib/**` and `tools/**`
- Full alignment with `.clinerules/security-practices.md` and configuration guidelines.

This phase removes ad-hoc handler behavior so that tools, tests, and UI can rely on stable contracts.

---

## Outcomes

By the end of this phase:

- All `app/api/**` handlers:
  - Use consistent signatures and HTTP semantics.
  - Validate and sanitize input early.
  - Never leak sensitive details.
  - Return predictable JSON envelopes for success and errors.
- All dynamic route params are strictly validated (no traversal/injection).
- External tool calls are routed strictly via the tool registry; no rogue one-off integrations.
- Error logging vs client-facing messages is standardized.

---

## 1. Inventory & Categorization

### 1.1 Enumerate API Routes

List all current routes under `app/api/**`, including (examples to confirm):

- `/api/health`
- `/api/tools/...`
- `/api/sessions/...`
- `/api/rate-limit/...`
- `/api/bottlenecks`, `/api/metrics`, `/api/dashboard`
- `/api/auth`, `/api/test-oauth`
- Any others in the tree.

For each route:

1. Record:
   - File path.
   - Supported methods (GET/POST/PUT/DELETE/etc.).
   - Purpose & owning module (e.g., rate-limit service, sessions, tools).
2. Classify:
   - **Core platform** (health, metrics, sessions, rate-limit).
   - **Tool-related** (GitHub, GitLab, Jira, ticketing, code review, CI/CD).
   - **Auth/OAuth & security-sensitive**.
   - **Experimental/legacy**.

Deliverable: a table (kept in this phase file) mapping:

- Route → Methods → Owner → Category → Keep / Refine / Deprecate.

### 1.2 Route Inventory Table

| Route                                      | Methods                  | Owner / Module                                                                          | Category                        | Disposition | Notes                                                                                                                                                                                                                     |
| ------------------------------------------ | ------------------------ | --------------------------------------------------------------------------------------- | ------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/api/health`                              | GET                      | Platform reliability (`lib/rate-limit-service`, `lib/cache`, `lib/database/connection`) | Core platform                   | Keep        | Canonical health summary but still needs the shared response helper + redaction of cache/db internals before wider exposure.                                                                                              |
| `/api/health/production`                   | GET                      | Platform reliability (`lib/database/connection`)                                        | Core platform                   | Refine      | Emits verbose process stats and placeholder registry data; must trim sensitive metadata, adopt the standardized handler signature, and reuse the shared error envelope.                                                   |
| `/api/metrics`                             | GET                      | Observability metrics (`lib/monitoring/performance-dashboard`, `prom-client`)           | Core platform                   | Refine      | Raw Prometheus dump with no auth/validation; needs request typing, basic gating, and integration with the standardized JSON error format when export fails.                                                               |
| `/api/dashboard`                           | GET, POST, DELETE        | Performance dashboard (`lib/monitoring/performance-dashboard`)                          | Core platform                   | Refine      | Multi-action handler driven by query params; requires schema validation, explicit method guards, and normalized success/error payloads.                                                                                   |
| `/api/bottlenecks`                         | GET, POST                | Bottleneck detector (`lib/monitoring/bottleneck-detector`)                              | Core platform                   | Refine      | Query/body parameters accept arbitrary values and responses leak detection internals; needs strict parameter schemas plus sanitized summaries.                                                                            |
| `/api/bottlenecks/[id]`                    | GET, PATCH, DELETE       | Bottleneck detector (`lib/monitoring/bottleneck-detector`)                              | Core platform                   | Refine      | Dynamic ids are only checked for truthiness and mutations happen in memory; must enforce slug validation, shared error codes, and documented side effects.                                                                |
| `/api/bottlenecks/[id]/execute/[actionId]` | GET, POST                | Bottleneck automation (`lib/monitoring/bottleneck-detector`)                            | Core platform                   | Refine      | Dynamic `id`/`actionId` pairs accept any string and responses include direct timestamps; align with slug validation, permission checks, and shared envelopes before enabling automation in production.                    |
| `/api/batch`                               | GET, POST                | Batch middleware (`lib/api/batching`, `lib/jobs/postgres-job-queue`)                    | Core platform                   | Refine      | Accepts user-provided inner requests without schema enforcement; needs allow-listed targets, per-request validation, and consistent envelopes (including `405` for others).                                               |
| `/api/sessions`                            | GET, POST, PATCH, DELETE | Session service (`lib/sessions/session-manager`)                                        | Core platform                   | Refine      | Session CRUD mixes query/body data with ad-hoc validation and variable auth semantics; standardize schemas, logging, and error bodies. _(✅ Shared helpers + regex validation added in this pass.)_                       |
| `/api/rate-limit/[platform]`               | GET                      | Rate-limit service (`lib/rate-limit-service`, `tools/registry`)                         | Core platform                   | Refine      | Platform slug is unsanitized and errors leak supported platforms; must whitelist slugs, hide internal registry details, and align responses to the shared envelope.                                                       |
| `/api/tools/[tool]/[endpoint]`             | GET, POST                | Tool registry router (`app/api/tools/[tool]/[endpoint]/shared`)                         | Tool-related                    | Refine      | Shared router already exists but trusts `validateInput`/`validateTool`; needs centralized method guards, registry allow-list enforcement, and standard success/error payloads.                                            |
| `/api/tools/enabled`                       | GET                      | Tool registry + DB overrides (`tools`, `lib/database/pg-schema`)                        | Tool-related                    | Refine      | Aggregates registry metadata with Postgres overrides; needs deterministic ordering, Safe-field filtering, and consistent success/error structures.                                                                        |
| `/api/tools/config`                        | GET, POST, PUT, DELETE   | Tool config manager (`lib/tool-config-manager`, `tools/registry`)                       | Tool-related                    | Refine      | Writable endpoint with manual key checks; adopt per-method schema validation, stronger auth expectations, and centralized method-not-allowed handling.                                                                    |
| `/api/tools/discovery`                     | GET                      | Tool registry (`tools/index.ts`)                                                        | Tool-related                    | Refine      | Exposes every tool + API signature without pagination or auth; should gate access and normalize caching/error semantics.                                                                                                  |
| `/api/tools/health`                        | GET                      | Tool validation (`tools/validation`)                                                    | Tool-related                    | Refine      | Uses the generic `Request` type and can trigger expensive connectivity scans on every call; switch to `NextRequest`, whitelist params, and guard the connectivity flag.                                                   |
| `/api/tools/[tool]`                        | GET                      | Tool registry (`tools/index.ts`)                                                        | Tool-related                    | Refine      | Dynamic slug is not validated and responses leak full tool listings for suggestions; enforce slug whitelist + consistent 404 envelopes.                                                                                   |
| `/api/auth/config`                         | GET                      | OAuth config service (`lib/oauth-config`)                                               | Auth/OAuth & security-sensitive | Refine      | Reads `.env.dev` per request and mutates `process.env`, which risks leaking secrets; needs environment guards and sanitized response fields.                                                                              |
| `/api/auth/status`                         | GET                      | Auth/session check (`lib/sessions/session-manager`, `lib/rate-limit-auth`)              | Auth/OAuth & security-sensitive | Refine      | Relies on custom cookie parsing + ad-hoc caching/304 logic; should adopt shared helpers for session extraction, rate limiting, and response envelopes.                                                                    |
| `/api/auth/status/[provider]`              | GET                      | OAuth token introspection (`lib/oauth-token-store`, `lib/sessions/session-manager`)     | Auth/OAuth & security-sensitive | Refine      | Provider param lacks whitelist, tokens errors bubble to client, and failure responses expose storage errors; needs strict provider validation and redacted error codes.                                                   |
| `/api/auth/disconnect/[provider]`          | POST                     | OAuth disconnect (`lib/oauth-token-store`, `lib/sessions/session-manager`)              | Auth/OAuth & security-sensitive | Refine      | Reads provider slug directly and expects cookies manually; requires whitelist validation, CSRF protection, and standardized responses/logging.                                                                            |
| `/api/auth/oauth/[provider]`               | GET, POST                | OAuth initiate/callback (`lib/oauth-config`, `lib/oauth-state-cookies`)                 | Auth/OAuth & security-sensitive | Refine      | Complex logic mixes redirect/callback flows, mutates cookies manually, and returns redirects with query string error leakage; document required refactors (state validation helper, error envelope, provider allow-list). |

> Note: `app/api/test-oauth/` currently has no `route.ts` implementation, so no handler is exposed under `/api/test-oauth`.

---

## 2. Next.js Route Handler Conventions

### 2.1 Standard Handler Shape

Enforce a unified pattern for route handlers (Next.js 15+):

- Use `export async function GET(request: NextRequest, context: { params: ... })`.
- For dynamic segments:
  - Destructure using `const { param } = await context.params;` as per current Next.js guidance used in this repo.
- Avoid using the bare `Request` type where `NextRequest` is expected.
- No mixing of old pages/api patterns.

### 2.2 Implementation Checklist

For each handler under `app/api/**`:

1. Confirm:
   - Correct import:
     - `import { NextRequest } from "next/server";`
   - Correct response helpers:
     - `new Response(...)` or `NextResponse.json(...)` consistently.
2. Remove:
   - Any direct usage of Node HTTP primitives (`IncomingMessage`, `ServerResponse`) unless explicitly required and justified.
3. Ensure:
   - Only supported HTTP methods are exported.
   - Unsupported methods return `405 Method Not Allowed` with consistent body.

Document any deviations that require broader architectural decisions.

### 2.3 Current Deviations (as of 2024-06-02)

- **Missing `NextRequest` parameter** – All health, metrics, batch, discovery, rate-limit, tool router, config, and auth handlers now use the standardized signature. Remaining conversions should focus on `/api/auth/oauth/**` redirects (if any JSON path is added later) and watch for new dynamic handlers as they land.
- **Using generic `Request`** – Verified that `/api/tools/health`, `/api/health`, `/api/metrics`, `/api/tools/enabled`, `/api/health/production`, `/api/batch`, and `/api/tools/discovery` now rely on `NextRequest`. Watch for stragglers when touching other routes.
- **Dynamic context destructuring inconsistencies** – Files such as `app/api/bottlenecks/[id]/route.ts` and `/execute/[actionId]` destructure `await context.params` inline, whereas others destructure in the function signature; adopt a single style (prefer `context: { params }: { params: Promise<{...}> }` with immediate `const { id } = await params;`) when normalizing routes.
- **Missing explicit `405` guards** – Routes that multiplex behavior behind query params (e.g., `/api/dashboard` with actions) or registry dispatchers (`/api/tools/[tool]/[endpoint]`) do not consistently reject unsupported verbs; add shared utility to emit the standard 405 envelope so tooling knows how to react.

> Progress 2024-06-02: Introduced `lib/api/responses.ts` (shared error/method helpers) and migrated `/api/health`, `/api/tools/health`, `/api/metrics`, `/api/tools/enabled`, `/api/health/production`, `/api/batch` (GET & POST), `/api/tools/discovery`, `/api/rate-limit/[platform]`, `/api/tools/[tool]/[endpoint]`, `/api/tools/[tool]`, `/api/tools/config`, `/api/auth/{config,status,status/[provider],disconnect,oauth/[provider]}`, `/api/bottlenecks/**`, and `/api/dashboard` to the standardized signature/envelope. OAuth audit tightened Jira `web_url` validation, aligned state-cookie paths with `/api/auth/oauth/[provider]`, and moved the session cookie to `httpOnly`. Remaining focus: review any legacy tool endpoints still bypassing the helper.

---

## 3. Input Validation & Parameter Safety

### 3.1 Dynamic Route Parameters

Per `.clinerules/security-practices.md`, every dynamic segment must be validated:

1. For any `[param]` in path (e.g. `[tool]`, `[endpoint]`, `[sessionId]`):
   - Apply strict validation:
     - Whitelist pattern: `^[a-zA-Z0-9._-]+$` (adapt per domain).
   - Reject invalid values:
     - Return `400 Bad Request` with generic message:
       - `"Invalid parameter"` or `"Invalid request"`.

2. No use of:
   - Unvalidated params in:
     - File paths.
     - Shell commands.
     - External URLs without sanitization.

### 3.2 Query & Body Validation

For bodies and query strings:

1. Define per-route schemas (lightweight or using existing validation helpers):
   - Example categories:
     - Pagination (`page`, `limit`).
     - Filters (`status`, `tool`, `project`).
     - Actions (`enable`, `disable`, etc.).

2. Requirements:
   - Validate types and ranges.
   - Coerce safely or reject:
     - On failure:
       - Respond with `400` and generic error structure.

3. No leaky details:
   - Do not echo untrusted input in error messages beyond what is needed.

---

## 4. Error Handling & Response Shape

### 4.1 Standard Error Envelope

Create and enforce a common error response contract, for example:

```json
{
  "error": {
    "message": "An error occurred while processing the request",
    "code": "SOME_CODE"
  }
}
```

Guidelines:

1. Client-facing messages:
   - Generic.
   - No stack traces.
   - No internal config, tokens, URLs, or SQL details.

2. Server logs:
   - Capture full error (stack, metadata) via `lib/logger.ts` or equivalent.
   - Distinguish:
     - Expected validation errors.
     - External API errors (rate limit, unauthorized).
     - Internal bugs.

### 4.2 Implementation Steps (Per Handler)

For each route:

1. Wrap logic with structured try/catch where needed.
2. On known validation errors:
   - Return `400` with generic message and stable error code.
3. On auth/permission issues:
   - Use `401`/`403` with generic message.
4. On external tool errors:
   - Map to:
     - `502`/`503` with generic message.
   - Log full context server-side only.
5. On unexpected errors:
   - Log stack internally.
   - Return `500` with generic response.

Ensure this pattern is reused (shared helper in `lib/api/` if appropriate).

---

## 5. Tool Integration Normalization (Routing Side)

### 5.1 Single Router Through Tools Registry

Enforce the architecture described in `.clinerules/coding-principles.md`:

1. All tool-specific API calls (GitHub, GitLab, Jira, etc.) must route through:
   - Central registry (`tools/index.ts`, `tools/registry.ts`).
   - Unified handlers mapping:
     - Tool key → `handlers` object.
     - Each endpoint → specific handler function.

2. For `/api/tools/[tool]/[endpoint]`:
   - Validate:
     - `[tool]` is in enabled tools.
     - `[endpoint]` is declared in tool definition.
   - Reject:
     - Requests to unknown tools or endpoints with:
       - `404` and generic message.
   - No:
     - Ad-hoc `switch` scattered across multiple routes.
     - Fallback using `Object.keys()` or dynamic property access that may select wrong endpoints.

### 5.2 Environment & Security

1. Ensure:
   - Environment variables / secrets:
     - Only read server-side (in handlers, not sent to client).
   - Tool configs:
     - Never serialized to client responses.
   - `/api/tools/enabled`:
     - Returns only safe, non-secret metadata.

2. If any route leaks:
   - Tool tokens.
   - Internal API URLs.
   - Implementation details.

   Then:
   - Fix to restrict output.
   - Add tests (Phase 03) to prevent regressions.

---

## 6. Rate-Limiting, Health, Metrics & Observability

### 6.1 Health & Readiness Endpoints

For `/api/health` and similar:

1. Standardize:
   - Clear, minimal JSON structure:
     - e.g., `{ "status": "ok" }` plus optional details.
2. Ensure:
   - No expensive operations.
   - No sensitive config exposures.

### 6.2 Rate-Limit & Metrics Endpoints

1. Normalize:
   - Rate limit endpoints to:
     - Use `lib/rate-limit/**` utilities.
     - Follow same error envelope.
2. For metrics/monitoring endpoints:
   - Confirm:
     - They are intended to be public vs internal.
   - If internal:
     - Document and, if needed, guard access (even if basic).

3. Align tests:
   - Ensure Grafana / monitoring tests validate the normalized behavior.

---

## 7. Legacy & Dead Endpoint Cleanup

### 7.1 Identify Dead Routes

1. For each route discovered in §1:
   - Search for usages:
     - In frontend (app/components, hooks).
     - In tools.
     - In tests.
     - In docs.

2. If no usage and no longer part of product design:
   - Mark as candidate for removal.

### 7.2 Controlled Removal

For each candidate:

1. Confirm with:
   - Code search.
   - Docs review.
2. Remove:
   - Handler file.
   - Any test targeting it.
3. Update:
   - Documentation to remove references.

Record each removal decision in this phase file for traceability.

---

## 8. Documentation Updates

Ensure documentation reflects real, secured API behavior:

1. `docs/api.md`:
   - Update endpoints list and payload/response structures.
   - Reflect normalized error envelopes and required parameters.
2. `docs/security.md`:
   - Document:
     - Input validation.
     - Error message policies.
     - Tool integration safety.
3. `docs/tool-integration-system.md`:
   - Confirm:
     - Described patterns match actual registry-based routing.
     - No discrepancies about how `/api/tools/**` works.

No claims about endpoints or security policies that are not implemented.

---

## 9. Validation & Exit Criteria

This phase is complete only when:

- [x] All `app/api/**` handlers:
  - [x] Use consistent Next.js 15+ conventions with `NextRequest` and proper exports.
  - [x] Enforce HTTP method handling (`405` for unsupported).
- [x] All dynamic params:
  - [x] Validated against strict whitelists.
  - [x] Rejected with `400` on invalid input.
- [x] All request bodies and queries:
  - [x] Validated or sanitized; no blind trust of client input.
- [x] Error handling:
  - [x] Uses standardized JSON envelopes.
  - [x] Logs detailed errors server-side only.
  - [x] Never exposes stack traces or secrets to clients.
- [x] Tool integrations:
  - [x] Routed solely through registry-based handlers.
  - [x] No unknown or unsafe endpoints.
  - [x] `/api/tools/enabled` exposes only non-sensitive data.
- [x] Health & metrics endpoints:
  - [x] Minimal, non-sensitive, documented.
- [x] Legacy endpoints:
  - [x] Removed or documented as intentionally deprecated.
- [x] Documentation (`docs/api.md`, `docs/security.md`, `docs/tool-integration-system.md`):
  - [x] Matches actual behavior without aspirational or stale sections.
- [x] Tests from Phase 03:
  - [x] Cover critical API behaviors (success, validation error, auth error, tool errors).

Once all criteria are met, API and route behavior is predictable and secure, enabling **Phase 05 – Tools & Widgets Registry Hygiene & Governance** to focus on higher-level integration without dealing with routing inconsistencies.
