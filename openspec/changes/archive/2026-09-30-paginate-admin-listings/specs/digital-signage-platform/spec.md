# Spec Delta

## ADDED Requirements

### Requirement: Paginated administration listings
The Media library, Playlists listing, and Displays listing SHALL show a bounded page of records with consistent navigation controls and an indication of the current page and total matching records. Pages SHALL use a stable order so records do not appear twice or disappear between adjacent pages when the underlying data is unchanged. Each listing SHALL distinguish no records from an empty page caused by filtering or data changes.

#### Scenario: Browse multiple pages
- **WHEN** a top-level listing contains more records than one page
- **THEN** an administrator can move between pages and see only the records for the chosen page with an accurate total count

#### Scenario: Stable order
- **WHEN** an administrator moves between pages without changing the underlying records or filters
- **THEN** each matching record appears in one predictable position and no record is duplicated or omitted

#### Scenario: Last page becomes empty
- **WHEN** records are removed so the current page no longer exists
- **THEN** the listing returns to the last valid page or its first-page empty state

### Requirement: Media filtering across pages
Media name search and selected tag filters SHALL apply to all eligible media before the matching result is paged. Changing a search or tag filter SHALL return the library to page one and clear the current media selection. Select all SHALL select only the media shown on the current page.

#### Scenario: Match on a later page
- **WHEN** an administrator searches for media that would have appeared on a later unfiltered page
- **THEN** the asset appears in the filtered results and the total count reflects all matches

#### Scenario: Change a filter with a selection
- **WHEN** an administrator changes search text or tag filters while media is selected
- **THEN** page one of the new result is shown and the old selection is cleared

#### Scenario: Select current page
- **WHEN** an administrator uses Select all on a media page with more matching assets on other pages
- **THEN** only that page's assets are selected, and changing pages clears the selection

### Requirement: Complete ordered editing views
Paging the top-level listings SHALL NOT split a playlist's ordered draft items or a display's assigned playlists across pages. A playlist's ready-media picker and display assignment controls SHALL continue to offer the records needed to complete their existing workflows, and Overview SHALL continue showing every registered display.

#### Scenario: Edit a long playlist
- **WHEN** a playlist has more items than the top-level list page size
- **THEN** all ordered draft items remain available together for selection, reordering, and saving

#### Scenario: Manage display assignments
- **WHEN** a display has multiple always-on, Append, and Override assignments
- **THEN** its assignment view shows the complete ordered set while the Displays listing remains paged

#### Scenario: Other list consumers
- **WHEN** an administrator opens a playlist media picker, display assignment chooser, or Overview
- **THEN** top-level listing pagination does not hide otherwise eligible media, playlists, or displays from that view
