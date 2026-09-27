# Tasks

## 1. Recurrence model and migration

- [x] 1.1 Add a typed daily/weekly/monthly recurrence model and Drizzle migration, backfilling current every-N-weeks rules and preserving one-time/legacy expiry data; verify migration on clean and pre-migration fixture databases plus existing weekly unit tests.
- [x] 1.2 Add the `rrule` server dependency behind a calendar-date adapter and prove it matches first/next daily, selected-weekday weekly, numbered/ordinal monthly, missing-31st, DST fold/gap, and organization-timezone-change fixtures; verify focused unit tests pass before using it in routes. If the adapter cannot preserve required semantics, retain the typed model and use a targeted Temporal enumerator instead.
- [x] 1.3 Implement shared occurrence enumeration and active-window checks for Append and Override, including optional inclusive last-start date, bounded enumeration, and same-assignment overlap coalescing; verify unit tests preserve old weekly rotations and avoid duplicate queue items.

## 2. Assignment API and validation

- [x] 2.1 Update authenticated Append and Override creation to validate and save one-time/daily/weekly/monthly rules, frequency-specific fields, intervals, first window, optional end date, playable Override media, and one-time-only **Activate now**; verify integration tests cover valid patterns and invalid combinations.
- [x] 2.2 Extend the single settings-only assignment PATCH contract with the general recurrence fields while preserving saved timezone, identity, ordering, and stale-edit protection; verify integration tests cover mode-specific edits, no-op, priority, conflict, and cross-organization access. Coordinate with `edit-display-assignment-settings` rather than adding a parallel edit API.

## 3. Manifest and schedule resolution

- [x] 3.1 Use the shared evaluator for Append activation and schedule preview; verify integration tests cover daily, multi-weekday, both monthly patterns, last occurrence date, DST, legacy weekly behavior, and normal queue rollover.
- [x] 3.2 Resolve recurring Overrides into active plus 14-day-lookahead absolute windows with full known ends, bounded work, and deterministic priority/winner transitions; verify integration tests cover overlap, one-time compatibility, long windows, version stability, and exact boundaries.
- [x] 3.3 Update `docs/architecture.md` with the general recurrence model, server-side occurrence resolution, and bounded offline contract; verify the documented behavior against manifest fixtures.

## 4. Display management workflow

- [x] 4.1 Add shared recurrence controls for Append and Override creation—interval, weekly weekdays, monthly date/ordinal choice, optional end date—and show readable saved summaries and preview results; verify browser tests cover each pattern, validation, missing 31st, and one-time **Activate now**.
- [x] 4.2 Extend the single settings Edit form with the same patterns and saved-timezone prefill, then refresh assignments/previews after save; verify browser tests cover edits, cancel/no-op, conflict, and unchanged playlist/mode. If `edit-display-assignment-settings` has not yet been applied, land its required settings-edit behavior here instead of a duplicate flow.
- [x] 4.3 Update `docs/operations.md` with daily/weekly/monthly setup, missing-date and end-date rules, DST/priority semantics, editing, and bounded offline behavior; verify the walkthrough against the browser flow.

## 5. Player timing and playback boundaries

- [x] 5.1 Make long-distance transition timers re-arm safely instead of relying on one oversized browser timeout; verify unit/browser tests cover a distant known end and server-clock compensation.
- [x] 5.2 Verify browser playback of recurring Override start/end, priority handoff, cached active-occurrence expiry, later online refresh, and unchanged Append queue-boundary adoption; add or update targeted browser tests and confirm they pass.

## 6. Cross-cutting verification

- [x] 6.1 Run `bun run check`, `bun run typecheck`, `bun run build`, `bun run test:unit`, `bun run test:integration`, and `bun run test:browser` with documented local services; record unrelated baseline failures separately.
- [x] 6.2 Run `openspec validate recurring-override-playlists --strict` and review this delta alongside `edit-display-assignment-settings` before syncing or archiving either; verify completed tasks have evidence.
