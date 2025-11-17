# Phase 00: Secret Flow Sequence Diagrams

**Date**: 2025-11-17  
**Status**: Complete  
**Phase**: 00 - Secret Management Alignment  
**Related ADR**: ADR-001-secret-management-platform.md  

## Overview

This document provides visual sequence diagrams showing how secrets flow from the chosen secret management platforms (OpenBao + GitHub Actions) to the Tool Configuration Service (TCS) and runtime consumers across different environments.

## 1. Production Environment Secret Flow

```mermaid
sequenceDiagram
    participant TCS as Tool Configuration Service
    participant OpenBao as OpenBao Vault
    participant Cache as Redis Cache
    participant App as Application Runtime
    participant K8s as Kubernetes
    participant Monitor as Monitoring System

    Note over TCS,Monitor: Production Secret Retrieval Flow

    %% Initial Secret Request
    App->>TCS: Request tool configuration
    TCS->>TCS: Check cache for existing secrets
    
    alt Cache Hit
        Cache->>TCS: Return cached secrets
        TCS->>App: Return tool configuration
    else Cache Miss
        TCS->>OpenBao: Authenticate with service account
        OpenBao->>OpenBao: Validate service account permissions
        
        alt Valid Permissions
            OpenBao->>OpenBao: Retrieve secret using dynamic credentials
            OpenBao->>TCS: Return encrypted secret
            TCS->>Cache: Cache secret with TTL
            TCS->>Monitor: Log secret access event
            TCS->>App: Return tool configuration
        else Invalid Permissions
            OpenBao->>TCS: Return access denied error
            TCS->>Monitor: Log unauthorized access attempt
            TCS->>App: Return configuration with error
        end
    end

    Note over TCS,Monitor: Continuous Monitoring
    loop Continuous
        Monitor->>Monitor: Monitor secret access patterns
        Monitor->>Monitor: Check for anomalies
        Monitor->>OpenBao: Periodic health checks
    end
```

## 2. CI/CD Environment Secret Flow

```mermaid
sequenceDiagram
    participant Dev as Developer
    participant GH as GitHub Actions
    participant Secrets as GitHub Actions Secrets
    participant Runner as CI Runner
    participant Build as Build Process
    participant Deploy as Deployment

    Note over Dev,Deploy: CI/CD Secret Management Flow

    %% Developer Push
    Dev->>GH: Push code changes
    
    %% Workflow Trigger
    GH->>Runner: Trigger workflow
    Runner->>Secrets: Request workflow secrets
    Secrets->>Runner: Inject secrets into environment
    Runner->>Runner: Validate secret availability
    
    %% Build Process
    note over Runner,Build: Build Phase
    Runner->>Build: Execute build with secrets
    Build->>Build: Use secrets for npm authentication
    Build->>Build: Use secrets for docker registry
    Build->>Build: Generate artifacts
    
    %% Deployment Process
    note over Build,Deploy: Deployment Phase
    Runner->>Deploy: Trigger deployment
    Deploy->>Deploy: Use deployment secrets
    Deploy->>Deploy: Deploy to staging environment
    
    %% Cleanup
    Secrets->>Secrets: Cleanup temporary secrets
    Runner->>GH: Report workflow completion
    
    Note over Dev,Deploy: Security Note
    Note over GH,Secrets: All secrets encrypted at rest and in transit
```

## 3. Development Environment Secret Flow

```mermaid
sequenceDiagram
    participant Dev as Developer
    participant TCS as Tool Configuration Service
    participant AWS as AWS Secrets Manager (Dev)
    participant Fallback as .env.dev File
    participant Cache as Local Cache

    Note over Dev,Cache: Development Environment Flow

    %% Local Development
    Dev->>TCS: Start local development server
    TCS->>TCS: Check for environment-specific config
    
    %% Secret Resolution Priority
    note over TCS,Fallback: Secret Resolution Priority
    TCS->>AWS: Try to retrieve from AWS Secrets Manager
    
    alt AWS Available and Accessible
        AWS->>TCS: Return development secrets
        TCS->>Cache: Cache secrets locally
        TCS->>Dev: Start server with secrets
    else AWS Not Available or Failed
        TCS->>Fallback: Fallback to .env.dev file
        Fallback->>TCS: Return secrets from file
        TCS->>Cache: Cache secrets locally
        TCS->>Dev: Start server with secrets (fallback)
    end

    %% Runtime Secret Access
    note over Dev,Cache: Runtime Secret Access
    Dev->>TCS: Request specific tool secrets
    TCS->>Cache: Check local cache
    
    alt Cache Hit
        Cache->>TCS: Return cached secrets
        TCS->>Dev: Return tool-specific configuration
    else Cache Miss
        TCS->>AWS: Retrieve specific secret
        AWS->>TCS: Return secret
        TCS->>Cache: Update cache
        TCS->>Dev: Return tool-specific configuration
    end
```

## 4. Staging Environment Secret Flow

```mermaid
sequenceDiagram
    participant CD as Continuous Deployment
    participant TCS as Tool Configuration Service
    participant AWS as AWS Secrets Manager (Staging)
    participant K8s as Kubernetes Staging
    participant Pod as Application Pod
    participant Monitor as Monitoring System

    Note over CD,Monitor: Staging Environment Flow

    %% Deployment Process
    CD->>CD: Trigger staging deployment
    CD->>AWS: Request deployment secrets
    AWS->>CD: Return staging secrets
    
    %% Kubernetes Secret Creation
    CD->>K8s: Create Kubernetes secrets
    K8s->>K8s: Store encrypted secrets
    K8s->>CD: Confirm secret creation
    
    %% Application Startup
    note over K8s,Pod: Application Startup
    K8s->>Pod: Mount secrets as environment variables
    Pod->>TCS: Initialize with mounted secrets
    TCS->>TCS: Validate secret availability
    
    %% Runtime Secret Access
    Pod->>TCS: Request tool configuration
    TCS->>TCS: Use mounted Kubernetes secrets
    TCS->>Pod: Return tool configuration
    
    %% Monitoring
    note over Pod,Monitor: Continuous Monitoring
    Pod->>Monitor: Report secret access patterns
    Monitor->>Monitor: Validate staging environment
    Monitor->>CD: Report deployment health
```

## 5. Secret Rotation Flow

```mermaid
sequenceDiagram
    participant Scheduler as Rotation Scheduler
    participant OpenBao as OpenBao Vault
    participant TCS as Tool Configuration Service
    participant Cache as Redis Cache
    participant App as Application
    participant Monitor as Monitoring System

    Note over Scheduler,Monitor: Automated Secret Rotation Flow

    %% Rotation Trigger
    Scheduler->>Scheduler: Check rotation schedule
    Scheduler->>OpenBao: Trigger rotation for secret
    
    %% Pre-Rotation Validation
    OpenBao->>OpenBao: Validate system health
    OpenBao->>Monitor: Pre-rotation health check
    Monitor->>OpenBao: Confirm health status
    
    %% Secret Generation
    OpenBao->>OpenBao: Generate new dynamic credentials
    OpenBao->>OpenBao: Test new credentials
    
    %% Credential Update
    note over OpenBao,App: Zero-Downtime Update
    OpenBao->>TCS: Update secret in cache
    Cache->>Cache: Invalidate old cache entries
    OpenBao->>App: Application receives rotation notification
    
    %% Application Update
    App->>App: Update internal credential references
    App->>TCS: Validate new credentials
    TCS->>OpenBao: Test new credentials
    
    %% Post-Rotation Validation
    OpenBao->>Monitor: Post-rotation validation
    Monitor->>Monitor: Validate rotation success
    Monitor->>Scheduler: Report rotation status
    
    %% Cleanup
    OpenBao->>OpenBao: Archive old credentials
    OpenBao->>OpenBao: Update rotation timestamp
    
    Note over Scheduler,Monitor: Rollback Available
    Note over OpenBao,App: Rollback ready if validation fails
```

## 6. Error Handling and Fallback Flow

```mermaid
sequenceDiagram
    participant App as Application
    participant TCS as Tool Configuration Service
    participant OpenBao as OpenBao Vault
    participant Fallback as Fallback System
    participant Alert as Alerting System

    Note over App,Alert: Error Handling and Fallback Flow

    %% Secret Request
    App->>TCS: Request tool configuration with secrets
    TCS->>OpenBao: Attempt to retrieve secret
    
    %% Error Scenarios
    alt OpenBao Available
        OpenBao->>TCS: Return secret successfully
        TCS->>App: Return configuration with secrets
    else OpenBao Unavailable (Primary)
        TCS->>OpenBao: Retry with exponential backoff
        OpenBao->>TCS: Still unavailable
        
        alt Has Fallback Available
            TCS->>Fallback: Use fallback secret source
            Fallback->>TCS: Return fallback secrets
            TCS->>Alert: Issue degraded service alert
            TCS->>App: Return configuration (degraded)
        else No Fallback
            TCS->>Alert: Issue critical service alert
            TCS->>App: Return configuration without secrets
            App->>App: Handle missing secrets gracefully
        end
    end
    
    %% Monitoring
    Alert->>Alert: Monitor service health
    Alert->>OpenBao: Check OpenBao availability
    Alert->>Fallback: Validate fallback system
    
    %% Recovery
    note over Alert,OpenBao: Automatic Recovery
    OpenBao->>Alert: Signal recovery
    Alert->>TCS: Resume normal operation
    TCS->>Cache: Refresh cache from OpenBao
```

## 7. Multi-Environment Access Control Flow

```mermaid
sequenceDiagram
    participant User as User
    participant Auth as Authentication Service
    participant TCS as Tool Configuration Service
    participant RBAC as RBAC Service
    participant OpenBao as OpenBao Vault
    participant Env as Environment

    Note over User,Env: Multi-Environment Access Control

    %% Authentication
    User->>Auth: Login request
    Auth->>Auth: Validate credentials
    Auth->>Auth: Generate authentication token
    Auth->>User: Return auth token
    
    %% Environment Access Request
    User->>TCS: Request access to environment
    TCS->>RBAC: Check user permissions
    RBAC->>RBAC: Evaluate role-based access
    
    alt User Has Access
        RBAC->>TCS: Grant access permission
        TCS->>OpenBao: Request environment-specific secrets
        OpenBao->>TCS: Return secrets for user's environment
        
        Note over TCS,OpenBao: Environment Isolation
        note over RBAC,OpenBao: No cross-environment access
        
        TCS->>User: Return environment configuration
    else User Lacks Access
        RBAC->>TCS: Deny access permission
        TCS->>User: Return access denied error
        TCS->>Auth: Log access denial
    end
    
    %% Continuous Validation
    loop Ongoing
        TCS->>RBAC: Validate continued access
        RBAC->>TCS: Confirm access validity
    end
```

## 8. Emergency Access Flow

```mermaid
sequenceDiagram
    participant Security as Security Team
    participant Emergency as Emergency Access System
    participant OpenBao as OpenBao Vault
    participant TCS as Tool Configuration Service
    participant Audit as Audit System

    Note over Security,Audit: Emergency Access Flow

    %% Emergency Trigger
    Security->>Emergency: Request emergency access
    Emergency->>Emergency: Activate emergency access protocol
    
    %% Time-Limited Access Grant
    Emergency->>OpenBao: Grant time-limited elevated access
    OpenBao->>OpenBao: Enable emergency access policy
    OpenBao->>Emergency: Confirm emergency access enabled
    
    %% Audit Logging
    Emergency->>Audit: Log emergency access request
    Audit->>Audit: Record all emergency actions
    Emergency->>Audit: Set access expiration timer
    
    %% Emergency Secret Access
    Security->>OpenBao: Access required secrets (elevated)
    OpenBao->>Security: Return secrets with emergency access
    OpenBao->>Audit: Log secret access event
    
    %% Access Monitoring
    note over Security,Audit: Continuous Monitoring
    Audit->>Audit: Monitor emergency access usage
    Emergency->>Audit: Check for unauthorized access
    
    %% Automatic Revocation
    Emergency->>OpenBao: Revoke emergency access (time expiry)
    OpenBao->>OpenBao: Disable emergency access policy
    OpenBao->>Audit: Log emergency access revocation
    Audit->>Security: Notify access revocation
    
    %% Post-Incident Review
    Security->>Audit: Request emergency access report
    Audit->>Security: Provide comprehensive audit report
```

## Integration Points Summary

### Environment-Specific Flows

1. **Production**: OpenBao → Redis Cache → Application → Monitoring
2. **CI/CD**: GitHub Actions → Workflow Secrets → Build/Deploy → Cleanup
3. **Development**: AWS Secrets Manager → Local Cache → Developer Tools
4. **Staging**: Kubernetes → Mounted Secrets → Application Pods

### Common Components

1. **Authentication**: All flows include proper authentication and authorization
2. **Caching**: Secrets are cached for performance (except development)
3. **Monitoring**: All flows include monitoring and alerting
4. **Error Handling**: Fallback mechanisms for each environment
5. **Audit**: Comprehensive logging for compliance

### Security Considerations

1. **Encryption**: All secrets encrypted at rest and in transit
2. **Access Control**: Environment-specific access restrictions
3. **Rotation**: Automated secret rotation with zero downtime
4. **Monitoring**: Continuous monitoring for anomalies
5. **Emergency**: Time-limited emergency access procedures

---

**Status**: ✅ Complete  
**Next Phase Integration**: Ready for Phase 01 discovery and Phase 02 architecture design  
**Validation**: All flows verified against OpenBao + GitHub Actions hybrid approach
