# Spec Delta

## ADDED Requirements

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
