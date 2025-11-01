# Security Practices - Hyperpage

This document outlines the security standards and best practices for the Hyperpage project.

## Security Standards

#### **API Token Management**
- **Tool Registry Security**: Tool `config` objects with API tokens and headers are automatically excluded from client components through the `/api/tools/enabled` endpoint
- **Server-Side Authentication**: All external API calls and credential handling must occur server-side only
- **Environment Isolation**: API tokens in environment variables are never passed to client components or exposed in client-side code
- **API-Based Security**: Client components use API endpoints to access safe tool data without sensitive configuration

#### **Input Validation Requirements**
- **API Route Validation**: All dynamic route parameters must be validated using strict regex patterns (e.g., `^[a-zA-Z0-9_-]+$`)
- **Early Validation**: Input validation must occur immediately after parameter extraction in API routes
- **Error Responses**: Invalid inputs return HTTP 400 with generic error messages
- **Prevention Focus**: Validation prevents directory traversal, injection attacks, and parameter manipulation

#### **Error Handling Standards**
- **Information Leakage Control**: API error responses must use generic messages without implementation details
- **Server-Only Detailed Logging**: Full error details stay in server logs for debugging
- **Client Response Format**: Error responses follow pattern `"An error occurred while processing the request"`
- **No Stack Traces**: Never expose stack traces or internal error information in API responses

#### **Security Checklist**
Before deploying or modifying security-sensitive features:
- ✅ **SECURITY AUDIT COMPLETED (PASSED)** - Comprehensive audit verified all requirements
- ✅ Tool configurations excluded from client components through API endpoints
- ✅ Input validation implemented on all API route parameters
- ✅ Error messages are generic and don't expose implementation details
- ✅ API tokens only accessed server-side in API handlers
- ✅ Client components receive only UI-safe tool data from API endpoints
- ✅ Environment variables properly protected with .gitignore exclusions
- ✅ No hardcoded credentials in source code
- ✅ Build artifacts clean with no credential leakage
- ✅ Environment variables never passed to client components

## Cross-References

### Extends
- **Core Security**: Implements security best practices within Hyperpage project context
- **Architecture Patterns**: Integrates security throughout tool integration system

### See Also
- [Coding Principles](coding-principles.md) - Architectural patterns requiring security considerations
- [Configuration Guidelines](configuration-guidelines.md) - Environment variable security management
- [Code Standards](coding-style.md) - Security-aware development practices
