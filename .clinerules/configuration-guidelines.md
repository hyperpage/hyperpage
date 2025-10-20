# Configuration Guidelines - Hyperpage

This document outlines the standards and best practices for configuration management in the Hyperpage project.

## Environment Variable Management

### File Structure and Naming Conventions

- **`.env.local.sample`**: Template file committed to version control with placeholder values
- **`.env.local`**: Local development file (ignored by git) with actual credentials
- **`.env`**: Production environment variables (server-side only)
- **Variable Prefixes**: Use `ENABLE_TOOL_NAME=true/false` for tool enablement
- **Sensitive Data**: Never commit real API keys, tokens, or credentials

### Configuration Categories

#### 1. Tool Enablement Variables
```env
# Aggregation Tools
ENABLE_CODE_REVIEWS=false
ENABLE_CICD=false
ENABLE_TICKETING=false

# Individual Tool Configurations
ENABLE_JIRA=false
ENABLE_GITHUB=false
ENABLE_GITLAB=false
```

#### 2. Tool-Specific Configuration
```env
# JIRA Configuration
JIRA_WEB_URL=https://your-domain.atlassian.net
JIRA_EMAIL=your_email@company.com
JIRA_API_TOKEN=your_personal_access_token

# GitHub Configuration
GITHUB_TOKEN=github_pat_...
GITHUB_USERNAME=your_username
```

#### 3. URL Auto-Derivation
The system automatically derives API URLs from web URLs using consistent patterns:
- **Jira**: `webUrl + '/rest/api/3'` (e.g., `https://domain.atlassian.net/rest/api/3`)
- **GitLab**: `webUrl + '/api/v4'` (e.g., `https://gitlab.com/api/v4`)
- **GitHub**: Always uses `https://api.github.com`

### Security Standards for Configuration

#### Credential Protection
- **Server-Only Access**: Environment variables read only in server components/pages
- **No Client-Side Leaks**: Never pass sensitive configs to client components
- **Registry-Based Isolation**: Tool configs automatically excluded from client-safe objects
- **Build Cleanliness**: Ensure no credential leakage in production bundles

#### Validation Requirements
- **Parameter Sanitization**: All dynamic route parameters validated with strict regex
- **Early Validation**: Input validation occurs immediately after parameter extraction
- **Error Responses**: Invalid inputs return HTTP 400 with generic messages
- **Injection Prevention**: Validation prevents directory traversal and injection attacks

### Adding New Tool Configurations

#### Checklist for New Tools

1. **Environment Variable Definition**
   - Add `ENABLE_TOOL_NAME=false` in `.env.local.sample`
   - Document the minimum required configuration variables
   - Include example placeholders

2. **Configuration Documentation**
   - Document all required and optional parameters
   - Explain authentication flows and token generation
   - Provide link to tool's API documentation

3. **Validation Implementation**
   - Implement parameter validation in API routes
   - Add error handling for invalid configurations
   - Create user-friendly error messages

4. **Testing Requirements**
   - Test with mock data during development
   - Validate real API integration safely
   - Document configuration test procedures

#### Tool Configuration Template

```env
# Tool Name Configuration
# ENABLE_TOOL_NAME=false
# TOOL_NAME_WEB_URL=https://your-instance-url
# TOOL_NAME_API_TOKEN=your_api_token
# TOOL_NAME_USERNAME=your_username (if required)
```

### Configuration Documentation Standards

#### README Integration
Update README.md configuration section when adding new tools:
- Add tool to configuration examples
- Document required environment variables
- Include setup instructions
- Provide troubleshooting guidelines

#### Developer Onboarding
Ensure all new team members receive:
- Complete .env.local setup guide
- Tool-specific authentication tutorials
- Security awareness training for credential handling

### Error Handling and User Experience

#### Configuration Validation
- **Startup Checks**: Validate required variables on application start
- **Graceful Degradation**: Disable tools with invalid configuration (no crashes)
- **User Feedback**: Provide clear error messages for missing/invalid configuration
- **Recovery Guidance**: Link to documentation for fixing configuration issues

#### Development vs Production
- **Development**: Comprehensive error messages for debugging
- **Production**: Generic error messages without sensitive details
- **Environment Detection**: Automatic behavior based on NODE_ENV

### Best Practices

#### Organization and Maintainability
- **Logical Grouping**: Group related configurations together
- **Clear Comments**: Document purpose and format of each variable
- **Version Control**: Only commit template files with placeholders
- **Backup Strategy**: Document safe backup procedures for configuration

#### Tool Addition Workflow
1. Define configuration requirements in tool specification
2. Update .env.local.sample with new variables
3. Implement validation logic in API routes
4. Test configuration handling comprehensively
5. Update README.md and documentation
6. Train team members on new configuration requirements

By following these guidelines, configurations remain secure, maintainable, and user-friendly throughout the project lifecycle.
