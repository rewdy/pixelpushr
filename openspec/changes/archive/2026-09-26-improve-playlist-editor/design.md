# Design

## Context

See [proposal.md](proposal.md) for motivation and [the delta spec](specs/digital-signage-platform/spec.md) for required behavior. The current playlist editor keeps an unsaved item draft in React state, uses a searchable asset select, and saves the complete ordered list with one PUT. Media rows already expose image preview URLs. The `media_assets` table has an unused nullable `thumbnail_key`, while video assets currently return no `previewUrl`. Media storage supports public URLs, presigned uploads, and deletion but not a direct small-object write. The public player has its own manifest, clock, override, and offline behavior; the editor preview must not change those rules.

## Goals / Non-Goals

**Goals:** Keep the draft and published playlist clearly separate, make duplicate uses of the same asset independently selectable, and share a compact playback presentation component with a future display preview.

**Non-Goals:** Drag reordering, multiple-file upload, interactive video playback in picker tiles, synchronized viewing of a running display, and changes to player manifests or scheduling.

## Decisions

### Persist video still frames with the existing media model

Extend the browser's existing video metadata read to seek to an early representative frame and encode a small JPEG (maximum 1 MB, bounded dimensions). After the video is ready, upload that JPEG to a new authenticated media endpoint. The API validates ownership, type, size, and image signature, writes it to a separate random storage key through an extended storage adapter, and records the key in the existing `thumbnail_key` column only after storage succeeds. The endpoint may also be used later to supply a thumbnail for an older video. Return its public URL as `previewUrl` in the media list and playlist item response, and remove both objects when a video asset is deleted.

Use a bounded API upload because thumbnail files are small and it keeps key allocation, verification, and persistence in one request. Presigned uploads would require a second completion step and pending-key tracking. Failure to extract or upload a frame leaves the original video ready; the UI uses a video placeholder. Existing videos are not backfilled. No database migration or new package is needed.

### Keep all editor actions in one draft

Replace the asset dropdown with an inline right-hand panel on desktop; use a Mantine Drawer at narrow widths so the editor remains usable. Tiles show ready assets and an Add button; the same asset can be added more than once. Each draft item gets a stable client-only ID so duplicate asset instances remain distinct while selecting, moving, or deleting them. Keep the existing atomic PUT as the sole publish action. Clear or reconcile selection after deletions and server reloads.

Bulk duration takes seconds within the API's existing 1–86,400 second bounds. Apply it to selected images (`imageDurationMs`) and videos already in repeat mode (`repeatDurationMs`); do not convert play-once videos. Show the number eligible before applying and the number updated afterward. Bulk delete removes selected draft IDs only. Deselect all resets only the selection set, leaving the draft and dirty state untouched. Mantine components and the existing theme provide layout and controls; CSS Modules are reserved for media framing and responsive details. Arrows continue to change order.

### Preview the draft locally without using the public player route

Build a reusable compact playback component that accepts an ordered list of media URLs and playback settings. The playlist editor maps its current draft and loaded assets into that input, including unsaved additions and edits. Its parent owns the open/closed state. At roughly 360 px wide with a 16:9 stage, it uses Mantine RingProgress for the current item's progress and a clear empty state. Opening starts at the first item; closing releases timers and media playback; reopening starts at the first current item. Structural draft changes restart at the first item; a timing edit on the current item updates its remaining time. The ring tracks image/repeat durations and video current time for play-once items. A play-once video with unavailable duration shows indeterminate progress until `ended`.

Use the same basic sequencing rules as the public player for images, play-once videos, and repeat-for-duration videos, but keep this component separate from manifest polling, schedule resolution, override timing, cache, and heartbeat. This allows reuse in a later display view without coupling the admin console to a public player token or implying that preview shows a display's exact live position.

## Risks / Trade-offs

- Browser frame extraction can fail for an otherwise playable video → keep video readiness independent and show a fallback tile; allow a later retry.
- Thumbnail upload through Lambda adds bounded binary request handling → enforce a 1 MB cap before reading and validate file signature; reject other content types.
- Unsaved edits can be lost if query invalidation overwrites the draft → initialize from server data only on first load or explicit successful save/reload, and track dirty state.
- Large playlists and many media tiles can increase decoding and rerenders → render still images in tiles, avoid mounting video elements there, and keep preview to one active video.
- Preview video playback may differ from a kiosk browser's codec support → label it as an editor preview and retain separate device validation.

## Migration Plan

Deploy API support for thumbnail upload, serialization, and cleanup before the updated web app. Existing rows have a null `thumbnail_key` and use the fallback automatically. Rollback can restore the prior web/API build without changing playlist data; if media is deleted while an older API build is running, a thumbnail object may need later orphan cleanup.
