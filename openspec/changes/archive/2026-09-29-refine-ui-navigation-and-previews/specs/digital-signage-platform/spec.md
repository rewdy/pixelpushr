# Spec Delta

## ADDED Requirements

### Requirement: Responsive playlist media picker
The playlist editor's ready-media picker SHALL fit its available width without horizontal scrolling while retaining the asset thumbnail, readable name, kind, and Add action. An asset name that cannot fit SHALL be visually truncated, and its full name SHALL remain available as a native tooltip and accessible text.

#### Scenario: Long unbroken media name
- **WHEN** a ready asset has a long name without spaces and the picker is narrow
- **THEN** the picker has no horizontal scrollbar, the name is ellipsized, its full value is available on hover, and the Add action remains visible and usable

#### Scenario: Desktop and narrow layouts
- **WHEN** the picker appears beside the playlist draft on desktop or in the narrow-screen drawer
- **THEN** its media rows remain inside the available width without forcing the page or picker to scroll sideways

### Requirement: Minimal compact-preview progress dial
The compact playback preview SHALL continue showing visual progress toward the next item in both playlist draft previews and Overview simulations, using a small dial without visible percentage text. The absence of a known duration SHALL NOT display a misleading numeric percentage.

#### Scenario: Timed slide progress
- **WHEN** an image or repeat-for-duration video advances in a compact preview
- **THEN** its small dial updates as time elapses without showing percentage text and playback advances on the existing schedule

#### Scenario: Play-once video with unknown remaining time
- **WHEN** a compact preview cannot determine a play-once video's remaining duration
- **THEN** the dial does not show a fabricated percentage and the video still advances when it ends

### Requirement: Direct return from detail pages
Playlist and display detail pages SHALL each provide a consistently placed, keyboard-accessible link back to their respective listing. The destination SHALL be stable even when the detail page was opened directly or from another page.

#### Scenario: Return from playlist editor
- **WHEN** an administrator activates the Back to Playlists link on a playlist detail page
- **THEN** the Playlists listing opens

#### Scenario: Return from display details
- **WHEN** an administrator activates the Back to Displays link on a display detail page
- **THEN** the Displays listing opens

### Requirement: Route-specific browser titles
Every routable administration, authentication, public player, and not-found view SHALL set a meaningful browser title with a consistent application suffix. Titles SHALL update when client-side navigation changes the route; a playlist or display detail title SHALL use its loaded name when available and a generic route title while loading or unavailable.

#### Scenario: Navigate between console pages
- **WHEN** an administrator navigates between Overview, Media, Playlists, Displays, People, and Settings without a full reload
- **THEN** the browser title reflects the current page rather than retaining the previous title

#### Scenario: Load a detail record
- **WHEN** a playlist or display detail page loads or refetches its record
- **THEN** the browser title reflects the current name and does not leave a stale detail title on another route

#### Scenario: Public, auth, and unknown routes
- **WHEN** the user opens a player, sign-in, registration, confirmation, setup, invitation, or unknown route
- **THEN** the browser title identifies that view without exposing a player token or invitation token
