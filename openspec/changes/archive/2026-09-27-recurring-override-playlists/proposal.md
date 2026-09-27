# Proposal

## Why

Append assignments can repeat every N weeks, but Override assignments are limited to a single window, and neither supports the daily or monthly patterns administrators expect from a calendar. A regularly scheduled event countdown or campaign therefore needs avoidable manual maintenance.

## What Changes

- Give both Append and Override assignments one recurrence model: one-time; every N days; every N weeks on selected weekdays; or every N months by day-of-month or ordinal weekday (for example, second Tuesday). Allow an optional last occurrence date. Preserve existing weekly assignments.
- Apply recurring windows with the current Append queue-boundary behavior or Override priority and exact-time interruption behavior, respectively.
- Resolve recurring Override occurrences into a bounded set of absolute transition windows in each player manifest, including any currently active occurrence and near-future occurrences, so the browser player can act on exact boundaries without evaluating recurrence itself.
- Show recurrence in display management and schedule previews, and make it editable with other assignment settings. Coordinate with the pending assignment-settings edit change rather than creating a second edit flow.
- Keep **Activate now** as a one-time Override shortcut; repeating Overrides require an explicit first start and end. Existing one-time Overrides remain unchanged.
- Keep the shared assignment/schedule-rule relationship, but migrate the weekly-only rule fields to a general recurrence representation. The app has not shipped, so this is the right time to make that change.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `digital-signage-platform`: General daily/weekly/monthly recurrence for Append and Override creation, editing, resolution, and playback.

## Impact

Schedule-rule migration; display assignment forms and summaries; authenticated assignment APIs and validation; schedule/manifest resolution; public player contract tests; operator documentation; unit/integration/browser coverage; and a server-side recurrence library. No new infrastructure or player-side recurrence engine.
