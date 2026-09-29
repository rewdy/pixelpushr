# UI direction

The [static prototype](../prototype/README.md) was used to approve the look before connecting the production screens. Continue from its source and the production [Mantine theme](../apps/web/src/config/theme.ts), rather than from the discarded review screenshots.

- Clean, modern, moderately dense desktop console with responsive collapse for smaller screens.
- No persistent white header. Navigation lives in a vertically centered, visually shaded sidebar; the main column uses the base body background (white in light mode).
- Neutral grays, not blue-tinted grays. Brand blue `#506DFF`; positive/operational green `#43B991`. Use semantic Mantine `brand`, `signal`, and `gray` theme colors.
- Manrope for primary UI text; Space Mono only for pills, eyebrows, labels, and select accents.
- Small, consistent default radius (`sm`, 4 px). Tables and panels should not feel pill-shaped.
- Follow the system light/dark preference. A visual toggle is intentionally absent for now.
- Use `react-icons/lu` for ordinary UI icons; the logo mark is `IoPlay` from `react-icons/io5`.
- Playlist and display detail pages place a lightweight, linked `Back to Playlists` or `Back to Displays` control above the eyebrow and heading. It always returns to the corresponding listing, including after direct entry; it does not use browser history.
- Each routable view owns one React-managed browser title in the form `View | pixelpushr`. Static routes set it in the matched route; playlist and display details use their loaded names, with generic fallbacks while loading. Auth, gate, player, and not-found states also have titles. Never include invite/player tokens in titles or add a competing static title in `index.html`.
- Mantine components, layout props, and theme tokens first. Use plain CSS Modules only where Mantine cannot express the behavior; avoid ad-hoc global CSS, SCSS, or a second styling system.
- The player fills the viewport, starts automatically, and shows no visible controls. Keyboard `d` exposes diagnostics for setup and troubleshooting.

The production UI is under `apps/web/src/components/`; the theme is the source of truth for color, type, and radius. The prototype uses fixture data and may illustrate screens that are not identical to the shipped console, so reconcile new visual decisions in the theme and production components.
