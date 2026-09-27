# Design

## Context

See proposal.md for motivation and the spec delta for behavior. The display editor currently separates always-on, recurring schedule, and override creation. Always-on assignments use a replacement `PUT`, while schedules and overrides have separate `POST` endpoints. The Overview is a placeholder. The sidebar links to Schedules and Overrides have no matching routes. The public manifest already contains the server-resolved effective queue and upcoming transitions; the display list exposes each display's player URL and actual last-seen state.

## Goals / Non-Goals

**Goals:** Make the assignment mode clear without changing queue semantics; simulate each display from server-resolved content; distinguish simulation from actual device health.

**Non-Goals:** Real-time mirroring of a physical player, device screenshots or telemetry, new scheduling APIs, or separate Schedules and Overrides pages.

## Decisions

### Use a single side drawer for adding assignments

The display editor will offer one Add playlist action that opens a Mantine Drawer. Choose playlist and timing first. Always-on implies append; scheduled timing reveals Append/Override and then only the corresponding recurrence or override fields. A drawer leaves room for conditional fields and matches the playlist media picker direction better than a compact modal. The existing per-mode mutation endpoints remain: append to the current always-on IDs when calling `PUT /admin/displays/:id/always`, or call the relevant schedule/override `POST`. Keep removal actions and mode/timing labels together on the display page. Avoid a new generic assignment endpoint and database migration for this UI consolidation.

### Simulate from public manifests on Overview

Use each display's existing player token/URL to request the public manifest, then render its effective queue in a compact, reusable preview component from `improve-playlist-editor`. The Overview preview starts a local playhead when mounted; it does not align with, control, or heartbeat the device. Show an explicit Simulated preview label beside actual last-seen/health data. Refresh manifests periodically and at known transition boundaries so override activation and expiration are reflected while Overview stays open. Limit work for offscreen cards and clean up timers/media on unmount. A heartbeat endpoint or device-side stream would falsely imply device synchronization and add infrastructure not required by this use case.

### Keep schedule semantics authoritative on the server

The UI constructs the mode-specific payload and displays validation errors, but the API remains responsible for validating time windows and resolving recurrence, priority, and override transitions. Preview playback consumes the resolved manifest rather than independently evaluating timezone rules. The regular player retains exact override cuts; the simulation may restart its playhead when a new manifest arrives and must not be presented as device playback.

## Risks / Trade-offs

- [Always-on `PUT` replaces the list] → Read the latest assignment IDs before append and invalidate/refetch display queries after every mutation; handle a conflict or stale result visibly instead of silently dropping an existing assignment.
- [Many Overview previews can consume bandwidth/CPU] → Use compact media, bounded concurrent fetching, visibility-based playback, and cleanup on unmount. Defer full-resolution video playback in Overview; a poster/thumbnail simulation is acceptable when video would be too costly.
- [A public token is present in the admin display URL] → Reuse only the intentionally public player manifest; do not send tokens or presigned URLs to logs or analytics.
- [A simulated playhead can differ from a real device] → Label it prominently and keep actual health metadata separate.
- [Dependency on the playlist preview work] → Implement `improve-playlist-editor` first, then reuse its component; keep assignment changes independently testable.

## Migration Plan

No data migration. Deliver the shared preview and then the unified display flow and Overview cards. Existing assignments remain readable and removable. Removing dead sidebar links is a navigation-only change. Rollback restores the prior editor/Overview presentation without altering stored assignments.
