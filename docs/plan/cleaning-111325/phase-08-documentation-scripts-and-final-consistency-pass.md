# Phase 08 – Documentation, Scripts & Final Consistency Pass

## Objective

Perform a **full, deterministic hygiene sweep** over:

- Documentation (`README`, `docs/**`, `.clinerules/**` references)
- Project scripts (`scripts/**`, npm scripts, validation tooling)
- Cross-cutting consistency (names, URLs, env vars, tools, endpoints, features)

This is the final pass that aligns written intent, operational scripts, and implemented behavior after Phases 01–07.

---

## Outcomes

By the end of this phase:

- All user-facing and contributor-facing docs are:
  - Accurate.
  - Free of hype or outdated claims.
  - Explicit about supported scenarios and commands.
- All scripts are:
  - Working.
  - Minimal.
  - Integrated into documented workflows.
- No dangling references to:
  - Removed endpoints, tools, features.
  - Old environment variables.
  - Legacy Docker configs or one-off migration paths.
- The repository is **self-describing**: reading `README.md` + key docs is enough to set up, run, and extend Hyperpage according to the current architecture.

---

## 1. Documentation Accuracy & Scope Audit

### 1.1 Top-Level Documentation

Targets:

- `README.md`
- `docs/index.md`
- `docs/usage.md`
- `docs/installation.md`
- `docs/CONTRIBUTING.md`
- `docs/roadmap.md`

Checklist:

1. `README.md`:
   - Describes:
     - What Hyperpage does in factual technical terms.
     - Minimal setup:
       - Node version (from Phase 01).
       - `npm install` / `npm ci`.
       - `npm run dev` / basic Docker usage.
     - Links to:
       - `docs/installation.md`
       - `docs/testing/index.md`
       - `docs/tool-integration-system.md`
       - `docs/config-management.md`
   - Remove/adjust:
     - Any claims about:
       - 100% coverage.
       - Specific performance numbers.
       - Features no longer implemented.
2. `docs/index.md` / `docs/usage.md`:
   - Reflect:
     - Current navigation.
     - Real flows (portal, widgets, tools).

Actions:
- Update or remove any sections referencing deprecated tools, endpoints, or configs identified in Phases 04–07.

### 1.2 Architecture & Security Docs

Targets:

- `docs/architecture/**`
- `docs/security.md`
- `docs/tool-integration-system.md`
- `docs/performance.md`
- `docs/logging.md`
- `docs/monitoring.md`
- `docs/caching.md`
- `docs/persistence.md`
- `.clinerules/**` (only if contradictions with reality are found)

Checklist:

1. Align with:
   - API normalization (Phase 04).
   - Tool registry rules (Phase 05).
   - UI/component architecture (Phase 06).
   - Runtime/DB story (Phase 07).
2. Ensure:
   - No diagrams or descriptions contradict the actual code:
     - Registry-driven tools.
     - Single API routing model.
     - Error envelopes.
     - Security practices.

If any architectural doc is aspirational rather than implemented:

- Either:
  - Update it to “current state”.
  - Or clearly separate “Today” vs “Future Work” without implying completion.

---

## 2. Testing & Workflow Documentation

Targets:

- `docs/testing/index.md`
- `docs/plan/**` (this cleaning plan)
- `docs/operations/**` (if present)

Checklist:

1. `docs/testing/index.md`:
   - Document:
     - Test taxonomy from Phase 03:
       - Unit, integration, e2e, performance, grafana.
     - Exact commands:
       - `npm test`, `npm run test:unit`, `npm run test:integration`, etc.
     - Required environments (DB, Docker, env vars).
   - Remove:
     - Old commands that no longer exist.
2. Cleaning plan (`docs/plan/cleaning-111325/**`):
   - Confirm:
     - Phases 01–08 are internally consistent.
     - Each phase’s exit criteria reflect actual intended target, not fantasy.

Result:
- New contributors can reliably run tests and understand coverage expectations.

---

## 3. Scripts Directory Hygiene

Targets:

- `scripts/**`
  - `bundle-analysis.sh`
  - `deploy-production.sh`
  - `fix-imports.mjs`
  - `fix-relative*`
  - `migrate-*`
  - `validate-*`
  - Any others.

### 3.1 Inventory & Classification

For each script:

1. Document:
   - Purpose.
   - Dependencies (Node version, CLIs, env vars).
   - Intended environment (local dev, CI, ops-only).
2. Classify:
   - **Core**: used in CI or documented workflows.
   - **Support**: useful for maintainers; keep and document.
   - **Legacy**: not referenced; candidate to remove.

### 3.2 Validation Rules

1. Every kept script:
   - Must run successfully given documented prerequisites.
   - Must not:
     - Reference removed paths or tools.
     - Bake in secrets or env-specific values.
2. Integrate with npm scripts where appropriate:
   - e.g., `npm run validate` → calls relevant `scripts/validation/*`.

### 3.3 Removal & Consolidation

1. Remove scripts that:
   - Are for one-off historical migrations.
   - Duplicate functionality covered elsewhere.
   - Point to deleted modules.
2. If uncertain:
   - Mark as deprecated and:
     - Add a comment header with:
       - Context.
       - Planned removal date/criteria.

---

## 4. NPM Scripts vs Documentation Consistency

Cross-check:

- `package.json` `"scripts"`:
  - `dev`, `build`, `start`
  - `lint`, `lint:fix`
  - `type-check`
  - `test`, `test:*`
  - `validate` or composite commands
- Documentation references:
  - `README.md`
  - `docs/testing/index.md`
  - `docs/operations/**`
  - `docs/docker/**`

Rules:

1. Every documented command must:
   - Exist in `package.json`.
   - Work under the assumptions stated.
2. No extra scripts present that:
   - Are not used or documented (unless explicitly marked internal).

Actions:

- Align names (e.g., `test:e2e` vs `e2e`).
- Prefer a canonical `validate` script for CI, documented as such.

---

## 5. Cross-Cutting Consistency Checks

### 5.1 Naming & Keys

Verify consistency for:

- Tool keys: `github`, `gitlab`, `jira`, `ticketing`, etc.
- Env vars: `ENABLE_GITHUB`, `ENABLE_GITLAB`, etc.
- API paths: `/api/tools/[tool]/[endpoint]` etc.
- Widget identifiers: `apiEndpoint` values.

All references in:

- Code
- Tests
- Docs

must match; fix any off-by-one or stale key variants.

### 5.2 Links & References

Search for:

- Dead links (internal markdown links to removed files).
- Mentions of:
  - Removed endpoints.
  - Removed scripts.
  - Old configuration patterns.

Fix or remove each, ensuring:

- No documentation points to non-existent components.

---

## 6. Compliance with `.clinerules` & Global Standards

Validate that final state respects:

- `.clinerules/avoid-marketing-hype` / `documentation-accuracy.md`:
  - No invented metrics, guarantees, or unimplemented features.
- `.clinerules/coding-style.md`:
  - Examples and snippets in docs reflect real patterns.
- `.clinerules/coding-principles.md`:
  - Registry-driven tools, component decomposition, security guidelines.
- `.clinerules/typescript-lint-prevention.md`:
  - No advice or examples that conflict with linting strategy.

If discrepancies are found:

- Adjust docs to the actual enforced rules.
- Only adjust `.clinerules` if the project’s actual standards have intentionally changed (and then document that change explicitly).

---

## 7. Optional: High-Level CHANGELOG / Maintenance Notes

While not mandatory, consider:

1. Adding/maintaining:
   - `CHANGELOG.md` or `docs/operations/changelog.md`.
2. Capture:
   - Major behavioral changes from this cleaning initiative.
   - Especially:
     - Deprecated endpoints/tools.
     - New scripts and standardized flows.

Ensure:

- Wording is factual.
- No inflated claims; only list what genuinely changed.

---

## 8. Validation & Exit Criteria

This final phase is complete only when:

- [ ] `README.md`:
  - [ ] Provides an accurate, minimal, and working getting-started flow.
  - [ ] Links to detailed docs instead of duplicating stale content.
- [ ] Core docs (`docs/index.md`, `docs/usage.md`, `docs/installation.md`, `docs/testing/index.md`, `docs/config-management.md`, `docs/tool-integration-system.md`, `docs/security.md`, `docs/ui.md`, `docs/persistence.md`):
  - [ ] Contain no references to removed or broken commands, endpoints, tools, or configs.
  - [ ] Reflect the architecture and patterns defined in Phases 01–07.
- [ ] Scripts (`scripts/**` and npm scripts):
  - [ ] All kept scripts are functional and documented.
  - [ ] All obsolete scripts are removed or clearly marked deprecated.
  - [ ] CI uses the documented, canonical scripts.
- [ ] Cross-cutting consistency:
  - [ ] Tool keys, env names, endpoint paths, and widget `apiEndpoint`s are consistent across code, tests, and docs.
  - [ ] No `.clinerules` contradictions with actual implementation.
- [ ] Documentation quality:
  - [ ] No hype language or unverifiable metrics.
  - [ ] Clear separation of current state vs future roadmap.
- [ ] Cleaning plan (`docs/plan/cleaning-111325/**`):
  - [ ] Accurately describes the implemented cleanup strategy and can be used as a reference for future maintenance.

Once all criteria are met, the Hyperpage repository is **fully cleaned, documented, and governable**, with clear standards for future contributions and extensions.
