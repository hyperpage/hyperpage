# Phase 00: Secret Rotation & Lifecycle Management Strategy

**Date**: 2025-11-17  
**Status**: In Progress  
**Phase**: 00 - Secret Management Alignment  
**Related ADR**: ADR-001-secret-management-platform.md  

## Overview

This document defines the comprehensive rotation and lifecycle management strategy for secrets in AWS Secrets Manager, ensuring security, compliance, and operational reliability across all environments.

## Lifecycle Management Framework

### Secret Lifecycle Stages

```
1. Creation → 2. Active Use → 3. Rotation → 4. Archival → 5. Deletion
     ↓              ↓              ↓            ↓            ↓
  Generate →   Monitor →    Replace →   Store →    Secure
  Store →      Validate →   Update →   Audit →    Destroy
```

### Lifecycle Policies by Secret Type

| Secret Type | Active Period | Rotation Interval | Archive Period | Max Age |
|-------------|---------------|-------------------|----------------|---------|
| **Database Credentials** | 90 days | 90 days | 30 days | 120 days |
| **API Tokens** | 90 days | 90 days | 30 days | 120 days |
| **OAuth Credentials** | 180 days | 180 days | 30 days | 210 days |
| **Session Secrets** | 30 days | 30 days | 7 days | 37 days |
| **Encryption Keys** | 365 days | 365 days | 90 days | 455 days |

## Rotation Strategy

### Automatic Rotation Policies

#### Database Credentials Rotation

```typescript
interface DatabaseRotationPolicy {
  frequency: '90-days';
  timing: '02:00-04:00-UTC'; // Low traffic window
  rollbackEnabled: true;
  validationRequired: true;
  notificationAdvance: '7-days';
  dependencies: ['application-restart', 'connection-pool-flush'];
}

class DatabaseCredentialRotator {
  async rotateDatabaseCredentials(environment: string): Promise<RotationResult> {
    const rotationId = generateRotationId();
    
    try {
      // 1. Pre-rotation validation
      await this.validateSystemHealth(environment);
      
      // 2. Generate new credentials
      const newCredentials = await this.generateSecureCredentials();
      
      // 3. Update AWS Secrets Manager
      await this.updateSecretInAWS(
        `DATABASE_CREDENTIALS_${environment}`,
        newCredentials
      );
      
      // 4. Test new credentials
      const connectionTest = await this.testDatabaseConnection(newCredentials);
      if (!connectionTest.success) {
        throw new Error('New credentials failed connection test');
      }
      
      // 5. Update application configuration
      await this.notifyApplicationOfRotation(environment, newCredentials);
      
      // 6. Invalidate caches
      await this.invalidateCredentialCaches(environment);
      
      // 7. Monitor for issues
      await this.startPostRotationMonitoring(rotationId);
      
      return { success: true, rotationId };
    } catch (error) {
      await this.handleRotationFailure(rotationId, error);
      return { success: false, rotationId, error: error.message };
    }
  }
}
```

#### API Token Rotation

```typescript
interface APIRotationPolicy {
  frequency: '90-days';
  timing: '03:00-05:00-UTC';
  rollbackEnabled: true;
  validationRequired: true;
  notificationAdvance: '3-days';
  dependencies: ['api-provider-notification', 'application-update'];
}

class APITokenRotator {
  async rotateAPITokens(environment: string): Promise<RotationResult> {
    const tokens = await this.getAPITokensForEnvironment(environment);
    
    const results = [];
    
    for (const token of tokens) {
      try {
        // 1. Request new token from provider
        const newToken = await this.requestNewTokenFromProvider(token.provider);
        
        // 2. Update AWS Secrets Manager
        await this.updateSecretInAWS(token.secretName, newToken);
        
        // 3. Test new token
        const tokenTest = await this.testTokenWithProvider(token.provider, newToken);
        if (!tokenTest.valid) {
          throw new Error(`Token validation failed for ${token.provider}`);
        }
        
        // 4. Notify provider of old token retirement
        await this.notifyProviderOfTokenRotation(token.provider, token.currentToken);
        
        results.push({ token: token.name, success: true });
      } catch (error) {
        results.push({ token: token.name, success: false, error: error.message });
      }
    }
    
    return this.consolidateRotationResults(results);
  }
}
```

### Rotation Scheduling System

```typescript
interface RotationSchedule {
  // Scheduled rotations
  scheduled: Array<{
    secretType: string;
    environment: string;
    nextRotation: Date;
    frequency: number; // days
  }>;
  
  // Rotation windows (low-traffic periods)
  windows: {
    [environment: string]: {
      start: string; // UTC time
      end: string;   // UTC time
      days: string[]; // days of week
    };
  };
}

class RotationScheduler {
  constructor(
    private secretsManager: AWSSecretsManagerClient,
    private notificationService: NotificationService,
    private monitoringService: MonitoringService
  ) {}

  async scheduleRotations(): Promise<void> {
    const schedules = await this.getRotationSchedules();
    
    for (const schedule of schedules.scheduled) {
      if (this.isRotationDue(schedule.nextRotation)) {
        await this.executeScheduledRotation(schedule);
      }
    }
  }

  private isRotationDue(nextRotation: Date): boolean {
    const now = new Date();
    const dueDate = new Date(nextRotation);
    const warningDate = new Date(dueDate.getTime() - (7 * 24 * 60 * 60 * 1000)); // 7 days before
    
    return now >= warningDate;
  }
}
```

## Notification and Communication

### Pre-Rotation Notifications

```typescript
interface RotationNotification {
  type: 'pre-rotation' | 'rotation-start' | 'rotation-success' | 'rotation-failure';
  secretType: string;
  environment: string;
  scheduledTime: Date;
  recipients: string[];
  channels: ('email' | 'slack' | 'pagerduty')[];
}

class RotationNotifier {
  async sendPreRotationNotification(secretType: string, environment: string): Promise<void> {
    const notification: RotationNotification = {
      type: 'pre-rotation',
      secretType,
      environment,
      scheduledTime: await this.getNextRotationTime(secretType, environment),
      recipients: await this.getNotificationRecipients(secretType, environment),
      channels: ['email', 'slack']
    };
    
    await this.deliverNotification(notification);
  }
  
  async sendRotationStartNotification(secretType: string, environment: string): Promise<void> {
    const notification: RotationNotification = {
      type: 'rotation-start',
      secretType,
      environment,
      scheduledTime: new Date(),
      recipients: await this.getNotificationRecipients(secretType, environment),
      channels: ['slack', 'pagerduty']
    };
    
    await this.deliverNotification(notification);
  }
}
```

### Stakeholder Notification Matrix

| Secret Type | Security Team | DevOps Team | Application Team | Management |
|-------------|---------------|-------------|------------------|------------|
| **Database** | ✅ Always | ✅ Always | ✅ Rotation day | ⚠️ Failures only |
| **API Tokens** | ✅ Always | ✅ Always | ✅ Provider notice | ⚠️ Failures only |
| **OAuth** | ✅ Always | ✅ Always | ✅ Never | ⚠️ Failures only |
| **Session** | ⚠️ Failures only | ✅ Always | ✅ Rotation day | ❌ Never |
| **Encryption** | ✅ Always | ✅ Always | ⚠️ Quarterly | ⚠️ Annual |

## Validation and Testing

### Pre-Rotation Validation

```typescript
interface PreRotationChecks {
  systemHealth: boolean;
  dependencyStatus: boolean;
  backupVerification: boolean;
  rollbackReadiness: boolean;
  monitoringActive: boolean;
}

class RotationValidator {
  async validatePreRotation(secretType: string, environment: string): Promise<ValidationResult> {
    const checks: PreRotationChecks = {
      systemHealth: await this.checkSystemHealth(environment),
      dependencyStatus: await this.checkDependencyStatus(secretType),
      backupVerification: await this.verifySecretBackup(secretType),
      rollbackReadiness: await this.prepareRollback(secretType),
      monitoringActive: await this.activateRotationMonitoring(secretType)
    };
    
    const allChecksPassed = Object.values(checks).every(check => check === true);
    
    return {
      passed: allChecksPassed,
      checks,
      timestamp: new Date(),
      environment,
      secretType
    };
  }
}
```

### Post-Rotation Testing

```typescript
interface PostRotationTests {
  secretAccessibility: boolean;
  applicationConnectivity: boolean;
  apiFunctionality: boolean;
  performanceImpact: boolean;
  errorRates: number;
}

class PostRotationTester {
  async validatePostRotation(secretType: string, environment: string): Promise<TestResult> {
    const tests: PostRotationTests = {
      secretAccessibility: await this.testSecretAccess(secretType),
      applicationConnectivity: await this.testApplicationConnectivity(environment),
      apiFunctionality: await this.testAPIEndpoints(environment),
      performanceImpact: await this.measurePerformanceImpact(),
      errorRates: await this.checkErrorRates(environment)
    };
    
    const allTestsPassed = tests.secretAccessibility && 
                           tests.applicationConnectivity && 
                           tests.apiFunctionality &&
                           tests.performanceImpact &&
                           tests.errorRate < 0.01; // Less than 1% error rate
    
    return {
      passed: allTestsPassed,
      tests,
      duration: Date.now() - this.rotationStartTime,
      environment,
      secretType
    };
  }
}
```

## Rollback Strategy

### Automatic Rollback Triggers

```typescript
interface RollbackTriggers {
  connectionFailure: boolean;
  performanceDegradation: boolean;
  errorRateSpike: boolean;
  healthCheckFailure: boolean;
  manualOverride: boolean;
}

class RollbackManager {
  async evaluateRollbackNeed(secretType: string, environment: string): Promise<boolean> {
    const triggers: RollbackTriggers = {
      connectionFailure: await this.checkConnectionFailures(environment),
      performanceDegradation: await this.checkPerformanceDegradation(),
      errorRateSpike: await this.checkErrorRateSpike(environment),
      healthCheckFailure: await this.checkHealthChecks(environment),
      manualOverride: await this.checkManualOverride()
    };
    
    return Object.values(triggers).some(trigger => trigger === true);
  }
  
  async executeRollback(secretType: string, environment: string): Promise<RollbackResult> {
    const rollbackId = generateRollbackId();
    
    try {
      // 1. Stop all incoming requests to affected services
      await this.enableMaintenanceMode(environment);
      
      // 2. Restore previous secret version
      const previousSecret = await this.getPreviousSecretVersion(secretType);
      await this.restoreSecretInAWS(secretType, previousSecret);
      
      // 3. Restart affected services
      await this.restartServices(environment);
      
      // 4. Validate rollback
      const validation = await this.validateRollback(secretType, environment);
      if (!validation.success) {
        throw new Error('Rollback validation failed');
      }
      
      // 5. Disable maintenance mode
      await this.disableMaintenanceMode(environment);
      
      // 6. Send rollback notification
      await this.sendRollbackNotification(secretType, environment, rollbackId);
      
      return { success: true, rollbackId };
    } catch (error) {
      await this.handleRollbackFailure(rollbackId, error);
      return { success: false, rollbackId, error: error.message };
    }
  }
}
```

## Monitoring and Alerting

### Rotation Monitoring Metrics

```typescript
interface RotationMetrics {
  // Success metrics
  rotationSuccessRate: number;
  averageRotationDuration: number;
  rollbackFrequency: number;
  
  // Performance metrics
  secretRetrievalLatency: number;
  cacheHitRateDuringRotation: number;
  apiResponseTimeImpact: number;
  
  // Security metrics
  unauthorizedRotationAttempts: number;
  failedValidationCount: number;
  auditLogCompleteness: number;
}

class RotationMonitor {
  constructor(private metrics: MetricsCollector) {}

  async recordRotationAttempt(
    secretType: string,
    environment: string,
    success: boolean,
    duration: number
  ): Promise<void> {
    await this.metrics.record('rotation_attempt', {
      secretType,
      environment,
      success,
      duration
    });
  }
  
  async alertOnRotationFailure(secretType: string, environment: string): Promise<void> {
    const alert = {
      severity: 'critical',
      title: `Secret Rotation Failed: ${secretType}`,
      description: `Rotation failed for ${secretType} in ${environment}`,
      timestamp: new Date(),
      metadata: {
        secretType,
        environment,
        requiresAttention: true
      }
    };
    
    await this.alertingService.sendAlert(alert);
  }
}
```

### Health Checks

```typescript
interface RotationHealthCheck {
  lastSuccessfulRotation: Date;
  nextScheduledRotation: Date;
  pendingRotationCount: number;
  failedRotationCount: number;
  systemHealth: 'healthy' | 'degraded' | 'critical';
}

class RotationHealthChecker {
  async performHealthCheck(): Promise<RotationHealthCheck> {
    const checks = await Promise.all([
      this.getLastSuccessfulRotation(),
      this.getNextScheduledRotation(),
      this.getPendingRotationCount(),
      this.getFailedRotationCount(),
      this.checkSystemHealth()
    ]);
    
    const [lastRotation, nextRotation, pending, failed, health] = checks;
    
    const overallHealth = this.determineOverallHealth(health, failed, pending);
    
    return {
      lastSuccessfulRotation: lastRotation,
      nextScheduledRotation: nextRotation,
      pendingRotationCount: pending,
      failedRotationCount: failed,
      systemHealth: overallHealth
    };
  }
}
```

## Compliance and Audit

### Audit Trail Requirements

```typescript
interface RotationAuditEvent {
  eventId: string;
  timestamp: Date;
  eventType: 'rotation-scheduled' | 'rotation-started' | 'rotation-completed' | 'rotation-failed' | 'rollback-executed';
  secretType: string;
  environment: string;
  initiator: string; // system/user
  details: Record<string, any>;
  duration?: number; // milliseconds
  success: boolean;
  errorMessage?: string;
}

class RotationAuditor {
  async logRotationEvent(event: RotationAuditEvent): Promise<void> {
    // Log to CloudTrail
    await this.cloudTrailClient.logEvent({
      ...event,
      source: 'secret-rotation-service',
      region: 'us-east-1'
    });
    
    // Log to application audit store
    await this.auditStore.recordEvent(event);
    
    // Send to SIEM for real-time monitoring
    await this.siemClient.sendEvent(event);
  }
}
```

### Compliance Reporting

```typescript
interface ComplianceReport {
  reportPeriod: {
    start: Date;
    end: Date;
  };
  totalRotations: number;
  successfulRotations: number;
  failedRotations: number;
  averageRotationDuration: number;
  complianceStatus: 'compliant' | 'non-compliant' | 'partial';
  violations: Array<{
    type: string;
    description: string;
    severity: 'low' | 'medium' | 'high';
    remediation: string;
  }>;
}

class ComplianceReporter {
  async generateComplianceReport(period: { start: Date; end: Date }): Promise<ComplianceReport> {
    const rotations = await this.getRotationEvents(period);
    
    const totalRotations = rotations.length;
    const successfulRotations = rotations.filter(r => r.success).length;
    const failedRotations = totalRotations - successfulRotations;
    const averageDuration = rotations.reduce((sum, r) => sum + (r.duration || 0), 0) / totalRotations;
    
    const complianceStatus = failedRotations === 0 ? 'compliant' : 'non-compliant';
    
    return {
      reportPeriod: period,
      totalRotations,
      successfulRotations,
      failedRotations,
      averageRotationDuration: averageDuration,
      complianceStatus,
      violations: await this.identifyViolations(rotations)
    };
  }
}
```

## Integration with Tool Configuration Service

### TCS Rotation Notifications

```typescript
interface TCSSecretChangeListener {
  onSecretRotated(callback: (secretName: string, environment: string) => Promise<void>): void;
  onSecretDeleted(callback: (secretName: string, environment: string) => Promise<void>): void;
}

class TCSSecretChangeManager implements TCSSecretChangeListener {
  private listeners = new Map<string, Array<(secretName: string, environment: string) => Promise<void>>>();
  
  async handleSecretRotation(secretName: string, environment: string): Promise<void> {
    const callbacks = this.listeners.get('rotation') || [];
    
    await Promise.all(
      callbacks.map(callback => callback(secretName, environment))
    );
    
    // Invalidate TCS cache
    await this.invalidateTCSCache(secretName);
    
    // Notify dependent services
    await this.notifyDependentServices(secretName, environment);
  }
}
```

## Success Metrics and KPIs

### Operational KPIs

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Rotation Success Rate** | >99% | Successful rotations / Total rotations |
| **Average Rotation Duration** | <30 minutes | Time from start to completion |
| **Rollback Rate** | <1% | Rollbacks / Total rotations |
| **Rotation SLA Compliance** | 100% | Rotations within scheduled windows |
| **Zero Downtime Rotations** | 100% | Rotations without service interruption |

### Security KPIs

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Unauthorized Rotation Attempts** | 0 | Security violations |
| **Failed Validation Rate** | 0% | Validation failures / Total validations |
| **Audit Log Completeness** | 100% | Logged events / Expected events |
| **Compliance Violations** | 0 | Policy violations per audit period |

### Business KPIs

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Mean Time to Recovery (MTTR)** | <5 minutes | Time to restore service after failure |
| **Rotation Window Utilization** | <50% | Time used / Available window |
| **Stakeholder Notification Rate** | 100% | Notifications sent / Required notifications |

## Implementation Roadmap

### Phase 1: Foundation (Weeks 1-2)
- [ ] Set up AWS Secrets Manager rotation Lambda functions
- [ ] Implement basic rotation scheduling
- [ ] Create notification system
- [ ] Set up monitoring and alerting

### Phase 2: Critical Secrets (Weeks 3-4)
- [ ] Implement database credential rotation
- [ ] Add API token rotation
- [ ] Test rollback procedures
- [ ] Validate post-rotation functionality

### Phase 3: Full Coverage (Weeks 5-6)
- [ ] Implement all secret type rotations
- [ ] Add compliance reporting
- [ ] Create audit trail system
- [ ] Finalize monitoring dashboards

### Phase 4: Optimization (Weeks 7-8)
- [ ] Performance optimization
- [ ] Automation refinement
- [ ] Team training and documentation
- [ ] Final validation and sign-off

---

**Next Steps**:
1. Implement AWS Lambda rotation functions
2. Set up rotation scheduling system
3. Create notification and monitoring infrastructure
4. Test rotation procedures in non-production environments
5. Train operations team on rotation procedures

---

*This rotation strategy will be implemented in Phase 03 as part of the Tool Configuration Service.*
