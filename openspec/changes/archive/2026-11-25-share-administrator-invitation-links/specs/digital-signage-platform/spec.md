# Spec Delta

## MODIFIED Requirements

### Requirement: Organization and administrator access
The system SHALL support one organization containing multiple administrator users. The first setup user SHALL become the organization owner, and only the owner SHALL be able to create administrator invitations. The administration console SHALL require authentication. A successful creation SHALL produce a pending invitation and a shareable acceptance URL. The system SHALL return the URL after saving the invitation without initiating email. The owner SHALL be able to explicitly request email submission for a pending, unexpired invitation. The system SHALL email the same URL to the invited address and report the submission outcome. A failed or unconfirmed attempt SHALL leave the invitation usable. Only the authenticated account matching the invited email address SHALL be able to redeem the invitation, within seven days and at most once.

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
- **WHEN** the recipient opens a manually shared link and accepts it while signed in with the matching account before expiration
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

### Requirement: Modal creation actions
The Playlists and Displays listings and the owner-only invitation area SHALL present one primary create action instead of an inline input. Activating it SHALL open a modal with the required field, Cancel, and submit. Cancel SHALL leave data unchanged. An invalid submission or failure to create the record SHALL keep the modal open and explain the error.

#### Scenario: Create playlist
- **WHEN** an administrator opens Create playlist, enters a valid name, and submits
- **THEN** the playlist is created and its editor opens

#### Scenario: Create display
- **WHEN** an administrator opens Create display, enters a valid name, and submits
- **THEN** the display is created and appears in the listing

#### Scenario: Send invitation
- **WHEN** the owner submits the invitation modal and the invitation is created
- **THEN** the modal closes and People & access shows the invitation URL, Copy link, and an optional Send email action
- **AND** the link is available while the email request is pending and after it completes

#### Scenario: Cancel or failed submission
- **WHEN** an administrator cancels a creation modal or receives a validation or server error on submit
- **THEN** cancellation makes no change, while an error is shown without losing the entered value

## ADDED Requirements

### Requirement: Revoke pending administrator invitations
The workspace owner SHALL be able to revoke a pending, unexpired invitation after confirming the recipient on People & access. Revocation SHALL invalidate the original URL and permit a fresh invitation for the same email address. Only the owner SHALL be able to revoke a workspace invitation. Accepted and expired invitations SHALL be ineligible for revocation.

#### Scenario: Replace a lost invitation link
- **WHEN** the owner confirms revocation of a pending invitation
- **THEN** the invitation is removed from People & access and its URL can no longer be redeemed or emailed
- **AND** an invitation created for the same address receives a new URL

#### Scenario: Cancel revocation
- **WHEN** the owner cancels the confirmation
- **THEN** the invitation stays pending and its URL remains valid

#### Scenario: Revocation is unauthorized or no longer available
- **WHEN** a non-owner requests revocation or the invitation is no longer active and pending
- **THEN** the system rejects revocation
