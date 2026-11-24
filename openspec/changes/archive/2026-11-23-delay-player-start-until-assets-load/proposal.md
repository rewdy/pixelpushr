# Proposal

## Why

The public player starts the slide timer as soon as it has a queue, so slow images can appear partially loaded and lose part of their configured screen time.

## What Changes

- Show a large white spinner on the dark player background while preparing the assets in the effective startup queue.
- Start playback automatically once that queue is ready, with the first playable item receiving its configured timing.
- Bound the wait for unavailable media and start with playable items when possible. Keep following server-timed override changes while loading.

## Capabilities

### New Capabilities

### Modified Capabilities

- `digital-signage-platform` gains a public player startup readiness requirement.

## Impact

The change affects the public player, its media readiness and cached-media handling, and browser playback coverage. It uses the existing manifest and media URLs.
