# OAuth Authentication Architecture Design

## Overview
This document outlines the authentication system architecture for implementing OAuth integration in Hyperpage, extending the existing session management to include user authentication with secure token storage.

## Architecture Components

### 1. Database Schema Extensions

#### User Authentication Table
```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY, -- OAuth provider user ID (e.g., github:12345)
  provider TEXT NOT NULL, -- 'github', 'jira', 'gitlab'
  providerUserId TEXT NOT NULL, -- Raw provider user ID
  email TEXT, -- Optional user email
  username TEXT, -- Optional username
  displayName TEXT, -- Optional display name
  avatarUrl TEXT, -- Optional avatar URL
  createdAt INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  updatedAt INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  UNIQUE(provider, providerUserId)
);
```

#### OAuth Tokens Table
```sql
CREATE TABLE oauth_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId TEXT NOT NULL,
  toolName TEXT NOT NULL, -- 'github', 'jira', 'gitlab'
  accessToken TEXT NOT NULL, -- Encrypted using AES-256-GCM
  refreshToken TEXT, -- Encrypted using AES-256-GCM (when available)
  tokenType TEXT DEFAULT 'Bearer',
  expiresAt INTEGER, -- Token expiry timestamp (milliseconds)
  refreshExpiresAt INTEGER, -- Refresh token expiry (milliseconds)
  scopes TEXT, -- Required scopes granted
  metadata TEXT, -- JSON: additional OAuth response data
  createdAt INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  updatedAt INTEGER NOT NULL DEFAULT (unixepoch() * 1000),

  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(userId, toolName)
);
```

#### User Sessions Table (Complement to Redis)
```sql
CREATE TABLE user_sessions (
  sessionId TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  provider TEXT, -- Quick reference to auth provider
  createdAt INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  lastActivity INTEGER NOT NULL DEFAULT (unixepoch() * 1000),

  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
);
```

### 2. Session Management Integration

#### Extended SessionData Interface
```typescript
export interface SessionData {
  userId?: string; // Authenticated user ID (changes from optional to authenticated users)
  user?: { // User profile information
    id: string;
    provider: string;
    email?: string;
    username?: string;
    displayName?: string;
    avatarUrl?: string;
  };
  authenticatedTools: {
    [toolName: string]: {
      connected: boolean;
      connectedAt: Date;
      lastUsed: Date;
    };
  };
  // ... existing fields (preferences, uiState, etc.)
}
```

#### Authentication-Aware Session Manager
- **User Association**: Unaffected sessions remain anonymous; authenticated sessions link to `userId`
- **Authentication Persistence**: Successful OAuth flow updates session with `userId` and profile
- **Logout Handling**: Authentication middleware invalidates authenticated sessions
- **Background Refresh**: Automated token refresh maintains active authentication state

### 3. Middleware Architecture

#### Authentication Middleware
```typescript
// /app/api/middleware/auth.ts
export async function withAuth(
  handler: NextApiHandler,
  options: { required?: boolean; tools?: string[] }
): Promise<NextApiHandler> {
  return async (req, res) => {
    const { sessionId } = parseSessionCookies(req);

    if (!sessionId) {
      if (options.required) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      return handler(req, res); // Allow anonymous for optional auth
    }

    const session = await sessionManager.getSession(sessionId);
    if (!session?.userId) {
      if (options.required) {
        return res.status(401).json({ error: 'Invalid session' });
      }
      return handler(req, res);
    }

    // Check tool-specific authentication if required
    if (options.tools?.length && session.authenticatedTools) {
      const missingTools = options.tools.filter(tool =>
        !session.authenticatedTools[tool]?.connected
      );

      if (missingTools.length > 0) {
        return res.status(403).json({
          error: 'Tool authentication required',
          missingTools
        });
      }
    }

    req.session = session; // Attach session to request
    req.user = session.user;

    return handler(req, res);
  };
}
```

### 4. Token Storage Security

#### Encryption Strategy
- **AES-256-GCM**: Military-grade encryption for all stored tokens
- **Key Management**: Encryption keys stored in environment variables (`OAUTH_ENCRYPTION_KEY`)
- **Key Rotation**: Support for periodic key rotation with re-encryption
- **Initialization Vector**: Unique IV per token using crypto.randomBytes(16)

#### Secure Token Storage Utilities
```typescript
export class SecureTokenStorage {
  private static encryptionKey = process.env.OAUTH_ENCRYPTION_KEY;

  static encrypt(plaintext: string): { encrypted: string; iv: string } {
    // Implementation using crypto.createCipherGCM
  }

  static decrypt(encrypted: string, iv: string): string {
    // Implementation using crypto.createDecipherGCM
  }

  static async storeToken(
    userId: string,
    toolName: string,
    tokenData: OAuthTokenData
  ): Promise<void> {
    // Store encrypted tokens in database
  }

  static async retrieveToken(
    userId: string,
    toolName: string
  ): Promise<OAuthTokenData | null> {
    // Retrieve and decrypt tokens from database
  }
}
```

### 5. OAuth Flow Architecture

#### Authentication Routes
```
/api/auth/[tool]/initiate  - Start OAuth flow (redirect to provider)
/api/auth/[tool]/callback  - Handle provider callback (exchange code for tokens)
/api/auth/[tool]/status    - Check authentication status
/api/auth/logout          - Clear authentication
```

#### Flow State Management
- **PKCE Support**: Proof Key for Code Exchange for enhanced security
- **State Parameter**: CSRF protection with encrypted state cookies
- **Nonce Handling**: Prevents replay attacks on authorization codes
- **Error Handling**: User-friendly error pages for failed authentications

### 6. API Integration

#### Tool API Authentication
```typescript
// Extend existing tool APIs with authentication
export async function authenticatedToolRequest(
  userId: string,
  toolName: string,
  endpoint: string,
  options: RequestOptions
): Promise<any> {
  const token = await SecureTokenStorage.retrieveToken(userId, toolName);

  if (!token) {
    throw new Error(`No authentication for tool: ${toolName}`);
  }

  // Auto-refresh if needed
  if (token.shouldRefresh()) {
    await refreshTokenForUser(userId, toolName);
    // Retry with new token
  }

  return makeAuthenticatedRequest(endpoint, {
    ...options,
    headers: {
      'Authorization': `${token.tokenType} ${token.accessToken}`,
      ...options.headers
    }
  });
}
```

### 7. UI/UX Architecture

#### Authentication UI Components
- **Connect Button**: Prominent tool connection buttons with status indicators
- **Connection Status**: Sidebar indicators showing authenticated tools
- **Error States**: User-friendly error messages for failed connections
- **Permission Requests**: Clear explanation of requested OAuth permissions

#### Responsive Design
- **Authentication Flows**: Optimized for mobile and desktop authentication
- **Loading States**: Clear progress indicators during OAuth redirects
- **Fallback Options**: Gradual feature degradation for unauthenticated users

### 8. Security Practices

#### CSRF Protection
- Server-generated state parameters for all OAuth flows
- Secure state validation preventing cross-site request forgery

#### Token Security
- Access tokens never exposed to client-side JavaScript
- Refresh operations performed server-side only
- Automatic token rotation/recovery for compromised tokens

#### Audit Logging
```typescript
export interface AuthAuditEvent {
  event: 'login' | 'logout' | 'token_refresh' | 'token_revoke';
  userId: string;
  toolName: string;
  ipAddress: string;
  userAgent: string;
  timestamp: number;
  success: boolean;
  details?: Record<string, any>;
}
```

#### Rate Limiting
- OAuth flow rate limiting (5 attempts per minute per user IP)
- Token refresh rate limiting to prevent abuse

### 9. Migration Strategy

#### Phased Implementation
1. **Phase 1**: Anonymous usage remains unchanged
2. **Phase 2**: Optional authentication UI with feature opt-in
3. **Phase 3**: Required authentication for sensitive operations
4. **Phase 4**: Full authentication enforcement

#### Database Migration
- Non-disruptive schema additions
- Backward-compatible with existing anonymous sessions
- Gradual migration of session data to database tables

This architecture provides secure, scalable OAuth authentication while maintaining backward compatibility with existing anonymous usage patterns.
