# Tasks

## 1. Prototype foundation

- [x] 1.1 Create the static React/Vite prototype workspace with Bun and verify it starts from a documented command without an API or database.
- [x] 1.2 Add Mantine, Manrope, Space Mono, and the initial theme tokens; verify system light/dark preference changes the rendered scheme without a theme toggle.
- [x] 1.3 Add fixture models and local navigation with Wouter; verify every prototype route is reachable through the shell and direct navigation.

## 2. Admin shell and shared patterns

- [x] 2.1 Build the screened, vertically centered side navigation and desktop shell; verify the active route, organization context, user context, and content area are visually distinct.
- [x] 2.2 Build shared page headers, stat cards, tables, filters, status pills, empty states, and modal/drawer patterns using Mantine; verify custom CSS is limited to cases Mantine cannot express.
- [x] 2.3 Add responsive shell behavior for smaller widths; verify navigation, tables, forms, and content cards remain usable without horizontal overflow.

## 3. Core workflow screens

- [x] 3.1 Build sign-in and first-run setup mock screens; verify the auth entry points match the console visual language without implementing authentication.
- [x] 3.2 Build media library and upload-state mock screens; verify ready, processing, failed, empty, and selected-media states are represented.
- [x] 3.3 Build playlist list and editor mock screens; verify ordered media items, duration controls, video modes, and save/publish affordances are visually clear.
- [x] 3.4 Build display list/detail screens; verify player URL, status, last-seen state, assigned playlists, and display actions have a clear hierarchy.
- [x] 3.5 Build scheduling and override screens; verify always, scheduled, and override concepts are visually distinguishable and exact start/end times are easy to inspect.
- [x] 3.6 Build administrator/invitation settings; verify owner/admin roles and pending invitation states are understandable.

## 4. Player prototype and review handoff

- [x] 4.1 Build the minimal full-viewport player prototype with fixture content; verify it has no visible controls and presents loading, empty, playing, and offline states.
- [x] 4.2 Add representative desktop and narrow viewport fixtures/screenshots; verify the admin shell and player behave as designed at the documented review sizes.
- [x] 4.3 Document final theme tokens, typography, spacing, shell measurements, responsive breakpoints, and approved component patterns; verify production implementation can use the document as a UI reference.
- [x] 4.4 Conduct visual review and record revisions or approval criteria; verify the prototype is ready to guide the main platform implementation.
