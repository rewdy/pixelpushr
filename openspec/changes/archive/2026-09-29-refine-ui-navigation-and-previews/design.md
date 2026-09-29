# Design

## Context

See [proposal.md](proposal.md) for motivation and [specs/digital-signage-platform/spec.md](specs/digital-signage-platform/spec.md) for behavior. The React/Vite SPA uses Wouter routes and Mantine. `PlaylistEditorPage` renders a `MediaPicker` inside a fixed-width desktop panel or a narrow-screen drawer; its `ScrollArea.Autosize` and non-wrapping rows can acquire horizontal overflow. `CompactPlaybackPreview` is shared by the playlist draft preview and Overview simulations; its current 50 px `RingProgress` includes a percentage label. Playlist and display detail pages show non-linked section text but no return link. `index.html` contains one static `pixelpushr` title, and no route currently manages document titles.

## Goals / Non-Goals

**Goals:** Keep these refinements within the established Mantine theme, preserve preview timing and playlist edits, give detail navigation a stable destination, and keep exactly one meaningful document title for the active SPA view.

**Non-Goals:** A new navigation hierarchy or global header, history-based Back behavior, an unsaved-draft navigation guard, player controls or playback changes, new routing/state dependencies, and API/schema changes.

## Decisions

### Constrain the picker at its own scroll viewport

Make the desktop panel and drawer content shrink within their available width. Constrain the scroll viewport and media row to the parent width, let only the name column shrink (`min-width: 0`), and keep the thumbnail and Add icon visible at fixed size. Use Mantine layout/`Text` truncation props first; use a small local CSS rule only where the scroll viewport cannot be constrained via component props. Set the native `title` attribute to the full asset name on the truncated name element; keep the full name in DOM text and in the Add action's accessible label. Avoid hiding horizontal overflow at the page root, which would conceal rather than correct a bad row width.

### Keep preview timing, simplify only the indicator

Change the shared `CompactPlaybackPreview` ring to approximately 16 px with proportionate stroke and no inner percentage label. Keep the existing timed-item and video-ended calculations untouched. For an unknown-duration play-once video, retain a neutral, nonnumeric dial and the existing nearby explanatory text. Because the component is shared, the visual change appears in both draft previews and Overview simulations. A browser check should assert the dial remains present, updates for timed items, and contains no visible `%` text.

### Use real listing links on detail pages

Render a matching lightweight `Back to Playlists` / `Back to Displays` link above each detail heading. Use Wouter's `Link` with a Mantine link/button treatment and the existing Lucide icon set; extract a tiny shared component only if it prevents visual drift without obscuring the destination. Point to `/playlists` and `/displays` directly, so entry from Overview, a bookmark, or a refresh behaves consistently. Keep the current unsaved-draft behavior; changing that would require a separate product decision.

### Let the matched route own its browser title

Use [React 19's native `<title>` support](https://react.dev/reference/react-dom/components/title) rather than adding Helmet or imperatively updating `document.title`. Render a single title for whichever Wouter route or gate state is active, with a consistent `… | pixelpushr` pattern. Detail views use the fetched name and a generic loading/unavailable fallback. Give authentication, invitation, setup, public player, and not-found states distinct titles without placing URL tokens in them. Remove or otherwise reconcile the static title in `index.html` so it cannot coexist with a React-managed title; React's guidance warns that multiple simultaneous titles have undefined behavior. Do not place a second default title above nested route titles. Browser tests should cover route transitions and detail-data arrival, not just initial loads.

## Risks / Trade-offs

- **Very narrow widths still constrain thumbnail + action + padding** → Test the minimum supported phone width, keep those controls visible, and let the name take the remaining space rather than introducing sideways scrolling.
- **A smaller dial is less legible** → Preserve adjacent item/status text and a meaningful nonvisual label while removing only the numeric center label.
- **Title duplication or stale detail names** → Keep title ownership with the active route/state, remove the static duplicate, and test in-app navigation plus async detail loading.
- **Back navigation can discard unsaved playlist edits** → This matches current sidebar navigation; do not silently add a new confirmation policy in a minor visual refinement.

## Migration Plan

No data or infrastructure migration. Ship the static web bundle after browser and accessibility checks; rollback is a normal frontend redeploy. No API compatibility change is expected.
