# Phase 02 – Linting, Type Safety & Code Style Enforcement

## Objective

Turn linting, typing, and formatting into enforced, automated contracts across the repository, aligned with `.clinerules` and the real toolchain:

- Zero tolerance for `eslint-disable-next-line` and similar blanket disables (see `.clinerules/typescript-lint-prevention.md`).
- Strict, project-wide TypeScript (already enabled) with no silent gaps.
- Consistent import order, module boundaries, and component structure.
- Fast feedback via editor integration, npm scripts, and CI.

This phase does not change behavior; it makes existing conventions executable and non-optional.

---

## Current Baseline (Snapshot)

As of this phase:

- **ESLint**
  - Config: `eslint.config.js`:
    - Extends: `next/core-web-vitals`, `next/typescript` via `FlatCompat`.
    - Ignores: `.next/**`, `next-env.d.ts`.
    - No custom rules yet for:
      - `no-warning-comments` on `eslint-disable-next-line`.
      - Import order.
      - Centralized logger usage.
      - Expanded ignore patterns for build artifacts.
  - Scripts (`package.json`):
    - `"lint": "eslint ."`
    - `"lint:sec": "npx eslint . --ext .ts,.tsx --config eslint.config.js --rule 'no-console: error' --rule 'no-debugger: error' --rule 'no-alert: error'"`

- **TypeScript**
  - `tsconfig.json`:
    - `"strict": true`, `"noEmit": true`, `isolatedModules: true`.
    - `allowJs: true`, `skipLibCheck: true`.
    - Path aliases for `@/*`, `@/app/*`, `@/lib/*`, `@/components/*`, `@/tools/*`, `@/tests/*`, `@/types/*`.
    - `include`: all `**/*.ts`, `**/*.tsx`, `next-env.d.ts`, `.next/types/**/*.ts`, `vitest.globals.d.ts`, specific validation scripts.
    - `exclude`: `node_modules`.
  - Type support for tests:
    - `types`: `vitest`, `node`, `playwright`.

- **Formatting & Tests**
  - Prettier scripts:
    - `"prettier": "npx prettier --check ."`
    - `"prettier:fix": "npx prettier --write ."`
  - Validation:
    - `"validate": "npm run prettier:fix && npm run lint && npm run lint:sec && npm run type-check && npm test"`

This plan builds directly on that baseline without assuming rules or integrations that do not yet exist.

---

## 1. ESLint Configuration Hardening

### 1.1 Document & Extend Effective Config

Actions:

1. Expand `eslint.config.js` to:
   - Keep `next/core-web-vitals` and `next/typescript`.
   - Add an explicit `rules` block and consistent ignore patterns for build artifacts (e.g. `.next/**`, `dist/**`, `build/**` if present).
2. In this document, maintain a short, concrete snippet showing the intended ESLint structure so it is easy to verify the code matches the plan:

Example (illustrative; must match real config when applied):

```ts
const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [".next/**", "next-env.d.ts"],
    rules: {
      // Import organization
      "import/order": [
        "error",
        {
          groups: [
            "builtin",
            "external",
            "internal",
            "parent",
            "sibling",
            "index",
          ],
          "newlines-between": "always",
        },
      ],

      // Hooks and React best practices (inherited from Next presets, ensure enabled)
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "error",
    },
  },
];
```

Deliverable:

- This file contains the agreed ESLint structure.
- `eslint.config.js` is updated to match and becomes the single source of truth.

### 1.2 Ban `eslint-disable` Comments

Execution steps:

1. Search repository for:
   - `eslint-disable-next-line`
   - `eslint-disable `
   - `eslint-disable-line`
2. For each usage:
   - Identify the underlying violation:
     - Unused vars/imports.
     - `any` usage.
     - React hooks issues.
     - Environment or globals problems.
     - Import cycles.
   - Fix the root cause:
     - Remove or prefix unused bindings with `_`.
     - Add proper TypeScript types instead of `any`.
     - Restructure hooks to follow the Rules of Hooks.
     - Adjust imports or split modules to avoid cycles.
3. Add a preventive rule in `eslint.config.js`:
   - Use a pattern (e.g. `no-warning-comments` or a custom rule/plugin) targeting `eslint-disable-next-line` to avoid new occurrences.
4. If an exception is absolutely unavoidable:
   - Treat it as a special case:
     - Document file path, rule, and justification in this plan.
     - Keep goal: zero such exceptions long term.

Target state:

- No generic disable comments in core code or tests.
- No reliance on disables to get a green build.

---

## 2. TypeScript Strictness & Configuration

### 2.1 Confirm Strict Baseline

Actions:

1. Keep `strict: true` as the canonical strictness flag.
2. Review:
   - `allowJs: true`:
     - Inventory any `.js` files in use.
     - Plan removal or typing; once feasible, switch off `allowJs` in a later step.
   - `skipLibCheck: true`:
     - Acceptable for this phase; revisit when third-party types are stable.
3. Verify:
   - `paths` resolve correctly for `app`, `lib`, `tools`, `__tests__`, `types`.
   - `include` / `exclude` accurately mirror project layout without hiding TypeScript errors.

### 2.2 `tsc --noEmit` as Gate

Actions:

1. Run `npm run type-check` on a clean checkout.
2. Categorize errors:
   - **Category A – Hygiene (must fix in Phase 02)**:
     - Missing parameter/return types.
     - Implicit `any`.
     - Unused locals/parameters (if not handled by ESLint).
     - Narrowing for nullable values.

   - **Category B – Structural (fix where local, otherwise document)**:
     - Incorrect import paths.
     - Module resolution problems.
     - Misaligned shared types between `app`, `lib`, `tools`.

   - **Category C – Design (may defer with explicit tracking)**:
     - Over-broad unions.
     - Ambiguous or inconsistent API/tool contracts.

3. Implement:
   - Fix all Category A issues.
   - Fix Category B issues that are small and local.
   - For remaining B/C issues:
     - Add explicit entries in this plan:
       - File, error, short description.
       - Link to the later phase responsible (e.g. API normalization, tool cleanup).

Exit condition (TypeScript):

- `npm run type-check` passes, or:
  - Residual failures are explicitly listed in this document and assigned to later phases (no unknown or ignored TS errors).

---

## 3. Import Order, Module Boundaries & Code Layout

### 3.1 Import Order Enforcement

Actions:

1. Configure `import/order` (see 1.1) to enforce:
   - Groups:
     - builtin
     - external
     - internal (aliased via `@/...`)
     - parent (`../`)
     - sibling (`./`)
     - index

   - With blank lines between groups.

2. Run:
   - `eslint . --fix` (or `npm run lint -- --fix`) to auto-apply order where possible.

3. Resolve:
   - Remaining conflicts and cycles manually.
   - Prefer stable module entrypoints over deep nested imports.

### 3.2 Module Boundaries

Actions:

1. Verify boundaries:
   - `lib/`: shared, framework-agnostic logic (e.g., utilities, services).
   - `tools/`: tool-specific types, handlers, registry entries.
   - `app/`: uses `lib` and `tools` but does not import from server-only internals incorrectly.
2. Fix violations without behavior changes:
   - Move shared logic into `lib`.
   - Introduce or use existing public entrypoints instead of deep imports.
3. Record any remaining cross-boundary issues that require architectural refactors for later phases.

---

## 4. Component & Hook Style Enforcement

### 4.1 Component Size & Responsibility

Actions:

1. Scan `app/components/**` and `components/**`:
   - Detect components significantly exceeding ~100 lines or mixing concerns.
2. For each:
   - Plan and implement mechanical decompositions:
     - Extract stateful/data-fetch logic into `useXxx` hooks.
     - Extract repeated UI fragments into smaller presentational components.
   - Keep:
     - Public API and behavior stable.
     - Strictly typed props.

3. Defer:
   - Complex UI redesigns and non-trivial reflows to the dedicated UI/architecture phases.
   - Track large refactor candidates explicitly in this plan.

### 4.2 Hooks & Environment Boundaries

Actions:

1. Ensure React hooks rules are enforced (1.1).
2. Fix all violations:
   - No conditional hooks.
   - Correct, explicit dependency arrays.
3. Enforce environment separation:
   - Client components do not read `process.env` directly.
   - Sensitive config lives in server components/handlers; passed via props or backend APIs.

---

## 5. Tests: Style, Linting & Types

### 5.1 Lint the Test Suite

Actions:

1. Confirm ESLint runs on:
   - `__tests__/**`
   - `vitest.setup.ts`
   - Playwright configs, mocks, and helpers.
2. Ensure:
   - Test environments (`vitest`, `playwright`) are configured via `tsconfig` / ESLint env/plugins rather than `eslint-disable` comments.
3. Cleanup:
   - Remove remaining `eslint-disable*` comments in tests.
   - Remove unused imports/variables.
   - Normalize import order.

### 5.2 Type-Safe Tests

Actions:

1. Ensure tests compile cleanly under `npm run type-check`:
   - Use shared types from `lib/types` or source modules.
2. Avoid:
   - Arbitrary `any` in tests (except where modeling external unknown data explicitly).
   - Duplicated type definitions when shared ones exist.

---

## 6. Automation: Scripts & CI Integration

### 6.1 NPM Scripts

Actions:

1. Keep core scripts:
   - `"lint": "eslint ."`
   - `"lint:sec": "npx eslint . --ext .ts,.tsx --config eslint.config.js --rule 'no-console: error' --rule 'no-debugger: error' --rule 'no-alert: error'"`
   - `"type-check": "npx tsc --noEmit"`
   - `"prettier"` / `"prettier:fix"`

2. Optionally add:
   - `"lint:fix": "eslint . --fix"`

3. Validate:
   - All relevant directories (app, lib, tools, **tests**, scripts) are covered.

### 6.2 Validation Pipeline & CI

Actions:

1. Treat `"validate"` as the canonical gate:

   ```json
   "validate": "npm run prettier:fix && npm run lint && npm run lint:sec && npm run type-check && npm test"
   ```

2. CI should:
   - Use `npm ci`.
   - Run `npm run validate`.
   - Fail on:
     - ESLint errors.
     - TypeScript errors.
     - Test failures.

3. If pre-commit hooks or lint-staged are introduced/updated:
   - Wire them to the same scripts (or narrowed equivalents) without weakening enforcement.

---

## 7. Documentation Alignment

Actions:

1. Update or confirm references in:
   - `docs/index.md` / `docs/usage.md`:
     - Describe `lint`, `type-check`, `validate` as part of the developer workflow.
   - Testing docs:
     - Note that tests are subject to linting and TS checks.
2. Ensure:
   - No documentation suggests permissive `any` usage or allows `eslint-disable-next-line`.
   - Examples follow:
     - Import order conventions.
     - Strict, explicit typing.
     - Correct client/server responsibility boundaries.

All statements must reflect the actual configuration (`documentation-accuracy.md`).

---

## 8. Exit Criteria

This phase is complete when:

- [x] `eslint.config.js`
  - [x] Extends the Next + TypeScript presets.
  - [x] Contains explicit rules for:
    - Import order.
    - React hooks.
    - Preventing or flagging `eslint-disable-next-line` usage.
  - [x] Ignores only appropriate build artifacts.
- [x] `tsconfig.json`
  - [x] Remains in strict mode.
  - [x] Has accurate `include`/`exclude` and path mappings.
- [x] Codebase
  - [x] Contains no unapproved `eslint-disable*` comments (any exception is documented here).
  - [x] Has no obvious unused imports/variables reported by linters.
  - [x] Avoids untyped parameters in production code; remaining cases are intentional and documented.
- [x] Tooling
  - [x] `npm run lint` passes on a clean checkout.
  - [x] `npm run lint:sec` passes or flags only deliberate, documented locations.
  - [x] `npm run type-check` passes; any remaining failures are explicitly listed and assigned to later phases.
  - [x] `npm test` passes.
- [x] Tests
  - [x] Are covered by linting and type-checking where appropriate and free from blanket disables.
- [x] Documentation
  - [x] Accurately describes the enforced lint/type/format workflow.

Once all exit criteria are satisfied, the repository has a reliable static-safety baseline and can proceed to **Phase 03 – Test Suite Stabilization & Pruning**.
