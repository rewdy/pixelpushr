# Spec Delta

## ADDED Requirements

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
