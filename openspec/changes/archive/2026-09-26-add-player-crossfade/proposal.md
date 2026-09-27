# Proposal

## Why

The public player currently swaps directly between media items. A short, consistent crossfade will make ordinary playlist playback feel less abrupt on signage displays without adding another per-item setting.

## What Changes

- Crossfade between consecutive items within a stable playback queue, including normal-queue rollover and transitions within an active override playlist, with a fixed 500 ms overlap.
- Preserve immediate, unfaded cuts when an override starts, expires, or a higher-priority override takes over. The same applies when an override manifest changes the active queue immediately.
- Keep the player control-free and retain its existing offline and manifest-refresh behavior.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `digital-signage-platform`: Define visual transitions between player items while keeping exact-time override semantics.

## Impact

- Public React player rendering and playback timing helpers, plus unit/browser playback tests.
- No API, manifest schema, database, or infrastructure changes are expected.
