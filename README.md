# pixelpushr

Open-source digital signage with an administrator console and a public browser player. The production build is under `apps/`; the approved static visual study remains under `prototype/`.

## Local development

Requires Bun 1.3+ and Docker for PostgreSQL, Mailpit, and [Floci](https://github.com/floci-io/floci) (local AWS S3 emulation). Run `bun install`, `docker compose up -d`, then `DATABASE_URL=postgres://pixelpushr:pixelpushr@127.0.0.1:54329/pixelpushr bun run --filter '@pixelpushr/api' db:migrate` and `bun run --filter '@pixelpushr/api' storage:init`. Copy `apps/api/.env.example` to `apps/api/.env`, then start the applications with `bun run dev`. The admin/player SPA is at `http://127.0.0.1:5173`; the Hono API health endpoint is at `http://127.0.0.1:3000/health`; captured invitation email is at `http://127.0.0.1:8025`. Use `bun run dev:web` and `bun run dev:api` to start the apps separately. For development without Floci, set `MEDIA_STORAGE=local` and `LOCAL_MEDIA_DIR=../../.local-media`.

Run `bun run typecheck`, `bun run build`, `bun run test:unit`, `bun run test:integration`, and `bun run test:browser` for verification. The player route is `/player/:token` and needs no admin login.

## Operations and AWS deployment

See [docs/operations.md](docs/operations.md) for the browser-window MVP walkthrough, schedule and override behavior, caching limits, media assumptions, and the Terraform deployment sequence. Terraform lives in `tf/` and uses the reusable `tf/modules/platform/` module with region and environment inputs. No AWS infrastructure is created by the local development commands.

For contributors: [architecture and product decisions](docs/architecture.md), [approved UI direction](docs/design-system.md), and [TypeScript conventions](docs/conventions.md). The [OpenSpec change](openspec/changes/build-digital-signage-platform/tasks.md) tracks implementation and the remaining live AWS verification.
