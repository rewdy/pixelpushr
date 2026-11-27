# Spec Delta

## MODIFIED Requirements

### Requirement: Organization and administrator access
The system SHALL support one organization containing multiple administrator users. The first setup user SHALL become the organization owner, and only the owner SHALL be able to create administrator invitations. The administration console SHALL require authentication. A successful creation SHALL produce a pending invitation and a shareable acceptance URL. The system SHALL return the URL after saving the invitation without initiating email. The owner SHALL be able to explicitly request email submission for a pending, unexpired invitation. The system SHALL email the same URL to the invited address and report the submission outcome. A failed or unconfirmed attempt SHALL leave the invitation usable. Only the authenticated account whose verified email matches the invited email address SHALL be able to redeem the invitation, within seven days and at most once.

#### Scenario: First-run setup
- **WHEN** no organization exists and a valid setup request is submitted
- **THEN** the system creates the organization and assigns the submitting user the owner role

#### Scenario: Administrator invitation
- **WHEN** the owner creates an invitation
- **THEN** the system returns its acceptance URL as soon as creation succeeds, without an email attempt

#### Scenario: No pending invitations
- **WHEN** the owner opens People & access and the loaded invitation list contains no pending invitations
- **THEN** the page shows “No invitations pending” and retains any accepted or expired invitation history
- **AND** the table is hidden if there are no invitation records

#### Scenario: Optional invitation email
- **WHEN** the owner requests email for a pending, unexpired invitation and the provider accepts the request
- **THEN** the system submits the same acceptance URL to the invited email address and reports the submission

#### Scenario: Email fails or cannot be confirmed
- **WHEN** the owner requests email and the attempt fails or exceeds its deadline
- **THEN** the system indicates that email could not be confirmed, and the invitation and its copy action remain available

#### Scenario: Recipient accepts a shared link
- **WHEN** the recipient opens a manually shared link and accepts it while signed in with the account that currently has the matching verified email before expiration
- **THEN** the recipient becomes an administrator and the invitation is marked accepted

#### Scenario: Invalid redemption
- **WHEN** a different account attempts redemption or the invitation is expired or already accepted
- **THEN** the system rejects the attempt without granting access

#### Scenario: Unauthorized creation
- **WHEN** a signed-in user without the owner role attempts to create an invitation
- **THEN** the system denies the request without creating an invitation or returning a link

#### Scenario: Unauthenticated administration request
- **WHEN** an unauthenticated user requests an administration page or API
- **THEN** the system denies access and does not expose organization data

## ADDED Requirements

### Requirement: Fixed seven-day administrator session

A successful sign-in SHALL create a session that persists across page reloads and browser restarts for up to seven days from login. The server SHALL enforce the deadline on protected operations. The system SHALL renew short-lived provider access credentials while the session remains valid. Renewal and ordinary activity SHALL leave the original deadline intact. Logout SHALL invalidate the application session.

#### Scenario: Access credential expires during a valid session
- **WHEN** a protected operation needs a new provider access credential before the session deadline
- **THEN** the system renews the credential and continues the operation without asking the user to sign in again

#### Scenario: Concurrent requests require renewal
- **WHEN** multiple protected operations need renewal at the same time for one session
- **THEN** they share the renewed credentials and each authorized operation executes once

#### Scenario: Absolute deadline after renewal
- **WHEN** a browser with a session that was refreshed shortly before the seven-day deadline next makes a protected request at or after that deadline
- **THEN** the API returns 401 and the console requires sign-in again

#### Scenario: Logout
- **WHEN** the user signs out of the current browser session
- **THEN** the server invalidates that session and the browser clears its credential and cached administrator data
- **AND** subsequent use of that session is rejected

### Requirement: Contextual authentication and access errors

The API SHALL distinguish missing or invalid sessions, membership and role failures, and temporary service failures. The console SHALL use the distinction when entering a protected route and during protected actions. The public player SHALL continue without administrator authentication.

#### Scenario: Protected route without a session
- **WHEN** a visitor opens a protected route without a session
- **THEN** the console opens sign-in without an error banner and returns to a validated internal destination after successful sign-in

#### Scenario: Session ends during console use
- **WHEN** a protected request finds an expired or definitively invalid session
- **THEN** the console clears the obsolete session state and opens sign-in with a message above the form explaining that the user needs to sign in again
- **AND** it waits for the user to resubmit any interrupted change

#### Scenario: Valid session with insufficient access
- **WHEN** a signed-in user lacks workspace membership, owner permission, or the account required for an invitation
- **THEN** the UI explains the applicable denial in context and offers an appropriate action, such as accepting an invitation or switching accounts
- **AND** the session remains active

#### Scenario: Temporary failure or sign-in form error
- **WHEN** session verification or renewal fails temporarily, or a sign-in form submission fails
- **THEN** the UI shows the applicable retry or form error without entering a redirect loop
- **AND** a temporary failure preserves the current session for retry
