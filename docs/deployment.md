# Deployment Guide

This guide covers deployment, CI/CD pipelines, and production security for the Hyperpage dashboard.

## Deployment Options

### Vercel (Recommended)

Hyperpage is optimized for Vercel's serverless platform:

#### One-Click Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/hyperpage/hyperpage)

#### Manual Setup

1. **Connect Repository:**
   ```bash
   # Vercel will detect Next.js and configure automatically
   ```

2. **Environment Variables:**
   Configure environment variables in Vercel dashboard:
   ```env
   ENABLE_GITHUB=true
   GITHUB_TOKEN=your_github_token
   ENABLE_JIRA=true
   JIRA_WEB_URL=https://your-domain.atlassian.net
   JIRA_EMAIL=your_email@company.com
   JIRA_API_TOKEN=your_jira_token
   ```

3. **Build Settings:**
   - **Build Command**: `npm run build`
   - **Output Directory**: `.next`
   - **Install Command**: `npm install`
   - **Node Version**: 18.x

#### Benefits
- **Automatic Scaling**: Serverless functions scale automatically
- **Global CDN**: Fast loading worldwide
- **Security**: Built-in DDoS protection and SSL certificates
- **Analytics**: Real-time performance monitoring

### Self-Hosted Deployment

For organizations requiring self-hosted solutions:

#### Docker Deployment

```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3000
CMD ["npm", "start"]
```

```bash
# Build and run
docker build -t hyperpage .
docker run -p 3000:3000 -e NODE_ENV=production hyperpage
```

#### Manual Server Setup

```bash
# Production build
npm run build
npm start

# Or with PM2
npm install -g pm2
pm2 start npm --name "hyperpage" -- start
pm2 save
pm2 startup
```

## CI/CD Pipeline

### GitHub Actions Example

```yaml
name: CI/CD Pipeline

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: TypeScript check
        run: npx tsc --noEmit

      - name: ESLint
        run: npx eslint . --max-warnings=0

      - name: Test
        run: npm test

  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build

      - name: Deploy to Vercel
        if: github.ref == 'refs/heads/main'
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          github-token: ${{ secrets.GITHUB_TOKEN }}
          vercel-args: '--prod'
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
```

## Security Considerations

### 🔒 **Security Audit Status: PASSED**

The Hyperpage project has undergone comprehensive security auditing:

- ✅ **Server-Side Credential Isolation**: API tokens never exposed to client-side code
- ✅ **Environment Variable Protection**: No hardcoded credentials in source code
- ✅ **Build Security**: Clean builds with no credential leakage
- ✅ **Input Validation**: All API endpoints protected against injection attacks
- ✅ **Error Handling**: Generic error messages prevent information disclosure

### Production Security Checklist

#### Environment Variables
- ✅ **No Hardcoded Secrets**: All credentials configured via environment variables
- ✅ **Secure Token Storage**: API tokens only accessible server-side
- ✅ **Variable Encryption**: Sensitive environment variables encrypted at rest
- ✅ **Access Control**: Environment variables accessible only to authorized personnel

#### Network Security
- ✅ **HTTPS Only**: All connections require SSL/TLS encryption
- ✅ **API Rate Limiting**: Request throttling prevents abuse
- ✅ **CORS Policy**: Cross-origin requests properly restricted
- ✅ **HSTS Headers**: HTTP Strict Transport Security enabled

#### Application Security
- ✅ **Input Validation**: All user inputs validated with strict regex patterns
- ✅ **XSS Protection**: Content Security Policy (CSP) headers
- ✅ **CSRF Protection**: Cross-site request forgery prevention
- ✅ **Dependency Scanning**: Automated vulnerability detection in packages

#### Monitoring & Logging
- ✅ **Error Monitoring**: Centralized error tracking and alerting
- ✅ **Access Logging**: API access patterns monitored for anomalies
- ✅ **Security Events**: Authentication and authorization events logged
- ✅ **Compliance**: Audit logs maintained for regulatory requirements

### API Token Management

#### Secure Token Storage
- **Server-Only Access**: Tokens never sent to browser
- **Encrypted Storage**: API keys encrypted using industry-standard methods
- **Access Logging**: All token usage logged with timestamps
- **Rotation Policy**: Regular token rotation to limit exposure

#### Token Validation
```typescript
// Server-side token validation pattern
const validateApiToken = (token: string, tool: string): boolean => {
  if (!token || token.length < 20) return false;

  // Tool-specific validation rules
  switch (tool) {
    case 'github':
      return token.startsWith('github_pat_') && token.length === 40;
    case 'gitlab':
      return /^[a-zA-Z0-9_-]{20,}$/.test(token);
    case 'jira':
      return /^ATATT3x.+$/.test(token);
    default:
      return false;
  }
};
```

## Environment Configuration

### Sample Production Configuration

```env
# Production Environment
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://your-dashboard.com

# Tool Configurations
ENABLE_GITHUB=true
GITHUB_TOKEN=github_pat_production_token_here
GITHUB_USERNAME=your_org_or_username

ENABLE_JIRA=true
JIRA_WEB_URL=https://your-company.atlassian.net
JIRA_EMAIL=service_account@your-company.com
JIRA_API_TOKEN=ATATT3x_production_token_here

# Performance Tuning
DATA_REFRESH_INTERVAL=600000
ACTIVITY_FEED_LIMIT=25
REQUEST_TIMEOUT=30000

# Security Headers
CSP_ENABLED=true
HSTS_ENABLED=true

# Monitoring
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
LOG_LEVEL=warn
```

## Performance Optimization

### Build Optimizations
- ✅ **Code Splitting**: Dynamic imports reduce initial bundle size
- ✅ **Image Optimization**: Next.js automatic image optimization
- ✅ **CSS Optimization**: Tailwind CSS purging removes unused styles
- ✅ **Font Optimization**: Self-hosted web fonts with preloading

### Runtime Optimizations
- ✅ **Server-Side Rendering**: Next.js SSR for improved performance
- ✅ **Static Generation**: Pages pre-generated for faster loading
- ✅ **Caching Strategy**: Intelligent API response caching
- ✅ **Compression**: Gzip/Brotli compression enabled

### Monitoring & Analytics

#### Application Performance Monitoring
```javascript
// Next.js Analytics
import { Analytics } from '@vercel/analytics/react';

export default function App({ Component, pageProps }) {
  return (
    <>
      <Component {...pageProps} />
      <Analytics />
    </>
  );
}
```

#### Custom Metrics
- Response times for tool API calls
- Error rates by tool and endpoint
- User session duration and feature usage
- Database performance (if applicable)

## Backup & Recovery

### Configuration Backup
- **Environment Variables**: Regularly export configurations (without secrets)
- **Tool Settings**: Backup enablement and threshold settings
- **User Preferences**: Export dashboard customizations if applicable

### Disaster Recovery
- **Automated Builds**: CI/CD enables rapid redeployment
- **Configuration as Code**: Infrastructure defined in version control
- **Rollback Capability**: Previous releases available for emergency rollback

### Data Retention
- **Log Rotation**: Implement log rotation to manage storage
- **Backup Frequency**: Backup critical configurations weekly
- **Retention Period**: Maintain backups for 30 days minimum

## Maintenance Procedures

### Regular Maintenance Tasks

#### Weekly Tasks
- Monitor application performance metrics
- Review error logs and alert patterns
- Update dependencies if security patches available
- Verify backup integrity

#### Monthly Tasks
- Audit user access and permissions
- Review API token validity and rotate if needed
- Update system documentation
- Performance benchmark against baselines

#### Quarterly Tasks
- Security vulnerability assessment
- Comprehensive backup and recovery testing
- Dependency analysis and updates
- Feature usage analysis and optimization

### Update Procedures

#### Dependency Updates
```bash
# Check for outdated packages
npm outdated

# Update with careful testing
npm update
npm run test
npm run build

# Deploy if tests pass
npm run deploy
```

#### Security Patches
- Monitor security advisories for dependencies
- Apply critical security patches immediately
- Test patches in staging environment first
- Schedule non-critical updates during maintenance windows

## Support & Troubleshooting

### Common Deployment Issues

**Build Failures:**
```bash
# Clear build cache
rm -rf .next
npm run build

# Check Node.js version
node --version  # Should be 18+

# Verify environment variables
echo $NODE_ENV  # Should be 'production'
```

**API Connection Issues:**
- Verify API tokens are valid and have correct permissions
- Check firewall rules and network connectivity
- Confirm API rate limits haven't been exceeded

**Performance Issues:**
- Monitor server resources and scaling
- Check for memory leaks in application code
- Optimize database queries if applicable
- Implement caching strategies for frequently accessed data

### Emergency Contacts

Document contact information for:
- Development team leads
- Infrastructure administrators
- Security team for breach incidents
- Vendor support contacts for third-party services

For installation instructions and configuration details, see [`docs/installation.md`](installation.md).
