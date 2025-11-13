# Phase 05 – Tools & Widgets Registry Hygiene & Governance

## Objective

Enforce a **single, coherent, registry-driven architecture** for all tools and widgets:

- Every tool (GitHub, GitLab, Jira, Ticketing, Code Reviews, CI/CD, etc.) is defined in one canonical place.
- Widgets, APIs, and handlers are owned by their tools and wired exclusively via the registry.
- No ad-hoc endpoints, no orphaned widgets, no duplicated integration logic.
- Environment flags (`ENABLE_*`) are the only source of truth for enablement.
- All exposed metadata is client-safe; all secrets/config stay server-side.

This phase ensures that adding/removing tools and maintaining widgets is predictable, safe, and well-governed.

---

## Outcomes

By the end of this phase:

- `tools/index.ts`, `tools/registry.ts`, and related types form a clean, extensible contract.
- Each tool implements:
  - Typed config and response models.
  - `apis` / `handlers` maps for backend behavior.
  - `widgets` definitions for UI integration.
- Widgets reference valid APIs via explicit `apiEndpoint` keys.
- Only enabled tools with valid configuration and handlers surface in:
  - `/api/tools/enabled`
  - Portal UI
  - Sidebar / overview widgets
- Documentation describes real behavior and the tool lifecycle accurately.

---

## 1. Inventory: Tools, Registry, Widgets

### 1.1 Tools & Registry Files

Identify core files (to validate against):

- `tools/index.ts`
- `tools/registry.ts`
- `tools/tool-types.ts`
- `tools/ui-props.ts`
- `tools/validation.ts`
- Tool-specific dirs:
  - `tools/github/**`
  - `tools/gitlab/**`
  - `tools/jira/**`
  - `tools/ticketing/**`
  - `tools/code-reviews/**`
  - `tools/ci-cd/**`
  - Any others in `tools/**`

For each tool:

1. Record:
   - Tool key (e.g., `"github"`, `"gitlab"`, `"jira"`).
   - Associated env flags (e.g., `ENABLE_GITHUB`, `ENABLE_GITLAB`).
   - Implemented `apis` and corresponding `handlers`.
   - Exposed `widgets`.

2. Classify:
   - **Active**: Used in UI & API and backed by handlers.
   - **Config-only**: Defined but not fully wired.
   - **Legacy**: No longer used; candidate for removal.

Deliverable: a mapping table in this file:
- Tool → Env flag(s) → Status (Active/Config-only/Legacy) → Actions.

### 1.2 Widgets

Inspect:

- `app/components/Portal.tsx`
- `app/components/PortalOverview.tsx`
- `app/components/PortalWidgetGrid.tsx`
- Related widget components under `app/components/**`
- Any widget definitions in `tools/**` (e.g., `widgets` arrays)

For each widget:

1. Identify:
   - Owning tool (or core system).
   - `apiEndpoint` it depends on.
   - Data shape expected (from tool types).
2. Check:
   - Widget is declared in the owning tool’s metadata, not ad-hoc.
   - Widget is only rendered if:
     - Tool is enabled.
     - Required APIs/handlers exist.

---

## 2. Registry-Driven Architecture Enforcement

### 2.1 Single Source of Truth

Enforce the design from `.clinerules/coding-principles.md`:

1. `tools/index.ts`:
   - Exports a typed collection of all known tools.
2. `tools/registry.ts`:
   - Provides runtime accessors:
     - Get all tools.
     - Filter enabled tools based on env.
     - Resolve handlers for `/api/tools/[tool]/[endpoint]`.

Rules:

- No direct tool-specific logic scattered through app components or random modules.
- No duplicate lists of tools (sidebar, portal, API) maintained manually.
- All lists derived from the registry and/or `ENABLE_*` flags.

### 2.2 Validate Tool Definitions

For each tool definition:

1. Confirm:
   - Has a **unique key**.
   - Has `apis` definition:
     - Each entry describes request/response shape, HTTP method, and handler name.
   - Has `handlers` map:
     - Implementations with proper typing and error handling.
   - Has `widgets` definitions (if applicable):
     - Title, description, and `apiEndpoint`.

2. Ensure:
   - No missing `handlers` for declared `apis`.
   - No extra handlers not referenced by `apis`.

If discrepancies exist:
- Fix definitions to match reality.
- Add tests (Phase 03) around the registry to enforce correctness.

---

## 3. Widget–API Contract Hygiene

### 3.1 Explicit `apiEndpoint` (No Fallback Magic)

For every widget that fetches data:

1. Require explicit `apiEndpoint` (string) that:
   - Matches a valid key in the tool’s `apis`/`handlers`.
2. Remove any behavior such as:
   - `Object.keys(apis)[0]` fallback.
   - Deriving endpoints from array index or position.
3. Ensure:
   - When a widget is configured for `"issues"`, `"pull-requests"`, `"pipelines"`, etc., the tool has:
     - A matching API handler registered.
     - A stable response structure.

### 3.2 Response Typing & Rendering

For each widget:

1. Verify:
   - Frontend expects a typed data shape.
   - Tool types (`tools/[tool]/types.ts`) define that shape.
   - API handler returns data in that exact format.

2. If mismatches are found:
   - Update types and/or handlers.
   - Prefer canonical types exported from tool modules.

---

## 4. Enablement Flags & Safe Exposure

### 4.1 `ENABLE_*` Flags Governance

Enforce:

1. Every tool has:
   - `ENABLE_TOOLNAME` or equivalent env flag documented in:
     - `.env.sample`
     - `docs/config-management.md`
2. `tools/registry.ts`:
   - Uses only env flags (and possibly required credentials) to decide:
     - If tool is enabled.
3. Portal UI:
   - Shows tools and widgets **only** if registry reports enabled.

No:
- Hardcoded enablement toggles inside components.
- Divergence between API-visible tools and UI-visible tools.

### 4.2 `/api/tools/enabled` Endpoint

Requirements:

1. Returns:
   - Only non-sensitive metadata:
     - Tool key.
     - Display name.
     - Supported widgets.
     - Maybe categories/capabilities.
2. Must:
   - Never leak tokens, URLs, or internal config.
3. Tests:
   - Validate response schema and absence of secret fields.

---

## 5. Secret & Config Isolation

### 5.1 Server-Only Configuration

For each tool:

1. Ensure:
   - API tokens, base URLs, and secrets are:
     - Read only in server-side handler code (e.g., `app/api/tools/**`, `lib/api/**`).
     - Never passed through registry responses or client components.

2. Audit:
   - `tools/**` for any accidental inclusion of secrets in exported objects used client-side.
   - `/app/components/**` for no direct access to `process.env` tool secrets.

Any leakage:
- Must be fixed immediately.
- Add regression tests where practical.

---

## 6. Legacy, Duplicate, and Experimental Tools

### 6.1 Identify Problematic Entries

1. Look for:
   - Tools defined but not used anywhere.
   - Widgets referencing removed APIs.
   - Handlers calling deprecated external endpoints.
2. Categorize:
   - **Remove**: clearly obsolete.
   - **Hide**: keep code but disabled by default with clear `experimental` tag.
   - **Fix**: still relevant but misaligned; schedule corrections.

### 6.2 Controlled Cleanup

For each tool/widget being removed:

1. Confirm:
   - No references from UI, docs, or tests.
2. Delete:
   - Tool module(s).
   - Widget definitions.
   - Associated docs sections.
3. Log:
   - Decision rationale in this phase plan.

---

## 7. Portal, Overview & Widget Orchestration

### 7.1 Portal Wiring

Ensure:

1. `Portal`, `PortalOverview`, `PortalWidgetGrid`:
   - Consume a **registry-derived** list of:
     - Enabled tools.
     - Their widgets.
2. No:
   - In-component hardcoded lists of tools or widgets.

### 7.2 Loading, Errors, Refresh

For each widget:

1. Confirm:
   - Shows:
     - Loading state (shimmer/skeleton).
     - Error state (using shared error components).
   - Supports:
     - Manual refresh button where relevant.
     - Optional `refreshInterval` for auto-refresh, consistent with API limits.

2. Ensure:
   - All widget fetching hits defined `/api/tools/[tool]/[endpoint]` routes.
   - Uses consistent error handling patterns from Phase 04.

---

## 8. Documentation & Governance

### 8.1 Developer Documentation

Update:

1. `docs/tool-integration-system.md`:
   - Reflect:
     - Actual tool registration flow.
     - Required pieces: `types`, `apis`, `handlers`, `widgets`, env flags.
     - How `/api/tools/[tool]/[endpoint]` works.
2. `docs/config-management.md`:
   - Ensure:
     - Every `ENABLE_*` described matches real usage.
     - Setup examples are correct.

### 8.2 Governance Rules

If not already codified:

1. In `.clinerules/workflows/add-new-tool.md` (or equivalent):
   - Require:
     - Registry entries.
     - Types.
     - API handlers.
     - Widgets.
     - Docs.
     - Tests.
2. Adding a new tool:
   - Must not require touching more than the defined extension points.

---

## 9. Validation & Exit Criteria

This phase is complete only when:

- [ ] `tools/index.ts` / `tools/registry.ts`:
  - [ ] Contain the canonical list of tools.
  - [ ] Are the only source of truth for tool metadata and enablement.
- [ ] Each tool:
  - [ ] Has consistent `types`, `apis`, and `handlers` definitions.
  - [ ] Exposes widgets that reference valid `apiEndpoint` keys.
- [ ] Widgets:
  - [ ] Only render for enabled tools.
  - [ ] Use explicit `apiEndpoint` with matching handlers.
  - [ ] Handle loading/error states consistently.
- [ ] `/api/tools/enabled`:
  - [ ] Lists only safe metadata.
  - [ ] Does not leak secrets or internals.
- [ ] No:
  - [ ] Hardcoded tool lists in UI separate from the registry.
  - [ ] Fallback/implicit endpoint resolution (`Object.keys` hacks).
  - [ ] Client-side access to tool secrets or config.
- [ ] Legacy/unused tools & widgets:
  - [ ] Removed or clearly marked and disabled.
- [ ] Documentation:
  - [ ] `docs/tool-integration-system.md` and `docs/config-management.md` accurately describe the registry-driven model and env flags.

With a clean, governed tool & widget system, proceed to **Phase 06 – UI & Component Architecture Refinement** and **Phase 07 – Runtime, Docker & Database Configuration Hygiene** to complete the global cleanup.
