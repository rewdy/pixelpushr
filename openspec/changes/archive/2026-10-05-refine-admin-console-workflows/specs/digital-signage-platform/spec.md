# Spec Delta

## ADDED Requirements

### Requirement: Listing names open their management views
Playlist and display listings SHALL make each item's name a keyboard-accessible link to that item's existing management view. The separate row action MAY remain available.

#### Scenario: Open a playlist from its name
- **WHEN** an administrator activates a playlist name in the Playlists listing
- **THEN** that playlist's editor opens

#### Scenario: Open a display from its name
- **WHEN** an administrator activates a display name in the Displays listing
- **THEN** that display's playlist-assignment view opens

### Requirement: Modal creation actions
The Playlists and Displays listings and the owner-only invitation area SHALL present one primary create or send action instead of an inline input. Activating it SHALL open a modal with the required field, Cancel, and submit. Cancel SHALL leave data unchanged; an invalid or failed submission SHALL keep the modal open and explain the error.

#### Scenario: Create playlist
- **WHEN** an administrator opens Create playlist, enters a valid name, and submits
- **THEN** the playlist is created and its editor opens

#### Scenario: Create display
- **WHEN** an administrator opens Create display, enters a valid name, and submits
- **THEN** the display is created and appears in the listing

#### Scenario: Send invitation
- **WHEN** an owner opens Send invitation, enters a valid email address, and submits
- **THEN** an invitation is sent and the existing confirmation and copy-link access remain available

#### Scenario: Cancel or failed submission
- **WHEN** an administrator cancels a creation modal or receives a validation or server error on submit
- **THEN** cancellation makes no change, while an error is shown without losing the entered value

### Requirement: Compact playlist draft editing
The playlist editor SHALL keep each draft item's thumbnail, name, selection, timing, reorder, and remove controls usable in a compact row on desktop and a readable stacked layout on narrow screens. Timing controls SHALL use space proportional to their content instead of dominating the row. Bulk-edit controls and a Select all action SHALL remain visible when no items are selected, with destructive or modifying actions disabled until eligible items are selected.

#### Scenario: Edit timing in a compact row
- **WHEN** an administrator edits an image duration or video playback mode in a desktop playlist draft
- **THEN** the item remains a compact row with all item actions visible and the timing value is saved only with the draft

#### Scenario: Narrow playlist editor
- **WHEN** the editor is viewed at a narrow width
- **THEN** item controls reflow without horizontal page overflow or loss of selection, timing, reorder, or remove actions

#### Scenario: Stable empty-selection toolbar
- **WHEN** no draft items are selected
- **THEN** Select all is available, bulk duration and delete actions are disabled, and the bulk toolbar occupies its normal place above the items

#### Scenario: Select and clear all items
- **WHEN** an administrator selects all draft items and later deselects all
- **THEN** the checkboxes and eligible bulk actions update without changing draft content or shifting the item list

### Requirement: Sunday-first schedule controls
Schedule date and date-time calendars SHALL display Sunday as the first day of the week. Recurrence weekday choices SHALL list Sunday first while retaining the established weekday meanings and saved schedule behavior.

#### Scenario: Inspect a Sunday schedule
- **WHEN** an administrator opens a schedule start, end, last-occurrence, or preview calendar
- **THEN** Sunday is the first weekday column and the chosen date remains the same calendar date

#### Scenario: Choose recurrence weekdays
- **WHEN** an administrator selects Sunday in a weekly or monthly recurrence control
- **THEN** the saved rule still represents Sunday and existing recurring assignments remain unchanged
