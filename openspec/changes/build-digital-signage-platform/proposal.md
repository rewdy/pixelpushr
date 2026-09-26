# Proposal

## Why

Small organizations need a simple way to manage recurring digital signage across multiple screens without relying on a proprietary signage service. This change establishes an open-source, AWS-hosted platform with an authenticated admin console and a browser-based public player that can run on a Raspberry Pi, mini PC, or any supported browser.

## What Changes

- Add first-run organization setup and admin-only authentication.
- Allow the first owner to invite additional administrators.
- Add media management for images and videos.
- Add playlists with ordered media items and per-item playback behavior.
- Add display registration and public, tokenized player URLs with no player login.
- Add display playback for one or more always-active playlists.
- Add manifest polling, media caching, offline continuation, and display health reporting.
- Add additive scheduled playlists that join the active playback queue during configured time windows.
- Add exact-time override playlists that replace all normal playback while active.
- Define three delivery milestones: always-playlist assignment, scheduled playlists, and overrides.

## Capabilities

### New Capabilities

- `digital-signage-platform`: Organization administration, media, playlists, displays, browser playback, scheduling, and overrides.

### Modified Capabilities

None.

## Impact

- New admin web application, public player application, and backend API.
- New PostgreSQL-backed domain model for organizations, users, invitations, media, playlists, displays, assignments, and schedules.
- Object storage and CDN integration for media delivery.
- Authentication and invitation dependencies for administrators.
- AWS deployment and operational configuration.
- Browser playback behavior, including cache management, manifest refresh, exact-time transitions, and offline fallback.
