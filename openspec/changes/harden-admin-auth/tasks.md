# Tasks

## 1. Session storage and provider renewal

- [x] 1.1 Add the application session schema, migration, expiry cleanup, encrypted provider credential storage and validated key configuration. Verify migration on clean and existing databases, expiry cleanup, credential redaction, and the fixed deadline with a controllable clock.
- [x] 1.2 Configure Cognito access and refresh validity, rotation, retry grace and compatible auth flows. Implement provider renewal, revocation and typed failure mapping. Verify SDK exchanges and required claims with focused adapter tests, and run Terraform format and local validation.
- [x] 1.3 Wire login, logout, session lookup and serialized renewal for the Cognito and local paths. Verify successful refresh, concurrent renewal, deadline enforcement after near-boundary refresh, retry after an ambiguous provider response, terminal failure and logout during renewal with integration tests.

## 2. Authentication and authorization boundaries

- [x] 2.1 Resolve current identity and membership once per request, preserve identity-only routes and enforce owner checks. Verify no-session, non-member, member and owner behavior, including membership removal, first-run setup and public player regression coverage.
- [x] 2.2 Bind invite redemption to the current verified email and keep redemption transactional. Verify valid redemption, stale or unverified email denial, revoked and expired invitations and concurrent single use.
- [x] 2.3 Enforce trusted origins on auth and unsafe cookie-authenticated routes, prevent credential caching and sanitize errors and logs. Verify cookie attributes, cross-origin rejection, same-origin proxy behavior, cache headers and safe error output. Document cookie forwarding, key configuration and rollout. Review login, sign-up and confirmation abuse controls and record the observed controls and any residual risk in the operator docs.

## 3. Console recovery

- [x] 3.1 Move the SPA to cookie-backed authentication and typed API errors. Handle initial and in-flight session loss, validate internal return paths, and reset administrator queries on session transitions. Verify reload and browser restart persistence, expired-session banners, stale legacy session recovery, and that interrupted mutations are never automatically replayed after sign-in.
- [x] 3.2 Keep membership, owner, invite, setup, bad-login and service errors in context. Verify browser coverage for appropriate copy, retry and account-switch actions, first-run routing, and absence of redirect loops or interference with public playback.

## 4. End-to-end verification

- [x] 4.1 Run lint, type checking, build, unit, integration and browser suites. Verify the deployed request shape locally, using controlled provider responses for the Cognito path.
- [ ] 4.2 With explicit operator authorization and a provisioned AWS environment, smoke-test sign-in, access renewal across an actual Cognito expiry, the configured session deadline and logout through CloudFront. Record results separately from local verification.
