# Deployment Guide

Hyperpage is shipped as a traditional Node.js application. The supported deployment paths today are Docker (single host, Compose overlays) and "bring your own" Node/PM2 setups. Serverless platforms such as Vercel are not covered because the app depends on long-lived connections to PostgreSQL and Redis.

## Supported Approaches

### 1. Docker Image

- Multi-stage `Dockerfile` builds the app with Node 22 and copies only the production artifacts into the final image.
- Runtime user: non-root `hyperpage` with `dumb-init` as PID 1.
- Exposes port `3000` by default. Configure environment variables via `--env-file` or direct `-e` flags.

Example:

```bash
docker build -t hyperpage .
docker run \
  -p 3000:3000 \
  -e NODE_ENV=production \
  -e CONFIG_ENV_FILE=.env.production \
  --env-file .env.production \
  hyperpage
```

### 2. Docker Compose (Local/Staging Production Mock)

Use the provided overlays to run the app, PostgreSQL, and Redis together.

```bash
# Staging-like stack
docker compose -f docker-compose.yml -f docker-compose.staging.yml --env-file .env.staging up -d

# Production-like stack
docker compose -f docker-compose.yml -f docker-compose.prod.yml --env-file .env.production up -d
```

Stop stacks with `docker compose ... down` (add `-v` to clear volumes when needed). Adjust `.env.staging` / `.env.production` to match your own secrets.

### 3. Bare Metal / PM2

```bash
npm install --production=false
npm run build
npm start   # or pm2 start npm --name hyperpage -- start
```

Ensure `DATABASE_URL`, `REDIS_URL`, and all `ENABLE_*` flags are set in the environment before starting the process.

## Secrets & Configuration

- `.env.sample` lists all supported variables. Copy it to `.env.dev`, `.env.production`, etc., and keep real values out of version control.
- `CONFIG_ENV_FILE` tells the runtime which env file to load when running inside Docker/PM2.
- For containerized deployments, mount your env file read-only or use your orchestrator’s secret store.
- There are no first-party Kubernetes manifests. If you deploy to Kubernetes, create your own Deployment/StatefulSet/Secret objects and document them locally.

## CI/CD Workflows

GitHub Actions workflows in `.github/workflows/` cover linting, testing, container builds, and deployment hooks. Key files:

| File                        | Purpose                                                |
| --------------------------- | ------------------------------------------------------ |
| `ci-cd.yml`                 | Lint, type-check, Vitest, and Playwright (matrixed)    |
| `container-registry.yml`    | Builds/pushes the Docker image + security scans        |
| `production-deployment.yml` | Example deployment job; customize or disable as needed |
| `test-environments.yml`     | Spins up ephemeral environments when required          |
| `cicd-monitoring.yml`       | Optional metrics/monitoring hooks                      |

Set the corresponding secrets (registry credentials, tokens, Grafana API keys) in your GitHub repository before enabling these workflows.

## Operational Checklist

- `DATABASE_URL` must point at PostgreSQL 15+ with SSL requirements that match your hosting environment.
- `REDIS_URL` is optional locally but required if you need session persistence across processes.
- Run `npm run validate` (lint + format + type-check + unit tests) before deploying.
- Scrape `/api/metrics` or forward logs from `pino` to your monitoring stack to catch regressions early.

When in doubt, treat Docker + Compose as the canonical deployment story. Everything else requires additional engineering effort that should be documented separately.
