# Design

## Context

The repository is greenfield apart from OpenSpec configuration. The platform must support an authenticated admin console and a public browser player that can run in a normal browser window now and on a Raspberry Pi kiosk later. The MVP intentionally treats possession of a display player URL as sufficient viewing access. The implementation is a Bun-powered TypeScript monorepo with static React/Vite applications and a Hono API running on Lambda.

## Goals / Non-Goals

**Goals:**

- Keep the player simple: download a resolved manifest, cache assets, play locally, and poll for changes.
- Make the server authoritative for playlist composition and schedule resolution.
- Represent always-active, additive scheduled, and interrupting override behavior without requiring a later data-model rewrite.
- Deploy naturally on AWS using static web hosting, Lambda, RDS, S3, CloudFront, Cognito, and Terraform while keeping storage and database boundaries portable enough for open-source use.
- Make the first three milestones independently testable.
- Establish a cohesive Mantine-based visual system for the admin console and a minimal, distraction-free player.

**Non-Goals:**

- Multi-tenant administration in the MVP.
- Fine-grained administrator roles beyond owner and admin.
- Player login, private-content controls, signed media URLs, or synchronization across displays.
- Native smart-TV applications, real-time sockets, visual transitions, overlays, analytics, or content approval workflows.

## Decisions

### Separate administration from playback

The admin console and player are separate routes and security boundaries. Admin APIs require authenticated users; player APIs accept a display-specific random token and return only that display's resolved manifest. This supports the open MVP player while preventing accidental exposure of administration endpoints.

### Server-resolved manifests

The API computes the effective queue for a display:

```text
if active override exists:
    highest-priority override playlist
else:
    always-active playlists
    + active additive scheduled playlists
```

The player does not evaluate schedule rules. This keeps timezone and priority behavior consistent and allows the API to evolve independently of the player.

### Playlist assignment modes

Assignments distinguish `always`, `scheduled`, and `override` behavior. Scheduled assignments carry explicit start/end rules and ordering or priority. The same playlist can be reused in different assignments. Always and additive scheduled playlists are concatenated in deterministic order; overrides suppress the entire normal queue.

### Polling with local transition timers

The player polls manifests on a modest interval and also schedules local timers from the manifest's absolute start/end timestamps. Normal queue changes take effect at playback boundaries. Override start and end transitions interrupt immediately. The manifest includes server time so the player can compensate for local clock drift.

### Offline-first playback cache

The player stores the last valid manifest and downloaded playable assets in browser-managed storage. A refresh failure does not blank the screen. A known override expiration remains actionable offline because the player can return to the cached normal queue without a new request.

### AWS-hosted, portable service boundaries

Use RDS PostgreSQL for organization and playback metadata, S3 for media and static web assets, and CloudFront for delivery. The API is a Hono application adapted to Lambda. The admin and player are static React/Vite SPAs. Cognito provides identity management, while all authentication screens are owned by the application rather than using Cognito's hosted UI. Terraform configuration lives under `./tf`, uses reusable modules, and accepts region and environment parameters even though the initial deployment targets one environment and region. Storage, authentication, and deployment concerns should be accessed behind application interfaces so local development and future non-AWS deployments remain possible.

### TypeScript monorepo and code conventions

Use Bun workspaces in a TypeScript monorepo. React applications use functional components, named exports, arrow functions, local types, TSDoc for exported functions, and no TypeScript enums. The codebase SHALL not use `tsconfig.json` path aliases or barrel `index.ts` files; explicit workspace package imports are allowed for intentional shared packages.

Shared workspace packages may provide runtime-free models and API contracts. Database row types remain API-internal, while public request and response contracts may combine runtime validation with inferred TypeScript types. Hono route handlers remain thin; validation happens at the HTTP boundary, domain services stay independent of Hono, repositories own Drizzle access, and API errors map through a centralized typed error policy. Environment variables are read through typed configuration rather than scattered direct reads. The codebase uses strict typing and avoids unvalidated request data and `any`.

### Frontend UI system and visual direction

Use Mantine as the primary component and layout system with a project theme. Custom CSS is a last resort when Mantine props, components, and theme tokens cannot express the requirement; when needed, use plain CSS Modules and Mantine variables rather than SCSS or utility CSS. Use Wouter for routing and TanStack Query for server state. Do not add Jotai unless client-only state complexity demonstrates a need beyond component state, URL state, and query state.

The visual direction is clean and modern with medium information density. The primary brand color is `#506DFF`, complemented by a compatible green for positive state and operational status. Manrope is the main font; Space Mono is reserved for pills, eyebrows, labels, and targeted monospace accents. The UI supports light and dark color schemes from the beginning, initially following the system preference without exposing a theme toggle. The admin shell uses a visually separated, screened-out side navigation with vertically centered menu groups and a spacious but efficient content area. The player remains minimal and control-free, with automatic playback as the primary interaction and only lightweight keyboard diagnostics if needed. Desktop is the primary target, with responsive collapse behavior sufficient for smaller setup and management screens.

### Media readiness before publication

Uploads move through pending, ready, or failed states. Playlists and manifests only include ready assets. Initial processing can validate supported browser media and generate metadata/thumbnails; full transcoding is a later capability if compatibility testing requires it.

## Risks / Trade-offs

- [Browser codec and autoplay differences] -> Define a supported media matrix, default video playback to muted, and test the player in the reference browser environment before expanding device support.
- [Client clock drift affects exact overrides] -> Include server time and absolute transition timestamps in manifests; use local time synchronization estimates and expose transition diagnostics.
- [Large media files exceed browser cache or slow startup] -> Use CDN delivery, thumbnails and asset metadata, bounded cache management, and validate size limits in the upload workflow.
- [An override remains active during a long outage] -> Require an end time for manual overrides and honor cached end timers locally.
- [AWS services reduce portability] -> Keep domain logic in the API and isolate object storage, authentication, and deployment adapters.
- [Concurrent edits produce confusing playback] -> Version manifests and refresh them after mutations; apply normal queue changes at item boundaries while allowing overrides to interrupt.
- [Visual polish drifts from the approved system] -> Build and review a separate static visual prototype before wiring the production screens, then encode approved decisions in the Mantine theme.

## Migration Plan

This is a greenfield deployment with no existing application data. Provision the database, object storage, CDN, authentication, and service runtime together. Seed first-run setup through a controlled setup flow. Rollback consists of deploying the previous service version and retaining compatible database migrations; media objects remain in storage unless explicitly removed.

## Open Questions

- The initial supported image/video codec and file-size matrix can be finalized during the media-processing task.
