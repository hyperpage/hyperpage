# Phase 06 – UI & Component Architecture Refinement

## Objective

Refine the UI and component layer into a **clean, modular, and enforceable architecture**:

- Components are small, focused, and typed.
- Complex behavior is encapsulated in hooks and service layers.
- Layout, theming, and interactions are consistent across the portal.
- UI consumes only safe, normalized data from Phases 04–05.
- No duplication, dead components, or ad-hoc patterns.

This phase ensures the frontend is maintainable and aligned with the platform’s registry-driven and security-conscious backend.

---

## Outcomes

By the end of this phase:

- Component tree follows single-responsibility and size limits (≤ ~100 lines for most).
- Shared patterns for:
  - Layout.
  - Loading & error states.
  - Pagination, search, filters.
  - Status indicators and badges.
- All tool- and widget-related UI:
  - Reads from the registry outputs and `/api/tools/**`.
  - Has no hardcoded, divergent logic.
- No client-side access to secrets or server-only concerns.
- UI-related documentation reflects real structure and patterns.

---

## 1. Inventory & Classification

### 1.1 Core Component Areas

Target directories (based on current repo):

- `app/components/**`
  - `Portal.tsx`, `PortalOverview.tsx`, `PortalWidgetGrid.tsx`
  - `TabNavigation.tsx`
  - `StatusBadge.tsx`, `RateLimitIndicator.tsx`
  - `ErrorBoundary.tsx`, `DefaultErrorFallback.tsx`, `ErrorDisplay.tsx`
  - `SetupWizard/**`, `Auth*`, `QuickStartGuide`, etc.
- `components/**`
  - Shared UI (e.g., `components/ui/**`, `OAuthErrorTemplates.tsx`)

For each component:

1. Classify:
   - **Layout / Shell**: Portal, page wrappers, navigation.
   - **Widget / Data View**: Cards, tables, charts bound to tool APIs.
   - **Primitive / Shared UI**: Buttons, badges, typography, icons.
   - **Stateful Logic**: Hooks & containers.
2. Note:
   - Approx line count.
   - Mixed concerns (UI + data + side-effects).
   - Direct registry/tool usage vs prop-driven.

Deliverable: a mapping in this phase plan listing “complex” or “violating” components.

---

## 2. Component Size & Responsibility

### 2.1 Size & Decomposition Rules

Enforce `.clinerules/coding-style.md` & `.clinerules/coding-principles.md`:

1. Most components:
   - ≤ ~100 lines.
   - Single, clear responsibility.
2. Overgrown components:
   - `Portal`, `PortalOverview`, `SetupWizard`, etc.

Refactor strategy:

- Extract:
  - Presentation-only children (e.g., `<PortalHeader>`, `<PortalStatsGrid>`).
  - Hooks for data retrieval and orchestration (e.g., `usePortalData`, `useToolWidgets`).
- Preserve behavior:
  - First refactor structurally, then adjust logic.

### 2.2 Container vs Presentational Pattern

For each complex component:

1. Introduce:
   - `useXxx` hook(s) handling:
     - Fetching data.
     - Mapping registry outputs to UI props.
     - Managing loading/error states.
   - Dumb/presentational child components:
     - Receive fully prepared props.
     - Contain no side-effects or fetches.

2. Benefits:
   - Testable hooks.
   - Reusable UI blocks.
   - Cleaner separation for future changes.

---

## 3. Data Flow & Registry Integration

### 3.1 Strict Data Boundaries

Enforce:

1. UI obtains:
   - Tool lists, widget configs from:
     - `/api/tools/enabled`
     - Registry-backed endpoints.
2. UI does **not**:
   - Hardcode lists of tools or widgets.
   - Infer endpoints by guessing or using indexes.
   - Touch tool secrets or server configs.

### 3.2 Widget Rendering Pipeline

Standard pipeline:

1. Portal fetches enabled tools + widgets (via Phase 05 contracts).
2. For each widget:
   - Resolved `apiEndpoint` → calls `/api/tools/[tool]/[endpoint]`.
3. Widget component:
   - Renders using typed data.
   - Uses shared loading/error components.

Tasks:

- Normalize all widget-like components to follow this pipeline.
- Remove legacy widget render paths that bypass registry/API conventions.

---

## 4. UX Consistency: Loading, Errors, Empty States

### 4.1 Loading States

Standardize:

1. Use shared skeleton/shimmer components for:
   - Portal overview.
   - Widget cards.
   - Tables and charts.
2. Behavior:
   - Preserve existing data during background refresh.
   - Avoid hard blank states on incremental reloads.

### 4.2 Error States

Use shared components:

- `ErrorBoundary`, `DefaultErrorFallback`, `ErrorDisplay`, `ErrorSeverityIcon/Variant`.

Guidelines:

1. All error presentations:
   - Use these shared primitives.
   - Show user-safe messages (no stack traces).
2. Map backend error envelope (Phase 04) to:
   - Consistent UI representation.

### 4.3 Empty States

For views with no data:

1. Provide clear guidance:
   - “Connect a tool”, “No recent activity”, etc.
2. Avoid:
   - Raw `null` return or unstyled placeholders.

---

## 5. Theming, Layout & Responsiveness

### 5.1 Theming & Dark Mode

Ensure:

1. All components respect:
   - Global theme classes and CSS variables.
2. Avoid:
   - Inline colors that break dark mode.
3. Verify:
   - Status colors (e.g., teal for tool status) follow `.clinerules/coding-style.md`.

### 5.2 Layout Standards

1. Use:
   - Consistent padding from container-level wrappers (e.g., `p-6` at portal level).
2. Components:
   - Should not insert arbitrary top padding that fights with layout.
3. Responsive behavior:
   - Grids and lists:
     - Stack vertically on small screens.
     - Expand to columns on larger screens.

---

## 6. Shared Patterns: Tables, Lists, Status Indicators

### 6.1 Tables & Pagination

For reusable data tables (e.g., `DataTable`, `PaginationControls`):

1. Ensure:
   - Shared, generic components are used.
   - Pagination defaults (e.g., 10 items/page) consistent.
2. Remove:
   - Local bespoke table implementations that duplicate logic.

### 6.2 Status & Metrics Components

For indicators like:

- `StatusBadge`
- `RateLimitIndicator`
- `SecurityInfo`
- `PermissionDetails`

1. Standardize:
   - Props and allowed statuses.
   - Color and icon mapping.
2. Ensure:
   - All usages go through the same APIs and types.

---

## 7. Client/Server Boundary Enforcement

### 7.1 Client Components

1. Must NOT:
   - Access `process.env` directly for secrets.
   - Do direct tool registry lookups that expose server config.
2. Instead:
   - Receive safe data via:
     - Props from server components.
     - `/api/**` calls returning sanitized data.

### 7.2 Server Components

1. Handle:
   - Env access.
   - Sensitive tool configuration.
   - Initial data fetching when safe.

2. Verify:
   - No server-only imports (fs, db clients) leak into client components.

---

## 8. Dead Code, Duplicates & Consolidation

### 8.1 Identify

Search for:

- Components not imported anywhere.
- Duplicate variants of:
  - Buttons, cards, spinners, alerts.
- Legacy portal/overview/views.

### 8.2 Remove or Consolidate

Rules:

1. Remove unused components after verifying:
   - No references in code, tests, or docs.
2. Consolidate:
   - To a single canonical implementation per UI primitive.
3. If uncertain:
   - Mark with `@deprecated` comment and track for removal once verified.

---

## 9. Documentation Updates

Update:

1. `docs/ui.md`:
   - Describe:
     - Component architecture (container vs presentational).
     - Registry-driven widget system.
     - Shared patterns for loading/error/empty states.
2. `docs/tool-integration-system.md`:
   - Cross-link how widgets are wired from tools.
3. Any `.clinerules` UI references:
   - Confirm they match the enforced patterns.

Ensure all statements are factual and match the current code.

---

## 10. Validation & Exit Criteria

This phase is complete only when:

- [ ] All major components:
  - [ ] Are under ~100 lines or split into logical children/hooks.
  - [ ] Have a single, clear responsibility.
- [ ] Complex behaviors:
  - [ ] Encapsulated in named hooks or service modules.
- [ ] Portal & widget UIs:
  - [ ] Consume registry and `/api/tools/**` outputs only.
  - [ ] Do not hardcode tool lists or endpoints.
- [ ] Loading & error states:
  - [ ] Use shared primitives consistently.
- [ ] Theming & layout:
  - [ ] Respect dark mode and spacing conventions.
- [ ] Client/server boundaries:
  - [ ] No client-side secret or env access.
  - [ ] No server-only modules imported into client components.
- [ ] Dead/duplicate components:
  - [ ] Removed or clearly deprecated with a migration note.
- [ ] `docs/ui.md` (and related docs):
  - [ ] Reflect actual component patterns and usage.

With the UI and component layer normalized, proceed to **Phase 07 – Runtime, Docker & Database Configuration Hygiene** and **Phase 08 – Documentation & Script Pruning** to finalize the comprehensive cleanup.
