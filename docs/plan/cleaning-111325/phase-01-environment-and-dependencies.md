# Phase 01 – Environment & Dependencies Hardening

## Objective

Establish a stable, deterministic, and well-documented development/runtime environment for Hyperpage.  
All subsequent cleaning phases depend on this foundation.

---

## Outcomes

By the end of this phase:

- Node, npm, and package manager usage are clearly defined and documented.
- Dependencies are audited, normalized, and updated where safe.
- npm scripts are coherent, minimal, and reflect reality.
- All developers can reproduce installs, builds, and test runs consistently.
- No critical dependency drift or unused/legacy packages remain.

---

## 1. Environment Baseline

### 1.1 Node & Package Manager

1. Detect current Node version in use:
   - Check for `.nvmrc`, `.node-version`, or similar.
   - If missing:
     - Choose a version compatible with:
       - Next.js version in `package.json`
       - TypeScript version
       - Playwright/Vitest requirements
     - Recommended: **active LTS** at time of work.
2. Document chosen runtime:
   - Add `.nvmrc` if not present.
   - Ensure README / `docs/installation.md` specify:
     - Required Node version
     - Recommended package manager (npm) and minimum version.

### 1.2 Lockfile Integrity

1. Confirm that `package-lock.json` is in sync with `package.json`.
2. Standardize:
   - Officially recommend `npm ci` for CI and reproducible installs.
3. Action:
   - If lockfile is inconsistent:
     - Run `npm install` locally to regenerate.
     - Commit updated lockfile only after all tests and builds pass.

---

## 2. Dependency Audit

### 2.1 Inventory

1. Extract current dependencies:
   - `dependencies`
   - `devDependencies`
2. Annotate each with:
   - Purpose (routing, DB, tests, lint, etc.).
   - Where it is used (key files/directories).

Deliverable: a short internal table (can live in this phase file or separate internal note) mapping:
- Package → Category → Used in (paths) → Keep / Remove / Upgrade.

### 2.2 Remove Unused Dependencies

For each dependency:

1. Perform codebase search:
   - If no imports/usage:
     - Mark as candidate for removal.
2. Confirm:
   - Not used in scripts.
   - Not used in configs (Next, ESLint, Vitest, Docker, etc.).
3. Action:
   - Remove confirmed-unused dependencies from `package.json`.
   - Re-run `npm install` to update lockfile.
   - Re-run:
     - `npm run lint`
     - `npm test` / `npm run test`
     - `npm run build`
   - Only keep removal if all pass or failures are unrelated and documented.

### 2.3 Identify Libraries to Consolidate

1. Check for overlapping tools:
   - Multiple HTTP clients, multiple assertion libs, etc.
2. If duplicates exist:
   - Choose primary/standard.
   - Mark secondary as deprecation candidate for Phase 06+ (code refactor).
3. No immediate code rewrites in this phase:
   - Only identify, do not partially migrate.
   - Record decisions in this document for later phases.

---

## 3. Safe Upgrades Strategy

### 3.1 Define Upgrade Policy

1. **Patch & Minor upgrades**
   - Allowed in this phase if:
     - No breaking changes documented.
     - Project builds + tests + lint pass.
2. **Major upgrades**
   - Do **not** execute blindly.
   - For each major bump candidate:
     - Document:
       - Current version vs latest.
       - Summary of breaking changes (from upstream changelog).
       - Impacted areas in Hyperpage.
     - Assign to a later dedicated phase (e.g., Phase 05+).

### 3.2 Concrete Upgrade Steps

For each package:

1. Check current vs latest with `npm outdated` (reference; command execution is part of actual work).
2. For **patch/minor**:
   - Update version.
   - Reinstall.
   - Run:
     - `npm run lint`
     - `npm test`
     - `npm run build`
   - If any regression:
     - Revert change.
     - Document in this file (package + error summary).

3. For **tooling packages** (ESLint, TypeScript, Vitest, Playwright, Next, etc.):
   - Treat carefully:
     - Prefer deferring major changes to specific phases:
       - Lint rules alignment phase
       - Test stabilization phase
       - Next.js upgrade phase

---

## 4. npm Scripts Normalization

### 4.1 Inventory Scripts

1. Enumerate all scripts in `package.json`, for example (to be verified):
   - `dev`
   - `build`
   - `start`
   - `lint`
   - `test` / `test:*`
   - `e2e`
   - `type-check`
   - `validate` or similar wrappers
2. For each script:
   - Confirm:
     - It runs successfully with current code and deps.
     - It is used (by docs, CI, or workflows).
   - Mark:
     - **Active**: stable, supported.
     - **Legacy**: no longer referenced; candidate to remove/rename.
     - **Broken**: fails; must be fixed or removed with justification.

### 4.2 Standardize Script Set

Target minimal, coherent set (adapt to real `package.json`):

- `dev`: Start local Next.js dev server.
- `build`: Production build.
- `start`: Start production server.
- `lint`: Run ESLint on src/app/lib/tools/tests.
- `type-check`: Run TypeScript compiler with `--noEmit`.
- `test`: Run unit/integration tests (document which).
- `test:e2e`: Run e2e tests (Playwright).
- `validate`: Composite (`lint`, `type-check`, `test`) for CI.

Actions:

1. Remove or rename misleading / broken scripts:
   - Do not keep scripts that reference non-existing files or obsolete tools.
2. Ensure consistency with documentation:
   - `README.md` and `docs/testing/index.md` must only mention real, working scripts.
3. Ensure CI configuration (if present) uses the normalized scripts only.

---

## 5. Tooling Configuration Sanity Check

### 5.1 ESLint

1. Open `eslint.config.js`:
   - Confirm:
     - Next + TypeScript + React rules integrated.
     - No `eslint-disable-next-line` recommendations/allowances (per `.clinerules`).
     - Import order / unused vars rules are active.
2. Note any inconsistencies:
   - To be corrected in Phase 02 (Lint & Style).

### 5.2 TypeScript

1. Open `tsconfig.json`:
   - Confirm:
     - `strict` mode (or equivalent strict options) enabled.
     - Paths / baseUrl consistent with folder structure.
   - Identify:
     - Any misaligned include/exclude patterns (e.g. missing `__tests__`, `tools`, etc.).
2. Do not deeply refactor TS config here:
   - Only record issues for Phase 02.

### 5.3 Vitest / Playwright / Test Configs

1. Inspect:
   - `vitest.config.ts`
   - `vitest.setup.ts`
   - `__tests__/e2e/playwright.config.ts`
2. Verify:
   - No references to removed dependencies.
   - Configs reflect reality of directory structure.
3. Record breakages for Phase 03 (Test stabilization).

---

## 6. Documentation Updates for this Phase

All documentation changes must follow `documentation-accuracy.md` (no hype, no false claims).

1. `docs/installation.md`:
   - Update Node/npm requirements.
   - Add recommended install command:
     - `npm ci` for CI / reproducible builds.
2. `README.md`:
   - Align quickstart section with actual scripts and Node version.
3. `docs/config-management.md` (if environment constraints depend on deps):
   - Ensure mentions of tooling (e.g., Next, database clients) match actual versions.

No mention of features or guarantees that are not yet true in code.

---

## 7. Validation & Exit Criteria

This phase is complete only when:

- [ ] Node version policy is defined and documented (and `.nvmrc` exists if chosen).
- [ ] `package.json` dependencies:
  - [ ] Have no obvious unused or dead packages.
  - [ ] Have safe patch/minor updates applied or explicitly deferred with notes.
- [ ] `npm run dev`, `npm run build`, `npm test`, and `npm run lint`:
  - [ ] Exist.
  - [ ] Behavior is understood and documented.
- [ ] Scripts in docs match reality (no broken commands referenced).
- [ ] All findings that require later work are recorded for:
  - Phase 02 – Linting & Style
  - Phase 03 – Test Stabilization
  - Later phases (API, tools, UI, etc.)

Once all checklist items are satisfied and validated locally and in CI, proceed to **Phase 02 – Linting & Code Style Enforcement**.
