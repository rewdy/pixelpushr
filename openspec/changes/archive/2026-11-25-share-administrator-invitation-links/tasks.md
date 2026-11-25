# Tasks

## 1. Invitation API

- [x] 1.1 Return the URL on creation and add a separate owner-only route for submitting the same invitation to the saved recipient. Verify creation does not call the mailer, both send outcomes, identical URLs, retention after rejection or deadline, duplicate creation conflicts, and late rejection handling.
- [x] 1.2 Use the existing acceptance route and hashed-token persistence. Verify that the link returned after mail failure can be redeemed exactly once by the matching account, that wrong-account and expired links are rejected, that listing responses omit the token and URL, and that a non-owner cannot create or email an invitation. Verify that the send endpoint rejects unknown, accepted, or expired invitations.

- [x] 1.3 Add owner-only revocation for active pending invitations. Verify invalidation, reissuance, and rejection of non-owner, accepted, and expired cases in integration tests.

## 2. People & access

- [x] 2.1 Show the read-only URL and Copy link immediately, with email submission available as a separate action. Verify in Playwright that the owner can copy before the email attempt, can still copy after rejection, and the recipient can redeem the link. Verify mail success and modal error behavior.
- [x] 2.2 Update the People & access design guidance and operator walkthrough. Verify that the docs match the implemented copy flow, including the need to copy before leaving and the separate Cognito account-confirmation step.

- [x] 2.3 Add a confirmation to the pending invitation row and document recovery for lost links. Verify cancellation, revocation after reload, and a fresh link for the same address in Chromium.

## 3. Verification

- [x] 3.1 Run `bun run check`, `bun run typecheck`, `bun run build`, `bun run test:integration`, and `bun run test:browser` with the documented local services.
