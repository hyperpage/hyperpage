# Phase 00: Secret Delivery Mechanisms for Tool Configuration Service

**Date**: 2025-11-17  
**Status**: In Progress  
**Phase**: 00 - Secret Management Alignment  
**Related ADR**: ADR-001-secret-management-platform.md  

## Overview

This document defines the secret delivery mechanisms for each environment, ensuring secure, reliable, and efficient secret distribution from AWS Secrets Manager to the Tool Configuration Service and runtime consumers.

## Delivery Architecture

### Environment Precedence Strategy

The Tool Configuration Service implements a layered secret delivery approach:

```
1. AWS Secrets Manager (Primary)
   ├── Production secrets
   ├── Staging secrets  
   ├── Test secrets
   └── Development secrets

2. Environment Files (Fallback)
   ├── .env.production
   ├── .env.staging
   ├── .env.test
   └── .env.dev

3. Runtime Environment (Override)
   ├── process.env
   ├── Docker environment
   └── Kubernetes secrets/configmaps
```

### Secret Discovery and Retrieval

```typescript
interface SecretDeliveryEngine {
  // Primary secret retrieval from AWS Secrets Manager
  getSecretFromAWS(secretName: string, environment: string): Promise<string | null>;
  
  // Fallback to environment files
  getSecretFromEnvFile(secretName: string): Promise<string | null>;
  
  // Runtime environment override
  getSecretFromRuntime(secretName: string): Promise<string | null>;
  
  // Unified secret retrieval with precedence
  getSecret(secretName: string): Promise<string | null>;
}

class EnvironmentAwareSecretDelivery implements SecretDeliveryEngine {
  constructor(
    private awsSecretsManager: AWSSecretsManagerClient,
    private environment: string,
    private enableFallback: boolean = true
  ) {}

  async getSecret(secretName: string): Promise<string | null> {
    // 1. Try AWS Secrets Manager first
    const awsSecret = await this.getSecretFromAWS(secretName, this.environment);
    if (awsSecret) return awsSecret;

    // 2. Fallback to environment files
    if (this.enableFallback) {
      const envFileSecret = await this.getSecretFromEnvFile(secretName);
      if (envFileSecret) return envFileSecret;
    }

    // 3. Final fallback to runtime environment
    return this.getSecretFromRuntime(secretName);
  }
}
```

## Environment-Specific Delivery Mechanisms

### Development Environment

#### Delivery Method
- **Primary**: AWS Secrets Manager (development secrets)
- **Fallback**: `.env.dev` file for local development
- **Override**: Local environment variables

#### Configuration
```typescript
// Development secret delivery configuration
const devSecretConfig = {
  source: 'aws-secrets-manager',
  fallback: '.env.dev',
  cache: false, // No caching in development
  rotation: 'manual',
  audit: false // Reduced logging for development
};
```

#### Use Case
- Developers need access to test credentials
- Local development without AWS dependency
- Fast iteration without secret fetching delays

### Test Environment

#### Delivery Method
- **Primary**: AWS Secrets Manager (test secrets)
- **Fallback**: `.env.test` file
- **Override**: CI/CD environment variables

#### Configuration
```typescript
// Test secret delivery configuration
const testSecretConfig = {
  source: 'aws-secrets-manager',
  fallback: '.env.test',
  cache: true, // Cache for test performance
  rotation: 'weekly',
  audit: true // Full audit trail for tests
};
```

#### Integration Points
- **Unit Tests**: Direct AWS Secrets Manager access
- **Integration Tests**: Cached secrets for performance
- **E2E Tests**: CI/CD injected secrets

### Staging Environment

#### Delivery Method
- **Primary**: AWS Secrets Manager (staging secrets)
- **Fallback**: `.env.staging` file (deprecated)
- **Override**: Kubernetes secrets/configmaps

#### Configuration
```typescript
// Staging secret delivery configuration
const stagingSecretConfig = {
  source: 'aws-secrets-manager',
  fallback: '.env.staging', // For migration period only
  cache: true,
  rotation: 'bi-weekly',
  audit: true,
  encryption: true,
  compliance: 'soc2'
};
```

#### Kubernetes Integration
```yaml
# Kubernetes secret example for staging
apiVersion: v1
kind: Secret
metadata:
  name: hyperpage-staging-secrets
  namespace: hyperpage-staging
type: Opaque
data:
  # Base64 encoded secrets from AWS Secrets Manager
  database-url: <base64-encoded-secret>
  redis-url: <base64-encoded-secret>
```

### Production Environment

#### Delivery Method
- **Primary**: AWS Secrets Manager (production secrets)
- **Fallback**: None (AWS Secrets Manager required)
- **Override**: Kubernetes secrets with rotation

#### Configuration
```typescript
// Production secret delivery configuration
const prodSecretConfig = {
  source: 'aws-secrets-manager',
  fallback: null, // No fallback in production
  cache: true, // Redis cache with TTL
  rotation: 'weekly',
  audit: true,
  encryption: true,
  compliance: 'soc2',
  monitoring: true,
  alerting: true
};
```

#### Security Measures
- **Encryption**: All secrets encrypted at rest and in transit
- **Network Isolation**: VPC endpoints for Secrets Manager
- **Access Logging**: CloudTrail integration for all access
- **Rotation**: Automatic rotation with zero downtime

## Secret Caching Strategy

### Cache Implementation

```typescript
interface SecretCache {
  get(secretName: string): Promise<string | null>;
  set(secretName: string, value: string, ttl: number): Promise<void>;
  invalidate(secretName: string): Promise<void>;
  clear(): Promise<void>;
}

class RedisSecretCache implements SecretCache {
  constructor(
    private redis: Redis,
    private defaultTtl: number = 300 // 5 minutes
  ) {}

  async get(secretName: string): Promise<string | null> {
    const cached = await this.redis.get(`secret:${secretName}`);
    return cached;
  }

  async set(secretName: string, value: string, ttl: number = this.defaultTtl): Promise<void> {
    await this.redis.setex(`secret:${secretName}`, ttl, value);
  }

  async invalidate(secretName: string): Promise<void> {
    await this.redis.del(`secret:${secretName}`);
  }
}
```

### Cache Configuration by Environment

| Environment | Cache Enabled | TTL | Invalidation Strategy |
|------------|---------------|-----|----------------------|
| Development | ❌ No | N/A | N/A |
| Test | ✅ Yes | 60s | Test completion |
| Staging | ✅ Yes | 300s | Manual/rotation |
| Production | ✅ Yes | 300s | Rotation/event-driven |

## Rotation and Lifecycle Management

### Automatic Rotation Policies

```typescript
interface SecretRotationPolicy {
  secretType: string;
  rotationInterval: number; // days
  rotationTime: string; // UTC time
  notificationDays: number; // advance notice
  rollbackEnabled: boolean;
}

const rotationPolicies: SecretRotationPolicy[] = [
  {
    secretType: 'database-credentials',
    rotationInterval: 90,
    rotationTime: '02:00', // 2 AM UTC
    notificationDays: 7,
    rollbackEnabled: true
  },
  {
    secretType: 'api-tokens',
    rotationInterval: 90,
    rotationTime: '03:00',
    notificationDays: 3,
    rollbackEnabled: true
  },
  {
    secretType: 'oauth-credentials',
    rotationInterval: 180,
    rotationTime: '01:00',
    notificationDays: 14,
    rollbackEnabled: false
  }
];
```

### Rotation Process

```typescript
class SecretRotationManager {
  async rotateSecret(secretName: string, environment: string): Promise<boolean> {
    try {
      // 1. Generate new secret
      const newSecret = await this.generateNewSecret(secretName);
      
      // 2. Update AWS Secrets Manager
      await this.awsSecretsManager.updateSecret({
        SecretId: `${secretName}_${environment}`,
        SecretString: newSecret
      });
      
      // 3. Notify dependent services
      await this.notifyDependentServices(secretName, environment);
      
      // 4. Invalidate cache
      await this.cache.invalidate(secretName);
      
      // 5. Log rotation event
      await this.logRotationEvent(secretName, environment, 'success');
      
      return true;
    } catch (error) {
      await this.logRotationEvent(secretName, environment, 'failure', error);
      return false;
    }
  }
}
```

## Monitoring and Alerting

### Key Metrics

| Metric | Environment | Threshold | Action |
|--------|-------------|-----------|---------|
| Secret retrieval latency | All | >5 seconds | Alert DevOps |
| Cache hit rate | Prod | <80% | Optimize cache config |
| Rotation failures | All | >0 per day | Immediate alert |
| Unauthorized access | All | >0 events | Security incident |
| Secrets not in AWS | All | >0 secrets | Migration alert |

### Monitoring Implementation

```typescript
interface SecretDeliveryMetrics {
  // Performance metrics
  retrievalLatency: Histogram;
  cacheHitRate: Gauge;
  errorRate: Counter;
  
  // Security metrics
  unauthorizedAccess: Counter;
  rotationFailures: Counter;
  
  // Business metrics
  secretsRetrieved: Counter;
  cacheEfficiency: Gauge;
}

class MetricsCollector {
  constructor(private metrics: SecretDeliveryMetrics) {}

  async recordSecretRetrieval(
    secretName: string,
    source: string,
    latency: number,
    success: boolean
  ): Promise<void> {
    this.metrics.retrievalLatency.observe(latency);
    this.metrics.secretsRetrieved.inc();
    
    if (!success) {
      this.metrics.errorRate.inc();
    }
  }
}
```

## Integration with Tool Configuration Service

### TCS Secret Interface

```typescript
interface TCSSecretIntegration {
  // Environment-specific secret retrieval
  getToolSecret(toolName: string, secretType: string): Promise<string | null>;
  
  // Batch secret retrieval for performance
  getToolSecrets(toolName: string): Promise<Record<string, string>>;
  
  // Secret validation
  validateToolSecrets(toolName: string): Promise<ValidationResult>;
  
  // Notification of secret changes
  onSecretRotated(callback: (toolName: string, secretType: string) => void): void;
}

class AWSSecretsTCSIntegration implements TCSSecretIntegration {
  constructor(
    private secretDelivery: EnvironmentAwareSecretDelivery,
    private cache: SecretCache,
    private metrics: MetricsCollector
  ) {}

  async getToolSecret(toolName: string, secretType: string): Promise<string | null> {
    const secretName = `${toolName.toUpperCase()}_${secretType.toUpperCase()}`;
    const startTime = Date.now();
    
    try {
      const secret = await this.secretDelivery.getSecret(secretName);
      const latency = Date.now() - startTime;
      
      await this.metrics.recordSecretRetrieval(secretName, 'aws', latency, true);
      return secret;
    } catch (error) {
      const latency = Date.now() - startTime;
      await this.metrics.recordSecretRetrieval(secretName, 'aws', latency, false);
      throw error;
    }
  }
}
```

## Migration Strategy

### Current State → Target State

#### Phase 1: AWS Secrets Manager Setup
- Deploy AWS Secrets Manager infrastructure
- Create IAM roles and policies
- Set up monitoring and alerting

#### Phase 2: Critical Secrets Migration
- Database credentials
- Redis configuration
- Session secrets

#### Phase 3: Tool-Specific Secrets
- GitHub API tokens
- Jira credentials
- GitLab tokens

#### Phase 4: Full Migration
- Remove .env file dependencies
- Enable production-only mode
- Implement full rotation policies

### Migration Validation

```typescript
interface MigrationValidation {
  // Verify all secrets accessible via AWS
  validateSecretAccess(): Promise<ValidationResult>;
  
  // Compare old vs new secret values
  validateSecretConsistency(): Promise<ValidationResult>;
  
  // Test application functionality
  validateApplicationFunctionality(): Promise<ValidationResult>;
  
  // Performance impact assessment
  assessPerformanceImpact(): Promise<PerformanceMetrics>;
}
```

## Success Metrics

### Delivery Performance
- **Latency**: <5 seconds for 99th percentile secret retrieval
- **Availability**: 99.9% secret delivery availability
- **Cache Efficiency**: >80% cache hit rate in production

### Security Effectiveness
- **Zero Secrets in .env Files**: 100% secrets in AWS Secrets Manager
- **Audit Coverage**: 100% secret access logged
- **Rotation Success**: >99% successful rotations

### Operational Excellence
- **Zero Downtime Rotations**: All rotations without service interruption
- **Fast Recovery**: <5 minutes to recover from AWS outage
- **Developer Experience**: <1 minute local development setup

---

**Next Steps**:
1. Implement AWS Secrets Manager infrastructure
2. Create environment-specific delivery configurations
3. Set up caching and monitoring
4. Implement rotation automation
5. Create migration validation tools

---

*This document defines the delivery mechanisms that will be implemented in Phase 03.*
