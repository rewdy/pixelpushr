# Design

## Context

`PlayerPage` selects a queue from a live or cached manifest and immediately mounts the active media layer and arms timed-item deadlines. `PlayerMediaLayer` already owns source fallback and readiness signals for the incoming crossfade layer. The background cache also fetches future override media, so completion of that cache job does not describe readiness for the queue currently due to play.

## Goals / Non-Goals

The startup gate applies to the public player's initial nonempty queue, including an offline reload. Existing playback after startup continues to use its rollover, crossfade and immediate override paths. Admin previews and the manifest contract are outside this change.

## Decisions

- Prepare the currently effective queue, deduplicating assets by media kind and URL. Use browser image load and decode and video readiness to play. A completed fetch or cache write alone cannot confirm browser renderability. Reuse prepared sources for presentation and keep the first playback layer hidden until its actual source is ready.
- Use bounded preparation concurrency and a finite startup deadline. Keep successful items in queue order, skip failed or timed-out assets in the startup attempt, and retry through the normal refresh cadence when every item is unavailable. Release abandoned media resources and allow unavailable assets to be retried on later preparation.
- Keep manifest polling and server-adjusted transition timers running during startup. Use the effective queue's identity and media URLs to distinguish a changed queue from an identical poll. Cancel obsolete preparation, ignore late readiness signals and apply the latest effective queue before opening the gate.
- Start item deadlines, autoplay, and crossfade scheduling when startup commits. Keep heartbeat reporting active and report a playing item only after playback starts. Center Mantine’s `Loader size="lg" color="white" type="oval"` on the dark player stage. Distinguish asset loading from existing empty, unavailable, and offline-waiting states.

## Risks / Trade-offs

- Preparing the whole effective queue increases startup latency for large playlists. Limit concurrent work, reuse cache where available and allow playable assets to start at the deadline.
- Cache eviction, URL replacement, and late media events can invalidate readiness. Bind readiness to the current source and startup attempt and release temporary object URLs when their consumers are done.

## Migration Plan

Deploy through the existing web build. Roll back by redeploying the prior web build.
