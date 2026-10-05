# Proposal

## Why

Common console actions use different entry patterns, and playlist editing spends too much space on duration controls while hiding bulk actions until an item is selected. The schedule calendars also start on Monday, which makes Sunday-based assignments harder to scan for this workspace.

## What Changes

- Make playlist names link to their editor and display names link to their assignment page from the respective listings.
- Replace inline creation forms for playlists, displays, and owner invitations with one primary action that opens a name or email modal with Cancel and submit actions.
- Condense playlist draft item rows, giving timing inputs only the width they need on desktop and allowing the layout to stack at narrow widths.
- Keep the playlist bulk-edit toolbar visible in a disabled state with no selection; provide Select all and Deselect all actions without shifting the item list.
- Start the calendar week on Sunday in schedule date and date-time pickers, and show Sunday first in recurrence weekday choices. Stored weekday values and schedule evaluation stay unchanged.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `digital-signage-platform`: Define listing title destinations, modal creation flows, compact playlist editing and stable bulk controls, and Sunday-first schedule controls.

## Impact

- React/Mantine console views for playlists, displays, invitations, playlist editing, and display scheduling; design-system guidance and browser coverage.
- No API contract, database, manifest, player timing, or Terraform change.
- Media title links, media edit and bulk actions, and list pagination remain separate planned changes.
