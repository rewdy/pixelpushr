# Proposal

## Why

Administrators can already edit scheduled Append and Override assignments in place. The edit form currently resubmits every schedule field when any setting changes, however, which can reinterpret an untouched time at minute precision and shift a saved instant (notably an **Activate now** start or a daylight-saving overlap). The display's Overview simulation also has a separate cache that should be refreshed after an edit.

## What Changes

- Send only changed settings through the existing versioned, settings-only assignment PATCH. Keep untouched start/end instants and recurrence fields exactly as saved, including when only Override priority changes.
- Continue showing dates in the assignment's saved timezone. A form opened and closed without changes makes no write; an edited field uses the existing validation and stale-edit behavior.
- Refresh the assignment list and schedule preview after a successful edit, and invalidate the Overview simulation so returning to it shows the latest manifest. Public players continue to receive changed manifests through normal polling, with existing Append rollover and exact-time Override behavior.
- Add targeted coverage for Append and Override editing, unchanged timestamps (including seconds and daylight-saving ambiguity), and simulation refresh. Clarify the operator walkthrough where needed.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `digital-signage-platform`: Make existing assignment edits preserve untouched schedule values and promptly refresh administrator previews.

## Impact

- The existing display edit form and its TanStack Query invalidation, with focused browser and integration tests. No new API, migration, infrastructure, or player controls.
