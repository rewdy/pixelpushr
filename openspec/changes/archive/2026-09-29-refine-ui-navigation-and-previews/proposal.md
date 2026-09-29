# Proposal

## Why

The current console has a few small but noticeable usability gaps: the playlist media picker can scroll sideways, preview progress is visually busy, detail pages lack an obvious return path, and browser tabs keep a generic title. Addressing them together improves the existing UI without changing signage playback or data behavior.

## What Changes

- Keep the playlist editor's media picker within its available width on desktop and narrow layouts. Truncate long unbroken asset names and expose the full name on hover without hiding thumbnails or Add actions.
- Reduce the shared compact preview's progress ring to a small, label-free indicator while preserving progress behavior in both playlist draft previews and Overview simulations.
- Add a consistent, linked Back to Playlists / Back to Displays affordance on playlist and display detail pages; it returns to the corresponding listing rather than relying on browser history.
- Give every routable console, authentication, public player, and not-found view a meaningful browser-tab title that updates during client-side navigation, including loaded detail names.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `digital-signage-platform`: Add responsive picker, compact preview, detail navigation, and document-title behavior to the existing UI contract.

## Impact

- React/Vite UI only: playlist picker and compact preview, playlist/display detail headers, route titles, and the static HTML title fallback.
- Browser tests for narrow widths, long media names, navigation, progress presentation, and tab titles; no API, database, Terraform, or player playback changes.
