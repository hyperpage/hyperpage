# Phase 02 – Linting, Type Safety & Code Style Enforcement

## Objective

Align the entire codebase with strict, enforced, and automated standards:

- Zero tolerance for `eslint-disable-next-line` (per `.clinerules/typescript-lint-prevention.md`).
- Consistent TypeScript strictness and typing.
- Unified import/order, formatting, and component structure.
- Fast feedback via editor + scripts + CI.

This phase turns style and type rules from “guidelines” into enforced, executable contracts before any functional refactors.

---

## Outcomes

By the end of this phase:

- ESLint, TypeScript, and formatting rules are:
  - Explicit.
  - Project-wide.
  - Applied consistently to `app`, `lib`, `tools`, `__tests__`, and scripts where relevant.
- All `eslint-disable-next-line` usages are removed or replaced with proper code fixes.
- The repo has **zero** known lint errors at HEAD.
- TypeScript is in strict mode (or equivalent granular strict flags) without structural holes.
- Code style (imports, file layout, component patterns) matches `.clinerules` and is auto-enforced.

---

## 1. ESLint Configuration Hardening

### 1.1 Baseline Review

1. Open `eslint.config.js` and document:
   - Base configs used (Next.js, TypeScript, React, etc.).
   - Custom rules (especially:
     - `@typescript-eslint/no-explicit-any`
     - `@typescript-eslint/no-unused-vars`
     - Import order rules
     - React hooks rules
       ).
   - Ignore patterns (e.g. `.next`, `dist`, `build`, etc.).
2. Verify alignment with:
   - Global `.clinerules/typescript-lint-prevention.md`.
   - Workspace `.clinerules/typescript-lint-prevention.md` (no `eslint-disable-next-line`).
   - `.clinerules/coding-style.md` (import order, structure, Next.js route patterns).

Deliverable: section in this file summarizing actual effective ESLint config and any gaps.

### 1.2 Enforce “No eslint-disable-next-line”

1. Search for all occurrences:
   - `eslint-disable-next-line`
   - `eslint-disable`
2. For each occurrence:
   - Identify the underlying issue:
     - Unused vars / imports.
     - `any` usage.
     - React hooks ordering.
     - Import cycles.
     - Test globals.
   - Fix the root cause:
     - Remove unused vars/imports or prefix with `_` where needed.
     - Add proper typing instead of `any`.
     - Restructure hooks to satisfy rules.
     - Adjust imports to break cycles.
   - Remove the disable comment.
3. After all fixes:
   - Optionally add ESLint rule:
     - `no-warning-comments` (or equivalent) targeting `eslint-disable-next-line` to prevent regression (if not already defined).
4. No exceptions:
   - If a scenario seems impossible to satisfy:
     - Re-evaluate the rule; adjust config narrowly (e.g. allow specific test globals) rather than disabling via comments.

---

## 2. TypeScript Strictness & Configuration

### 2.1 `tsconfig.json` Audit

1. Confirm:
   - `strict: true` OR equivalent granular flags:
     - `noImplicitAny`
     - `strictNullChecks`
     - `noImplicitThis`
     - `alwaysStrict`
     - `exactOptionalPropertyTypes`
   - `noUnusedLocals`, `noUnusedParameters` (or enforce via ESLint).
   - `moduleResolution`, `paths`, `baseUrl` are correct for:
     - `app/`, `lib/`, `tools/`, `__tests__/`.
2. Validate inclusion/exclusion:
   - `include` covers:
     - Application code.
     - Shared libs.
     - Type declarations.
   - `exclude` omits:
     - `.next`, build artifacts.
     - Generated files.

### 2.2 Strictness Gaps

1. Identify:
   - Any `tsconfig.*.json` variants for tests, tooling, etc.
   - Any relaxed configs that contradict core strictness.
2. Plan:
   - Converge towards a single strict standard across:
     - App runtime.
     - API routes.
     - Tools registry.
     - Tests (with appropriate `types` configuration).

### 2.3 Implementation Steps

1. Run `tsc --noEmit` and capture all errors.
2. Bucket errors:
   - **Category A – Simple hygiene**:
     - Missing types on params.
     - Obvious `any`.
     - Unused vars.
     - Narrowing needed for nullable values.
   - **Category B – Structural**:
     - Incorrect module resolution.
     - Wrong import paths.
     - Type mismatches between layers (e.g., tool handlers vs UI types).
   - **Category C – Design**:
     - Ambiguous API response contracts.
     - Over-broad unions.
3. Actions:
   - Fix all Category A issues within this phase.
   - For Category B/C:
     - If small & local: fix here.
     - If large/architectural: document and defer to specific later phases (API normalization, tool registry cleanup, etc.) with clear references.

Exit condition for TS:

- `tsc --noEmit` runs clean or has only explicitly documented, tracked exceptions scheduled for other phases (no unknown or ignored errors).

---

## 3. Import, Module, and File Structure Rules

### 3.1 Import Order & Consistency

1. Normalize imports according to `.clinerules/coding-style.md`:
   - Grouping:
     - Built-in (fs, path, etc.).
     - External (npm packages).
     - Internal (absolute/aliased).
     - Parent (`../`), sibling (`./`), index.
   - Always include blank lines between groups.
2. Ensure:
   - No circular imports between `lib`, `tools`, `app` where avoidable.
   - Prefer stable entrypoints (e.g. `lib/index.ts` where appropriate).

If an import-order rule is not yet codified in ESLint:

- Add standardized `import/order` rules there.
- Re-run lint and auto-fix where possible.

### 3.2 Module Boundaries

1. Validate:
   - `lib/` contains shared, framework-agnostic logic.
   - `tools/` encapsulates tool-specific definitions and handlers.
   - `app/` uses these building blocks; does not re-implement logic.
2. Flag violations:
   - API routes importing from random deep paths instead of proper modules.
   - UI code depending on server-only modules or env logic.
3. Fix:
   - Adjust imports to use stable boundaries.
   - Move shared logic to appropriate modules (without behavior change).

---

## 4. Component & Hook Style Enforcement

### 4.1 Component Size & Responsibility

1. Scan `app/components/**` and `components/**`:
   - Identify components > 100 lines or with mixed responsibilities.
2. For each oversized/mixed component:
   - Plan refactor:
     - Extract logic into `useXxx` hooks.
     - Extract UI segments into smaller components.
   - In this phase:
     - Prefer incremental, mechanical splits without changing behavior.
     - Keep props strictly typed.

Document refactors that are too large for this phase and schedule them under the UI-focused phase.

### 4.2 Hooks & Client/Server Boundaries

1. Ensure:
   - Hooks follow React rules (no conditional calls, etc.).
   - Client components:
     - Do not access `process.env` directly.
     - Receive config via props or safe APIs.
   - Server components:
     - Handle env access and sensitive logic.
2. Use ESLint React hooks rules to enforce patterns:
   - `react-hooks/rules-of-hooks`
   - `react-hooks/exhaustive-deps`

Fix all violations as part of this phase.

---

## 5. Test Code Style Alignment

### 5.1 Lint Tests Too

1. Ensure ESLint covers:
   - `__tests__/**`
   - test-related setup files
   - With appropriate environment:
     - `jest` / `vitest` / `playwright` globals as needed.
2. Remove:
   - `eslint-disable` comments.
   - Unused imports and variables.
   - Ad-hoc global leaks.

### 5.2 Type-safe Tests

1. Confirm tests compile under TypeScript:
   - Shared types imported from source where possible.
2. Avoid:
   - `any` in tests except when explicitly modeling “unknown” external data.
   - Copy-pasted types; centralize in `lib/types` or dedicated shared modules.

---

## 6. Automation: Scripts & CI Integration

### 6.1 npm Scripts

1. Ensure presence of:
   - `"lint"`: ESLint over all relevant directories.
   - `"type-check"`: `tsc --noEmit`.
2. Optionally:
   - `"lint:fix"`: ESLint with `--fix`.
   - `"validate"`: `npm run lint && npm run type-check && npm test` (if desired).
3. Confirm:
   - Script targets match actual file structure.
   - No legacy globs referencing deleted paths.

### 6.2 Pre-commit / CI

If using lint-staged or similar:

1. Ensure:
   - TS + ESLint run on staged files.
   - No rule to skip or weaken constraints.
2. CI pipelines:
   - Must fail on:
     - Lint errors.
     - Type errors.
   - Use standardized scripts from Phase 01/02.

---

## 7. Documentation for Standards

All documentation must reflect actual, enforced rules (no aspirational claims).

1. Update or create references in:
   - `docs/testing/index.md` (how lint + types integrate with tests).
   - `docs/usage.md` or `docs/index.md` (developer workflow summary).
   - `.clinerules` if new patterns emerge (or link to existing ones).
2. Ensure:
   - No mention of outdated rules (e.g., permissive `any`, allowed `eslint-disable-next-line`).
   - Examples use correct import order and TypeScript patterns.

---

## 8. Validation & Exit Criteria

This phase is complete only when:

- [ ] `eslint.config.js`:
  - [ ] Explicitly encodes the intended rule set.
  - [ ] Prohibits or effectively eliminates `eslint-disable-next-line` usages.
- [ ] `tsconfig.json`:
  - [ ] Uses strict mode (or equivalent).
  - [ ] Has accurate include/exclude paths.
- [ ] Codebase:
  - [ ] Contains **no** `eslint-disable-next-line` (or other disable) comments, except if strictly justified and documented (target: zero).
  - [ ] Has no obvious unused imports/variables.
  - [ ] Has no untyped function parameters in production code.
- [ ] `npm run lint`:
  - [ ] Passes on a clean checkout.
- [ ] `npm run type-check`:
  - [ ] Passes, or any remaining issues are explicitly documented and assigned to later phases (with file + reason).
- [ ] Tests:
  - [ ] Are included in lint/type-check coverage where appropriate and free from style violations.
- [ ] Documentation:
  - [ ] Describes the actual lint/type-check workflow accurately.

Once all exit criteria are satisfied, the repository has a reliable static-safety baseline and you can proceed to **Phase 03 – Test Suite Stabilization & Pruning**.
