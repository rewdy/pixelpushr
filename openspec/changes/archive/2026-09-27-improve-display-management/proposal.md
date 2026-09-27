# Proposal

## Why

Playlist assignments are currently spread across three forms on each display, making the choice between always-on, additive schedules, and overrides harder than it needs to be. The Overview page also gives little sense of what each display is configured to show, while Schedules and Overrides sidebar links lead to missing routes.

## What Changes

- Add one **Add playlist** action on a display that opens a guided form for playlist, timing, and behavior. Always-on assignments append to the normal queue; scheduled assignments choose Append or Override, with the existing recurrence, activate-now, expiration, and priority controls shown only when relevant.
- Keep an organized list of all assignments on the display page, including their timing, behavior, and removal actions.
- Remove the unused top-level Schedules and Overrides sidebar links; scheduling and overrides remain managed per display.
- Show a locally simulated preview card for every display on Overview using its currently resolved manifest. Label previews as simulations so they are not mistaken for exact device playback.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `digital-signage-platform`: Add a unified assignment workflow and Overview display simulations while preserving existing additive schedule and exact-time override behavior.

## Impact

- Display editor, Overview, and navigation components; reuse the compact playback preview from `improve-playlist-editor`.
- Existing assignment and public manifest APIs are expected to suffice; no database migration is planned.
