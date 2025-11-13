# Docker Development Setup

This guide explains how to use Docker Compose for local development with PostgreSQL and Redis.

## Quick Start

### Prerequisites

- Docker Desktop installed
- Docker Compose v2.0+

### 1. Start Services

```bash
# Start PostgreSQL and Redis services
docker-compose up -d

# Or start all services including Hyperpage
docker-compose up -d --build
```

### 2. Configure Environment

```bash
# Copy development environment template
cp .env.local.sample .env.local

# Edit .env.local to configure your tool integrations (GitHub, GitLab, Jira, etc.)
# See .env.local.development for examples
```

### 3. Access Services

- **Hyperpage**: http://localhost:3000
- **PostgreSQL**: localhost:5432
- **Redis**: localhost:6379

## Services

### PostgreSQL 18-alpine

- **Host**: postgres
- **Port**: 5432
- **Database**: hyperpage
- **Username**: postgres
- **Password**: hyperpage_dev
- **Connection**: `postgresql://postgres:hyperpage_dev@postgres:5432/hyperpage`

### Redis 8-alpine

- **Host**: redis
- **Port**: 6379
- **Connection**: `redis://redis:6379`

### Hyperpage (Next.js)

- **Port**: 3000
- **Command**: `npm run dev`
- **Auto-reload**: Enabled with volume mounting
- **Dependencies**: Waits for PostgreSQL and Redis to be healthy

## Common Commands

### Service Management

```bash
# Start services
docker-compose up -d

# View logs
docker-compose logs -f hyperpage
docker-compose logs -f postgres
docker-compose logs -f redis

# Stop services
docker-compose down

# Reset databases (removes all data)
docker-compose down -v && docker-compose up -d

# Rebuild and restart
docker-compose up -d --build

# View service status
docker-compose ps
```

### Database Access

```bash
# Access PostgreSQL
docker exec -it hyperpage-postgres psql -U postgres -d hyperpage

# Create a new database
docker exec -it hyperpage-postgres createdb -U postgres newdb

# Backup database
docker exec hyperpage-postgres pg_dump -U postgres hyperpage > backup.sql

# Restore database
docker exec -i hyperpage-postgres psql -U postgres hyperpage < backup.sql
```

### Redis Access

```bash
# Access Redis CLI
docker exec -it hyperpage-redis redis-cli

# Access with password
docker exec -it hyperpage-redis redis-cli

# Monitor Redis
docker exec -it hyperpage-redis redis-cli monitor
```

## Development Workflow

### 1. Initial Setup

```bash
# Start database services
docker-compose up -d postgres redis

# Wait for services to be healthy
docker-compose ps

# Configure environment
cp .env.local.development .env.local
# Edit .env.local with your tool integrations
```

### 2. Database Operations

```bash
# Run database migrations
docker exec hyperpage-app npm run db:migrate

# Access database directly
docker exec -it hyperpage-postgres psql -U postgres -d hyperpage

# Check database connection
docker exec hyperpage-app npm run db:check
```

### 3. Application Development

```bash
# Start Hyperpage (in another terminal or as service)
docker-compose up hyperpage

# Development with hot reload
# Code changes automatically reload the application

# View application logs
docker-compose logs -f hyperpage
```

## Environment Configuration

### Database Configuration

The docker-compose.yml automatically configures:

- `DB_ENGINE=postgres`
- `DATABASE_URL=postgresql://postgres:hyperpage_dev@postgres:5432/hyperpage`
- Individual `POSTGRES_*` variables for fine-grained control

### Redis Configuration

The docker-compose.yml automatically configures:

- `REDIS_URL=redis://redis:6379`
- Redis with AOF persistence enabled
- Password protection for development

### Development Settings

Additional development configurations:

- `NODE_ENV=development`
- `LOG_LEVEL=info`
- High rate limits for testing
- GitHub integration enabled by default

## Volume Management

### Named Volumes

- `hyperpage_postgres_data`: PostgreSQL data persistence
- `hyperpage_redis_data`: Redis data persistence

### Volume Commands

```bash
# List volumes
docker volume ls

# Inspect volume
docker volume inspect hyperpage_postgres_data

# Remove volume (destroys data)
docker volume rm hyperpage_postgres_data
```

## Network Configuration

Services communicate through the `hyperpage-dev` bridge network:

- PostgreSQL reachable at `postgres:5432` from Hyperpage
- Redis reachable at `redis:6379` from Hyperpage
- External access via localhost ports

## Troubleshooting

### Common Issues

1. **Port already in use**

   ```bash
   # Check what's using the port
   lsof -i :5432
   lsof -i :6379
   lsof -i :3000

   # Stop conflicting services
   docker-compose down
   ```

2. **Database connection failed**

   ```bash
   # Check PostgreSQL status
   docker-compose logs postgres

   # Test connection manually
   docker exec hyperpage-postgres pg_isready -U hyperpage -d hyperpage
   ```

3. **Redis connection failed**

   ```bash
   # Check Redis status
   docker-compose logs redis

   # Test connection manually
   docker exec hyperpage-redis redis-cli -a redis_dev_pass ping
   ```

4. **Permission issues**
   ```bash
   # Reset volumes and restart
   docker-compose down -v
   docker-compose up -d
   ```

### Health Checks

All services include health checks:

```bash
# Check health status
docker-compose ps

# Manual health checks
docker exec hyperpage-postgres pg_isready -U postgres -d hyperpage
docker exec hyperpage-redis redis-cli -a redis_dev_pass ping
curl -f http://localhost:3000/api/health
```

## Security Notes

⚠️ **Important**: This setup is for local development only:

- Uses weak passwords for convenience
- No SSL/TLS encryption
- Development tokens with limited permissions
- No network isolation from host

🔐 **For production**: Use proper secrets management, SSL certificates, and strong authentication.

## Integration with Existing Workflows

### VS Code Development

1. Install "Remote - Containers" extension
2. Use Docker Compose as development environment
3. Volume mounting provides seamless file synchronization

### CI/CD Integration

```yaml
# Example GitHub Actions workflow
- name: Start test environment
  run: docker-compose -f docker-compose.yml up -d postgres redis

- name: Run tests
  run: |
    docker-compose exec hyperpage-app npm test
    docker-compose exec hyperpage-app npm run lint
```

### Backup and Recovery

```bash
# Backup database
docker exec hyperpage-postgres pg_dump -U postgres hyperpage > $(date +%Y%m%d_%H%M%S)_backup.sql

# Restore database
docker exec -i hyperpage-postgres psql -U postgres hyperpage < backup.sql
```
