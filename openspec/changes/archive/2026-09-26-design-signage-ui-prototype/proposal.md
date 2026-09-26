# Proposal

## Why

The signage platform's layout and visual language should be validated before production screens are connected to authentication, media APIs, and scheduling logic. A static prototype lets us review the admin workflow, player presentation, responsive behavior, and Mantine theme early, when visual changes are inexpensive.

## What Changes

- Create a static React/Vite visual prototype using fixture data only.
- Establish the Mantine theme, typography, color tokens, spacing, status colors, and light/dark system mode.
- Prototype the desktop admin shell with screened side navigation and medium-density content layouts.
- Prototype media, playlists, displays, scheduling, overrides, and authentication-facing screens.
- Prototype the minimal public player view and its empty/loading/offline states.
- Verify responsive collapse behavior at smaller desktop/tablet widths.
- Capture review criteria and approved visual decisions for the production implementation.

## Capabilities

### New Capabilities

This change is a visual prototype and does not introduce runtime product behavior. Specs are intentionally skipped via `.openspec.yaml`.

### Modified Capabilities

None.

## Impact

- Adds a static prototype application or prototype workspace area.
- Establishes reusable visual tokens and Mantine theme decisions for the later platform implementation.
- Produces a visual reference for the main `build-digital-signage-platform` change.
- Does not add real authentication, API calls, persistence, media uploads, or scheduling behavior.
