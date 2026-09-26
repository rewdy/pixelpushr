# Tasks

## 1. Application and persistence foundation

- [ ] 1.1 Establish the web, API, and shared-domain project structure and verify the application starts locally with documented development commands.
- [ ] 1.2 Add PostgreSQL configuration, migrations, and repositories for organizations, users, memberships, invitations, media assets, playlists, displays, assignments, and schedule rules; verify migrations apply to a clean database.
- [ ] 1.3 Define shared validation and API error conventions; verify invalid payloads return stable client-readable errors.
- [ ] 1.4 Add a basic automated test setup and verify unit, integration, and browser/player test commands are documented and runnable.

## 2. Administrator access and organization setup

- [ ] 2.1 Implement first-run setup that creates the single organization and owner; verify a second setup attempt is rejected.
- [ ] 2.2 Implement authenticated admin sessions and protected admin routes/API handlers; verify unauthenticated requests cannot read or mutate organization data.
- [ ] 2.3 Implement owner invitations and acceptance, including pending, accepted, expired, and duplicate-invitation states; verify an accepted invite creates an administrator membership.
- [ ] 2.4 Build the initial admin shell for organization, user, and invitation management; verify the owner can invite an admin through the UI.

## 3. Media and playlist management

- [ ] 3.1 Add object-storage upload and media metadata persistence with pending, ready, and failed processing states; verify successful and rejected uploads produce the expected state transitions.
- [ ] 3.2 Add supported image/video validation, thumbnails or preview metadata, and configurable upload limits; verify unsupported media cannot reach a ready state.
- [ ] 3.3 Implement playlist CRUD and ordered playlist-item editing for ready assets; verify item order and playback settings survive reloads.
- [ ] 3.4 Implement image duration, video play-once, and video repeat-for-duration validation; verify invalid durations and unavailable assets cannot be published.
- [ ] 3.5 Build the media library and playlist editor views; verify an administrator can upload media and create a playable playlist end-to-end.

## 4. Milestone 1: display registration and always-playlist playback

- [ ] 4.1 Implement display registration, random player-token generation, display assignment persistence, and public player URL generation; verify each registered display has a distinct working URL.
- [ ] 4.2 Implement display-scoped manifest generation for one or more always-active playlist assignments with deterministic playlist and item ordering; verify the manifest contains the combined queue.
- [ ] 4.3 Build the public browser player that loads a manifest, plays images and videos, loops the queue, and handles empty/unavailable states; verify browser playback with a fixture manifest.
- [ ] 4.4 Add manifest polling and display heartbeat reporting; verify a player observes a playlist reassignment and the admin view shows a recent last-seen time.
- [ ] 4.5 Add browser-managed caching of the last valid manifest and playable media; verify the player continues using cached content after a simulated network failure.
- [ ] 4.6 Build display management and always-playlist assignment UI; verify an administrator can register a display, copy its public URL, assign playlists, and observe playback in a separate browser window.

## 5. Milestone 2: additive scheduling

- [ ] 5.1 Implement organization-timezone schedule evaluation for display-specific additive assignments with explicit start/end windows, recurrence support needed for weekly rotation, and deterministic sort order; verify active and inactive windows resolve correctly.
- [ ] 5.2 Extend display manifests to include all always-active and currently active additive scheduled playlists; verify overlapping additive schedules produce one ordered combined queue.
- [ ] 5.3 Apply normal manifest changes at playback boundaries without interrupting the current item; verify a schedule transition changes the next queue without restarting the current image/video.
- [ ] 5.4 Build schedule management UI for weekly and date-bounded playlist rotations; verify the documented branding-plus-weekly-campaign use case can be configured and previewed.
- [ ] 5.5 Add schedule resolution tests covering timezone boundaries, overlapping schedules, empty windows, and organization timezone changes; verify all schedule scenarios pass.

## 6. Milestone 3: exact-time overrides

- [ ] 6.1 Implement override assignments with explicit start/end timestamps and priority; verify the highest-priority active override is selected when multiple overrides overlap.
- [ ] 6.2 Add manifest server time, absolute transition timestamps, and player clock-drift compensation; verify transitions are scheduled from server-reported time.
- [ ] 6.3 Interrupt playback immediately when an override starts and ends, restoring the latest valid normal queue; verify a countdown override suppresses normal content for its complete active interval.
- [ ] 6.4 Honor a cached override end time during a network outage; verify the player exits the override and resumes cached normal playback without a refresh.
- [ ] 6.5 Add “activate now” override creation in the existing scheduling UI with a required or explicit expiration; verify saving an immediate override causes the next manifest to interrupt playback.
- [ ] 6.6 Add override unit, integration, and browser tests for exact start, exact end, priority, manual activation, and restoration; verify all override scenarios pass.

## 7. AWS deployment and operational readiness

- [ ] 7.1 Add environment configuration and adapters for PostgreSQL, object storage, authentication, and CDN media delivery; verify local development can use compatible local services or documented substitutes.
- [ ] 7.2 Add AWS deployment definitions for the web/API runtime, managed database, object storage, CDN, authentication, secrets, and logging; verify a clean environment can be provisioned from documented steps.
- [ ] 7.3 Add health checks, structured logs, and safe startup behavior for missing or invalid configuration; verify failed dependencies produce actionable diagnostics.
- [ ] 7.4 Document supported browser/media assumptions, first-run setup, admin invitation, display pairing, cache behavior, schedule semantics, and override operation; verify a new operator can follow the documentation through the browser-window MVP test.

## 8. End-to-end verification

- [ ] 8.1 Run the full automated test suite against a clean database and verify all capability scenarios pass.
- [ ] 8.2 Validate the complete three-milestone journey in a browser: create owner, invite admin, upload media, create playlists, register display, play always content, rotate scheduled content, and activate an override.
- [ ] 8.3 Verify the public player remains usable during simulated API/media outages and that admin endpoints remain authenticated; record the supported reference browser configuration.
