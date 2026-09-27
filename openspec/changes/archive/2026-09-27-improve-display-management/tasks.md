# Tasks

## 1. Unified assignment flow

- [x] 1.1 Replace the three creation forms with one Mantine Add playlist drawer that conditionally reveals always-on, scheduled Append, and scheduled Override fields; verify each mode shows only its relevant inputs in component/browser tests.
- [x] 1.2 Wire each mode to its existing assignment API, preserve always-on ordering, and surface missing or invalid time-window errors; verify creation and rejection paths in browser tests against a clean local database.
- [x] 1.3 Present all existing assignments with mode, timing, and removal controls on the display page; verify mixed-mode assignments can be inspected and removed without changing other assignments.
- [x] 1.4 Update the display-management guidance in `docs/operations.md` and verify its steps match the new drawer and mode labels.

## 2. Overview simulations and navigation

- [x] 2.1 Reuse the compact preview from `improve-playlist-editor` to render a simulated queue for each display from its public manifest; verify populated, empty, and failed-manifest cards in component tests without sending heartbeat requests.
- [x] 2.2 Add bounded manifest refresh and transition-boundary handling for active/expiring overrides, with visibility-aware playback and timer cleanup; verify an Overview card changes at override boundaries in a browser test while device health remains unchanged.
- [x] 2.3 Label previews as simulations, show actual last-seen/health separately, provide a manage-display link, and remove dead Schedules/Overrides sidebar entries; verify navigation and responsive cards in browser tests.
- [x] 2.4 Document the simulation-versus-device distinction in `docs/operations.md` and verify the text reflects the implemented refresh and health behavior.

## 3. Integration checks

- [x] 3.1 Run `bun run check`, `bun run typecheck`, `bun run test:unit`, `bun run test:browser`, and `bun run build`; verify the suites pass with local services running and no live AWS deployment.
