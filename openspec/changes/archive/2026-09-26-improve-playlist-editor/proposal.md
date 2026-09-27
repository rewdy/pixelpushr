# Proposal

## Why

The first-pass playlist editor makes administrators identify media by name and edit items one at a time. A visual picker, bulk actions, and an immediate playback preview will make larger playlists easier to assemble and verify before saving.

## What Changes

- Replace the editor's asset dropdown with a right-side media panel showing ready assets as visual tiles; adding an asset appends a new playlist item.
- Show a thumbnail or video still frame beside each playlist item. Generate a persistent still-frame thumbnail for newly uploaded videos, with a fallback for videos that have no thumbnail.
- Add item selection, bulk duration editing for images and repeating videos, and bulk deletion. Play-once videos retain their playback mode when bulk duration is applied.
- Add a toggleable, approximately 300–400 px wide preview that plays the unsaved playlist draft in order, including real video playback and a countdown ring. Build the playback preview for reuse in a later display view.
- Preserve the current save boundary: draft edits and bulk actions affect the published playlist only after Save.
- Defer drag reordering and video playback inside asset tiles; retain the existing move-up/move-down controls.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `digital-signage-platform`: Extend media asset behavior with video thumbnails and playlist behavior with visual selection, bulk editing, and draft playback preview.

## Impact

- Admin web playlist editor, media presentation, and reusable preview components.
- Media upload metadata/storage for video still frames; existing player manifests and display playback semantics remain unchanged.
- Tests for video thumbnail availability and fallback, bulk actions, unsaved preview, and save behavior.
