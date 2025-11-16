# Contributing to Hyperpage

Thanks for helping keep Hyperpage accurate and maintainable. This project prioritises factual documentation, deterministic tooling, and registry-driven patterns. Please read this guide before sending a pull request.

## Development Workflow

1. **Plan** – capture the intent of your change, confirm the affected docs/tests, and reference relevant `.clinerules` files.
2. **Act** – implement the change with small, reviewable commits. Update docs and tests alongside the code.
3. **Validate** – run the lint/type/test suite locally before opening a PR.

The repository uses the PLAN/ACT convention internally, but you are not required to use any specific AI assistant or tooling. Clear descriptions in issues and pull requests are more important than automation choices.

## Prerequisites

- Node.js **22.x** (matching [`.nvmrc`](../.nvmrc))
- npm 10+
- PostgreSQL 15+ reachable via `DATABASE_URL`
- Optional Redis if you need to exercise the session clustering features

## Local Setup

```bash
# Clone the repository
git clone https://github.com/hyperpage/hyperpage.git
cd hyperpage

# Install dependencies
npm install

# Copy the environment template and edit it
cp .env.sample .env.dev
# Point DATABASE_URL at your Postgres instance and enable the tools you need

# Create or migrate the schema
npm run db:migrate

# Start the Next.js dev server (loads .env.dev automatically)
npm run dev
```

Use `docker compose -f docker-compose.yml -f docker-compose.test.yml up -d postgres redis` if you prefer running Postgres/Redis via containers.

## Coding Guidelines

- Follow the patterns documented in `.clinerules/` (coding style, documentation accuracy, lint prevention).
- Prefer hook-first components and keep UI logic decomposed (`Portal.tsx` + `app/components/hooks/**` are good references).
- Keep TypeScript strict: avoid `any`, lean on discriminated unions, and keep types co-located with the modules they describe.
- Respect the registry-driven architecture. Tools should register themselves via `registerTool` and client code must consume `ClientSafeTool` objects only.
- Keep persistent logic inside repositories (`lib/database/**`) and avoid reaching directly into Drizzle tables from components.

## Documentation Standards

- Update the relevant doc whenever you add/remove a capability. The README links directly to `docs/installation.md`, `docs/testing/index.md`, `docs/tool-integration-system.md`, and `docs/config-management.md`.
- Never claim a feature exists unless it is already merged. If you need to describe future work, label it clearly as such.
- Reference `.clinerules/avoid-marketing-hype.md` for wording expectations.

## Testing & Validation

1. Copy `.env.test.example` to `.env.test` and start the canonical stack when running Postgres-backed tests:
   ```bash
   cp .env.test.example .env.test
   npm run db:test:up
   ```
2. Run the scripts expected by CI:
   ```bash
   npm run lint
   npm run type-check
   npm run test:unit
   npm run test:integration
   ```
   Optional suites (`npm run test:integration:tools`, `npm run test:e2e`, `npm run test:perf`) should only run when you provide the required tokens/flags.
3. Use `npm run validate` locally before pushing if you want the same formatting/linting stack that CI enforces.

## Pull Request Checklist

- [ ] Reference the issue or cleaning plan phase you are addressing.
- [ ] Include screenshots or logs if you touched UI or API behaviour.
- [ ] Mention any follow-up tasks if you had to defer work.
- [ ] Keep commits scoped; avoid mixing unrelated refactors.

Thanks again for contributing!
