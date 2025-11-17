# Architecture Decision Record: Secret Management Platform Selection

**ADR Number**: 001  
**Date**: 2025-11-17  
**Status**: Draft  
**Type**: Architecture Decision  
**Phase**: 00 - Secret Management Alignment  

## Context

We need to implement a robust secret management strategy for the Tool Configuration Service (TCS) that addresses current security gaps, supports the planned env-tool refactor, and provides a foundation for production-grade secret handling.

### Current Problems
- Manual secret distribution across environments
- No automated rotation policies
- Lack of centralized audit trails
- Different storage patterns (.env files, CI secrets, manual processes)
- No emergency access procedures

### Requirements for Solution
- Support for multiple environments (dev, test, staging, production)
- Integration with Tool Configuration Service
- Compliance with SOC 2 and security best practices
- Automated secret rotation
- Fine-grained access controls
- Audit logging and monitoring
- Developer-friendly integration

## Decision

**Selected Platform**: OpenBao (Open Source) + GitHub Actions Secrets

### Rationale

#### 1. **Hybrid Approach for Optimal Results**
- **GitHub Actions Secrets**: Immediate CI/CD solution with zero setup
- **OpenBao**: Enterprise-grade secret management for production
- **Best of Both Worlds**: Easy CI management + enterprise security

#### 2. **Cost Effectiveness**
- **Zero Licensing Costs**: OpenBao is completely open-source
- **No Enterprise Fees**: No monthly/yearly licensing like Vault Enterprise
- **GitHub Actions**: Free for public repositories, included in GitHub plans
- **Infrastructure Control**: Self-hosted but predictable operational costs

#### 3. **Security & Compliance**
- **OpenBao Enterprise Features**: Dynamic secrets, advanced policies, audit trails
- **GitHub Actions Security**: Secure CI/CD secret storage and injection
- **SOC 2 Compliance**: Both platforms support enterprise compliance requirements
- **Audit Capabilities**: Comprehensive logging and monitoring

#### 4. **Technical Excellence**
- **OpenBao Dynamic Secrets**: Temporary credential generation with auto-expiration
- **Advanced Access Policies**: Fine-grained control over secret access
- **Multi-Environment Support**: Dev, staging, production deployment
- **API Compatibility**: Generally compatible with existing Vault integrations

#### 5. **Operational Control**
- **Self-Hosted OpenBao**: Full control over infrastructure and policies
- **GitHub Actions**: Managed CI/CD with repository-level secret management
- **No Vendor Lock-in**: Open-source independence with community support
- **Customizable Deployment**: Tailored to specific organizational needs

## Architecture Overview

### Secret Management Layers

```
┌─────────────────────────────────────┐
│     CI/CD Layer (GitHub Actions)     │
│  ┌─────────────────────────────┐   │
│  │ Build Secrets                │   │
│  │ • npm tokens                 │   │
│  │ • Docker registry credentials│   │
│  │ • Temporary AWS creds        │   │
│  └─────────────────────────────┘   │
└─────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────┐
│   Production Layer (OpenBao)        │
│  ┌─────────────────────────────┐   │
│  │ Dynamic Secrets              │   │
│  │ • Database credentials       │   │
│  │ • API tokens (GitHub, etc.)  │   │
│  │ • OAuth client secrets       │   │
│  │ • Application secrets        │   │
│  └─────────────────────────────┘   │
└─────────────────────────────────────┘
```

### Environment-Specific Implementation

#### CI/CD (GitHub Actions)
- **Repository Secrets**: Configured via GitHub repository settings
- **Workflow Secrets**: Injected into CI/CD pipelines
- **Temporary Access**: Generated for deployment workflows
- **Zero Setup**: Immediate availability for CI/CD

#### Production (OpenBao)
- **Self-Hosted Instance**: Deployed in production environment
- **Dynamic Secrets**: Temporary credentials with auto-expiration
- **Advanced Policies**: Fine-grained access control
- **Enterprise Features**: Audit trails, monitoring, compliance

## Alternatives Considered

### AWS Secrets Manager
**Pros**: Managed service, simple integration, AWS native  
**Cons**: No dynamic secrets, AWS lock-in, per-secret pricing  
**Decision**: Good for simple use cases but lacks enterprise features

### HashiCorp Vault Enterprise
**Pros**: Most powerful features, dynamic secrets, enterprise features  
**Cons**: High licensing costs, resource intensive, operational overhead  
**Decision**: Excellent but too expensive for our needs

### Doppler
**Pros**: Developer-focused, good CI/CD integration  
**Cons**: Limited enterprise features, vendor lock-in  
**Decision**: Good for teams but lacks advanced security features

## Implementation Approach

### Phase 1: CI/CD Foundation (Immediate)
- Set up GitHub Actions secrets for build and deployment workflows
- Configure repository secret management
- Implement CI/CD secret injection patterns
- Test build and deployment pipelines

### Phase 2: OpenBao Foundation (Weeks 1-2)
- Deploy OpenBao instance in development environment
- Configure basic authentication and policies
- Migrate critical production secrets
- Implement basic API integration with TCS

### Phase 3: OpenBao Integration (Weeks 3-4)
- Integrate with Tool Configuration Service
- Implement environment-specific secret delivery
- Configure dynamic secret rotation for databases
- Set up audit logging and monitoring

### Phase 4: Production Deployment (Weeks 5-6)
- Deploy OpenBao in production environment
- Configure high availability and disaster recovery
- Implement advanced policies and access controls
- Complete migration from existing secret storage

## API Integration Design

```typescript
// TCS Secret Integration Interface
interface SecretManager {
  // OpenBao production secrets
  getSecretFromOpenBao(path: string, environment: string): Promise<string>;
  generateDynamicCredentials(engine: string, ttl: string): Promise<DynamicCredentials>;
  listSecrets(pattern?: string): Promise<SecretMetadata[]>;
  rotateSecret(path: string): Promise<boolean>;
  
  // GitHub Actions CI/CD secrets
  getCICDSecret(name: string, workflow: string): Promise<string>;
}

// Environment Precedence
const getSecretValue = async (name: string): Promise<string | undefined> => {
  // 1. Check if this is a CI/CD secret
  if (isCICDSecret(name)) {
    return await secretsManager.getCICDSecret(name, getCurrentWorkflow());
  }
  
  // 2. Check OpenBao for production secrets
  const openbaoSecret = await secretsManager.getSecretFromOpenBao(name, currentEnv);
  if (openbaoSecret) return openbaoSecret;
  
  // 3. Final fallback to environment files
  return process.env[name];
};
```

## Security Considerations

### OpenBao Security
- **High Availability**: Multi-instance deployment for fault tolerance
- **Audit Logging**: Comprehensive audit trails for all secret access
- **Encryption**: All secrets encrypted at rest and in transit
- **Access Policies**: Fine-grained control over secret access
- **Dynamic Secrets**: Temporary credentials with automatic expiration

### GitHub Actions Security
- **Repository Isolation**: Secrets scoped to specific repositories
- **Workflow Security**: Secrets injected securely into CI/CD pipelines
- **Audit Trails**: GitHub provides audit logs for secret access
- **Temporary Access**: Secrets available only during workflow execution

### Compliance
- **SOC 2**: Both platforms support SOC 2 compliance requirements
- **GDPR**: Proper data handling and audit capabilities
- **Encryption Standards**: AES-256 encryption for data at rest
- **Access Controls**: Principle of least privilege implementation

## Migration Plan

### Current State
- `.env.*` files across environments
- GitHub Actions secrets (partial)
- Manual secret distribution
- No centralized audit

### Target State
- **CI/CD**: All build/deployment secrets in GitHub Actions
- **Production**: All runtime secrets in OpenBao with dynamic secrets
- **Audit**: Comprehensive audit trails across both platforms
- **Rotation**: Automated secret rotation policies

### Migration Steps
1. **Audit Phase**: Complete secrets inventory and classification
2. **CI/CD Migration**: Move all CI/CD secrets to GitHub Actions
3. **OpenBao Setup**: Deploy and configure OpenBao instance
4. **Production Migration**: Move production secrets to OpenBao
5. **Dynamic Secrets**: Implement temporary credential generation
6. **Cleanup**: Remove legacy secret storage methods

## Risks and Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| OpenBao complexity | Medium | Medium | Comprehensive training, documentation |
| GitHub Actions limitations | Low | Low | Clear CI/CD secret boundaries |
| Infrastructure costs | Medium | Medium | Cost monitoring, optimization |
| Migration complexity | High | Medium | Phased migration, testing |

## Success Metrics

### Security Metrics
- **Secret Coverage**: 100% of secrets managed by appropriate platform
- **Dynamic Secrets**: 80% of database credentials use dynamic generation
- **Audit Coverage**: 100% of secret access logged and monitored
- **Compliance**: SOC 2 audit readiness for production secrets

### Operational Metrics
- **CI/CD Success Rate**: >99% successful builds with GitHub Actions secrets
- **Secret Access Latency**: <100ms for OpenBao secret retrieval
- **Migration Success**: Zero critical issues during migration phases
- **Team Adoption**: 100% team training completion

### Cost Metrics
- **Total Cost**: 70% reduction vs. enterprise Vault licensing
- **Operational Overhead**: Managed GitHub Actions + self-hosted OpenBao
- **Infrastructure**: Predictable operational costs

## Timeline

### Immediate (Week 0)
- **Day 1-2**: GitHub Actions secrets setup for CI/CD
- **Day 3-5**: CI/CD workflow testing and validation

### Week 1-2: OpenBao Foundation
- **Week 1**: OpenBao deployment and basic configuration
- **Week 2**: Critical secrets migration and basic integration

### Week 3-4: Integration
- **Week 3**: TCS integration with OpenBao
- **Week 4**: Dynamic secrets and advanced policies

### Week 5-6: Production
- **Week 5**: Production deployment and high availability
- **Week 6**: Final testing, documentation, and team training

## Decision Outcome

This hybrid approach provides:
- ✅ **Enterprise Security**: OpenBao provides Vault-equivalent features without licensing costs
- ✅ **CI/CD Simplicity**: GitHub Actions eliminates CI/CD secret management complexity
- ✅ **Cost Optimization**: Zero licensing fees with predictable operational costs
- ✅ **Future-Proof**: Open-source platforms with community support
- ✅ **Compliance Ready**: Both platforms support enterprise compliance requirements
- ✅ **Operational Control**: Self-hosted OpenBao with managed GitHub Actions

### Strategic Advantages
1. **No Vendor Lock-in**: Open-source independence
2. **Cost Predictability**: No variable per-secret pricing
3. **Enterprise Features**: Dynamic secrets, advanced policies, audit trails
4. **Best Practices**: Combines managed simplicity with enterprise control
5. **Scalability**: Grows with organizational needs

**Next Actions**:
1. Stakeholder review and sign-off on hybrid approach
2. GitHub Actions secrets configuration for immediate CI/CD needs
3. OpenBao infrastructure planning and deployment
4. Detailed implementation roadmap creation

---

**Approvers**:
- Security Lead: TBD
- DevOps Lead: TBD  
- Backend Lead: TBD
- Product Owner: TBD

**Revisions**:
- v0.1 (2025-11-17): Initial AWS Secrets Manager draft
- v0.2 (2025-11-17): Updated to OpenBao + GitHub Actions hybrid approach
- v1.0 (TBD): Final approved version

---

*This ADR represents a strategic shift to a hybrid secret management approach that maximizes security while minimizing costs and operational complexity.*
