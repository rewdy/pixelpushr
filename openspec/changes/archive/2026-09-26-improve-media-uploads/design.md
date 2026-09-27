# Design

## Context

See [proposal.md](proposal.md) and [the delta spec](specs/digital-signage-platform/spec.md). `MediaPage` currently owns a single-file mutation that creates an asset, uploads to its storage URL, reads media metadata, and completes the asset. For ready videos, it then attempts thumbnail capture and upload; thumbnail failure does not make the playable video fail. The API already validates each file independently. Batch intake should reuse this complete per-file flow.

## Goals / Non-Goals

**Goals:** Give both file selection and dropping one intake path, retain useful per-file status, and bound concurrent uploads so several videos do not overload the browser.

**Non-Goals:** A new batch API, background uploads across page reloads, byte-level progress bars, drag reordering, or changing media format limits.

## Decisions

Use the file input's `multiple` option and a page-wide file-drop target visible while the Media library route is active. Native file drag events are sufficient for file intake; `dnd-kit` is better reserved for a future sortable playlist UI. Show a clear drop overlay on file drag, prevent the browser from navigating to a dropped file, and ignore drags that contain no files. Both entry paths hand a `File[]` to the same enqueue function.

Extract the existing per-file upload sequence, including best-effort video thumbnail generation after readiness, into a reusable operation. Maintain transient queue entries with a client-generated ID, filename, status, and error. Run at most two uploads concurrently, continue processing after a failure, and refresh the media query when each file settles. Use status labels instead of a misleading percentage because the current `fetch` PUT path does not expose upload byte progress. Precheck recognizable unsupported types and size when possible, while leaving API validation authoritative.

Keep the queue in page state for this pass; successful records persist in the media library and server-side failed records remain visible after navigation. Thumbnail capture remains best-effort for each ready video and does not change that file's upload result. An alternative app-wide upload manager would keep uploads visible during route changes, but it expands state and navigation behavior beyond this request.

## Risks / Trade-offs

- Dropping a file outside the target can navigate away from the app → attach window-level prevention while the media page is mounted and give the page a visible drop state.
- Large simultaneous videos compete for network and memory → cap active uploads at two and process each independently.
- `fetch` provides no upload byte progress → show discrete states and file-specific errors, without implying a percent complete.
- Extracting the upload function could regress video thumbnails → preserve the existing post-readiness capture/upload step and its non-fatal failure behavior for each video in a batch.

## Migration Plan

This is a web-only change using existing upload endpoints. Existing media rows and storage objects require no migration. Rollback restores single-file intake without changing stored assets.
