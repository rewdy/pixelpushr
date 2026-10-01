# Tasks

## 1. Bounded list APIs

- [x] 1.1 Add shared page parameter and metadata contracts, with validated positive page numbers and bounded sizes, to the authenticated media, playlist, and display list routes; verify integration tests cover invalid inputs, totals, and unpaged legacy responses.
- [x] 1.2 Apply media name and OR-tag filters before SQL count and page selection, and use stable name-plus-ID ordering on all three routes; verify integration tests cover later-page matches, combined filters, duplicate names, organization isolation, and no duplicate or skipped rows across unchanged pages.
- [x] 1.3 Document opt-in paging parameters and response metadata in `docs/operations.md`; verify the documented examples agree with integration responses.

## 2. Media listing

- [x] 2.1 Add shared page controls, URL-backed page and filter state, accurate result counts, and distinct loading and empty states to the Media library; verify browser tests cover navigation, refresh/direct entry, later-page search matches, and filter reset to page one.
- [x] 2.2 Integrate page-local bulk selection so Select all covers only visible media and page or filter changes clear it; verify browser tests cover selected count and no cross-page tagging or deletion.
- [x] 2.3 Document the media paging and selection pattern in `docs/design-system.md`; verify the guidance matches the responsive controls.

## 3. Playlist and display listings

- [x] 3.1 Add the shared page controls and URL-backed page state to Playlists and Displays, including last-valid-page recovery after data changes; verify browser tests cover totals, navigation, direct entry, and creation from a later page.
- [x] 3.2 Keep playlist draft items, display assignments, ready-media picker, assignment chooser, and Overview on complete data sources; verify browser or integration checks cover records beyond the listing page size in each affected workflow.
- [x] 3.3 Document the common top-level paging pattern and the unpaged ordered editor views in `docs/design-system.md`; verify the guidance matches all three listing screens.

## 4. Integrated verification

- [x] 4.1 Run `bun run check`, `bun run typecheck`, `bun run build`, `bun run test:unit`, `bun run test:integration`, and `bun run test:browser` with the README's local services; resolve failures and verify existing unpaged API consumers and public player behavior remain intact.
