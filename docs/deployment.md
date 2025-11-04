# Deployment Guide

This guide covers deployment, CI/CD pipelines, and production security for the Hyperpage portal.

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
   Configure environment variables in Vercel portal:

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

## CI/CD Pipeline - Enterprise Automation ✅

### Phase 6: Complete CI/CD Integration & Automation

Hyperpage now features comprehensive CI/CD automation with **5 production-ready GitHub Actions workflows**:

#### 📋 **Available CI/CD Workflows**

| Workflow File                 | Purpose                       | Features                                               |
| ----------------------------- | ----------------------------- | ------------------------------------------------------ |
| **ci-cd.yml**                 | Main CI/CD Pipeline           | Build, test, security scanning, deployment             |
| **test-environments.yml**     | Test Environment Provisioning | Kubernetes test environments for PR validation         |
| **container-registry.yml**    | Container Management          | Multi-arch builds, security scanning, versioning       |
| **production-deployment.yml** | Production Deployment         | GitOps workflow with blue-green deployments            |
| **cicd-monitoring.yml**       | Monitoring & Reporting        | Pipeline metrics, DORA calculations, automated reports |

#### 🚀 **Key CI/CD Features**

**✅ Comprehensive Automation:**

- Full CI/CD pipeline from code commit to production deployment
- Automated testing, security scanning, and deployment processes
- Environment provisioning and resource management

**✅ Security Integration:**

- Multi-layered security scanning (Trivy, Snyk, Docker Scout)
- Vulnerability detection and compliance validation
- Security context validation in Kubernetes deployments

**✅ Environment Management:**

- Dynamic test environment provisioning for PR validation
- Blue-green deployment strategy for zero-downtime releases
- Environment isolation and resource allocation

**✅ Observability & Monitoring:**

- DORA metrics calculation and tracking
- Pipeline health monitoring and failure analysis
- Automated reporting with actionable insights

#### 🔧 **CI/CD Workflow Details**

**1. Main CI/CD Pipeline (`ci-cd.yml`)**

- **Stages**: Build → Test → Security Scan → Deploy
- **Security**: Automated dependency checking and vulnerability scanning
- **Performance**: Integrated performance testing
- **Deployment**: Production deployment with rollback capabilities

**2. Test Environment Provisioning (`test-environments.yml`)**

- **Kubernetes Integration**: Ephemeral test environments for PR validation
- **Namespace Management**: Automated namespace creation and configuration
- **Resource Management**: Dynamic environment isolation with proper allocation
- **Health Monitoring**: Environment health checks and automatic cleanup

**3. Container Registry Management (`container-registry.yml`)**

- **Multi-Architecture**: Builds for linux/amd64, linux/arm64, linux/arm/v7
- **Security Scanning**: Trivy, Snyk, and Docker Scout integration
- **Versioning**: Automated container image versioning and tagging
- **Promotion**: Image promotion workflows between environments

**4. Production Deployment (`production-deployment.yml`)**

- **GitOps Workflow**: Infrastructure-as-Code deployment approach
- **Blue-Green Deployment**: Zero-downtime deployment strategy
- **Rolling Updates**: Alternative deployment strategy available
- **Monitoring**: Comprehensive deployment monitoring and notifications

**5. CI/CD Monitoring (`cicd-monitoring.yml`)**

- **Metrics Collection**: Daily CI/CD metrics with DORA calculations
- **Health Analysis**: Pipeline health analysis and failure pattern detection
- **Automated Reporting**: Scheduled and on-demand report generation
- **Grafana Integration**: Compatible with Grafana dashboards

#### 📊 **CI/CD Metrics & Monitoring**

**DORA Metrics Tracking:**

- **Deployment Frequency**: Automated tracking of deployment rate
- **Lead Time**: Average time from commit to deployment
- **Mean Time to Recovery (MTTR)**: Time to fix failed deployments
- **Change Failure Rate**: Percentage of deployments causing failures

**Pipeline Health Monitoring:**

- **Failure Pattern Analysis**: Automated detection of common failure patterns
- **Success Rate Tracking**: Real-time pipeline success rate monitoring
- **Performance Monitoring**: Pipeline execution time and efficiency tracking
- **Automated Alerts**: Slack notifications for critical pipeline events

#### 🛠️ **CI/CD Setup Requirements**

**Repository Secrets Required:**

```bash
# GitHub Actions Secrets
GITHUB_TOKEN=your_github_token
GRAFANA_URL=https://your-grafana-instance.com
GRAFANA_API_KEY=your_grafana_api_key
DOCKER_REGISTRY=your-registry.com
DOCKER_USERNAME=your_registry_username
DOCKER_PASSWORD=your_registry_password

# Kubernetes Secrets (for deployments)
KUBE_CONFIG_DATA=base64_encoded_kube_config
KUBERNETES_NAMESPACE=production
```

**Workflow Triggers:**

- **Main Pipeline**: Push to main, pull requests
- **Test Environments**: Pull requests, manual triggers
- **Container Registry**: Push to main, version tags
- **Production Deployment**: Manual approval, push to production branch
- **Monitoring**: Daily schedule (9 AM UTC), workflow completion triggers

#### 🔍 **CI/CD Best Practices**

**Security:**

- All workflows use minimal required permissions
- Secrets managed through GitHub encrypted storage
- Security scanning runs before any deployment
- Container images scanned for vulnerabilities

**Reliability:**

- Automated rollback on deployment failures
- Health checks ensure services are running
- Blue-green deployments minimize downtime
- Comprehensive testing before production deployment

**Observability:**

- All deployments logged and monitored
- Performance metrics tracked automatically
- Failure patterns analyzed and reported
- DORA metrics calculated and displayed

## Security Considerations

### 🔒 **Security Audit Status: PASSED**

The Hyperpage project has undergone comprehensive security auditing:

- ✅ **Server-Side Credential Isolation**: API tokens never exposed to client-side code
- ✅ **Environment Variable Protection**: No hardcoded credentials in source code
- ✅ **Build Security**: Clean builds with no credential leakage
- ✅ **Input Validation**: All API endpoints protected against injection attacks
- ✅ **Error Handling**: Generic error messages prevent information disclosure
- ✅ **CI/CD Security**: Multi-layer security scanning in automated pipelines

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
- ✅ **Container Security**: Multi-layer container scanning in CI/CD pipeline

#### Monitoring & Logging

- ✅ **Error Monitoring**: Centralized error tracking and alerting
- ✅ **Access Logging**: API access patterns monitored for anomalies
- ✅ **Security Events**: Authentication and authorization events logged
- ✅ **Compliance**: Audit logs maintained for regulatory requirements
- ✅ **CI/CD Monitoring**: Automated pipeline health monitoring and reporting

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
    case "github":
      return token.startsWith("github_pat_") && token.length === 40;
    case "gitlab":
      return /^[a-zA-Z0-9_-]{20,}$/.test(token);
    case "jira":
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
NEXT_PUBLIC_APP_URL=https://your-portal.com

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

# CI/CD Integration
GITHUB_TOKEN=your_github_token
GRAFANA_URL=https://your-grafana-instance.com
GRAFANA_API_KEY=your_grafana_api_key
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
import { Analytics } from "@vercel/analytics/react";

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
- CI/CD pipeline performance metrics
- Deployment frequency and success rates

## Backup & Recovery

### Configuration Backup

- **Environment Variables**: Regularly export configurations (without secrets)
- **Tool Settings**: Backup enablement and threshold settings
- **User Preferences**: Export portal customizations if applicable
- **CI/CD Workflows**: Version controlled in `.github/workflows/`

### Disaster Recovery

- **Automated Builds**: CI/CD enables rapid redeployment
- **Configuration as Code**: Infrastructure defined in version control
- **Rollback Capability**: Previous releases available for emergency rollback
- **Blue-Green Deployment**: Instant rollback capability in production

### Data Retention

- **Log Rotation**: Implement log rotation to manage storage
- **Backup Frequency**: Backup critical configurations weekly
- **Retention Period**: Maintain backups for 30 days minimum
- **CI/CD History**: GitHub Actions retains workflow run history

## Maintenance Procedures

### Regular Maintenance Tasks

#### Weekly Tasks

- Monitor application performance metrics
- Review error logs and alert patterns
- Update dependencies if security patches available
- Verify backup integrity
- Review CI/CD pipeline health and metrics

#### Monthly Tasks

- Audit user access and permissions
- Review API token validity and rotate if needed
- Update system documentation
- Performance benchmark against baselines
- Analyze CI/CD DORA metrics and optimize workflows

#### Quarterly Tasks

- Security vulnerability assessment
- Comprehensive backup and recovery testing
- Dependency analysis and updates
- Feature usage analysis and optimization
- CI/CD workflow optimization and cleanup

### Update Procedures

#### Dependency Updates

```bash
# Check for outdated packages
npm outdated

# Update with careful testing
npm update
npm run test
npm run build

# Deploy if tests pass (automated in CI/CD)
git push origin main
```

#### Security Patches

- Monitor security advisories for dependencies
- Apply critical security patches immediately
- Test patches in staging environment first
- Schedule non-critical updates during maintenance windows
- Automated dependency scanning in CI/CD pipeline

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

**CI/CD Pipeline Issues:**

```bash
# Check GitHub Actions logs
# Navigate to Actions tab in GitHub repository
# Review workflow run details and error messages
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
