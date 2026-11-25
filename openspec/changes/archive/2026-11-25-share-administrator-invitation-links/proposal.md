# Proposal

## Why

Workspace owners need a working invitation link as soon as it is created, including while SES production access is pending. Sending email in the creation request ties access to the link to the mail provider’s response time.

## What Changes

- Show the invitation URL and Copy link immediately after creation on People & access.
- Offer Send email as a separate, optional action that sends the same URL.
- Report whether the mail provider accepted the request or email could not be confirmed. Keep the invitation pending and usable after a mail failure.
- Let owners revoke a pending invitation so they can invalidate a lost link and issue a new one for the same address.
- Keep invitations tied to the invited email address, with the existing seven-day expiry and account requirements.

## Capabilities

### New Capabilities

### Modified Capabilities

- `digital-signage-platform` will support sharing an administrator invitation independently of email delivery.

## Impact

The owner-only invitation creation, email, and revocation APIs, People & access, invitation tests, and operator documentation will change. The existing invitation token and mail adapters support this change without a schema migration or AWS configuration changes.
