# Pixelpushr UI prototype

Static visual prototype for the digital signage admin console and browser player. It uses fixture data only; there is no API, authentication, database, or persistence.

## Run locally

```bash
bun install
bun run dev
```

Build verification:

```bash
bun run build
```

## Review routes

- `/` — dashboard and admin shell
- `/sign-in` — custom admin sign-in direction
- `/setup` — first-run setup direction
- `/media` — media library and processing states
- `/playlists` — playlist cards and playback modes
- `/displays` — display health and registration direction
- `/schedules` — additive schedule direction
- `/overrides` — exact-time override direction
- `/settings` — administrator and invitation management
- `/player` — minimal full-viewport player

## Visual tokens

- Brand blue: `#506DFF`
- Neutral UI gray: Mantine-style neutral scale from `#F8F9FA` through `#212529`
- Positive/operational green: Mantine `signal` palette, centered on `#43B991`
- Main typeface: Manrope
- Accent typeface: Space Mono
- Icon set: Lucide via `react-icons/lu`
- Color scheme: Mantine system preference (`defaultColorScheme="auto"`)
- Primary desktop review size: `1280 x 720`
- Narrow review size: `390 x 844`

The admin shell uses a screened side navigation with vertically centered groups, no persistent header, medium information density, and Mantine-first layout. On small screens, a floating menu button opens the same navigation. The player has no visible controls. Press `1` through `4` while focused on `/player` to preview playing, loading, empty, and offline states.
