# Spec Delta

## Purpose

Provides a browser-based digital signage platform for managing media, playlists, displays, schedules, and timed overrides from a single administrator-controlled organization.

## ADDED Requirements

### Requirement: Organization and administrator access
The system SHALL support one organization containing multiple administrator users. The first setup user SHALL become the organization owner, and the owner SHALL be able to invite additional administrators. The administration console SHALL require authentication.

#### Scenario: First-run setup
- **WHEN** no organization exists and a valid setup request is submitted
- **THEN** the system creates the organization and assigns the submitting user the owner role

#### Scenario: Administrator invitation
- **WHEN** the owner sends an invitation to an email address
- **THEN** the system creates a pending invitation and allows the recipient to accept it and become an administrator

#### Scenario: Unauthenticated administration request
- **WHEN** an unauthenticated user requests an administration page or API
- **THEN** the system denies access and does not expose organization data

### Requirement: Media assets
The system SHALL allow administrators to upload, name, inspect, and remove image and video assets. An asset SHALL expose its processing state and SHALL be eligible for playlist use only when ready for playback. Images SHALL support an administrator-configured display duration. Videos SHALL support play-once playback and repeated playback for a configured duration.

#### Scenario: Ready media upload
- **WHEN** an administrator uploads a supported image or video
- **THEN** the system stores the asset, reports its processing status, and makes it available to playlists after it is ready

#### Scenario: Unsupported or failed asset
- **WHEN** an upload cannot be processed for playback
- **THEN** the system marks the asset as failed and prevents it from being published in a playback manifest

### Requirement: Playlists
The system SHALL allow administrators to create ordered playlists containing ready media assets. A playlist item SHALL preserve its position and playback configuration. The system SHALL support one or more playlists being associated with a display.

#### Scenario: Ordered playlist playback
- **WHEN** a display receives a playlist with multiple items
- **THEN** the player presents items in the configured order and loops the playlist continuously

#### Scenario: Image duration
- **WHEN** an image item reaches playback
- **THEN** the player displays it for its configured duration before advancing

#### Scenario: Video play-once
- **WHEN** a video item configured to play once reaches playback
- **THEN** the player advances after the video finishes

#### Scenario: Video repeat-for-duration
- **WHEN** a video item configured to repeat for a duration reaches playback
- **THEN** the player repeats the video until the configured duration expires and then advances

### Requirement: Display registration and public player
The system SHALL allow administrators to register named displays and obtain a public player URL for each display. The player URL SHALL require no administrator login. The player SHALL retrieve only the manifest associated with its display identifier. Possession of the public player URL SHALL be treated as sufficient viewing access for the MVP.

#### Scenario: Public player startup
- **WHEN** a browser opens a valid display player URL
- **THEN** the player loads the display's current manifest and begins playback without an administrator login

#### Scenario: Unknown player URL
- **WHEN** a browser requests a player URL that does not identify a registered display
- **THEN** the player reports that the display is unavailable and does not expose administrative functionality

#### Scenario: Display heartbeat
- **WHEN** a player is running and can reach the service
- **THEN** it reports its last-seen time and basic playback health for administrators to inspect

### Requirement: Always-active playlist queue
The system SHALL allow administrators to assign one or more playlists to a display as always-active playlists. The effective normal queue SHALL contain the ordered items from all assigned always-active playlists and all currently active additive scheduled playlists.

#### Scenario: Multiple always-active playlists
- **WHEN** a display has multiple always-active playlists
- **THEN** the manifest contains all of their items in configured playlist order, preserving item order within each playlist

#### Scenario: Reassignment
- **WHEN** an administrator adds, removes, or reorders an always-active playlist assignment
- **THEN** a subsequent manifest reflects the new effective normal queue

### Requirement: Additive scheduled playlists
The system SHALL allow administrators to schedule playlists for display-specific time windows. An active additive scheduled playlist SHALL be added to the normal queue without removing always-active playlists or other active additive scheduled playlists. The system SHALL support multiple simultaneously active scheduled playlists and deterministic ordering.

#### Scenario: Weekly playlist rotation
- **WHEN** different playlists are scheduled for consecutive weekly windows
- **THEN** each week's effective queue contains the always-active playlists plus the playlist scheduled for that week

#### Scenario: Overlapping additive schedules
- **WHEN** multiple additive schedules are active for the same display
- **THEN** the effective queue contains all active scheduled playlists in their configured order

#### Scenario: Schedule boundary
- **WHEN** an additive schedule becomes active or expires
- **THEN** the player adopts the changed normal queue at a playback boundary rather than interrupting the current item

### Requirement: Exact-time override playlists
The system SHALL allow an administrator to schedule an override playlist with an explicit start and end time. While an override is active, the effective queue SHALL contain only the highest-priority active override playlist and SHALL exclude all always-active and additive scheduled playlists. Override activation and expiration SHALL interrupt playback immediately at their effective times.

#### Scenario: Override activation
- **WHEN** an override's start time is reached
- **THEN** the player cuts to the override playlist immediately and stops presenting the normal queue

#### Scenario: Override expiration
- **WHEN** an override's end time is reached
- **THEN** the player cuts back immediately to the latest valid normal queue

#### Scenario: Countdown override
- **WHEN** a countdown override is configured to start five minutes before an event and end at the event start
- **THEN** only the countdown playlist plays during that five-minute interval

#### Scenario: Multiple active overrides
- **WHEN** more than one override is active for a display
- **THEN** the override with the highest configured priority is played and the others are suppressed

#### Scenario: Immediate manual override
- **WHEN** an administrator saves an override assignment whose start time is now
- **THEN** the next manifest received by the player activates the override immediately and the configured end time remains authoritative

### Requirement: Manifest refresh and resilient playback
The system SHALL publish a resolved display manifest containing the effective queue, media URLs, playback settings, server time, and scheduled transition times. The player SHALL poll for manifest changes, cache the last valid manifest and playable media, and continue playback during temporary service or network failures. The player SHALL honor known override end times even if a refresh fails.

#### Scenario: Normal manifest update
- **WHEN** the player discovers a changed normal manifest
- **THEN** it preserves the current item and applies the new normal queue at a queue boundary

#### Scenario: Override manifest update
- **WHEN** the player receives a manifest containing an active override
- **THEN** it interrupts the current item and switches to the override

#### Scenario: Temporary outage
- **WHEN** the service becomes unreachable after the player has received a valid manifest
- **THEN** the player continues using cached playable content and reports or displays an offline state when possible

#### Scenario: Known override expiration while offline
- **WHEN** the player loses connectivity during an override whose end time is known
- **THEN** the player exits the override at that end time and resumes the cached normal queue

### Requirement: Display timezone and transition time
The system SHALL evaluate schedules using an organization timezone by default and SHALL represent manifest transition timestamps in an unambiguous form. The player SHALL account for the server's reported time when scheduling exact-time transitions.

#### Scenario: Timezone-aware schedule
- **WHEN** an administrator configures a schedule in the organization's timezone
- **THEN** the system activates and expires it according to that timezone's local date and time

#### Scenario: Client clock drift
- **WHEN** the player's local clock differs from the server clock
- **THEN** the player uses the manifest's server time to reduce transition timing error
