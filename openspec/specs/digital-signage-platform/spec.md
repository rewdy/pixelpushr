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

### Requirement: Media library rename and informed deletion
The media library SHALL let an administrator rename an asset and delete an asset. Before deleting an asset used by saved playlists, the system SHALL identify the affected playlists and item instances and require explicit confirmation. Confirmed deletion SHALL remove those item instances while preserving unrelated playlist items and assignments. If the set of uses changes after confirmation is presented, deletion SHALL stop and require a refreshed confirmation.

#### Scenario: Rename an asset
- **WHEN** an administrator saves a valid new name
- **THEN** the library and playlist views show the new name without changing the asset's identity or playback settings

#### Scenario: Delete unused asset
- **WHEN** an administrator deletes an asset that has no saved playlist uses
- **THEN** the asset disappears from the library and future manifests without changing playlists

#### Scenario: Confirm in-use deletion
- **WHEN** an administrator chooses to delete an asset used by one or more saved playlists
- **THEN** the confirmation identifies the affected playlists and number of item instances and explains that those instances will be removed

#### Scenario: Delete confirmed uses
- **WHEN** an administrator confirms deletion against the current set of uses
- **THEN** those item instances and the asset are removed while the remaining playlist order and display assignments remain intact

#### Scenario: Uses change before deletion
- **WHEN** the asset's saved playlist uses differ from those shown in the confirmation
- **THEN** deletion does not occur and the administrator is asked to review the updated impact

#### Scenario: Recently deleted file handoff
- **WHEN** a player still holds a manifest referencing a recently deleted asset
- **THEN** the old file remains available during a bounded handoff period, after which normal offline-cache limitations apply

### Requirement: Identity-preserving media replacement
The media library SHALL let an administrator replace a ready image with another supported image or a ready video with another supported video. A successful replacement SHALL keep the asset identifier, name, tags, and every saved playlist item's identity, order, and playback settings, while subsequent manifests use the new validated file. Replacement SHALL use the existing media validation limits and SHALL NOT expose an incomplete or failed file as playable content.

#### Scenario: Replace an image used in several playlists
- **WHEN** an administrator completes a valid image replacement
- **THEN** all saved uses still refer to the same asset and subsequent manifests refer to the new image without editing each playlist

#### Scenario: Replace a video
- **WHEN** an administrator completes a valid video replacement
- **THEN** the same playlist video modes and durations remain and the new video becomes playable; a missing still-frame thumbnail does not make it unready

#### Scenario: Wrong media kind or invalid candidate
- **WHEN** the selected file has a different media kind or fails upload or validation
- **THEN** the replacement is rejected or reported failed and the original asset remains ready and playable

#### Scenario: Existing player adopts replacement
- **WHEN** a player receives a manifest after a successful replacement
- **THEN** it adopts the changed normal content according to existing queue-boundary rules, without treating replacement as an override transition

#### Scenario: Older manifest during replacement handoff
- **WHEN** a player has not yet adopted a manifest containing the replacement
- **THEN** the previous file remains available during a bounded handoff period, after which normal offline-cache limitations apply

#### Scenario: Reuse replacement upload URL after publication
- **WHEN** a previously issued staging upload URL is used again after a replacement has completed
- **THEN** the published file and its player URL remain unchanged

### Requirement: Media tags and filtering
The system SHALL let administrators assign and remove reusable, case-insensitive tags on media assets. Tags SHALL remain attached to an asset when it is renamed or successfully replaced. The Media library and playlist media picker SHALL let administrators filter assets by one or more tags without modifying playlists or playback. Tag filtering SHALL include an asset matching any selected tag and SHALL combine with text search by requiring both filters to match.

#### Scenario: Assign and reuse tags
- **WHEN** an administrator adds a tag to an asset and later selects the same label with different letter case
- **THEN** the library treats it as one reusable tag and shows it on that asset

#### Scenario: Filter library and picker
- **WHEN** an administrator selects one or more tags in the Media library or playlist media picker
- **THEN** the view shows assets matching any selected tag, further narrowed by any entered text search

#### Scenario: Remove a tag
- **WHEN** an administrator removes a tag from an asset
- **THEN** that asset no longer matches the tag filter, while its playlist uses and playback are unchanged

### Requirement: Media library edit drawer
The media library SHALL make an asset title and its Edit row action open a side drawer over the library. The drawer SHALL let an administrator rename the asset, edit its tags, and start a same-kind replacement for a ready asset using the existing validation and identity-preservation rules. The row SHALL retain a separate Delete action with the existing impact confirmation.

#### Scenario: Open media editing from its title
- **WHEN** an administrator activates a media title or Edit action
- **THEN** the same asset's edit drawer opens without leaving the library

#### Scenario: Edit asset metadata
- **WHEN** an administrator saves a valid new name or tag set in the drawer
- **THEN** the library and existing playlist views reflect the change while the asset identity and playback settings remain unchanged

#### Scenario: Replace from the drawer
- **WHEN** an administrator replaces a ready asset from its edit drawer
- **THEN** only a valid same-kind file becomes playable and the existing asset and playlist item identities remain intact

#### Scenario: Delete from the row
- **WHEN** an administrator activates the row's Delete action
- **THEN** the existing single-asset impact review appears before any in-use deletion

### Requirement: Media library selection and bulk tagging
The media library SHALL offer a checkbox for each listed asset, a Select all action for the currently visible listing, and a bulk Add tags action. Selection SHALL clear when the search, tag filter, or listing page changes. Bulk Add tags SHALL add the chosen tags to every selected asset without removing existing tags; if any selected asset or tag input is invalid, no selected asset SHALL be changed.

#### Scenario: Select visible assets
- **WHEN** an administrator selects all while a filtered or paged media listing is shown
- **THEN** only the currently visible assets are selected and the bulk actions reflect that count

#### Scenario: Change listing context
- **WHEN** an administrator changes the media search, tag filter, or listing page
- **THEN** the previous selection is cleared

#### Scenario: Add tags to mixed existing tags
- **WHEN** an administrator bulk-adds valid tags to selected assets with different existing tags
- **THEN** each selected asset retains its existing tags and gains the new tags once, with case-insensitive tag reuse

#### Scenario: Reject invalid bulk tagging
- **WHEN** a bulk tag request includes an inaccessible asset or would violate tag limits
- **THEN** none of the selected assets' tags change and an error is shown

### Requirement: Combined informed media deletion
The media library SHALL provide one impact review for a selected set of assets before bulk deletion. The review SHALL identify all selected assets and summarize every affected saved playlist and item count. A confirmation SHALL delete the selected assets and their saved playlist item instances as one atomic operation, preserving unrelated items and assignments. If selected assets or their saved uses differ from the reviewed snapshot, deletion SHALL stop without deleting any asset and require a refreshed review. Existing seven-day object handoff SHALL apply to every deleted file.

#### Scenario: Review a mixed selection
- **WHEN** an administrator chooses bulk Delete for used and unused media
- **THEN** one confirmation identifies all selected assets, affected playlists, item counts, and the deletion consequence

#### Scenario: Confirm unchanged impact
- **WHEN** an administrator confirms a current impact snapshot
- **THEN** all selected assets and their saved playlist item instances are deleted together, with unrelated playlist order and display assignments preserved

#### Scenario: Impact changes after review
- **WHEN** a selected asset or its saved playlist uses changes before confirmation
- **THEN** no selected asset is deleted and the administrator must review the updated impact

#### Scenario: Old player manifest after bulk deletion
- **WHEN** a player still holds a manifest referencing a bulk-deleted file
- **THEN** that file remains available during the existing bounded handoff period

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

### Requirement: General recurring display assignments
The system SHALL let an administrator configure an Append or Override assignment as one-time, every N days, every N weeks on one or more selected weekdays, or every N months on a numbered day or ordinal weekday (such as the second Tuesday or last Friday). A repeating rule SHALL have an explicit first local start and end, a positive interval, and MAY have a last occurrence date that includes starts on that local date. Each occurrence SHALL retain the first window's local wall-clock start and end span across daylight-saving changes and follow the existing organization-timezone-change behavior. Monthly numbered-day occurrences that do not exist in a month SHALL be skipped rather than moved to another date. Administrators SHALL be able to inspect and edit these settings without replacing the assignment.

#### Scenario: Daily recurrence
- **WHEN** an administrator schedules a window every two days
- **THEN** the assignment is active on the corresponding calendar days at the configured local times, starting no earlier than its first start

#### Scenario: Selected weekdays
- **WHEN** an administrator selects Monday and Thursday for a weekly rule with a two-week interval
- **THEN** those days in each eligible two-week cycle receive occurrences and other days do not

#### Scenario: Monthly numbered day
- **WHEN** a rule repeats monthly on the 31st
- **THEN** months without a 31st have no occurrence, and a later valid month still uses the 31st

#### Scenario: Monthly ordinal weekday
- **WHEN** a rule repeats on the last Friday of every month
- **THEN** each month's occurrence starts on that month's last Friday at the configured local time

#### Scenario: Optional end date
- **WHEN** a rule has a last occurrence date
- **THEN** starts on that local date may occur but no later starts occur; an occurrence that started by that date may finish afterward

#### Scenario: Existing weekly rotation
- **WHEN** an existing every-N-weeks Append assignment is evaluated after the model change
- **THEN** it has the same occurrence dates, window length, ordering, and normal-queue rollover behavior as before

#### Scenario: Edit a repeating assignment
- **WHEN** an administrator changes a saved assignment's recurrence pattern, interval, weekdays, monthly selection, first window, or last occurrence date
- **THEN** future occurrences follow the edited rule without changing its playlist, mode, identity, or queue position

#### Scenario: Overlapping occurrences of one assignment
- **WHEN** two occurrences of the same assignment overlap
- **THEN** an active Append assignment contributes its playlist only once to the normal queue, and an active Override remains continuous until no occurrence remains active or another Override wins

#### Scenario: Invalid recurrence
- **WHEN** a repeating rule has an invalid interval, missing dates, empty weekly weekday selection, invalid monthly selection, or end date before the first occurrence
- **THEN** it is not saved and the administrator sees an actionable validation error

### Requirement: Preserve untouched assignment settings during edits
When an administrator edits an existing Append or Override assignment, the system SHALL preserve the exact stored start and end instants and recurrence settings for fields the administrator did not change. Changed wall-clock times SHALL use the assignment's saved timezone. A settings edit SHALL retain the assignment's identity, playlist, mode, and queue position; the existing validation and stale-edit protections SHALL continue to apply.

#### Scenario: Priority-only edit preserves an immediate start
- **WHEN** an administrator changes only the priority of a one-time **Activate now** Override whose stored start has seconds
- **THEN** its priority changes, its exact start and end instants remain unchanged, and subsequent manifests use the new priority without moving either boundary

#### Scenario: Recurrence edit preserves ambiguous instants
- **WHEN** an administrator changes only the recurrence settings of an Append or Override assignment whose saved start or end falls in a daylight-saving overlap
- **THEN** the unchanged boundary retains its original instant and timezone rather than being reinterpreted from the displayed minute

#### Scenario: Edit a scheduled Append assignment
- **WHEN** an administrator changes a saved Append assignment's interval, selected days, or other recurrence settings without changing its dates
- **THEN** future occurrences follow the edited rule while the saved start and end instants, playlist, mode, identity, and queue position remain unchanged

#### Scenario: Explicitly change a boundary
- **WHEN** an administrator changes a start or end in the saved timezone and saves valid settings
- **THEN** the changed boundary is applied according to existing schedule validation while the untouched boundary keeps its original instant

#### Scenario: Leave an edit unchanged
- **WHEN** an administrator opens and closes the settings form without making changes
- **THEN** no assignment or schedule write occurs

### Requirement: Refresh administrator previews after assignment edits
After a successful settings edit, the display's assignment summary and schedule preview SHALL refresh, and the Overview simulation SHALL show the updated manifest when the administrator returns to it without waiting for its normal polling interval. This administrator preview refresh SHALL NOT force a public player reload or change existing Append rollover or exact-time Override behavior.

#### Scenario: Inspect an edited Override
- **WHEN** an administrator saves a priority or window change and returns to Overview
- **THEN** that display's simulation fetches the updated manifest and reflects the resolved winning content without waiting for its next scheduled poll

#### Scenario: Inspect an edited Append rule
- **WHEN** an administrator saves a valid Append recurrence change and views the display's schedule preview
- **THEN** the preview reflects the edited occurrences without requiring a manual reload

### Requirement: Recurring Override playback
Each active recurring Override occurrence SHALL use the existing highest-priority, exact-time Override behavior. A one-time **Activate now** Override SHALL remain available and SHALL NOT implicitly repeat; repeating Overrides SHALL require an explicit first start and end. One-time Overrides already saved SHALL retain their absolute boundaries.

#### Scenario: Repeated event countdown
- **WHEN** a five-minute Override countdown occurs at a scheduled daily, weekly, or monthly start
- **THEN** it alone displaces the normal queue at its exact start and the player cuts back at its exact end

#### Scenario: Competing Override occurrences
- **WHEN** recurring and one-time Overrides overlap
- **THEN** only the highest-priority active Override is presented, with the existing deterministic tie-break and exact-time winner changes

#### Scenario: Activate now is one-time
- **WHEN** an administrator selects both **Activate now** and a repeating pattern
- **THEN** saving is rejected with a clear explanation; a valid one-time **Activate now** still works as before

### Requirement: Bounded recurring Override transitions
The system SHALL resolve recurring Override rules into absolute, unambiguous windows for any currently active occurrence and a bounded near-future period. The public player SHALL use those windows and server time for exact-time start, end, and winner changes without evaluating recurrence rules. The player SHALL honor the end of a known active occurrence during a temporary outage; a cached manifest SHALL NOT be treated as an unlimited calendar of future occurrences.

#### Scenario: Active occurrence at manifest fetch
- **WHEN** a manifest is fetched during a recurring Override occurrence
- **THEN** the manifest includes that occurrence's absolute end and the player exits it at that time, including if connectivity is lost afterward

#### Scenario: Upcoming occurrence
- **WHEN** a recurring Override occurrence falls within the manifest's lookahead period
- **THEN** the manifest carries its absolute start and end and the player cuts at those boundaries using its server-clock estimate

#### Scenario: Refresh before a later occurrence
- **WHEN** a later recurring occurrence was outside an earlier manifest's bounded lookahead and the player remains online
- **THEN** a subsequent manifest refresh supplies its boundaries before it starts

### Requirement: Unified display playlist assignment
The display management view SHALL provide one Add playlist flow in which an administrator chooses a playlist, selects always-on or scheduled timing, and, for scheduled timing, chooses additive or override behavior. The flow SHALL show only fields relevant to the chosen mode and SHALL save the assignment according to the existing queue, recurrence, override priority, and expiration rules. Administrators SHALL be able to inspect and remove all modes of assignment from the display view.

#### Scenario: Always-on assignment
- **WHEN** an administrator adds a playlist as always-on
- **THEN** it joins the display's normal queue after the existing always-on playlists without requiring schedule fields

#### Scenario: Scheduled additive assignment
- **WHEN** an administrator chooses scheduled timing and Append behavior
- **THEN** the form collects its time window and recurrence and saves an additive schedule

#### Scenario: Scheduled override assignment
- **WHEN** an administrator chooses scheduled timing and Override behavior
- **THEN** the form collects an explicit expiration and relevant start or activate-now and priority fields, and saves an override that displaces normal playback while active

#### Scenario: Invalid mode or window
- **WHEN** the selected assignment mode lacks a required time or has an invalid window
- **THEN** the form identifies the problem and does not create an assignment

#### Scenario: Manage existing assignments
- **WHEN** an administrator views a display with always-on, scheduled additive, and override assignments
- **THEN** each assignment's mode and timing are visible and it can be removed from that display

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

### Requirement: Overview display simulations
The Overview page SHALL show a locally simulated playback preview for each registered display using the display's currently resolved queue. Each preview SHALL be labeled as a simulation and SHALL NOT claim to mirror the physical player's exact item or playback position. Preview activity SHALL NOT update the display's heartbeat or device health.

#### Scenario: Preview configured display
- **WHEN** an administrator opens Overview while displays have playable assignments
- **THEN** each display card shows a simulated loop of its currently effective content and a link to manage that display

#### Scenario: Preview active override
- **WHEN** an override becomes active or expires while Overview remains open
- **THEN** the corresponding simulation switches between override and normal content according to the resolved manifest

#### Scenario: Empty or unavailable display
- **WHEN** a display has no playable items or its manifest cannot be loaded
- **THEN** its card shows a clear empty or unavailable state without implying that the device is online

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

### Requirement: Responsive playlist media picker
The playlist editor's ready-media picker SHALL fit its available width without horizontal scrolling while retaining the asset thumbnail, readable name, kind, and Add action. An asset name that cannot fit SHALL be visually truncated, and its full name SHALL remain available as a native tooltip and accessible text.

#### Scenario: Long unbroken media name
- **WHEN** a ready asset has a long name without spaces and the picker is narrow
- **THEN** the picker has no horizontal scrollbar, the name is ellipsized, its full value is available on hover, and the Add action remains visible and usable

#### Scenario: Desktop and narrow layouts
- **WHEN** the picker appears beside the playlist draft on desktop or in the narrow-screen drawer
- **THEN** its media rows remain inside the available width without forcing the page or picker to scroll sideways

### Requirement: Minimal compact-preview progress dial
The compact playback preview SHALL continue showing visual progress toward the next item in both playlist draft previews and Overview simulations, using a small dial without visible percentage text. The absence of a known duration SHALL NOT display a misleading numeric percentage.

#### Scenario: Timed slide progress
- **WHEN** an image or repeat-for-duration video advances in a compact preview
- **THEN** its small dial updates as time elapses without showing percentage text and playback advances on the existing schedule

#### Scenario: Play-once video with unknown remaining time
- **WHEN** a compact preview cannot determine a play-once video's remaining duration
- **THEN** the dial does not show a fabricated percentage and the video still advances when it ends

### Requirement: Direct return from detail pages
Playlist and display detail pages SHALL each provide a consistently placed, keyboard-accessible link back to their respective listing. The destination SHALL be stable even when the detail page was opened directly or from another page.

#### Scenario: Return from playlist editor
- **WHEN** an administrator activates the Back to Playlists link on a playlist detail page
- **THEN** the Playlists listing opens

#### Scenario: Return from display details
- **WHEN** an administrator activates the Back to Displays link on a display detail page
- **THEN** the Displays listing opens

### Requirement: Route-specific browser titles
Every routable administration, authentication, public player, and not-found view SHALL set a meaningful browser title with a consistent application suffix. Titles SHALL update when client-side navigation changes the route; a playlist or display detail title SHALL use its loaded name when available and a generic route title while loading or unavailable.

#### Scenario: Navigate between console pages
- **WHEN** an administrator navigates between Overview, Media, Playlists, Displays, People, and Settings without a full reload
- **THEN** the browser title reflects the current page rather than retaining the previous title

#### Scenario: Load a detail record
- **WHEN** a playlist or display detail page loads or refetches its record
- **THEN** the browser title reflects the current name and does not leave a stale detail title on another route

#### Scenario: Public, auth, and unknown routes
- **WHEN** the user opens a player, sign-in, registration, confirmation, setup, invitation, or unknown route
- **THEN** the browser title identifies that view without exposing a player token or invitation token
