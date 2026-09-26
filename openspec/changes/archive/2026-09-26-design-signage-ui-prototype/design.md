# Design

## Context

The platform design calls for React/Vite SPAs, Mantine-first styling, a clean modern admin console, and a minimal browser player. The repository is otherwise greenfield, so the prototype should establish the visual foundation without inheriting production architecture prematurely.

## Goals / Non-Goals

**Goals:**

- Validate the overall visual direction before production implementation.
- Use the intended Mantine theme and typography so the prototype is representative of the final UI.
- Make the major admin workflows understandable with fixture data and navigable screens.
- Validate desktop-first layout and responsive collapse behavior.
- Provide a stable visual reference that production work can reproduce.

**Non-Goals:**

- No real API, authentication, Cognito integration, database, uploads, or persistence.
- No real scheduling or playback engine.
- No final production copy, analytics, or accessibility certification beyond sensible semantic markup and keyboard navigation.
- No player controls in the normal viewing experience.

## Decisions

### Prototype implementation

Use a small React/Vite application with fixture data and local navigation. Use Mantine components and theme tokens wherever possible, with CSS Modules only for visual treatments Mantine cannot express cleanly. Keep the prototype independent from the production API so visual iteration remains fast.

### Theme

- Primary blue: `#506DFF`.
- Positive/operational green: choose a compatible green during the prototype and record the final token.
- Main font: Manrope.
- Accent font: Space Mono for pills, eyebrows, labels, and targeted metadata.
- Support Mantine light and dark schemes from the beginning, selected from the system preference.
- Do not expose a theme toggle in the prototype's first pass.

### Admin shell

Use a persistent desktop side navigation with a screened-out background that is visually separate from the main content area. Center primary navigation groups vertically rather than pinning the menu to the top. Use a medium information density: generous enough to feel calm, compact enough to manage tables and playlists efficiently.

Prototype routes/screens:

- Sign-in and first-run setup
- Dashboard/overview
- Media library
- Playlist editor
- Displays list and display detail
- Schedule management
- Override activation/editing
- Administrator/invitation settings

### Player

The player is a full-viewport, control-free presentation surface. It should demonstrate image/video placeholders, loading, empty, and offline states without adding visible navigation chrome. A hidden or keyboard-triggered diagnostic state may be represented for later implementation, but it must not affect the normal display view.

### Responsive behavior

Desktop is the primary review size. At smaller widths, the side navigation should collapse into a compact navigation treatment and tables/cards should remain usable without horizontal layout failure. The player should remain full-viewport at all supported sizes.

### Review process

The prototype should be runnable locally with a single documented Bun command and reviewable by route or navigation. The final review should record approved theme tokens, shell measurements, responsive breakpoints, and any screens requiring revision before production implementation.

## Risks / Trade-offs

- [Prototype diverges from production Mantine usage] -> Use the intended Mantine components and theme APIs directly rather than drawing the UI with unrelated raw HTML.
- [Fixture flows hide real data complexity] -> Focus review on hierarchy, states, density, and interaction affordances; leave data behavior to the platform change.
- [The shell works only at desktop width] -> Include explicit narrow-width review checkpoints for navigation, tables, forms, and the player.
- [Visual choices become implicit] -> Record final tokens and approved patterns in the prototype documentation before handing off to production implementation.

## Migration Plan

There is no existing UI to migrate. After visual approval, production screens in the main platform change should reproduce the approved theme and layout patterns. The prototype may remain as a reference or be removed once the production UI has parity.
