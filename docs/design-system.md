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
- The playlist editor's ready-media picker stays within its panel or narrow-screen drawer. Long names truncate visually, retain their full native tooltip, and never push the thumbnail or Add action out of view.
- Shared compact previews on the playlist editor and Overview use a small progress dial without visible percentage text. Unknown play-once video duration stays nonnumeric; the preview still advances when playback ends.
- Each routable view owns one React-managed browser title in the form `View | pixelpushr`. Static routes set it in the matched route; playlist and display details use their loaded names, with generic fallbacks while loading. Auth, gate, player, and not-found states also have titles. Never include invite/player tokens in titles or add a competing static title in `index.html`.
- Mantine components, layout props, and theme tokens first. Use plain CSS Modules only where Mantine cannot express the behavior; avoid ad-hoc global CSS, SCSS, or a second styling system.
- The player fills the viewport, starts automatically, and shows no visible controls. Keyboard `d` exposes diagnostics for setup and troubleshooting.
- On Media, the asset name and row Edit action open the same right-side drawer over the library. The drawer groups name, tags, and a ready-only same-kind replacement control; it uses the available width on narrow screens. The row keeps Delete as a separate action with its impact confirmation.
- Media, Playlists, and Displays use the same compact paging control below their top-level lists: a result range and Previous/Page/Next controls. The groups wrap on narrow screens. The current page is in the URL, so refresh and direct links preserve it; an out-of-range page returns to the last available page. Show loading, empty, and error states separately from the result count.
- Media keeps its search text and selected tags in the URL. Filtering runs before the result count and returns to page one. Select all visible applies only to the current page; changing the page or filters clears the bulk selection and its count before another bulk action.
- Paging applies only to the top-level library and index lists. Playlist draft items and the ready-media picker, display assignments and their playlist chooser, and Overview continue to use complete data sources so ordered editing and playback context include records beyond the listing page size.

The production UI is under `apps/web/src/components/`; the theme is the source of truth for color, type, and radius. The prototype uses fixture data and may illustrate screens that are not identical to the shipped console, so reconcile new visual decisions in the theme and production components.
