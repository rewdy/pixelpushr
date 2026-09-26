# Architecture and product decisions

The [OpenSpec change](../openspec/changes/build-digital-signage-platform/design.md) records the full MVP requirements and trade-offs. This page orients contributors to the implementation; [operations.md](operations.md) covers running and deploying it.

## Scope

Pixelpushr is a single-organization, multi-admin, multi-display signage platform. The first account claims the organization and becomes its owner; later administrators join by invitation. Admin endpoints require a session. A display player is a public URL with a random display token and needs no login. Do not use the MVP for sensitive or private media. Multi-tenancy, player access controls, real-time push, device synchronization, and transcoding are not included.

The three playback milestones are deliberately separate: (1) assign one or more always-on playlists; (2) add one or more scheduled playlists to the same cycling queue; (3) let an active override playlist play *alone*, interrupting the current item at its exact start and end. See [operations.md](operations.md#scheduling-and-override-semantics) for configuration and boundary details.

## Stack and boundaries

| Area | Choice |
| --- | --- |
| Repository | Bun workspaces; TypeScript; shared contracts package |
| Admin and player | React + Vite static SPA; Wouter routing; TanStack Query for server state |
| UI | Mantine theme/components; react-icons Lucide set, with `IoPlay` as the logo mark |
| API | Hono, local Node server and AWS Lambda adapter |
| Data | PostgreSQL/RDS, Drizzle schema and SQL migrations |
| Identity | App-owned login screens; local auth for development; Cognito in AWS |
| Media | S3-compatible storage; direct browser upload via presigned URL; CloudFront delivery |
| Infrastructure | Docker Compose for local Postgres, Mailpit and Floci; Terraform under `tf/` for AWS |

`apps/web` contains both `/admin`-style console pages and the public `/player/:token` route in one static build. Browser calls use `/api/*`; Vite proxies this path locally, and CloudFront routes it to API Gateway in AWS. `apps/api` owns validation, authentication, persistence, schedule resolution, and manifest generation. `packages/contracts` holds intentionally shared types, imported by package name rather than a `tsconfig` alias. The `prototype/` site is the approved, fixture-only visual study, not a second production app.

Each uploaded asset has an object-storage key and a `pending`, `ready`, or `failed` state. A playlist is an ordered list of ready assets with per-item image duration or video mode (`once` or `repeat` for a duration). A display has ordered `always`, `scheduled`, and `override` assignments; schedule rules store UTC instants plus the timezone used when entered. The API composes a display-scoped manifest with playable URLs, a deterministic version, server time, normal queue, active queue, and override transition windows. The player never evaluates recurrence rules; it only follows the resolved manifest.

The player polls for changes and sends heartbeats. Normal queue updates wait for queue rollover; override transitions interrupt immediately using a server-clock estimate. It retains the last manifest in local storage and prefetches playable media into Cache Storage. Offline playback is best-effort because browsers may evict cached data. The public player token gates access to a single display's manifest, but is **not** an MVP privacy or security boundary.

## Deployment state and limitations

The local application, tests, Lambda package, and Terraform module have been built and validated. A live AWS `terraform apply`, migration, and CloudFront smoke test have **not** been performed; [task 7.2](../openspec/changes/build-digital-signage-platform/tasks.md) remains open until that happens. Deployment requires the operator's AWS account, domain/Route 53 zone, ACM certificate, SES sender, and authorization to create billable resources. The Raspberry Pi Zero W is a prospective kiosk target, not a tested reference device; desktop Chromium is the tested player browser.
