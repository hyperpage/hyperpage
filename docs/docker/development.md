# Docker Development Setup

Use Docker Compose to bootstrap the supporting services (PostgreSQL + Redis) for local work, or to run the entire stack in containers when needed. Most developers run `npm run dev` on the host and let Compose provide the databases.

## When to Use Compose

| Scenario                      | Recommendation                                                                                                                             |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Local feature/dev workflow    | Run `npm run dev` on your machine. Use `npm run db:test:up` (or `docker compose up -d postgres redis`) to bring up Postgres/Redis.         |
| Vitest / integration suites   | Use `npm run db:test:up` before `npm test` (the scripts shell out to `docker compose -f docker-compose.yml -f docker-compose.test.yml …`). |
| Full containerized app (rare) | Use `docker compose up hyperpage` if you want the Next.js dev server in a container. Most contributors don’t need this.                    |

## Quick Start

```bash
# 1. Copy the environment template
cp .env.sample .env.dev

# 2. Start Postgres + Redis (preferred helper scripts)
npm run db:test:up      # starts postgres+redis with docker-compose

# 3. Start the Next.js dev server on your host (uses .env.dev)
npm run dev

# 4. When finished
npm run db:test:down    # stops postgres+redis
```

> **Tip:** The helper scripts (`npm run db:test:up` / `npm run db:test:down`) wrap `docker compose -f docker-compose.yml -f docker-compose.test.yml …` so CI and local workflows behave the same. Use the raw `docker compose` commands only when you need custom options.

## Services Overview

| Service              | Container            | Host Port        | Default Connection                                | Notes                                                                                              |
| -------------------- | -------------------- | ---------------- | ------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| PostgreSQL           | `hyperpage-postgres` | `localhost:5432` | `postgresql://postgres:@localhost:5432/hyperpage` | Auth uses scram; set `DATABASE_URL` in `.env.dev` to the connection string you prefer.             |
| Redis                | `hyperpage-redis`    | `localhost:6379` | `redis://localhost:6379`                          | AOF enabled, no password by default.                                                               |
| Hyperpage (optional) | `hyperpage-app`      | `localhost:3000` | `http://localhost:3000`                           | Runs `npm run dev` inside the container. Only needed if you want a fully containerized dev server. |

## Common Commands

```bash
# Start services (foreground)
docker compose up postgres redis

# Start services (detached)
docker compose up -d postgres redis

# View logs
docker compose logs -f postgres
docker compose logs -f redis
docker compose logs -f hyperpage   # if running the app container

# Stop services
docker compose down

# Hard reset (removes volumes)
docker compose down -v && docker volume prune -f
```

The helper scripts wrap the same commands:

```bash
npm run db:test:up       # docker compose up -d postgres redis
npm run db:test:down     # docker compose ... down -v
npm run db:test:reset    # down -v, prune, up
```

## Database Access Examples

```bash
# psql shell inside the container
docker exec -it hyperpage-postgres psql -U postgres -d hyperpage

# Run migrations from host
docker compose run --rm hyperpage npm run db:migrate
```

If you need to expose a different password/URL, update `.env.dev` and restart the containers so `DATABASE_URL` stays in sync with Postgres authentication.

## Redis Access Examples

```bash
# Start redis-cli shell
docker exec -it hyperpage-redis redis-cli

# Monitor traffic
docker exec -it hyperpage-redis redis-cli monitor
```

## Running the App Container (Optional)

Most contributors run `npm run dev` locally. If you want the app inside Docker:

```bash
# Build and start the dev server container along with dependencies
docker compose up -d --build

# Tail application logs
docker compose logs -f hyperpage
```

This maps the repo into `/app` inside the container, so file changes still trigger hot reloads.

## Environment Notes

- `.env.dev` is the only required file for local work. Copy it from `.env.sample` and fill in tokens/secrets.
- `DATABASE_URL`, `REDIS_URL`, and `NEXTAUTH_URL` must point at the Compose-hosted services (`localhost` ports unless you override them).
- `CONFIG_ENV_FILE` / `NEXT_PUBLIC_ENV_FILE` should match the file you actually use (e.g. `.env.dev`).

## Volumes

Compose creates named volumes for persistent data:

- `postgres_data`
- `redis_data`

Manage them with standard Docker commands:

```bash
# List volumes
docker volume ls

# Inspect a volume
docker volume inspect postgres_data

# Remove unused volumes
docker volume prune -f
```

With this setup, you can start/stop services quickly without losing data, keep the host Next.js dev server, and share the same workflow the automated scripts expect.
