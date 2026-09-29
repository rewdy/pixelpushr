# Tasks

## 1. Preserve untouched assignment values

- [x] 1.1 Change the existing Edit form to send `expectedVersion` plus only changed start/end, recurrence, and mode-specific fields; explicitly clear obsolete recurrence fields when switching modes. Verify focused tests cover priority-only Override edits, Append interval/day edits, and one-time/daily/weekly/monthly transitions without resending unrelated dates.
- [x] 1.2 Add integration regressions for the existing PATCH: omitted dates retain exact stored instants, including an **Activate now** start with seconds and a daylight-saving overlap; an explicitly changed boundary is interpreted in the saved timezone. Verify the targeted integration tests pass and assignment identity/ordering remain unchanged.
- [x] 1.3 Add browser coverage for an unchanged form (no write), an Append edit, a priority-only Override edit, and stale/invalid edit feedback. Verify the targeted Playwright tests pass and inspect request payloads for omitted untouched fields.
- [x] 1.4 Clarify `docs/operations.md` to describe saved-timezone editing, unchanged-value preservation, and reload-on-conflict behavior; verify the described controls against the browser flow.

## 2. Refresh administrator previews

- [x] 2.1 Invalidate the edited display's Overview simulation query along with existing assignments and schedule-preview queries after a successful save. Verify a browser test returns to Overview and sees a freshly fetched manifest without waiting for its normal poll or forcing a public player reload.
- [x] 2.2 Add focused coverage that an edited Append rule appears in schedule preview and an edited Override priority/window appears in a subsequent manifest, while existing rollover and exact-time player semantics remain intact. Verify targeted integration tests pass; add player-browser coverage only if these checks expose a playback regression.

## 3. Cross-cutting verification

- [x] 3.1 Run `bun run check`, `bun run typecheck`, `bun run build`, `bun run test:unit`, `bun run test:integration`, and `bun run test:browser` with the documented local services; record unrelated baseline failures rather than expanding this change's scope.
- [x] 3.2 Run `openspec validate edit-display-assignment-settings --strict` and confirm every task has verification evidence before marking it complete.
