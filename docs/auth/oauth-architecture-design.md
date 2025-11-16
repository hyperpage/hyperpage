# OAuth Authentication Architecture

This document captures the registry-driven OAuth approach that exists in the repository today. It intentionally distinguishes between shipped behaviour and future enhancements so the implementation and documentation stay aligned.

## Current State

- Each tool definition may expose an `oauthConfig` block describing authorization/token URLs, scopes, and the environment variables that hold the client ID/secret.
- `getOAuthConfig()` (in `lib/oauth-config.ts`) loads those settings at runtime, normalises provider names, and builds redirect URLs such as `/api/auth/oauth/github`.
- `/api/auth/oauth/[provider]` contains both the initiation and callback handlers.
  - **Initiation (`GET`)** – validates provider name, builds the authorization URL, creates a state cookie (JSON payload for Jira), and redirects the browser to the provider.
  - **Callback (`POST`)** – validates the state cookie, exchanges the code for tokens, stores them via `SecureTokenStorage`, and updates the session record.
- State validation and error envelopes are fully implemented. If validation fails, the handler redirects back to the portal with descriptive query parameters (e.g., `?error=github_oauth_missing_code`).
- Tokens are stored in PostgreSQL without additional encryption. The plan is to add AES-256-GCM in a future pass, but that code does not exist yet.
- PKCE is not implemented. The current flow relies on server-side secret storage and is suitable for trusted deployments only.

## Components

| Component                 | Purpose                                                                                                      |
| ------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `tool.config.oauthConfig` | Declares provider URLs, scopes, and env-var names for credentials.                                           |
| `getOAuthConfig`          | Loads provider settings, validates secrets, formats URLs, and exposes a provider descriptor.                 |
| `buildAuthorizationUrl`   | Constructs the redirect URL with scopes, redirect URI, `response_type=code`, and the state value.            |
| `exchangeCodeForTokens`   | Performs the POST request to the provider’s token endpoint and normalises the response shape.                |
| `SecureTokenStorage`      | Wraps the Postgres repository and offers helper methods (`storeTokens`, `getTokens`, `shouldRefresh`, etc.). |
| `sessionManager`          | Persists authenticated tool metadata so the client can show which providers are connected.                   |

## Data Model

- **`users` table** – Records provider metadata (provider, provider user ID, username, avatar, etc.).
- **`oauth_tokens` table** – Stores access tokens, refresh tokens, scope strings, expiry timestamps, and an opaque `raw` JSON payload.
- **`user_sessions` table** – Tracks session IDs, user relationships, and metadata so the portal knows which tools are authenticated.

All schema definitions live in `lib/database/pg-schema.ts` and are exercised by the Postgres migration `lib/database/migrations/000_init_pg_schema.ts`.

## Future Work

| Area                | Status / Notes                                                                                                           |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| PKCE                | Not implemented. Requires storing `code_verifier` per session and updating both initiation + callback handlers.          |
| Token encryption    | Planned AES-256-GCM layer for `SecureTokenStorage`. Until then, restrict database access.                                |
| User-facing auth UI | The `AuthPanel` components expose credentials and status, but there is no multi-tenant or per-user permission model yet. |
| Automated refresh   | `SecureTokenStorage.shouldRefresh` helpers exist, but scheduled refresh/cleanup loops need to be wired up.               |

Update this file whenever the OAuth implementation changes so other docs (security, deployment, usage) stay consistent.
