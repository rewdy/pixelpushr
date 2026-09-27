# Design

## Context

See [proposal.md](proposal.md) for motivation and [specs/digital-signage-platform/spec.md](specs/digital-signage-platform/spec.md) for behavior. Media assets already have an organization-scoped row, a storage object key, readiness metadata, and playlist-item references. The API has rename and unused-delete routes; upload completion validates storage metadata and file signatures. The player obtains public object URLs in server-generated manifests and can hold an older manifest until a queue boundary or while offline.

## Goals / Non-Goals

**Goals:** Keep playlist references stable across replacement, avoid publishing partial uploads, make destructive effects reviewable, and bound the lifetime of superseded storage objects so recently issued manifests remain playable.

**Non-Goals:** Cross-kind replacement, media version history or rollback UI, global tag administration, media editing/transcoding, private player URLs, and a new manifest push channel.

## Decisions

### Stage replacements separately, then swap the asset's object pointer

Add a `media_replacements` table for pending candidates (asset ID, unique temporary staging key, declared MIME/size, metadata, timestamps, status). Initiation requires a ready target and the same media kind and produces a presigned upload URL **only for the staging key**. Completion validates the staged object with the same size, MIME, signature, dimensions/duration rules, and configured limits used for new media. The server copies it to a fresh, server-only final key and revalidates that copy before a conditional database transaction changes the existing `media_assets` row's object key and file metadata. The transaction leaves its ID, name, tags, and playlist references untouched. No upload URL is issued for the final key, so reuse of a still-valid staging URL cannot mutate published content. A candidate is never listed or served in manifests before that transaction. Conditional completion rejects stale/concurrent replacements, deletes, or changed target versions; each attempt uses its own final key, so a losing concurrent attempt cannot overwrite the winner. Failed candidates never change the ready asset.

Before copying, register the attempt's final key for one-day idempotent cleanup. On successful publication, remove that cleanup reservation transactionally and retire the staging key for one day (longer than its write URL's lifetime). Failed or interrupted attempts leave their unpublished final key reserved for cleanup. Revalidate the final copy even when the staging object passed its first check: the presigned staging URL can still be used between validation and copying.

Use a fresh storage key rather than overwriting the existing key. This keeps older public URLs valid and avoids cache ambiguity in CloudFront. For video, reset the old thumbnail pointer on publication; generate/upload a new thumbnail on a best-effort basis, using a version-aware update so a late thumbnail cannot attach to a newer replacement. Missing thumbnail does not block a ready video. Reuse the existing upload helper and validation logic where practical rather than diverging rules.

### Review deletion impact, then remove uses transactionally

Provide an authenticated impact endpoint returning the asset, affected saved playlist names/IDs, item counts, and a deterministic snapshot token derived from the exact playlist-item IDs (including the unused case). The UI presents these details in a confirmation dialog and sends the token on delete. In one database transaction, serialize changes to that asset and its playlist uses, recheck the exact set, delete those item rows, and delete the asset. A mismatch returns `409` with refreshed impact and performs no deletion. Keep remaining item IDs and relative order and leave display assignments intact. Any API path that adds a playlist use must coordinate with this lock/transaction so a concurrent insert cannot escape the comparison; the asset FK remains restrictive as a backstop.

This is preferable to blind cascading deletion: the user sees the actual effect, and a changed playlist cannot be silently pruned. Both unused and in-use deletion use the same validated path.

### Retire files for a bounded handoff, then garbage-collect

On successful replacement or deletion, record old published object and thumbnail keys in a `retired_media_objects` table in the same database transaction. Keep them readable for seven days, then delete storage objects through an idempotent cleanup job that removes the retirement row only after successful object removal. Expired, abandoned candidate uploads, successful replacement staging objects, and unpublished final-copy attempts are cleaned after one day. Run cleanup via a scheduled Lambda/EventBridge trigger in AWS and a documented local/operator command; no live deployment is part of this change. This bounds storage growth while allowing a player holding a recent manifest to fetch its referenced file. A player disconnected longer than the retention window still depends on its own cache. Avoid eager deletion in existing thumbnail update code where it would invalidate a recent manifest or preview URL.

### Store reusable tags relationally and filter consistently

Add organization-scoped `media_tags` with a normalized case-insensitive unique key and a display label, plus `media_asset_tags` join rows with cascading cleanup. Trim labels, impose a length/count limit, and use an atomic upsert to avoid duplicate tags under concurrent edits. Asset edit endpoints return ordered tags; tag suggestions come from an authenticated organization-scoped list endpoint. Filtering is by any selected tag, combined with name text search using AND. Apply the same predicate to the library and playlist picker, preferably via shared query state/helper and server list filters so both surfaces agree. Do not alter manifest payloads for tags.

### Keep the UI within the established admin system

Add row/card actions for rename, replace, and delete in the Media library. Use Mantine dialogs, notifications, file input/progress, and tag select/chips within the existing theme. The delete dialog is specific about affected playlist names and instance counts; on a stale-impact conflict it refreshes and requires another confirmation. Replacement indicates supported same-kind files and keeps the old item visible/playable until publication. Invalidate relevant TanStack Query media, playlist, and picker data after mutations. The player UI stays unchanged.

## Risks / Trade-offs

- **Old manifests outlive seven days** → Document this bounded guarantee and retain the existing player cache/offline behavior; do not promise indefinite availability.
- **Concurrent playlist edits or replacement completions** → Recheck within serialized transactions and use conditional updates; test races and conflict responses.
- **Cleanup failures leak objects** → Persist retirement/candidate records, make cleanup idempotent and retryable, and surface failures in logs/metrics without logging URLs or tokens.
- **Video poster generation fails or arrives late** → Treat it as optional and bind updates to the published object version.
- **Tag vocabulary drifts** → Normalize uniqueness, offer existing suggestions, and leave unused-tag pruning to a later maintenance feature.

## Migration Plan

Add non-destructive tables/indexes for replacement candidates, retired objects, tags, and asset-tag joins; existing assets and playlists need no backfill. Deploy database migration before API/UI rollout. Update API, cleanup Lambda/schedule, and UI together, then validate a clean database and an upgraded database. Rollback of app code is possible while tables remain; do not roll back by dropping new tables until pending candidates and retired objects have been drained. Terraform changes are validation-only until the operator authorizes a real deployment.
