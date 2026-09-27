# Design

## Context

See proposal.md and the spec delta. `PlayerPage` currently renders one keyed image or video and advances image/repeating-video items with timers or play-once video with media events. `playerQueue` defers normal manifest changes until rollover and replaces the queue immediately for override changes. Cached manifests and media support offline playback. The player's server-time offset drives exact override boundary timers.

## Goals / Non-Goals

**Goals:** Add a smooth item-to-item visual transition without extending configured durations or delaying override cuts; preserve playable content during media-load failures.

**Non-Goals:** Per-item fade settings, fades to/from the empty state, a new manifest field, or making the admin preview synchronize with the public player.

## Decisions

### Keep queue timing and visual transition state separate

Maintain the existing queue state as the authoritative current item and boundary clock. Add a small visual transition state holding outgoing and incoming render descriptors. For an image or timed repeating video, preload the next item and begin the fade during the last 500 ms of the outgoing item's duration; finish the fade and commit the queue advance at the original boundary. Start the incoming item's duration clock at that boundary, so neither item acquires an extra 500 ms of schedule time. At queue rollover, resolve the incoming item from any pending normal manifest without adopting that queue before the boundary. A single-layer CSS animation cannot show both items, so use two stacked media layers and opacity transitions. Keep CSS limited to the player stage/layers.

For play-once video, use media metadata/current time to start the fade in its final 500 ms, then commit on completion. If duration is unavailable or end prediction is unreliable, retain the outgoing video and use a direct handoff on `ended` rather than adding a post-video delay. For a repeat video, only fade when its configured repeat duration ends, not at each internal loop. If a next media element fails to load, cancel the transition and keep or advance from the last playable item without leaving a blank overlay. Prefer a direct cut over violating playback timing.

### Treat override changes as higher priority than fades

When `receiveManifest` or `applyTimedOverride` changes the winning override, cancel transition state, timers, pending preload, and outgoing layer before rendering the new queue's first item. Use the existing server-adjusted override timer; never wait for a fade to finish. Normal manifest changes remain pending until queue rollover. The same rule applies while offline with known override windows. This keeps the earlier exact-time contract intact; a global CSS transition on the stage would not.

### Reuse the existing offline URL path for both layers

Resolve incoming and outgoing URLs through the player's cache fallback where necessary, and release object URLs after their layer exits. Avoid a new media cache or manifest contract. Keep only two mounted playback elements at a time to cap decoder use on small signage hardware.

## Risks / Trade-offs

- [Videos may lack trustworthy duration metadata] → Fall back to an immediate handoff at `ended`; do not hold a finished frame for 500 ms just to animate.
- [A short or failed incoming item can flash blank] → Cap overlap by available outgoing time, preload when practical, and retain a visible outgoing layer until a playable replacement exists.
- [Normal manifest refresh during a fade can change the pending next item] → If the eligible incoming item changes, cancel or replace the preloaded layer and use a direct cut at rollover when there is not enough time to preload; test refresh races.
- [Two videos can stress a low-power Raspberry Pi/browser] → Mount at most two media layers and dispose the outgoing video promptly; test in Chromium and later on target hardware before relying on kiosk performance.
- [Existing video-repeat browser test is timing-sensitive] → Stabilize its media fixture/assertions while adding transition tests; do not weaken duration verification.

## Migration Plan

No schema, API, or infrastructure migration. Ship the web player change with a fixed duration constant. Rollback restores immediate item swaps without affecting playlist data or manifest compatibility.
