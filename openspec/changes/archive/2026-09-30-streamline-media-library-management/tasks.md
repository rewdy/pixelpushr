# Tasks

## 1. Media edit drawer

- [x] 1.1 Replace separate rename, tag, and replacement dialogs with a right-side edit drawer opened by the media title or Edit row action; verify browser coverage for open, close, rename, tags, ready-only replacement, and retained row Delete action.
- [x] 1.2 Document the media edit drawer and row actions in `docs/design-system.md`; verify the guidance matches the implemented responsive view.

## 2. Selection and additive bulk tags

- [x] 2.1 Add validated, organization-scoped bulk tag contracts and endpoint that atomically unions new tags with each selected asset's existing tags; verify integration tests cover mixed existing tags, case-insensitive reuse, invalid IDs, tag limits, and no partial writes.
- [x] 2.2 Add media row checkboxes, visible-result Select all, selection count, and bulk Add tags UI with selection reset on search and tag-filter changes; verify browser tests cover empty, partial, filtered, and cleared selection plus additive tag results.
- [x] 2.3 Document bulk selection and additive tagging behavior in `docs/operations.md`; verify the examples match the UI and API behavior.

## 3. Combined bulk deletion

- [x] 3.1 Add shared bulk impact and confirmation contracts and authenticated endpoints with stable snapshot calculation, ordered asset locking, atomic deletion, and seven-day retirement of every affected object; verify integration tests cover mixed used/unused assets, cross-organization IDs, changed uses, all-or-nothing rollback, and handoff records.
- [x] 3.2 Add one bulk Delete confirmation showing selected assets and aggregated playlist item impact, with refresh-on-conflict and selection clearing after success; verify browser tests cover combined review, cancellation, stale impact, and successful removal without changing unrelated playlist items.
- [x] 3.3 Document combined deletion impact and confirmation in `docs/operations.md`; verify the described playlist effects and seven-day handoff agree with tests.

## 4. Integrated verification

- [x] 4.1 Run `bun run check`, `bun run typecheck`, `bun run build`, `bun run test:unit`, `bun run test:integration`, and `bun run test:browser` with the README's local services; resolve failures and verify existing single-asset media and player-manifest behavior remains intact.
