# TypeScript and implementation conventions

These conventions adapt the original frontend preference note to this monorepo. They guide new work; existing files can be improved as they are touched.

## TypeScript and modules

- Prefer `type` over `interface` unless an interface is technically required. Avoid TypeScript `enum`; use a `const` object and derived type when needed.
- Give exported functions and components a brief TSDoc description of behavior, without repeating their type signatures.
- Use named exports and arrow functions for application code, except where a tool requires a default export or a specific handler shape.
- Import concrete modules directly. Do not create `index.ts` barrels or `tsconfig` path aliases. Relative imports are the default _within_ a workspace package; explicit package-name imports such as `@pixelpushr/contracts/manifest` are welcome _across_ workspace packages.
- Keep local types next to their owner. Move truly shared frontend models to `src/models/*.models.ts` (types only); use `packages/contracts` for deliberate web/API contracts. Keep database row types inside the API.
- Preserve strict TypeScript settings. Validate data at HTTP and environment boundaries; do not use `any` to bypass uncertainty.

## Frontend

- Use functional React components, Wouter for routes, and TanStack Query for server state. Put linkable UI state in the URL where appropriate. Keep the catch-all Wouter route last in `<Switch>`.
- Start with component state, URL state, and query state. Add Jotai only when client-only state warrants it; if atom families are introduced, import `atomFamily` from `jotai-family`.
- Keep hooks in `src/hooks/`, pure helpers in `src/helpers/`, and configuration in `src/config/`. Component-specific types may stay beside their component; broadly shared types belong in `src/models/` or `packages/contracts`.
- Follow [design-system.md](design-system.md): Mantine and its theme first, then plain CSS Modules when necessary. Use Mantine CSS variables in custom rules.

## API and data

- Keep Hono handlers focused on authentication, parsing, and response assembly. Validate request bodies with Zod and return the shared `ApiError` envelope for expected failures.
- Put schedule/playback calculations in pure functions where practical, and test boundary times separately from database routes. Drizzle owns persistence; SQL migrations are committed and run explicitly.
- Read environment configuration through the typed parser. Keep local and AWS auth, email, and storage concerns behind adapters. Never log passwords, tokens, presigned URLs, or raw request bodies.
- Changes to manifest shape or scheduling semantics need unit, integration, and player-browser coverage, particularly for offline and override behavior.
