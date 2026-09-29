# Tasks

## 1. Playlist media picker

- [x] 1.1 Constrain the ready-media picker and its rows to the available panel/drawer width, truncate long unbroken names with a full-name `title`, and retain thumbnail/Add visibility; verify a browser test at desktop and narrow viewport widths finds no horizontal overflow and can add the long-named asset.

## 2. Compact preview progress

- [x] 2.1 Reduce the shared compact preview ring to approximately 16 px and remove its visible percentage while preserving timed and play-once advancement; verify browser coverage on both playlist draft and Overview previews, including unknown video duration, and check that no `%` text appears in the dial.

## 3. Detail-page navigation

- [x] 3.1 Add matching linked Back to Playlists and Back to Displays controls above the detail headings; verify keyboard activation and direct-entry return destinations in browser tests without depending on browser history.
- [x] 3.2 Record the new detail-page return-link placement in `docs/design-system.md`; verify the guidance matches both implemented detail pages.

## 4. Browser titles

- [x] 4.1 Give every route and authentication/gate state one React-managed title, remove the static duplicate, and use loaded playlist/display names with generic fallbacks; verify browser tests cover in-app navigation, delayed detail data, auth/player/not-found routes, and absence of tokens or duplicate title elements.
- [x] 4.2 Document the route-title pattern and suffix in `docs/design-system.md`; verify every routable view follows the documented convention.

## 5. Integrated verification

- [x] 5.1 Run `bun run check`, `bun run typecheck`, `bun run build`, `bun run test:unit`, `bun run test:integration`, and `bun run test:browser` with the README's local services; resolve new failures and confirm no player controls, timing changes, or horizontal page overflow were introduced.
