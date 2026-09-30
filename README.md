# pixelpushr

Open-source digital signage with an administrator console and a public browser player. The production build is under `apps/`; the approved static visual study remains under `prototype/`.

## Local development

Requires Bun 1.3+ and Docker for PostgreSQL, Mailpit, and [Floci](https://github.com/floci-io/floci) (local AWS S3 emulation). For app development, run `bun install`, `docker compose up -d`, copy `apps/api/.env.example` to `apps/api/.env`, then run `bun run --filter '@pixelpushr/api' db:migrate` and `bun run --filter '@pixelpushr/api' storage:init`. Start the applications with `bun run dev`. The admin/player SPA is at `http://127.0.0.1:5173`; the Hono API health endpoint is at `http://127.0.0.1:3000/health`; captured invitation email is at `http://127.0.0.1:8025`. Use `bun run dev:web` and `bun run dev:api` to start the apps separately. For development without Floci, set `MEDIA_STORAGE=local` and `LOCAL_MEDIA_DIR=../../.local-media`.

## Full local check

From the repository root, install dependencies and Playwright Chromium once, then start the local services and initialize the media bucket:

```sh
bun install
bunx playwright install chromium
docker compose up -d
bun run --filter '@pixelpushr/api' storage:init
```

Run every check explicitly:

```sh
bun run check
bun run typecheck
bun run build
bun run test:unit
bun run test:integration
bun run test:browser
```

`check`, `typecheck`, `build`, and unit tests do not need Docker. Integration and browser tests use PostgreSQL and Floci; the browser flow also uses Mailpit. Test defaults are defined in `tests/config.ts` and match `compose.yaml`, so no environment variables or running app servers are required. Integration and browser tests create and migrate disposable databases; Playwright starts the web server and the real-flow test starts its own API. Stop any existing `bun run dev:web` or `bun run dev` process before browser tests so Playwright can use port 5173 with its test API proxy. Run `storage:init` after creating or resetting the Floci volume. To target different test services, override `TEST_DATABASE_ADMIN_URL` and/or `TEST_S3_ENDPOINT`. Use the explicit test scripts rather than `bun test`, which does not run Playwright correctly. The player route is `/player/:token` and needs no admin login.

## Operations and AWS deployment

See [docs/operations.md](docs/operations.md) for the browser-window MVP walkthrough, schedule and override behavior, media management and cleanup, caching limits, and the Terraform deployment sequence. Terraform lives in `tf/` and uses the reusable `tf/modules/platform/` module with region and environment inputs. Deployed API settings, including the RDS connection, S3 bucket, media URL, Cognito pool, and site URL, are supplied by the module's Lambda environment; the test-only local defaults are never used for deployment. No AWS infrastructure is created by the local development commands.

For contributors: [architecture and product decisions](docs/architecture.md), [approved UI direction](docs/design-system.md), and [TypeScript conventions](docs/conventions.md). The latest archived [UI navigation and previews change](openspec/changes/archive/2026-09-29-refine-ui-navigation-and-previews/tasks.md) records the completed refinement; the active [platform change](openspec/changes/build-digital-signage-platform/tasks.md) still tracks live AWS verification.
