# Design

## Context

The invitation API persists a pending record with a token hash and builds an absolute URL from the configured public web URL. Cognito handles new-account verification separately from invitation email.

## Goals / Non-Goals

- Return the shareable link as soon as creation succeeds. Keep optional mail submission bounded within its own request.
- Keep the existing one-time disclosure model. Retrieving a link after reload and rotating its token are outside this change.

## Decisions

1. Return `201` with `invitation` and `url` from `POST /admin/invitations` with `Cache-Control: no-store`. Leave email submission out of this request. Keep the existing member and pending-invitation conflict checks, account verification, and redemption path.
2. Add owner-only `POST /admin/invitations/email` with the invitation token in its JSON body. Look up the token hash in the owner's organization and require a pending, unexpired invitation. Derive the email from the saved recipient and construct the URL from the server configuration and matched token. Return `emailStatus` as `submitted` or `unconfirmed`. The request performs no invitation writes.
3. Bound the mail wait to five seconds. Clear the deadline timer on settlement. Handle late completion or rejection and cancel where the adapter supports it. A timeout is unconfirmed because a provider may have accepted the request before its response arrived. Log sanitized events without provider exception text, tokens, or URLs.
4. Keep the newest creation result in People & access component state. Close the creation modal and show the recipient, read-only URL, **Copy link**, and optional **Send email**. Show the result of the latter near the link. The owner can copy throughout the send attempt and after either outcome. If creation fails, keep the modal open with the entered value and its error.

5. Add owner-only `DELETE /admin/invitations/:id` for a pending, unexpired invitation in the owner's organization. Delete it in one conditional statement so concurrent redemption and revocation have a single winner. The removed token fails the existing lookup, and a new invitation can reuse the email. People & access confirms revocation, refreshes the list, and clears the creation result if it holds the revoked URL.

## Risks / Trade-offs

- A provider may accept a send despite a timeout or may fail to deliver it later. An owner can retry an unconfirmed send. Any duplicate emails contain the same single-use URL.
- Leaving or reloading People & access clears the displayed URL. Prompt the owner to copy it first. If the link is lost, the owner can revoke the invitation and create a replacement.
- New Cognito users still complete account confirmation separately.

## Migration Plan

Release the API and web changes together through the existing release process. Existing invitations keep their redemption path and schema.
