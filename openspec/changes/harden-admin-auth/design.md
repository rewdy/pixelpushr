# Design

## Context

The admin gate sends every `/admin/me` error through setup discovery and then renders the same membership alert. The client request helper discards the API status and error code. The API verifies identity and queries membership in both middleware and several handlers. Cognito login returns a refresh token, but the SPA keeps only the access token in `sessionStorage`. The local provider issues a 12-hour JWT without renewal. Sign-out currently clears browser storage only.

Production and local development both send console requests through same-origin `/api`. Cognito already checks signature, issuer, token use and app client, and production setup already checks the designated owner's current verified email. Invitation acceptance currently compares against the saved application email. Registration and confirmation can return raw provider messages, and provider dependency failures can look like bad credentials or invalid sessions.

## Goals / Non-Goals

**Goals**

- Retain one authentication path for setup, invitations and administration, with explicit identity, membership and owner checks.
- Keep provider credentials server-side and use one revocable browser session per login.

**Non-Goals**

- MFA, identity-provider migration, new account-management features, and changes to public player access are outside this change.

## Decisions

1. **Persist the application session in PostgreSQL.** Set a high-entropy opaque credential in a persistent host-only HttpOnly cookie with SameSite=Lax and Secure in HTTPS environments. Store a digest of the cookie credential and the subject and server-side deadline. Protect stored Cognito credentials with application-level encryption and managed key configuration. Keep the seven-day deadline fixed and enforce it at every protected request, including requests using recently renewed provider credentials. The local adapter uses the same session lifecycle with PostgreSQL identity and no upstream token exchange. A browser-managed bearer token would expose the credential to JavaScript and complicate revocation.
2. **Renew Cognito credentials at the API.** Configure short access-token validity and seven-day refresh validity explicitly. Use rotation and `GetTokensFromRefreshToken`, with a bounded retry grace period. Serialize renewal per session in PostgreSQL across Lambda instances, recheck current state after lock acquisition, and save replacements atomically. Bound provider calls and retain retryable state on transient failures. An expired or revoked refresh credential ends the app session. Logout invalidates the app session immediately, clears the cookie, and attempts Cognito refresh revocation with sanitized failure reporting. Application session enforcement covers logout independently of JWT expiration. [AWS Cognito refresh token documentation](https://docs.aws.amazon.com/cognito/latest/developerguide/amazon-cognito-user-pools-using-the-refresh-token.html)
3. **Use typed errors at the request boundary.** Preserve response status and error code in the web client. Use stable codes for missing session, invalid or expired session, membership required and owner required. A cookie that has already aged out is indistinguishable from a first visit after reopening the browser, so a request with no cookie opens ordinary sign-in. When a running console loses its prior session, show the sign-in notice even if the cookie is already gone. Restrict first-run discovery to authenticated membership denials. Keep invitation and setup errors on their routes. Validate return targets against known same-origin routes and keep credentials and raw provider errors out of navigation state. Reset administrator query state on logout and account changes. Do not replay interrupted mutations after sign-in.
4. **Fail closed at authorization boundaries.** Centralize identity and membership resolution for protected requests and check current membership on each request. Keep setup and invite acceptance identity-only until membership is granted. Require the current verified provider email at production invitation redemption, with equivalent identity binding in local development. Preserve transaction-based invitation consumption and owner-only operations. Normalize provider failures, keeping credential rejection distinct from timeouts, throttling and dependency errors. Document the remaining limit that locally verified Cognito access credentials can remain usable through their short validity window following provider-side revocation until renewal detects it.
5. **Protect the cookie transport.** Require trusted same-origin requests for unsafe cookie-authenticated operations and auth session creation, using the configured public origin and explicit local/test equivalents. Verify API cookie forwarding, Set-Cookie behavior, and disabled API caching through the existing proxy and CloudFront configuration. Return no-store for session-bearing and private responses. Sanitize provider, database and request telemetry to exclude credentials, invite links and sensitive payloads.

## Risks / Trade-offs

- **Database writes and concurrent renewal** → Use indexed session lookup, bounded calls and an expiry cleanup path. Test concurrent tabs and logout during renewal. Prevent a late response from restoring a revoked session.
- **Provider rotation succeeds before a local write or response fails** → Use a short provider retry grace window, test recovery from a lost response, and require reauthentication if the original credential is definitively rejected.
- **Provider outage** → Preserve a valid session while renewal remains retryable and expose a retryable error. Enforce the seven-day cap even during an outage.

## Migration Plan

Add the session table and key configuration, then deploy the API and SPA together with the Cognito app-client settings. Existing browser sessions will require one sign-in. If rolling back, restore the matching API and SPA plus compatible Cognito settings, and invalidate sessions from the withdrawn release. Validate the infrastructure locally and record the live renewal and expiration smoke checks for an authorized deployment.
