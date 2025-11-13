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

- [ ] All `app/api/**` handlers:
  - [ ] Use consistent Next.js 15+ conventions with `NextRequest` and proper exports.
  - [ ] Enforce HTTP method handling (`405` for unsupported).
- [ ] All dynamic params:
  - [ ] Validated against strict whitelists.
  - [ ] Rejected with `400` on invalid input.
- [ ] All request bodies and queries:
  - [ ] Validated or sanitized; no blind trust of client input.
- [ ] Error handling:
  - [ ] Uses standardized JSON envelopes.
  - [ ] Logs detailed errors server-side only.
  - [ ] Never exposes stack traces or secrets to clients.
- [ ] Tool integrations:
  - [ ] Routed solely through registry-based handlers.
  - [ ] No unknown or unsafe endpoints.
  - [ ] `/api/tools/enabled` exposes only non-sensitive data.
- [ ] Health & metrics endpoints:
  - [ ] Minimal, non-sensitive, documented.
- [ ] Legacy endpoints:
  - [ ] Removed or documented as intentionally deprecated.
- [ ] Documentation (`docs/api.md`, `docs/security.md`, `docs/tool-integration-system.md`):
  - [ ] Matches actual behavior without aspirational or stale sections.
- [ ] Tests from Phase 03:
  - [ ] Cover critical API behaviors (success, validation error, auth error, tool errors).

Once all criteria are met, API and route behavior is predictable and secure, enabling **Phase 05 – Tools & Widgets Registry Hygiene & Governance** to focus on higher-level integration without dealing with routing inconsistencies.
