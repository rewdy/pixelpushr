# Tasks

## 1. Startup preparation

- [x] 1.1 Prepare distinct assets with bounded concurrency, browser image decoding, video readiness and existing cached-source fallback. Verify readiness, cleanup, and late callback handling with focused tests.
- [x] 1.2 Gate the player stage, autoplay and item timers on preparation. Add the white Mantine spinner at `lg` size on the dark stage and preserve empty and unavailable states. Verify the spinner is visible during preparation and disappears when playback starts. Verify in Playwright that withholding a later image keeps the slideshow hidden past the first item's configured duration, then releasing it starts the first item with its full duration. Cover video startup as well.
- [x] 1.3 Bound the wait and recover from unavailable media. Verify that a failed or stalled asset does not block a ready item, and that the player automatically recovers when a queue with no initially playable assets becomes playable.

## 2. Manifest and schedule behavior

- [x] 2.1 Keep polling, heartbeats and server-timed overrides active during preparation. Verify duplicate polls do not reset the wait, a changed manifest or override boundary supersedes obsolete preparation, and heartbeats report a playing item only after playback begins.
- [x] 2.2 Verify startup from cached media with the API and media network requests unavailable. Document the startup wait and fallback behavior in the operator walkthrough.

## 3. Verification

- [x] 3.1 Run `bun run check`, `bun run typecheck`, `bun run build`, `bun run test:unit`, and `bun run test:browser`. Confirm existing rollover, crossfade, video timing, and offline override behavior passes.
