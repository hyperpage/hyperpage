# OAuth 2.0 Integration Research - Authentication System

## Overview

This document summarizes OAuth 2.0 authorization code flow requirements for the supported tools in Hyperpage (GitHub, Jira, GitLab) to implement secure authentication.

## OAuth 2.0 Authorization Code Flow Requirements

### Common OAuth 2.0 Components

- **Client ID**: Application identifier registered with OAuth provider
- **Client Secret**: Secret key for server-side token requests (never exposed to client)
- **Redirect URI**: HTTPS URL where users are redirected after authorization
- **Scopes**: Permissions requested (read:repo, write:issues, etc.)
- **Authorization Code**: Temporary code exchanged for access tokens
- **Access Token**: Bearer token for API requests
- **Refresh Token**: Optional token to obtain new access tokens without re-authorization

### Tool-Specific OAuth Implementation

#### GitHub OAuth 2.0

- **Authorization URL**: `https://github.com/login/oauth/authorize`
- **Token URL**: `https://github.com/login/oauth/access_token`
- **Supported Flow**: Authorization Code (PKCE recommended)
- **Common Scopes**: `read:user`, `repo`, `read:org`, `read:discussion`
- **Features**: Supports personal access tokens as backup; provides refresh tokens for long-term access
- **API Note**: GitHub's REST API v3 requires base URL `https://api.github.com`

#### Jira OAuth 2.0

- **Authorization URL**: `{instance-url}/rest/oauth2/latest/authorize`
- **Token URL**: `{instance-url}/rest/oauth2/latest/token`
- **Supported Flow**: Authorization Code Grant (separate from OAuth 1.0a)
- **Common Scopes**: `read:jira-work`, `read:jira-user`, `write:jira-work`
- **Features**: Instance-specific URLs based on user's Atlassian site; supports project/organization-level access
- **API Note**: REST API v3 is available, but v2 is more widely supported

#### GitLab OAuth 2.0

- **Authorization URL**: `{instance-url}/oauth/authorize` (e.g., `https://gitlab.com/oauth/authorize`)
- **Token URL**: `{instance-url}/oauth/token`
- **Supported Flow**: Authorization Code Grant
- **Common Scopes**: `read_user`, `api`, `read_repository`, `write_repository`
- **Features**: Supports both GitLab.com and self-hosted instances; provides groups-based access control
- **API Note**: GitLab provides both v3 and v4 APIs, with v4 being the current recommended version

## Security Considerations

- Use HTTPS exclusively for all OAuth flows (critical requirement)
- Store client secrets securely in environment variables only
- Implement PKCE (Proof Key for Code Exchange) for public clients
- Handle token refresh automatically without user intervention
- Validate state parameters to prevent CSRF attacks
- Use secure token storage (server-side only, never in localStorage)

## Implementation Architecture

1. **Initiation**: User clicks "Connect [Tool]" → Redirect to OAuth authorization URL
2. **Authorization**: User grants permissions → Provider redirects with authorization code
3. **Exchange**: Server exchanges code for access/refresh tokens via secure POST
4. **Storage**: Tokens stored securely (refresh tokens hashed/encrypted)
5. **Usage**: Tool APIs use access tokens for authenticated requests
6. **Refresh**: Automate token refresh before expiry to maintain continuous access

## Next Steps for Implementation

Following this research, implement the server-side OAuth handlers starting with a single tool (GitHub) to establish the pattern, then expand to other tools using similar flows.
