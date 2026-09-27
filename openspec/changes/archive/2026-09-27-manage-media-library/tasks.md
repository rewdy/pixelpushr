# Tasks

## 1. Data model and shared contracts

- [x] 1.1 Add a Drizzle migration for replacement candidates, retired objects, organization-scoped tags, and asset-tag joins; verify migration succeeds on clean and existing databases without changing existing playlist/media rows.
- [x] 1.2 Define shared request/response contracts for media tags, deletion impact, and replacement initiation/completion; verify API and web typechecks accept them without path aliases.

## 2. Replacement and storage lifecycle

- [x] 2.1 Extract/reuse media upload validation and implement same-kind replacement with browser-writable temporary staging, a separately copied/revalidated server-only final key, reserved cleanup for failed final copies, one-day retirement of successful staging keys, and an atomic pointer swap; verify unit and integration tests cover success, wrong kind, invalid file, failed upload, concurrent completion, and reuse of the staging upload URL after publication without disrupting the original.
- [x] 2.2 Make replacement video thumbnails optional and version-aware, and retire prior object/thumbnail keys instead of eagerly deleting them; verify integration tests cover missing and late thumbnails plus old URL availability during handoff.
- [x] 2.3 Implement idempotent cleanup for expired staged candidates and seven-day retired objects, wire a scheduled AWS invocation in Terraform and a local command; verify cleanup tests, Terraform validation, and a local dry run/fixture run.
- [x] 2.4 Document replacement behavior, retention/offline caveats, and cleanup operation in the operator docs; verify the documented local command and configuration names against the implementation.

## 3. Informed deletion

- [x] 3.1 Add an authenticated deletion-impact endpoint with exact saved playlist-item uses and a snapshot token; verify integration tests cover unused and multiply-used media and organization scoping.
- [x] 3.2 Replace the restrictive delete route with a transaction that rechecks the impact token, removes matching playlist items and the asset, and retires storage keys; coordinate concurrent playlist-use creation and verify integration tests cover stale impact, concurrent insert, preserved item order/assignments, and subsequent manifests.
- [x] 3.3 Add Media library rename and delete actions with an explicit affected-playlists confirmation and refreshed-confirmation path on conflict; verify browser tests cover rename, unused deletion, in-use deletion, and stale impact.
- [x] 3.4 Document the irreversible playlist-use removal and bounded storage handoff in admin/operator guidance; verify the wording matches the actual confirmation and retention behavior.

## 4. Tags and library/picker workflows

- [x] 4.1 Implement organization-scoped tag creation/reuse, asset tag editing, suggestions, and OR-within-tags/AND-with-text list filtering; verify unit and integration tests cover normalization, cross-organization isolation, tag removal, and filter combinations.
- [x] 4.2 Add Mantine-based tag editing and tag/text filters to the Media library and playlist picker, plus replacement upload/progress and refresh behavior in the library; verify browser tests cover tagging/filtering on both surfaces and same-kind replacement preserving playlist settings.
- [x] 4.3 Document tag matching/filter semantics and replacement usage in admin guidance; verify documented examples against browser/integration tests.

## 5. Cross-cutting verification

- [x] 5.1 Run `bun run check`, `bun run typecheck`, `bun run build`, `bun run test:unit`, `bun run test:integration`, `bun run test:browser`, and Terraform validation; record any pre-existing failures separately and verify new failures are resolved.
- [x] 5.2 Verify player manifests before/after replacement and deletion, including an older manifest within the handoff period and normal queue-boundary adoption, across unit/integration/browser coverage; confirm no player controls or tag data appear in the public player.
