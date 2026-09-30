# Agent guide for pixelpushr

Read [README.md](README.md) for setup, then [docs/architecture.md](docs/architecture.md), [docs/conventions.md](docs/conventions.md), and [docs/design-system.md](docs/design-system.md) for the decisions behind the code. [docs/operations.md](docs/operations.md) is the operator walkthrough. The archived [UI navigation and previews change](openspec/changes/archive/2026-09-29-refine-ui-navigation-and-previews/tasks.md) records the latest completed refinement; the active [platform deployment task](openspec/changes/build-digital-signage-platform/tasks.md) remains an implementation checklist. Do not mark a task complete without verification.

## Repository map

- `apps/web`: React/Vite admin console and public `/player/:token` route. Wouter, TanStack Query, Mantine. The production theme is `apps/web/src/config/theme.ts`.
- `apps/api`: Hono routes, local server and Lambda handlers, Drizzle/PostgreSQL schema and migrations, auth/email/storage adapters. Schedule resolution is server-side in `src/displays/`.
- `packages/contracts`: intentional shared web/API types. Import this workspace package by name; do not add `tsconfig` path aliases or barrel files.
- `prototype/`: approved fixture-only UI study. It is not the production app; generated review screenshots were removed after sign-off.
- `tf/`: AWS root and reusable `modules/platform/`; `compose.yaml`: local Postgres, Mailpit, and Floci.
- `tests/unit`, `tests/integration`, `tests/browser`: playback boundaries need coverage at all three levels where relevant.

## Working locally

1. `bun install` and `docker compose up -d`.
2. Copy `apps/api/.env.example` to `apps/api/.env` and use local-only values.
3. `bun run --filter '@pixelpushr/api' db:migrate` and `bun run --filter '@pixelpushr/api' storage:init`.
4. `bun run dev`; web is `http://127.0.0.1:5173`, API health is `http://127.0.0.1:3000/health`, Mailpit is `http://127.0.0.1:8025`.

Use `bun run check`, `bun run typecheck`, `bun run build`, and `bun run test:unit` for quick verification. With Docker services running and `storage:init` completed, `bun run test:integration` and `bun run test:browser` run the full suites without manually setting environment variables. Local test defaults in `tests/config.ts` match Compose; PostgreSQL and Floci endpoints can be overridden for nonstandard test environments. Playwright supplies the API proxy target, starts the web server, and uses Chromium. Tests create isolated databases. Do not run `bun test` indiscriminately over browser specs. The full command sequence is in [README.md](README.md#full-local-check).

## Implementation guardrails

- Preserve the approved UI direction: headerless admin shell, shaded sidebar, neutral grays, Manrope/Space Mono, small radii, system light/dark, Mantine-first styling. Keep the player visually control-free.
- Keep admin APIs authenticated; the public player is intentionally open for this MVP. Do not add private-content assumptions or expose admin data in player manifests.
- The API resolves additive schedules in the organization timezone. Normal queue updates wait for rollover; override start/end and priority changes interrupt immediately. Retain server-time compensation and offline override expiry behavior when changing manifests or the player.
- Same-kind media replacements preserve asset and playlist identities. In-use deletion needs an impact confirmation; old media URLs remain for a seven-day handoff and are removed by the scheduled/local media cleanup job. Keep replacement candidates out of public manifests and never eagerly delete referenced objects.
- Validate request and environment inputs; use shared error conventions. Add a migration for schema changes and test a clean database. Do not log secrets, raw tokens, or presigned URLs.
- AWS Terraform has passed local validation but has **not** been applied or smoke-tested. OpenSpec task 7.2 remains unchecked. Never run `terraform apply`, upload to AWS, or mark 7.2 complete without the operator's deployment details and explicit authorization. See [operations.md](docs/operations.md#aws-deployment) for prerequisites and steps.
- Keep generated screenshots, build outputs, local media, `.env`, Terraform state, and Lambda zip artifacts out of commits. Review `git status` before staging; preserve unrelated user changes.
