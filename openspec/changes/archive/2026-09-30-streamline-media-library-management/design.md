# Design

## Context

See [proposal.md](proposal.md) and [specs/digital-signage-platform/spec.md](specs/digital-signage-platform/spec.md). `MediaPage` currently fetches the full asset list, filters it locally, and opens separate modals for rename, tags, replacement, and single deletion. The API already supports authenticated single-asset rename, tag replacement, same-kind file replacement, and a deletion impact snapshot. Single deletion uses a database transaction, checks the snapshot, removes saved playlist item uses, and retires object keys for seven days. Bulk actions must preserve these protections across several assets.

## Goals / Non-Goals

**Goals:** Reuse current single-asset endpoints in the drawer, add bounded authenticated bulk endpoints for multi-asset operations, and keep selection semantics compatible with later list pagination.

**Non-Goals:** Asset detail routes, batch rename or replacement, changes to media validation, player manifest fields, eager object removal, and top-level list pagination.

## Decisions

### Keep the edit drawer focused on one asset

Use a Mantine right-side `Drawer` with an overlay. Opening either the linked media name or Edit row action selects the same asset; the drawer contains rename and `TagsInput`, followed by a Replace button for ready media. Reuse the current rename, tag, and replacement requests and query invalidation. Keep Delete in the row and its existing confirmation modal, so destructive action is not mixed into routine editing. A separate asset route would add navigation and a new URL model for a small form.

### Represent selection as asset IDs in the listing

Track selected IDs against the currently visible result. Select all adds only IDs shown in that result, and changing search, tags, or (after pagination) page clears selection. Reconcile selection after asset deletion or refresh so stale IDs cannot be submitted. Use a persistent bulk-action area with disabled actions at zero selection to avoid layout movement. An all-matching-results selection would require a server-side query snapshot and different confirmation semantics, so it is excluded.

### Add additive bulk tagging as one transaction

Add an authenticated bulk tag endpoint that accepts a bounded, deduplicated asset-ID array and tag names, validated with Zod. Normalize names and reuse or create organization tags case-insensitively, as the single-asset endpoint does. Lock or validate all selected organization assets before changes, compute each asset's union with its existing tags, reject the entire request if any union exceeds the existing per-asset limit, then insert only missing associations in one transaction. Calling the existing replace-tags endpoint once per asset would risk partial completion and accidentally remove distinct existing tags.

### Review and delete a set atomically

Add authenticated bulk impact and bulk delete endpoints with shared contracts. The impact response includes the exact selected asset IDs, per-asset and aggregated playlist uses, item counts, and one snapshot token derived from a stable sorted representation. Confirmation submits those IDs and token. The delete transaction locks selected asset rows in stable ID order, recomputes the impact, rejects a changed token or inaccessible/missing asset, removes all selected playlist items and assets, and records every public object and thumbnail for the seven-day handoff. Replacement candidates remain server-only and are handled by the existing cleanup rules. A sequence of single-asset deletes would allow partial success and could invalidate later impact checks.

### Preserve public and admin boundaries

Bulk endpoints use `getAdmin`, organization-scoped queries, and the shared error envelope. Shared contracts expose impact summaries but no raw object keys, presigned URLs, or replacement candidates. Query invalidation refreshes media, tags, and affected playlist views after success. The public player receives only normal resolved manifest updates caused by deletion, according to existing queue behavior.

## Risks / Trade-offs

- **A selected asset changes during review** → Recompute one snapshot while rows are locked and reject the whole delete if it differs.
- **Large selections strain one request or transaction** → Bound ID-array size at request validation and use the same bound in the UI; provide a clear error rather than silently processing a subset.
- **Tag limits differ across selected assets** → Check the union for every asset before writing; fail atomically if any would exceed the limit.
- **A pending or failed asset cannot be replaced** → Disable Replace in its drawer while retaining rename and tags.
- **The later pagination change changes what is visible** → Keep selection keyed to displayed IDs and clear it on page or filter changes.

## Migration Plan

No schema migration. Deploy API and web together because the new bulk UI calls new endpoints; rollback both together if needed. Existing single-asset routes remain available.
