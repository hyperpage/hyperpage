# Phase 00: Access Control Model for Secret Management

**Date**: 2025-11-17  
**Status**: In Progress  
**Phase**: 00 - Secret Management Alignment  
**Related ADR**: ADR-001-secret-management-platform.md  

## Overview

This document defines the Role-Based Access Control (RBAC) model for AWS Secrets Manager integration with the Tool Configuration Service, implementing the principle of least privilege across all environments.

## Roles and Responsibilities

### 1. Service Account Roles

#### TCS Application Role
**Purpose**: Primary application access to secrets
**Permissions**:
- `secretsmanager:GetSecretValue` - Read secrets for TCS
- `secretsmanager:ListSecrets` - Discover available secrets
- `logs:CreateLogGroup` - Create application log groups
- `logs:PutLogEvents` - Write audit logs

**Secrets Accessed**:
- Database credentials (read-only)
- Redis configuration (read-only)
- API tokens for tool integrations (read-only)
- Session secrets (read-only)
- OAuth client credentials (read-only)

**Environment Scope**: All environments (dev, test, staging, production)

#### Database Rotation Role
**Purpose**: Automated rotation of database credentials
**Permissions**:
- `secretsmanager:GetSecretValue` - Read current credentials
- `secretsmanager:PutSecretValue` - Update rotated credentials
- `rds:ModifyDBInstance` - Update RDS connection with new credentials
- `secretsmanager:RotateSecret` - Trigger rotation

**Secrets Managed**:
- `POSTGRES_PASSWORD_{ENV}`
- `DATABASE_URL_{ENV}`

**Environment Scope**: Staging and production only

### 2. Team Roles

#### DevOps Team
**Purpose**: Infrastructure and deployment management
**Permissions**:
- Full AWS Secrets Manager access for operational tasks
- CloudWatch logs access for monitoring
- IAM role management for service accounts
- Cost and usage reporting

**Environment Scope**: All environments with elevated privileges

#### Development Team
**Purpose**: Local development and testing
**Permissions**:
- Read access to non-production secrets
- Limited write access to development secrets
- Cannot access production secrets

**Environment Scope**: Development and test environments only

#### Security Team
**Purpose**: Security monitoring and compliance
**Permissions**:
- Read access to all secrets (for audit purposes)
- CloudTrail logs access
- Security metrics and alerting configuration
- Compliance reporting access

**Environment Scope**: All environments (read-only)

### 3. Emergency Access Roles

#### Incident Response Role
**Purpose**: Emergency access during security incidents
**Permissions**:
- Temporary elevated access to all secrets
- Audit log access
- Emergency rotation capabilities

**Activation**: Manual approval process with time limits
**Environment Scope**: All environments

## Policy Structure

### Service Account Policy (TCS Application)

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "TCSApplicationAccess",
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue",
        "secretsmanager:ListSecrets"
      ],
      "Resource": [
        "arn:aws:secretsmanager:*:*:secret:hyperpage/*"
      ]
    },
    {
      "Sid": "LoggingAccess",
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "arn:aws:logs:*:*:*"
    }
  ]
}
```

### Development Team Policy

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "DevelopmentReadAccess",
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue"
      ],
      "Resource": [
        "arn:aws:secretsmanager:*:*:secret:hyperpage/dev/*",
        "arn:aws:secretsmanager:*:*:secret:hyperpage/test/*"
      ]
    },
    {
      "Sid": "DevelopmentWriteAccess",
      "Effect": "Allow",
      "Action": [
        "secretsmanager:PutSecretValue",
        "secretsmanager:CreateSecret"
      ],
      "Resource": [
        "arn:aws:secretsmanager:*:*:secret:hyperpage/dev/*"
      ]
    }
  ]
}
```

## Secret Access Matrix

| Secret Type | Application | DevOps | Development | Security | Emergency |
|-------------|-------------|--------|-------------|----------|-----------|
| **Database Credentials** | Read | Full | Read (dev only) | Read | Emergency |
| **API Tokens** | Read | Full | Read (dev only) | Read | Emergency |
| **OAuth Credentials** | Read | Full | None | Read | Emergency |
| **Session Secrets** | Read | Full | None | Read | Emergency |
| **Redis Config** | Read | Full | Read (dev only) | Read | Emergency |

## Environment-Specific Access

### Development Environment
- **Access Level**: Most permissive
- **Restrictions**: No production data access
- **Secret Types**: Development-specific credentials only
- **Rotation**: Manual, as-needed

### Test Environment  
- **Access Level**: Moderate restrictions
- **Restrictions**: Test-only secrets, no production access
- **Secret Types**: Test credentials and non-sensitive configs
- **Rotation**: Automated, weekly

### Staging Environment
- **Access Level**: Restricted
- **Restrictions**: Production-like security, limited team access
- **Secret Types**: Staging credentials mirroring production
- **Rotation**: Automated, bi-weekly

### Production Environment
- **Access Level**: Most restrictive
- **Restrictions**: Only essential personnel, comprehensive logging
- **Secret Types**: All production secrets
- **Rotation**: Automated, weekly for critical secrets

## Access Review Process

### Monthly Access Reviews
- **Frequency**: First Monday of each month
- **Participants**: Security team lead, DevOps lead
- **Process**: 
  1. Export access logs for previous month
  2. Review for anomalies or unauthorized access
  3. Validate current access levels against roles
  4. Update access as needed
  5. Document findings and actions taken

### Quarterly Access Audits
- **Frequency**: Every 3 months
- **Participants**: Security team, DevOps, Product owner
- **Process**:
  1. Comprehensive access review across all environments
  2. Validate role assignments and permissions
  3. Review emergency access usage
  4. Update policies as needed
  5. Compliance reporting

## Integration with Tool Configuration Service

### TCS Permission Model

```typescript
interface TCSAccessControl {
  // Environment-specific secret access
  getSecret(secretName: string, environment: string): Promise<string | null>;
  
  // Validation of application permissions
  validateAccess(secretName: string, operation: 'read' | 'write'): Promise<boolean>;
  
  // Audit logging for all secret access
  logAccess(secretName: string, operation: string, success: boolean): Promise<void>;
}

// Implementation with AWS SDK
class AWSSecretsManagerAccess implements TCSAccessControl {
  constructor(
    private roleArn: string,
    private environment: string
  ) {}
  
  async getSecret(secretName: string): Promise<string | null> {
    try {
      // Log access attempt
      await this.logAccess(secretName, 'read', true);
      
      // Get secret from AWS Secrets Manager
      const secretValue = await this.secretsManager.getSecretValue({
        SecretId: `${secretName}_${this.environment}`
      }).promise();
      
      return secretValue.SecretString || null;
    } catch (error) {
      await this.logAccess(secretName, 'read', false);
      throw error;
    }
  }
}
```

## Compliance and Audit Trail

### CloudTrail Integration
- All secret access logged to CloudTrail
- Integration with SIEM for monitoring
- 7-year retention for compliance requirements
- Real-time alerting for suspicious access

### Required Audit Information
- Who accessed the secret
- When the secret was accessed
- What operation was performed
- Source IP and user agent
- Success/failure status

### Compliance Reports
- Monthly access summary reports
- Quarterly compliance assessments
- Annual security audit documentation
- Incident response documentation

## Emergency Access Procedures

### Emergency Access Trigger
- Security incident response
- Production outage resolution
- Compliance audit requirements
- Legal/regulatory requests

### Emergency Access Process
1. **Request Submission**: Formal request via incident management system
2. **Approval**: Security lead or on-call manager approval
3. **Time Limitation**: Access expires after 4 hours automatically
4. **Full Audit**: Complete access logging and post-incident review
5. **Documentation**: Detailed incident report and lessons learned

### Emergency Access Roles
- **Security Incident Commander**: Full emergency access
- **On-Call Engineer**: Limited emergency access
- **Compliance Officer**: Read-only emergency access for audits

## Success Metrics

### Access Control Effectiveness
- 100% of secrets protected by access controls
- Zero unauthorized access attempts
- <24 hours average access review completion
- 100% compliance with access review schedule

### Operational Metrics
- <5 seconds average secret access latency
- 99.9% secret access availability
- Zero emergency access misuse incidents
- 100% audit trail completeness

---

**Next Steps**:
1. Implement AWS IAM policies and roles
2. Configure CloudTrail logging and monitoring
3. Set up automated access reviews
4. Create emergency access procedures and training
5. Validate access controls in each environment

---

*This document will be updated based on stakeholder feedback and implementation experience.*
