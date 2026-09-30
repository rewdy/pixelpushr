# Proposal

## Why

The media library spreads rename, tags, and replacement across separate row actions and dialogs, making routine edits hard to scan. The library also lacks a safe way to tag or delete several assets together while preserving the existing informed-deletion protection.

## What Changes

- Make each media title and its Edit row action open one side drawer over the library with rename and tag fields plus a Replace action for ready assets. Keep the row's Delete action available.
- Add a checkbox per media row, Select all for the visible listing, and bulk Add tags and Delete actions. Bulk tagging adds to existing tags and never removes them.
- Make bulk deletion use one combined impact review for all selected assets and their saved playlist uses. Confirmation deletes the entire selected set atomically; a changed impact requires a fresh review.
- Keep the existing same-kind replacement, playlist identity, seven-day media handoff, and public-manifest protections.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `digital-signage-platform`: Define the media edit drawer, title link, bulk additive tagging, selection, and combined atomic deletion while retaining current media safety behavior.

## Impact

- Media library UI, authenticated media API and shared contracts for bulk operations, integration and browser tests, and design-system guidance.
- No schema migration is expected. Playback manifests and player behavior remain unchanged except for the already specified effects of confirmed deletions or valid replacements.
- Pagination is planned separately; this change defines Select all over the current visible listing so it can later mean the current page.
