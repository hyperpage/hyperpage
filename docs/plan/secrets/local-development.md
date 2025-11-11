# Local Secrets Management Guide

This guide covers the secure local development setup for Hyperpage, including secrets management best practices and procedures.

## 🔐 Overview

Hyperpage now uses a secure secrets management system for local development that separates infrastructure secrets from application configuration. This approach provides:

- **Separation of Concerns**: Infrastructure secrets (database passwords) are separate from application secrets (API tokens)
- **Version Control Safety**: Only template files are committed, real secrets remain private
- **Consistent Development**: All team members use the same setup process
- **Security Best Practices**: Default secure configurations with clear upgrade paths

## 📁 File Structure

The secrets management system uses two main environment file types:

### `.env.docker` (Private - Not Committed)
Contains infrastructure secrets for Docker services (PostgreSQL, Redis):
- Database credentials
- Redis passwords
- Session and JWT secrets
- **NEVER commit this file to version control**

### `.env.docker.sample` (Template - Committed)
Contains template values for Docker secrets:
- Provides setup instructions
- Shows required variables
- Safe to commit to version control

### `.env.local` (Private - Not Committed)
Contains application-specific configuration:
- API tokens for tools (GitHub, GitLab, Jira)
- OAuth credentials
- Service-specific settings
- **NEVER commit this file to version control**

### `.env.local.sample` (Template - Committed)
Contains template for application configuration:
- Documents available options
- Provides setup instructions
- Safe to commit to version control

## 🚀 Quick Start

### For New Developers

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd hyperpage
   ```

2. **Setup Docker secrets**
   ```bash
   cp .env.docker.sample .env.docker
   # Edit .env.docker with secure passwords
   ```

3. **Setup application configuration**
   ```bash
   cp .env.local.sample .env.local
   # Edit .env.local with your API tokens
   ```

4. **Start services**
   ```bash
   docker-compose up -d
   ```

5. **Start development**
   ```bash
   npm run dev
   ```

### For Existing Developers

If you already have a working setup, you have two options:

#### Option 1: Upgrade to New System (Recommended)
1. Backup your current configuration
2. Follow the new setup process above
3. Migrate any custom settings to the new files

#### Option 2: Continue with Legacy Setup
The old system continues to work for backward compatibility, but we recommend upgrading for better security.

## 🔧 Configuration Details

### Docker Environment (.env.docker)

The `.env.docker` file contains infrastructure configuration:

```bash
# Database Configuration
POSTGRES_DB=hyperpage
POSTGRES_USER=hyperpage
POSTGRES_PASSWORD=your_secure_password_here
POSTGRES_HOST=postgres
POSTGRES_PORT=5432

# Redis Configuration
REDIS_PASSWORD=your_redis_password_here
REDIS_URL=redis://:your_redis_password_here@redis:6379

# Security Settings
SESSION_SECRET=your_session_secret
JWT_SECRET=your_jwt_secret
OAUTH_ENCRYPTION_KEY=your_oauth_encryption_key
```

**Security Notes:**
- Change default passwords to something secure
- Use different passwords for different environments
- Generate strong secrets: `openssl rand -hex 32`

### Application Configuration (.env.local)

The `.env.local` file contains application-specific configuration:

```bash
# Tool Configuration
ENABLE_GITHUB=true
GITHUB_TOKEN=ghp_your_token_here
GITHUB_USERNAME=your_username

ENABLE_GITLAB=true
GITLAB_TOKEN=glpat_your_token_here
GITLAB_WEB_URL=https://gitlab.com

# OAuth Configuration (optional)
GITHUB_OAUTH_CLIENT_ID=your_client_id
GITHUB_OAUTH_CLIENT_SECRET=your_client_secret
```

## 🛡️ Security Best Practices

### Password and Secret Generation

**Generate Secure Passwords:**
```bash
# Generate a secure database password
openssl rand -base64 32

# Generate a session secret
openssl rand -hex 32

# Generate a secure JWT_SECRET
openssl rand -hex 32

# Generate an encryption key
openssl rand -hex 32
```

**Use Strong Passwords:**
- Minimum 16 characters
- Mix of uppercase, lowercase, numbers, and symbols
- Use password managers to generate and store
- Never reuse passwords across environments

### Environment Separation

**Development:**
- Use the Docker setup described above
- Apply reasonable rate limits (10000 requests/hour)
- Use development OAuth applications
- Test with sample data when possible

**Production:**
- Never use development secrets in production
- Use production OAuth applications
- Implement proper rate limiting
- Monitor for security issues
- Use managed secrets services (AWS Secrets Manager, etc.)

### Access Control

**File Permissions:**
```bash
# Set restrictive permissions on secret files
chmod 600 .env.docker
chmod 600 .env.local
chmod 644 .env.docker.sample
chmod 644 .env.local.sample
```

**Version Control:**
- Only commit template files (`.sample` files)
- Use `.gitignore` to prevent committing real secrets
- Regularly audit for accidental secret commits
- Use pre-commit hooks to validate files

## 🔍 Troubleshooting

### Common Issues

#### Services Won't Start
**Problem:** Docker services fail to start
**Solution:** 
1. Check `.env.docker` exists and has correct permissions
2. Verify all required variables are set
3. Check Docker logs: `docker-compose logs`

#### Database Connection Failed
**Problem:** Application can't connect to database
**Solution:**
1. Verify `POSTGRES_PASSWORD` matches in `.env.docker` and `DATABASE_URL`
2. Check PostgreSQL container is running: `docker-compose ps`
3. Test connection: `docker-compose exec postgres pg_isready`

#### Redis Connection Failed
**Problem:** Application can't connect to Redis
**Solution:**
1. Verify `REDIS_PASSWORD` in `.env.docker`
2. Check Redis container is running: `docker-compose ps`
3. Test connection: `docker-compose exec redis redis-cli ping`

#### API Tokens Not Working
**Problem:** Tools not fetching data
**Solution:**
1. Verify `ENABLE_*` flags are set to `true`
2. Check API tokens are valid and have correct permissions
3. Test API access manually: `curl -H "Authorization: token YOUR_TOKEN" https://api.github.com/user`

### Debugging Commands

**Check Environment Variables:**
```bash
# View Docker environment (without exposing secrets)
docker-compose config

# Check running containers
docker-compose ps

# View service logs
docker-compose logs postgres
docker-compose logs redis
docker-compose logs hyperpage
```

**Test Connectivity:**
```bash
# Test database connection
docker-compose exec postgres psql -U hyperpage -d hyperpage -c "SELECT 1;"

# Test Redis connection
docker-compose exec redis redis-cli -a YOUR_REDIS_PASSWORD ping

# Test application
curl http://localhost:3000/api/health
```

## 🔄 Migration Guide

### From Legacy Setup

If you were using the old setup with hardcoded passwords in `docker-compose.yml`:

1. **Backup Current Setup**
   ```bash
   cp docker-compose.yml docker-compose.yml.backup
   ```

2. **Setup New System**
   ```bash
   cp .env.docker.sample .env.docker
   # Edit .env.docker with your existing passwords
   ```

3. **Test New Setup**
   ```bash
   docker-compose down
   docker-compose up -d
   ```

4. **Verify Everything Works**
   - Check all services start correctly
   - Test application functionality
   - Verify tool integrations work

5. **Clean Up**
   ```bash
   rm docker-compose.yml.backup  # After successful migration
   ```

### Rolling Back

If the new system causes issues:

1. **Restore Old Configuration**
   ```bash
   cp docker-compose.yml.backup docker-compose.yml
   ```

2. **Start Services**
   ```bash
   docker-compose up -d
   ```

3. **Debug Issues**
   - Check logs for specific error messages
   - Verify configuration changes
   - Test in isolation

## 📚 Additional Resources

### Documentation
- [Installation Guide](installation.md) - Detailed setup instructions
- [Security Guidelines](security.md) - Security best practices
- [Tool Integration](tool-integration-system.md) - Configuring external tools

### Docker Documentation
- [Docker Compose Environment Variables](https://docs.docker.com/compose/environment-variables/)
- [Docker Secrets](https://docs.docker.com/engine/swarm/secrets/)

### Security Resources
- [OWASP Environment Variables Security](https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/07-Input_Validation/04-Testing_for_HTTP_Parameter_Pollution)
- [NIST Password Guidelines](https://pages.nist.gov/800-63-3/sp800-63b.html)

## 🤝 Getting Help

### Team Support
- **Slack**: #development channel
- **Email**: dev-team@company.com
- **Issues**: Create a GitHub issue

### External Resources
- **Docker Issues**: [Docker Forums](https://forums.docker.com/)
- **Security Concerns**: Follow responsible disclosure

---

**Last Updated**: 2025-11-11  
**Version**: 1.0  
**Owner**: Hyperpage Development Team
