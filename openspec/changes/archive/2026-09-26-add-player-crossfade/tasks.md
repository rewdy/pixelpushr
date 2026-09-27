# Tasks

## 1. Timed item transitions

- [x] 1.1 Add a fixed 500 ms overlap planner for image and repeat-for-duration boundaries, including queue rollover and pending normal updates; verify unit tests keep configured item cadence unchanged.
- [x] 1.2 Render at most two media layers during the overlap, preload the incoming item, and remove the outgoing layer at the original item boundary; verify browser tests observe opacity overlap and no stale layer after completion.
- [x] 1.3 Handle play-once video completion and repeat-video internal loops, falling back to a direct cut when duration or incoming media is unavailable; verify browser tests cover each mode and stabilize the existing repeat-video test without weakening duration assertions.
- [x] 1.4 Document the fixed within-duration crossfade and its fallback behavior in `docs/operations.md`; verify the playback description matches the player tests.

## 2. Exact-time interruption and resilience

- [x] 2.1 Cancel all fade/preload state when an override starts, expires, or changes winner through polling or a known timed boundary; verify browser tests show immediate cuts despite an in-flight fade and server-clock skew.
- [x] 2.2 Resolve media URLs and cleanup for both layers during online and offline playback; verify browser tests cover cached-media rollover and an override expiring offline without blank or leaked layers.
- [x] 2.3 Cover a normal manifest refresh racing with the fade and a missing next asset; verify the latest eligible queue is adopted at rollover and the display never retains a stale overlay.
- [x] 2.4 Update the player behavior note in `docs/architecture.md` and verify it distinguishes item fades from exact-time override cuts.

## 3. Integration checks

- [x] 3.1 Run `bun run check`, `bun run typecheck`, `bun run test:unit`, `bun run test:browser`, and `bun run build`; verify all pass with local services and no live AWS deployment.
