# Proposal

## Why

The media library can upload and display assets, but administrators cannot manage names, tags, or replacements from the console. Updating a dated image currently means uploading a new asset and manually changing every playlist that uses the old one.

## What Changes

- Expose rename and delete actions in the Media library. Deleting an asset used by playlists requires an explicit confirmation that shows which playlists and items will lose it; confirmed deletion removes those uses.
- Add same-kind replacement (image for image, video for video) that keeps the asset identity, playlist references, item order, timing, name, and tags. Publish the new file only after it passes the existing upload checks; a failed replacement leaves the old file playable.
- Let administrators assign reusable tags to assets and filter by tags in both the Media library and playlist media picker.
- Keep normal manifest refresh and queue-boundary behavior for published replacements and deletions; no new real-time push mechanism is introduced.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `digital-signage-platform`: Add safe library management, identity-preserving media replacement, and tag-based organization/filtering.

## Impact

- Media and playlist picker UI, media APIs and upload helper, PostgreSQL schema/migration, object-storage cleanup, and player manifest behavior.
- Existing rename and delete API routes provide a starting point; delete currently rejects in-use assets, and replacement and tags need new persistence and API behavior.
- Requires unit, integration, and browser coverage for in-use deletion, replacement success/failure, filtering, and resulting playback manifests.
