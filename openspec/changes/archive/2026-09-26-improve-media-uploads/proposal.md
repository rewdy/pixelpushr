# Proposal

## Why

The media library currently accepts one file at a time and provides only a file picker. Loading a campaign with many images or videos takes repeated manual actions and gives little feedback while uploads are in progress.

## What Changes

- Accept multiple files from the upload button and by dropping files onto the media library page.
- Show each file's queued, uploading, ready, or failed state with its own failure message.
- Keep successful files available even when another file in the batch fails.
- Maintain existing supported formats, per-file size limits, and media validation.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `digital-signage-platform`: Add batch selection and drag-and-drop intake with independent per-file results to media management.

## Impact

- Media library UI and upload orchestration; existing per-file API endpoints can remain in place.
- Browser coverage for mixed outcomes and drag-and-drop; no database migration is expected.
