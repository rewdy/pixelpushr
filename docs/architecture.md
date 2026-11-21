# Architecture and product decisions

The [OpenSpec change](../openspec/changes/build-digital-signage-platform/design.md) records the full MVP requirements and trade-offs. This page orients contributors to the implementation; [operations.md](operations.md) covers running and deploying it.

## Scope

Pixelpushr is a single-organization, multi-admin, multi-display signage platform. In production, the account with the configured, Cognito-verified email can create the organization and become its owner. Later administrators join by invitation. Admin endpoints require a session. A display player is a public URL with a random display token and needs no login. Do not use the MVP for sensitive or private media. Multi-tenancy, player access controls, real-time push, device synchronization, and transcoding are not included.

The three playback milestones are deliberately separate: (1) assign one or more always-on playlists; (2) add one or more scheduled playlists to the same cycling queue; (3) let an active override playlist play _alone_, interrupting the current item at its exact start and end. See [operations.md](operations.md#scheduling-and-override-semantics) for configuration and boundary details.

## Stack and boundaries

| Area             | Choice                                                                              |
| ---------------- | ----------------------------------------------------------------------------------- |
| Repository       | Bun workspaces; TypeScript; shared contracts package                                |
| Admin and player | React + Vite static SPA; Wouter routing; TanStack Query for server state            |
| UI               | Mantine theme/components; react-icons Lucide set, with `IoPlay` as the logo mark    |
| API              | Hono, local Node server and AWS Lambda adapter                                      |
| Data             | PostgreSQL/RDS, Drizzle schema and SQL migrations                                   |
| Identity         | App-owned login screens; local auth for development; Cognito in AWS                 |
| Media            | S3-compatible storage; direct browser upload via presigned URL; CloudFront delivery |
| Infrastructure   | Docker Compose for local Postgres, Mailpit and Floci; Terraform under `tf/` for AWS |

`apps/web` contains both `/admin`-style console pages and the public `/player/:token` route in one static build. Browser calls use `/api/*`; Vite proxies this path locally, and CloudFront routes it to API Gateway in AWS. `apps/api` owns validation, authentication, persistence, schedule resolution, and manifest generation. `packages/contracts` holds intentionally shared types, imported by package name rather than a `tsconfig` alias. The `prototype/` site is the approved, fixture-only visual study, not a second production app.

Append and Override assignments share a schedule-rule model: one-time, daily, weekly (selected weekdays and interval), or monthly (numbered date or ordinal weekday and interval), with an optional inclusive last-start date. Existing weekly rules are migrated into the same typed model. `rrule` enumerates floating calendar dates, while Temporal converts each occurrence to an instant in the organization's current IANA timezone; the saved entry timezone anchors the original local window. Missing numbered dates are skipped, not moved to month-end. An old absolute recurrence cap remains honored. Same-assignment overlapping windows are coalesced. The authenticated settings-only PATCH retains playlist/mode and saved timezone and rejects stale assignment versions.

The API evaluates Append activity and preview with this same recurrence adapter. For Overrides, it sends absolute active windows and starts in a rolling 14-day lookahead, retaining full ends even past the horizon; higher priority wins and equal priorities use assignment ID. Enumeration is bounded, so the player does not synthesize future occurrences offline. Its 15-second polling renews the horizon. Cached known starts/ends remain authoritative during an outage, including expiration of a long active window; distant browser timers re-arm in bounded chunks against the server-clock estimate. Once a disconnected player passes its fetched horizon, later recurring Overrides are not guaranteed until a successful refresh.

Each uploaded asset has an object-storage key and a `pending`, `ready`, or `failed` state. A playlist is an ordered list of ready assets with per-item image duration or video mode (`once` or `repeat` for a duration). A display has ordered `always`, `scheduled`, and `override` assignments; schedule rules store UTC instants plus the timezone used when entered. The API composes a display-scoped manifest with playable URLs, a deterministic version, server time, normal queue, active queue, and override transition windows. The player never evaluates recurrence rules; it only follows the resolved manifest.

Media replacement stages and validates a same-kind upload, copies it to a separately validated server-only key, then atomically changes the existing asset's object key; playlist item IDs and timing remain stable. Deletion reviews the exact saved uses and removes confirmed items transactionally. Tags are organization-scoped library metadata, not part of public manifests. Replaced/deleted object keys are retained for a seven-day player handoff, then a scheduled cleanup removes them. See [operations.md](operations.md#media-and-offline-behavior) for the operator-facing limits.

The player polls for changes and sends heartbeats. Normal queue updates wait for queue rollover. At ordinary item boundaries, a two-layer visual transition crossfades during the outgoing item's final 500 ms without changing its configured cadence; this also covers queue loops and pending normal updates. Play-once videos use their known remaining time, while unavailable timing or incoming media falls back to a direct handoff. Override activation, expiration, and winner changes take priority over any fade and cut immediately using a server-clock estimate. It retains the last manifest in local storage and prefetches playable media into Cache Storage; both visual layers use the same cached-media fallback. Offline playback is best-effort because browsers may evict cached data. The public player token gates access to a single display's manifest, but is **not** an MVP privacy or security boundary.

## Deployment state and limitations

The local application, tests, Lambda package, and Terraform module have been built and validated. A live AWS `terraform apply`, migration, and CloudFront smoke test have **not** been performed; [task 7.2](../openspec/changes/build-digital-signage-platform/tasks.md) remains open until that happens. Deployment requires the operator's AWS account, domain/Route 53 zone, ACM certificate, SES sender, and authorization to create billable resources. The Raspberry Pi Zero W is a prospective kiosk target, not a tested reference device; desktop Chromium is the tested player browser.
