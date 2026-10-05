# Design

## Context

See [proposal.md](proposal.md) for motivation and [specs/digital-signage-platform/spec.md](specs/digital-signage-platform/spec.md) for behavior. The Playlists and Displays pages currently place a text input beside their create button; People & access does the same for invitations. Listing names are plain text even though each playlist and display has a separate row link. The playlist editor renders a full-width timing input below each item's name and mounts the bulk panel only after a selection. Display scheduling uses one `LocalDateTimePicker` wrapper plus a last-occurrence `DatePickerInput`; weekly and monthly recurrence use a shared weekday option list.

## Goals / Non-Goals

**Goals:** Keep the changes within the existing React, Wouter, TanStack Query, and Mantine patterns. Preserve current API mutations, permissions, playlist draft semantics, and recurrence values. Apply one calendar week convention across scheduling controls.

**Non-Goals:** New routes or API endpoints, invitation permissions, media editing or media bulk actions, list pagination, schedule resolution changes, and public player UI.

## Decisions

### Link the name, retain the row action

Use the same Wouter destination as each listing's existing Edit or Assign playlists action. Render the name with a keyboard-focusable link treatment while keeping the row action for discoverability. This avoids row-wide click handlers, which would interfere with other controls and provide weaker keyboard behavior.

### Use local modal state for each creation flow

Replace each inline form with one primary button and a Mantine `Modal` owned by its page. Keep name or email input, validation/error feedback, Cancel, and submit inside the modal. Continue using the existing mutations and query invalidation. On playlist creation, navigate to the new editor; on display creation, close the modal and refresh the list; on invitation success, close the modal and retain the existing page-level confirmation and copy-link access. Clear form state after success or explicit cancellation, but keep the entered value visible on error. A shared modal abstraction is unnecessary for three small forms with different outcomes.

### Compact draft items without changing their model

Keep selection, thumbnail, name, timing, reorder, and remove controls in the existing item component. Arrange desktop content in one horizontal row with a constrained timing area; let the row wrap or stack at the existing narrow breakpoint. Give numeric duration controls a modest explicit width instead of allowing them to consume the flexible name column. Use Mantine layout props and theme spacing first, with a local CSS Module only if necessary for responsive control widths. The draft state and save payload remain unchanged.

### Keep a stable bulk panel

Always render the bulk panel above draft items. With no selection, leave Select all enabled when items exist, disable modifying actions, and show a neutral selection count. With a selection, retain existing duration eligibility rules and deletion behavior and expose Deselect all. This preserves the panel's height while checkboxes change. Selecting all means all items in the current playlist draft; this editor is not paged.

### Configure Sunday-first presentation centrally

Wrap the app's Mantine date controls in `DatesProvider` with `firstDayOfWeek: 0`, which the installed `@mantine/dates` version supports. Reorder the recurrence weekday options so Sunday appears first while keeping its existing value `7` and Monday's value `1`. Calendar presentation and option order must not alter saved rules, timezone conversion, or the recurrence engine. Setting only one picker prop would risk inconsistent calendars; changing recurrence numeric values would change saved behavior.

## Risks / Trade-offs

- **Modal errors or cancellation lose input unexpectedly** → Keep field state until success or explicit cancellation and cover failed submit in browser checks.
- **Dense item rows hide actions at phone widths** → Verify the supported narrow viewport with long media names and all controls visible; allow a stacked layout there.
- **Permanent bulk panel takes space for an empty playlist** → Keep it compact and use a clear disabled state; verify its height does not jump after selection.
- **Sunday-first visuals accidentally alter recurrence semantics** → Keep weekday values unchanged and cover an existing Sunday recurring assignment plus calendar ordering.

## Migration Plan

No data or infrastructure migration is needed. Deploy the web bundle after browser verification; rollback is a normal frontend redeploy.
