# Tasks

## 1. Video thumbnails

- [x] 1.1 Extend local and S3 media storage with a bounded small-object write, add an authenticated JPEG thumbnail upload for ready videos using the existing `thumbnail_key`, and verify ownership, signature, and size rejection in API tests.
- [x] 1.2 Return video `previewUrl` in media and playlist responses and delete thumbnail objects with their parent video; verify URL serialization, legacy null-thumbnail fallback, and cleanup in integration tests.
- [x] 1.3 Extract and upload a representative JPEG frame from newly uploaded videos without blocking video readiness on thumbnail failure; verify success and extraction/upload failure with browser or component coverage.
- [x] 1.4 Document video-thumbnail generation, retry/fallback, and the 1 MB upload limit in operator documentation; verify the documented local flow against Floci and Mailpit setup.

## 2. Visual playlist editing

- [x] 2.1 Replace the asset select with a ready-media tile panel alongside the editor on desktop and a drawer on smaller screens; verify opening, closing, filtering, and appending an asset in browser coverage.
- [x] 2.2 Add image/video thumbnails or fallbacks to each picker tile and playlist row, including preexisting videos without posters; verify both kinds render without mounting video decoders in the tile list.
- [x] 2.3 Give each draft item a stable client-only identity and implement checkbox selection, bulk deletion, and type-aware bulk duration with eligible-item counts; verify duplicate asset instances, mixed selections, unchanged play-once videos, and preserved order in focused tests.
- [x] 2.4 Keep all editor changes local until Save and prevent background query refresh from replacing a dirty draft; verify unsaved edits leave the stored playlist unchanged and a save persists the final order/settings.
- [x] 2.5 Update the playlist editing walkthrough for the media panel and bulk actions; verify its controls and save behavior match the delivered UI.
- [x] 2.6 Add Deselect all to the bulk-actions bar and document it; verify a browser test clears all checkboxes without changing draft items or their playback settings.

## 3. Reusable draft preview

- [x] 3.1 Build a compact preview component driven by ordered draft media/settings, including image duration, video play-once, video repeat-for-duration, loop, empty state, and timer cleanup; verify sequencing and end-of-video behavior in focused browser coverage.
- [x] 3.2 Add a toggle and approximately 360 px wide 16:9 preview to the playlist editor with RingProgress, immediate response to unsaved edits, and restart on reopen; verify duration edits, structural edits, close/reopen, and no published-playlist mutation in browser coverage.
- [x] 3.3 Document that editor preview plays the local draft and is not a synchronized view of a running display; verify the description in the editor and operator walkthrough.

## 4. Integration verification

- [x] 4.1 Run Biome check on change-scoped files, typecheck, build, and the relevant unit, integration, and Playwright suites; verify video thumbnail fallback, bulk editing, and draft playback together without changing public player scheduling or override behavior. Repository-wide Biome cleanup is outside this change.
