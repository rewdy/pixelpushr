# digital-signage-platform Specification

## Purpose

Provides a browser-based digital signage platform for managing media, playlists, displays, schedules, and timed overrides from a single administrator-controlled organization.

## Requirements

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

### Requirement: Batch media intake
The media library SHALL accept multiple image and video files from one file selection or one drop onto the media library page. It SHALL show the status and failure reason for each file independently. A failure or rejection of one file SHALL NOT prevent other supported files in the same batch from becoming ready. Existing per-file format, size, and readiness rules SHALL apply to every file.

#### Scenario: Select several files
- **WHEN** an administrator selects multiple supported files through the upload control
- **THEN** each file enters an upload queue and can reach a ready state independently

#### Scenario: Drop files on the media library
- **WHEN** an administrator drops multiple files onto the media library page
- **THEN** the same upload queue accepts them and displays each file's progress state

#### Scenario: Mixed success and failure
- **WHEN** one file in a batch fails validation or upload while another succeeds
- **THEN** the failed file shows its reason and the successful file remains available in the library

#### Scenario: Non-file drag or drop
- **WHEN** a drag or drop contains no files
- **THEN** the media library does not begin an upload or replace existing content

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

### Requirement: Player item crossfade
The public player SHALL crossfade over 500 milliseconds between consecutive playable items in a stable normal or override queue, including when that queue loops. The overlap SHALL fit within the outgoing item's configured playback duration or, for a play-once video, its remaining playback time when known; it SHALL NOT add 500 milliseconds to every item. Override activation, expiration, and winner changes SHALL cut immediately at their effective times without a crossfade. The transition SHALL leave no prior item visibly displayed after it completes.

#### Scenario: Image or repeating video advances
- **WHEN** an image or repeat-for-duration video approaches the end of its configured duration and another playable item follows
- **THEN** the player overlaps the outgoing and incoming items for up to 500 milliseconds and completes the transition by the configured item boundary

#### Scenario: Play-once video finishes
- **WHEN** a play-once video with known remaining time approaches its end
- **THEN** the player fades to the next item during its final 500 milliseconds and advances no later than video completion

#### Scenario: Queue loops or normal update arrives
- **WHEN** playback reaches the end of a stable queue or a pending normal queue update is adopted at rollover
- **THEN** the transition to the next item uses the same crossfade without changing the rule that normal updates wait for a queue boundary

#### Scenario: Exact-time override transition
- **WHEN** an override starts, expires, or a different override wins while a crossfade is in progress
- **THEN** the player immediately cancels the fade and shows only the newly effective queue at the scheduled server-adjusted time

#### Scenario: No next playable item
- **WHEN** the effective queue is empty or the next item cannot be loaded
- **THEN** the player does not leave a stale or blank crossfade layer over otherwise playable content

### Requirement: Display timezone and transition time
The system SHALL evaluate schedules using an organization timezone by default and SHALL represent manifest transition timestamps in an unambiguous form. The player SHALL account for the server's reported time when scheduling exact-time transitions.

#### Scenario: Timezone-aware schedule
- **WHEN** an administrator configures a schedule in the organization's timezone
- **THEN** the system activates and expires it according to that timezone's local date and time

#### Scenario: Client clock drift
- **WHEN** the player's local clock differs from the server clock
- **THEN** the player uses the manifest's server time to reduce transition timing error

### Requirement: Discoverable organization timezone selection
The system SHALL let an administrator choose the organization's IANA timezone from a searchable list during first-run setup and view or change that selection in workspace settings according to existing permissions. The selector SHALL display each zone's identifier and current UTC offset, identify that the offset can change with daylight saving time, and preserve the selected timezone identifier when saved. Schedule evaluation SHALL continue to use the saved IANA timezone.

#### Scenario: Select timezone during setup
- **WHEN** the first owner searches for and selects a timezone while creating the workspace
- **THEN** the selector shows its identifier and current UTC offset and setup saves that identifier

#### Scenario: Change timezone in settings
- **WHEN** the owner selects and saves a different timezone in workspace settings
- **THEN** the saved IANA identifier changes and subsequent schedule evaluation uses it

#### Scenario: Existing timezone remains selectable
- **WHEN** workspace settings opens with a previously saved valid timezone
- **THEN** that timezone remains selected and recognizable even if the browser's common-zone list uses a different alias

#### Scenario: Read-only administrator settings
- **WHEN** an administrator who is not the owner views workspace settings
- **THEN** the timezone and its current offset are visible but cannot be changed

### Requirement: Video media thumbnails
The system SHALL make a persistent still-frame thumbnail available for a newly uploaded video when a frame can be extracted. Media and playlist views SHALL display an image thumbnail or video still frame when available and SHALL show a recognizable fallback when a video thumbnail is unavailable. Thumbnail failure SHALL NOT prevent an otherwise valid video from becoming ready for playback.

#### Scenario: Uploaded video with an extractable frame
- **WHEN** an administrator uploads a supported video whose frame can be extracted
- **THEN** the media library and playlist editor display its still-frame thumbnail

#### Scenario: Video without a thumbnail
- **WHEN** a video has no usable still-frame thumbnail, including a video uploaded before this change
- **THEN** the media library and playlist editor show a video fallback while the video remains usable in playlists

### Requirement: Visual playlist editing
The system SHALL let an administrator browse ready media as visual tiles alongside the playlist editor, append an asset to the draft from its tile, and see a thumbnail or fallback for every draft item. The editor SHALL support selecting multiple draft items, clearing the selection without changing the draft, deleting the selection, and applying one duration to selected images and repeat-for-duration videos while leaving selected play-once videos unchanged. These edits SHALL affect published playback only after the administrator saves the playlist.

#### Scenario: Add media from visual picker
- **WHEN** an administrator opens the media panel and adds a ready asset
- **THEN** a new item appears at the end of the unsaved playlist draft with an appropriate initial playback setting

#### Scenario: Bulk duration for mixed items
- **WHEN** an administrator applies a duration to a selection containing images, repeating videos, and play-once videos
- **THEN** the images and repeating videos receive that duration, the play-once videos remain unchanged, and the editor reports the number of updated items

#### Scenario: Bulk delete
- **WHEN** an administrator deletes selected draft items
- **THEN** only those item instances are removed from the draft and the remaining items keep their relative order

#### Scenario: Deselect all
- **WHEN** an administrator clears the current selection
- **THEN** all item checkboxes become unselected and the draft items and their playback settings remain unchanged

#### Scenario: Unsaved edits do not publish
- **WHEN** an administrator changes the playlist draft without saving
- **THEN** the stored playlist and display playback remain unchanged

#### Scenario: Save edited playlist
- **WHEN** an administrator saves the edited draft
- **THEN** the stored playlist reflects the draft item order and playback settings

### Requirement: Draft playlist playback preview
The playlist editor SHALL offer a toggleable, compact playback preview of the current unsaved draft. The preview SHALL play images for their draft durations, play videos once or repeat them for their draft durations, loop the draft, and show progress toward the next item. Preview playback SHALL NOT publish draft changes or control a display player.

#### Scenario: Preview unsaved changes
- **WHEN** an administrator opens the preview or edits the draft while it is open
- **THEN** the preview reflects the current unsaved item order and playback settings without requiring Save

#### Scenario: Preview video behavior
- **WHEN** the draft contains a video configured to play once or repeat for a duration
- **THEN** the preview plays the video using that mode and advances according to the corresponding completion or duration rule

#### Scenario: Preview progress and empty draft
- **WHEN** a draft item is playing
- **THEN** the preview shows progress toward its next transition; an empty draft shows a clear empty state

#### Scenario: Close and reopen preview
- **WHEN** an administrator closes the preview and later opens it again
- **THEN** preview playback restarts from the first current draft item
