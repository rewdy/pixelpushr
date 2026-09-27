# Design

## Context

See [proposal.md](proposal.md) and the [spec delta](specs/digital-signage-platform/spec.md). The current schema has one `assignments` table with a mode and one `schedule_rules` table with `none`/`weekly`, `weekInterval`, a timezone, and first-window timestamps. Append and Override are **not** separate database entity types. The current recurrence evaluator handles only one weekly pattern; Override creation always stores `none` and manifest resolution treats its timestamps as one window. The player consumes absolute windows/transitions and does not interpret recurrence rules. An optional absolute `recurrenceUntil` exists in the database, but has no user-facing control.

## Goals / Non-Goals

**Goals:** Give Append and Override one daily/weekly/monthly rule model and edit surface; preserve existing weekly rotation and one-time Override behavior; generate finite, absolute windows without unbounded manifest growth; maintain priority, queue-boundary, offline-expiry, and timezone behavior.

**Non-Goals:** Replace the shared assignment/schedule-rule relationship, offer arbitrary iCalendar/RRULE syntax, exceptions or per-occurrence edits, support yearly rules or count-based termination, make the browser evaluate calendar rules, or promise indefinite recurring playback while disconnected.

## Decisions

### 1. Generalize schedule rules, not assignment types

Keep `assignments.mode` and its schedule-rule link. Migrate the schedule-rule enum to `none`/`daily`/`weekly`/`monthly`, replace weekly-only interval storage with a generic positive `interval`, and add selected weekdays, monthly selection (numbered day or ordinal weekday), and an optional inclusive local `lastOccurrenceDate`. Keep first start/end instants and saved entry timezone. Backfill existing weekly rows as the original start weekday plus their existing `weekInterval`; one-time rows stay one-time. Preserve the legacy absolute `recurrenceUntil` cap for any rows that use it, rather than silently losing data. Use a new Drizzle migration and verify a clean database and backfilled data. Bound intervals (daily 1–365, weekly 1–52, monthly 1–12) and reject rule-specific fields on other frequencies.

Alternative considered: separate tables per mode or storing an opaque user-supplied RRULE. The shared tables already model the assignment distinction, while typed rule fields keep the supported subset validateable and editable. Because the app has not shipped, a targeted schema migration is preferable to retaining weekly-only fields indefinitely.

### 2. Use `rrule` for calendar dates and Temporal for exact instants

The established [`rrule` library](https://github.com/jkbrzt/rrule) provides interval, weekday, month-day, ordinal-weekday, and bounded `between`/`before` queries. Its [timezone guidance](https://github.com/jkbrzt/rrule#timezone-support) warns that returned zero-offset `Date` values can represent floating local times; do **not** treat them directly as player instants. Use a narrow server-side adapter: generate calendar-local occurrence starts with pseudo-UTC date components, then convert each local start and corresponding local end through the existing Temporal/IANA-zone path. This preserves the current behavior for ambiguous/nonexistent DST wall times and the rule's entered wall clock when the organization timezone changes. Keep one-time instants absolute.

Use the first window's local calendar/time span to derive each occurrence end, not a fixed UTC millisecond duration. For monthly numbered dates, skip months without the requested day; do not clamp to month-end or drift the anchor. An optional `lastOccurrenceDate` includes occurrences whose **start** local date is on or before it; their ends may follow later. Existing `recurrenceUntil` remains an additional exclusive absolute cap. Weekly cycles use Monday as a stable week start, with selected weekdays within eligible weeks; the first start date is a lower bound/anchor, not necessarily a selected weekday. Coalesce overlapping/adjacent windows of the same assignment for effective activity, so Append contributes once and Override does not spuriously cut to itself.

Alternative considered: hand-writing all daily/weekly/monthly enumeration in Temporal or letting `rrule` handle timezone conversion end-to-end. The former duplicates mature calendar selection logic; the latter risks changing the project's existing DST and timezone-change semantics. Before adopting the dependency in code, prove the adapter with unit fixtures for 31st, fifth/last weekday, DST gaps/folds, long intervals, and selected weekdays. If it cannot reproduce those semantics, use the same typed model with a targeted Temporal enumerator instead; do not silently relax the spec.

### 3. Resolve rolling occurrence windows on the server

Use the same occurrence adapter for Append activity checks, schedule preview, and Override manifest windows. For a manifest at server time `t`, include any Override window active at `t` plus starts within a 14-day lookahead; retain each selected window's full end even if beyond lookahead. Include a bounded backward search for a long window already in progress. Enforce bounded query/result work, deduplicate by assignment, and keep one-time Override behavior. The existing 15-second player polling renews the lookahead. The public manifest still contains absolute windows and deterministic priority/tie-break, not recurrence expressions. Preview and UI summaries must use the same evaluator, rather than duplicating date math in the browser.

Alternative considered: send the recurrence rule to the player, or all future windows. The former duplicates timezone/DST logic in an offline browser; the latter is unbounded. A 14-day window is far longer than the poll cadence but limits payloads. Offline playback can honor only windows already fetched, including the end of an active occurrence.

### 4. Keep exact-time player scheduling safe for distant boundaries

The player currently creates a timeout for the next transition. An active Override can have an end beyond the browser's maximum reliable single-timeout delay, even if future starts are lookahead-limited. Re-arm long delays in bounded chunks and compute against server-adjusted time on each wake, while continuing to cut immediately at a due boundary. Refresh and cached-manifest paths use the same window logic. Priority still picks the highest active Override; one-time and recurring occurrences may overlap.

Alternative considered: omit long active windows from the manifest. That would risk leaving an Override stuck on an offline player, violating the existing known-expiry contract.

### 5. One recurrence control across create and edit

Expose one-time/daily/weekly/monthly in the Add Playlist drawer for both modes. Show N, weekday multi-select, monthly numbered-day versus ordinal-weekday, and optional last occurrence date only when relevant. For Override, selecting any repeat clears/disables **Activate now** and requires explicit first start/end; priority stays independent. Show recurrence summaries on saved cards and schedule previews. Extend the settings-only edit flow planned in `edit-display-assignment-settings` with the general recurrence fields, using its saved-timezone prefill, version check, and settings-only PATCH contract. Apply that change first where possible; if implementation order differs, this change still must deliver one coherent edit flow rather than a second endpoint or drawer. Do not change the assigned playlist or mode.

Alternative considered: a separate recurring-Override dialog. That would fragment the existing unified Add Playlist and pending Edit experiences.

## Risks / Trade-offs

- **Rolling lookahead changes a manifest as time advances** → Keep versioning deterministic for each resolved window set and verify polling adopts refreshed windows without resetting stable playback.
- **Library timezone conventions differ from the current resolver** → Isolate `rrule` behind a local-date adapter, test it against current weekly fixtures, and keep Temporal responsible for exact instants.
- **DST and timezone changes shift future occurrence instants** → Test spring/fall and organization-timezone changes for daily, weekly, and monthly in both modes.
- **Long or overlapping occurrences** → Coalesce same-assignment activity, bound enumeration, and test priority/winner transitions and long timers.
- **Disconnected player runs beyond its cached lookahead** → Document the bounded guarantee; it honors fetched windows and known active expiry, but does not synthesize later occurrences.
- **Two in-flight OpenSpec changes touch the edit form and API** → Implement `edit-display-assignment-settings` first if convenient, then extend those controls and validation here; review both deltas together before syncing/archiving to avoid dropping either requirement.

## Migration Plan

Add and test a Drizzle migration that backfills existing weekly intervals/weekday anchors and leaves one-time rows unchanged. Deploy migration, API resolver/validation, and UI as one feature; update `docs/architecture.md` and `docs/operations.md`, then verify a clean database and player/browser boundaries locally. Rollback to the old code is **not** safe once daily/monthly or new weekly rules have been saved; those rows must be removed or mapped back before a code rollback. No AWS deployment is authorized by this planning change.
