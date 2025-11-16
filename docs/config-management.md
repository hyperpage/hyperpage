# Configuration Management

This document outlines the configuration management system for the Hyperpage platform, covering environment setup, tool configuration, and deployment practices.

## Environment Configuration

### File Structure

Hyperpage uses purpose-specific env files plus runtime overrides:

- **`.env.sample`** – canonical template (committed) containing every supported variable with placeholders.
- **`.env.dev`** – developer-local copy of `.env.sample` (gitignored).
- **`.env.test`** – Vitest/Postgres harness settings (gitignored, created from `.env.test.example`).
- **`.env.staging`** – optional staging template (mirrors production values with staging URLs/secrets).
- **`.env.production`** – production template (stored in deployment secrets manager or `.env.production` on the server).
- **`__tests__/e2e/.env.e2e`** – dockerized Playwright stack template.

Every environment also sets `CONFIG_ENV_FILE` (server) and `NEXT_PUBLIC_ENV_FILE` (client hints) so the runtime knows which file to load. At runtime, environment variables from secret stores or orchestration systems always win over the file contents.

### Database Configuration

### Database Configuration

Hyperpage is PostgreSQL-only for runtime and tests.

- `DATABASE_URL` is the single source of truth for all environments.
- Test harnesses (e.g. `vitest.setup.ts`) consume `DATABASE_URL` directly.
- `TEST_DATABASE_URL` may exist in some setups but is not authoritative and MUST NOT be treated as the primary runtime/test database configuration.

### Tool Enablement Variables

Each tool in the platform is controlled by environment variables:

```env
# Aggregation Tools
ENABLE_CODE_REVIEWS=false
ENABLE_CICD=false
ENABLE_TICKETING=false

# Individual Tool Configurations
ENABLE_JIRA=false
ENABLE_GITHUB=false
ENABLE_GITLAB=false
```

### Registry-Driven Enablement Flow

- Every tool reads its `ENABLE_*` flag at import time and registers with the global registry.
- `/api/tools/enabled` merges that registry data with persisted overrides from `tool_configs` (e.g., user-tuned refresh intervals or enablement toggles).
- The endpoint returns sanitized `ClientSafeTool` objects (name, slug, capabilities, widgets, APIs) so client components never touch handlers, configs, or secrets.
- Portal, setup wizard, sidebar, and any discovery surface MUST rely on this endpoint; no other tool lists should be maintained.
- If a tool is disabled via environment variables or a persisted override, it disappears from the API, the portal, and the sidebar automatically.

### Tool-Specific Configuration

#### JIRA Configuration

```env
# JIRA Configuration
ENABLE_JIRA=true
JIRA_WEB_URL=https://your-domain.atlassian.net
JIRA_EMAIL=your_email@company.com
JIRA_API_TOKEN=your_personal_access_token
```

#### GitHub Configuration

```env
# GitHub Configuration
ENABLE_GITHUB=true
GITHUB_TOKEN=github_pat_...
GITHUB_USERNAME=your_username
```

#### GitLab Configuration

```env
# GitLab Configuration
ENABLE_GITLAB=true
GITLAB_TOKEN=your_gitlab_token
GITLAB_USERNAME=your_username
GITLAB_WEB_URL=https://gitlab.com
```

### Core Auth & Security Variables

Every environment must provide the following (see `.env.sample` for placeholders):

- `SESSION_SECRET`, `JWT_SECRET` – secure random strings for session + token signing.
- `NEXTAUTH_SECRET`, `NEXTAUTH_URL` – NextAuth cookie signing + callback base URL.
- `OAUTH_ENCRYPTION_KEY` – reserved for the upcoming AES-256-GCM layer (set a stable value now to avoid redeploying secrets later).

## URL Auto-Derivation

The system automatically derives API URLs from web URLs using consistent patterns:

- **Jira**: `webUrl + '/rest/api/3'` → `https://domain.atlassian.net/rest/api/3`
- **GitLab**: `webUrl + '/api/v4'` → `https://gitlab.com/api/v4`
- **GitHub**: Always uses `https://api.github.com`

## Security Standards

### Credential Protection

- **Server-Only Access**: Environment variables are read only in server components/pages
- **No Client-Side Leaks**: Never pass sensitive configs to client components
- **Registry-Based Isolation**: Tool configs are automatically excluded from client-safe objects
- **Build Cleanliness**: Ensure no credential leakage in production bundles

### Validation Requirements

- **Parameter Sanitization**: All dynamic route parameters validated with strict regex
- **Early Validation**: Input validation occurs immediately after parameter extraction
- **Error Responses**: Invalid inputs return HTTP 400 with generic messages
- **Injection Prevention**: Validation prevents directory traversal and injection attacks

## Tool Configuration Standards

### Adding New Tool Configuration

1. **Environment Variable Definition**
   - Add `ENABLE_TOOL_NAME=false` in `.env.sample`
   - Document all required configuration variables
   - Include example placeholders

2. **Configuration Documentation**
   - Document all required and optional parameters
   - Explain authentication flows and token generation
   - Provide link to tool's API documentation

3. **Validation Implementation**
   - Implement parameter validation in API routes
   - Add error handling for invalid configurations
   - Create user-friendly error messages

### Configuration Template

For new tools, use this template:

```env
# Tool Name Configuration
# ENABLE_TOOL_NAME=false
# TOOL_NAME_WEB_URL=https://your-instance-url
# TOOL_NAME_API_TOKEN=your_api_token
# TOOL_NAME_USERNAME=your_username (if required)
```

## Development vs Production

### Development Environment

- **Comprehensive Error Messages**: Detailed error messages for debugging
- **Verbose Logging**: Enhanced logging for development troubleshooting
- **Development Tools**: Additional debugging and development utilities

### Production Environment

- **Generic Error Messages**: Generic error messages without sensitive details
- **Security Logging**: Security-focused logging and monitoring
- **Performance Monitoring**: Production-grade monitoring and alerting

### Environment Detection

The platform automatically detects environment using `NODE_ENV`:

```typescript
const isDevelopment = process.env.NODE_ENV === "development";
const isProduction = process.env.NODE_ENV === "production";
const isTest = process.env.NODE_ENV === "test";
```

## Configuration Management Best Practices

### Organization and Maintainability

- **Logical Grouping**: Group related configurations together
- **Clear Comments**: Document purpose and format of each variable
- **Version Control**: Only commit template files with placeholders
- **Backup Strategy**: Document safe backup procedures for configuration

### Tool Addition Workflow

1. Define configuration requirements in tool specification
2. Update `.env.sample` with new variables
3. Implement validation logic in API routes
4. Test configuration handling comprehensively
5. Update documentation and team training

### Error Handling and User Experience

- **Startup Checks**: Validate required variables on application start
- **Graceful Degradation**: Disable tools with invalid configuration (no crashes)
- **User Feedback**: Provide clear error messages for missing/invalid configuration
- **Recovery Guidance**: Link to documentation for fixing configuration issues

## Environment-Specific Behaviors

### Local Development

- Hot reloading and development tools enabled
- Detailed error messages and stack traces
- Additional logging for debugging
- Test data and mock services available

### Staging Environment

- Production-like configuration
- Integration testing with real services
- Performance monitoring enabled
- Security scanning active

### Production Environment

- Optimized for performance and security
- Minimal error information exposed
- Comprehensive monitoring and alerting
- Automated backup and recovery procedures

## Configuration Validation

### Startup Validation

All configuration is validated during application startup:

```typescript
// Required environment variables
const requiredVars = ["NODE_ENV", "ENABLE_JIRA", "ENABLE_GITHUB"];

// Validate required variables
requiredVars.forEach((varName) => {
  if (!process.env[varName]) {
    throw new Error(`Missing required environment variable: ${varName}`);
  }
});
```

### Runtime Validation

Configuration is also validated during runtime operations:

- API route parameter validation
- Tool configuration validation
- Authentication flow validation
- Service connectivity validation

## Configuration Deployment

### Docker Configuration

Docker deployments rely on environment variables, not bundled `.env` files:

- Provide `DATABASE_URL` and tool flags (e.g. `ENABLE_GITHUB`) via:
  - Docker `-e` flags, or
  - An environment file mounted at runtime (not baked into the image).

Example pattern:

```dockerfile
# Dockerfile
FROM node:22-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .

# Environment is injected at runtime; do NOT bake secrets into the image.
# DATABASE_URL and ENABLE_* flags must be provided via container environment.
CMD ["npm", "start"]
```

For testing with Docker:

- `docker-compose.test.yml` is the canonical Postgres-backed test stack.
- It should define a Postgres service and an app service wired via `DATABASE_URL`.
- Local test runs use the same `DATABASE_URL` contract as production.

### CI/CD Integration

CI/CD pipelines inject configuration during deployment:

```yaml
# .github/workflows/deployment.yml
env:
  NODE_ENV: production
  ENABLE_JIRA: ${{ secrets.ENABLE_JIRA }}
  JIRA_API_TOKEN: ${{ secrets.JIRA_API_TOKEN }}
```

## Security Considerations

### Credential Rotation

- Regular rotation of API tokens and credentials
- Automated rotation where possible
- Secure credential storage in secret managers
- Audit trail for credential access

### Access Control

- Environment-specific access controls
- Principle of least privilege
- Regular access reviews
- Secure credential sharing practices

### Monitoring and Alerting

- Configuration change monitoring
- Credential access logging
- Unauthorized access detection
- Automated security scanning

---

## Cross-References

### Related Documentation

- **[Security Practices](security.md)** - Security standards and validation
- **[Tool Integration System](tool-integration-system.md)** - How tools integrate with the platform
- **[Deployment Guide](deployment.md)** - Container/manual deployment strategies
- **[Installation Guide](installation.md)** - Local development setup

### Configuration Files

- **`.env.sample`** - Template for all environment variables
- **`tools/*/index.ts`** - Tool definitions with configuration hooks

---

**Last updated**: January 2025
