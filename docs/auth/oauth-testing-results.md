# OAuth Implementation Status

This note replaces the earlier “all green” report that no longer matched reality. It documents what is verified today and what still needs attention.

## What Works

- `/api/auth/oauth/[provider]` initiation and callback handlers respond with the expected redirects and error envelopes.
- State cookies are validated, so mismatched or missing `state` parameters result in `github_oauth_invalid_state` style errors.
- Sessions are updated with authenticated tool metadata after a successful callback.
- Tokens are saved via `SecureTokenStorage` and can be retrieved for subsequent API calls.

You can confirm the basics with:

```bash
curl -I http://localhost:3000/api/auth/github/initiate
curl -I "http://localhost:3000/api/auth/oauth/github?code=test&state=bad"
```

## Known Gaps (Need Work)

| Area              | Issue                                                                                                       |
| ----------------- | ----------------------------------------------------------------------------------------------------------- |
| Token encryption  | Tokens are stored in plain columns inside PostgreSQL. AES-256-GCM has not been implemented.                 |
| PKCE              | No `code_verifier` / `code_challenge` support. The current flow assumes a trusted server.                   |
| Automated refresh | No background refresh loop exists; tokens expire unless manually refreshed.                                 |
| Test coverage     | There are no automated tests that hit the OAuth handlers end-to-end. Manual curl testing is required today. |

## Next Steps

1. Implement AES-256-GCM encryption in `SecureTokenStorage` and update docs/tests accordingly.
2. Add PKCE support and revisit the callback handler to validate the `code_verifier`.
3. Write integration tests that mock provider responses so regressions are caught automatically.
4. Extend `AuthPanel` UX once the backend protections are in place.

Until those items land, treat the OAuth implementation as functional but not production-hardened. Update this document whenever a gap is closed so contributors know the real state of the system.
