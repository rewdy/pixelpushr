# Proposal

## Why

The admin gate reports expired sessions and service failures as missing administrator access. Login currently stores only a tab-scoped access token, so the console cannot renew an expired credential or keep users signed in across browser restarts.

## What Changes

- Redirect protected pages to sign-in when the session is missing or definitively invalid. Show a sign-in notice for expired or invalid sessions and keep permission and service errors in context.
- Keep users signed in for a fixed seven days from successful login, including across browser restarts. Renew short-lived Cognito access tokens during the session and enforce the deadline on the server.
- Make logout invalidate the application session on the server. Harden invitation identity checks, credential handling, and authentication error reporting.
- **BREAKING** Existing browser sessions require one sign-in after rollout. Authenticated console API calls move from browser-managed bearer tokens to a same-origin session cookie.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `digital-signage-platform` gains administrator session renewal and recovery behavior, role-specific denials, and verified-email enforcement for invitation redemption.

## Impact

The change spans the React auth screens and request layer, Hono auth routes and guards, local and Cognito adapters, PostgreSQL session persistence, Cognito and CloudFront configuration, and auth tests and operator docs.
