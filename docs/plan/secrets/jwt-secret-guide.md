# JWT_SECRET Security Guide

## 🔐 What is JWT_SECRET?

**JWT_SECRET** is a cryptographic key used to sign and verify JSON Web Tokens (JWTs) for authentication and authorization in the Hyperpage application.

## 🎯 Purpose and Function

### What JWTs Do in Hyperpage

- **User Authentication**: Verify user login sessions
- **Session Management**: Maintain user state across requests
- **API Security**: Protect API endpoints that require authentication
- **OAuth Integration**: Handle authentication with external services (GitHub, GitLab, Jira)

### How JWT_SECRET Protects Your Application

```
User Login → JWT Token Generated → JWT_SECRET signs the token
    ↓
Subsequent Requests → Token verified with JWT_SECRET
    ↓
If JWT_SECRET is compromised → All tokens can be forged
```

## 🛡️ Security Requirements

### JWT_SECRET Characteristics

- **Length**: Must be at least 32 characters (256 bits) for security
- **Complexity**: Should be cryptographically random
- **Uniqueness**: Must be different for each environment (dev, staging, production)
- **Secrecy**: NEVER commit to version control

### Secure Generation

```bash
# Generate a secure JWT_SECRET
openssl rand -hex 32

# Example output:
# 8f7d9e2c5a6b3f1a9e2c5d8b7a3f1e9c2d5b8a7f3e1c9d2b5a8f7c3e1d9b2a5f8c
```

## 🔧 Implementation in Hyperpage

### Current Template Values (Development)

```bash
# In .env.docker (development)
JWT_SECRET=dev_jwt_secret_change_in_production

# This should be replaced with a secure random value
JWT_SECRET=8f7d9e2c5a6b3f1a9e2c5d8b7a3f1e9c2d5b8a7f3e1c9d2b5a8f7c3e1d9b2a5f8c
```

### Production Requirements

```bash
# In production environment (.env.production)
JWT_SECRET=PRODUCTION_UNIQUE_32_CHARACTER_SECRET_HERE
```

## 🚨 Security Risks

### If JWT_SECRET is Compromised

- **Token Forgery**: Attackers can create valid authentication tokens
- **Session Hijacking**: Can impersonate any user
- **Unauthorized Access**: Can bypass all authentication controls
- **Data Breaches**: Can access sensitive user data and operations

### Real-World Example

```
Compromised JWT_SECRET → Attacker creates fake admin token →
Full system access → User data theft → System compromise
```

## 📋 Best Practices

### 1. Environment-Specific Secrets

```bash
# Development (local only)
JWT_SECRET=dev_local_only_secret_2025

# Staging
JWT_SECRET=staging_unique_secret_2025

# Production
JWT_SECRET=production_military_grade_secret_2025
```

### 2. Rotation Strategy

- **Rotate regularly**: Change JWT_SECRET every 90 days
- **Graceful rotation**: Support multiple secrets during transition
- **Monitor usage**: Watch for suspicious token generation patterns

### 3. Secure Storage

- **Environment variables**: Store in secure environment configuration
- **Secret management**: Use services like AWS Secrets Manager, HashiCorp Vault
- **Access control**: Limit who can access production secrets

## 🔍 Verification and Testing

### Verify JWT_SECRET is Working

```bash
# Test token generation (if you have access to the application)
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"test"}'

# Check response for JWT token
# Token should be properly signed and verifiable
```

### Debug JWT Issues

```bash
# If you see "Invalid signature" errors, JWT_SECRET might be:
# 1. Missing or empty
# 2. Different between services
# 3. Not properly configured
```

## 📚 Hyperpage Integration

### Where JWT_SECRET is Used

- **Authentication endpoints**: `/api/auth/*`
- **OAuth callbacks**: GitHub, GitLab, Jira integration
- **Session middleware**: User session validation
- **API protection**: Rate limiting and user identification

### Configuration Files

- **`.env.docker`**: Development JWT secret template
- **`.env.production.sample`**: Production JWT secret template
- **Application code**: JWT token signing and verification

## 🆘 Troubleshooting

### Common JWT_SECRET Issues

#### "Invalid signature" Errors

**Problem**: JWT token validation fails
**Solution**:

1. Check JWT_SECRET is set in environment
2. Verify JWT_SECRET is identical across services
3. Ensure JWT_SECRET is properly loaded

#### "Secret not provided" Errors

**Problem**: JWT_SECRET environment variable missing
**Solution**:

1. Add JWT_SECRET to your .env.docker file
2. Restart the application
3. Verify with `echo $JWT_SECRET`

#### Authentication Not Working

**Problem**: Users cannot log in
**Solution**:

1. Check JWT_SECRET is not empty
2. Verify JWT_SECRET meets security requirements
3. Check application logs for JWT-related errors

## 🔄 Migration Guide

### For New Developers

1. **Copy template**: `cp .env.docker.sample .env.docker`
2. **Generate secret**: `openssl rand -hex 32`
3. **Replace placeholder**: Update `JWT_SECRET=` with your generated value
4. **Test authentication**: Verify login works with your tools

### For Existing Developers

1. **Backup current setup**: Keep note of current JWT_SECRET
2. **Generate new secret**: `openssl rand -hex 32`
3. **Update .env.docker**: Replace the JWT_SECRET value
4. **Test thoroughly**: Verify all authentication flows work
5. **Invalidate old tokens**: Users may need to re-login

## 📞 Support

### If You Need Help

- **Application issues**: Check `docs/secrets/local-development.md`
- **Security concerns**: Follow your organization's security policies
- **JWT debugging**: Enable debug logging and check application logs

---

**Remember**: JWT_SECRET is one of the most critical security components in your application. Treat it with the same care as you would a production database password!
