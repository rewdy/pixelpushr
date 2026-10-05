# Tasks

## 1. Listing links and creation flows

- [x] 1.1 Link playlist and display names to their existing management routes while retaining row actions; verify browser checks can activate each name by keyboard and reach the correct detail page.
- [x] 1.2 Replace inline playlist and display creation forms with single-action modals containing the required field, Cancel, submit, and inline errors; verify browser checks cover cancel, invalid or failed submit retaining input, successful playlist navigation, and successful display listing refresh.
- [x] 1.3 Move owner invitation entry into a Send invitation modal while preserving owner-only access and the existing success and copy-link flow; verify browser checks cover cancel, failed submit, success, and non-owner visibility.
- [x] 1.4 Document the listing-link and creation-modal pattern in `docs/design-system.md`; verify the guidance matches the implemented pages.

## 2. Playlist editor density and bulk controls

- [x] 2.1 Reflow playlist draft item controls into compact desktop rows and narrow stacked rows without changing draft or save behavior; verify browser checks cover image duration, video mode, reorder, remove, long names, and no horizontal overflow at a narrow viewport.
- [x] 2.2 Keep the bulk panel mounted with a no-selection state, add Select all and Deselect all, and disable modifying actions until selection makes them applicable; verify browser checks cover empty, partial, all, and cleared selection without item-list movement.
- [x] 2.3 Document compact draft rows and the stable bulk panel in `docs/design-system.md`; verify the guidance matches desktop and narrow layouts.

## 3. Sunday-first scheduling controls

- [x] 3.1 Configure all schedule date calendars to start on Sunday and reorder recurrence weekday choices without changing their saved numeric values; verify browser checks cover start, end, last-occurrence, and preview pickers plus selection of a Sunday recurrence.
- [x] 3.2 Record the Sunday-first calendar and weekday-choice convention in `docs/design-system.md`; verify the documented convention matches the controls.

## 4. Integrated verification

- [x] 4.1 Run `bun run check`, `bun run typecheck`, `bun run build`, `bun run test:unit`, and the relevant `bun run test:browser` suite with the README's local services; resolve failures and verify existing schedule preview outcomes and playlist draft saves remain intact.
