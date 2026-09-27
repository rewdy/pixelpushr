# Design

## Context

See [proposal.md](proposal.md) for the problem and [the delta spec](specs/digital-signage-platform/spec.md) for observable behavior. Setup and Settings currently use plain text inputs. The API already validates IANA identifiers and stores one organization timezone; schedule evaluation uses that value. Settings are owner editable and administrator readable.

## Goals / Non-Goals

**Goals:** Keep one timezone control and option source across setup and settings, preserve the stored identifier, and make the displayed offset unambiguously current rather than a promise about future dates.

**Non-Goals:** Per-display timezones, schedule rule changes, conversion of existing schedules, or a new timezone database service.

## Decisions

Use a shared Mantine Autocomplete backed by browser `Intl.supportedValuesOf("timeZone")`, with `UTC` and the current saved value included explicitly. Store the IANA identifier as the option value; display a human-readable label containing the identifier and `UTC±HH:MM` offset. Search by identifier, city segment, and offset. Preserve aliases already stored by the API rather than silently replacing them with another canonical spelling. If the browser lacks the list API, use a bundled supported-zone list or a small explicit fallback so a valid existing value remains usable. Keep API validation authoritative.

Compute offsets for one captured `Date` when building options and label them **Current UTC offset**. Recompute when the component mounts and if it remains open across a local date change; timezone offsets can differ at a future scheduled event due to daylight saving time. Sort zones by name rather than by changing offset. Use the same control in first-run setup and Settings, preserving Settings' owner-only edit permission.

The alternative is a timezone package or custom backend endpoint. The browser's internationalization data and existing API validation already cover the target environments, so a new runtime dependency or service is unnecessary for this change.

## Risks / Trade-offs

- The browser zone list can omit an alias already saved by another environment → always inject the current value and validate it before showing it.
- A displayed offset can change seasonally → label it as current and keep the zone identifier visible.
- A large option list may be cumbersome on small screens → use searchable filtering and a bounded visible dropdown, while retaining keyboard selection.

## Migration Plan

This is a web-only change. Existing stored timezone strings remain intact, and the old text input can be restored without data migration.
