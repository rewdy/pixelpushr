# Proposal

## Why

The media, playlist, and display listings currently load and render every record at once. A common paging pattern will keep these top-level views usable as the library and number of displays grow, without making ordered editing harder.

## What Changes

- Add consistent page controls, result counts, loading, and empty states to the Media library, Playlists, and Displays listings.
- Apply media search and tag filters across the full matching set before paging; changing filters returns to the first page and clears media selection.
- Add authenticated, bounded pagination to the three list APIs with stable ordering and total counts, while retaining unpaged access for existing detail views, pickers, and Overview consumers.
- Keep playlist draft items and a display's assigned playlists together on their editor pages; these ordered collections will not be paged.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `digital-signage-platform`: Define paging, filtering, and selection behavior for top-level administration listings while preserving ordered editor views.

## Impact

- Admin list API handlers and shared pagination contracts; Media, Playlists, and Displays React pages; integration and browser tests; design-system and operations guidance.
- No database schema migration or public player change. Existing unpaged API consumers remain supported.
- Media selection follows the separate `streamline-media-library-management` change: Select all covers the current page and selection clears on page or filter changes.
