# Design

## Context

See [proposal.md](proposal.md) for the motivation and the [spec delta](specs/digital-signage-platform/spec.md) for required behavior. The existing display view edits scheduled Append and Override assignments through a versioned, organization-scoped PATCH. That endpoint accepts partial settings, preserves omitted start/end instants, locks rows transactionally, and rejects stale writes. The edit form displays minute-precision local times in the saved rule timezone but currently submits every field on any save. The Overview simulation queries the public manifest under a separate cache key and normally polls every 30 seconds.

## Goals / Non-Goals

**Goals:** Preserve stored instants and recurrence settings that an administrator did not change; refresh administrator-facing previews promptly after a successful edit; cover these behaviors across Append and Override assignments.

**Non-Goals:** Add another endpoint or edit form, change the assignment model or creation workflow, change playlist/media content, convert modes, add player controls or push delivery, or edit always-on ordering through this form.

## Decisions

### 1. Use the existing partial settings endpoint

Keep `PATCH /admin/displays/:id/assignments/:assignmentId` as the only save path. It already accepts `expectedVersion` and partial, mode-appropriate settings while forbidding identity fields. Preserve its organization scoping, transactional stale-write protection, assignment/rule IDs, and merged-rule validation. The form should use this contract instead of creating a replacement route or submitting a full schedule snapshot.

When a field is omitted, the API retains its stored value. In particular, omitting an unchanged start time preserves seconds from **Activate now** and the exact instant chosen at a daylight-saving overlap. Explicitly changed wall times continue to use the rule's saved timezone and existing validation. Check whether the existing API behavior needs a focused regression test, but do not reimplement it unless a test exposes a defect.

Alternative considered: replace the entire schedule on each save. That can reinterpret values the administrator never touched.

### 2. Send only changed values from the existing form

Compare the form draft to the original saved assignment and include only genuinely changed fields plus `expectedVersion`. Do not use the minute-precision display string as the source of truth for untouched instants. When recurrence frequency changes, send the fields needed to define the new rule and explicitly clear fields that no longer apply; when only an interval, weekday, monthly choice, or priority changes, omit unrelated dates and recurrence fields. Preserve the form's existing disabled Save when nothing changed, saved-timezone label, validation, and conflict message.

Alternative considered: submit all visible fields but attempt to round-trip seconds or DST fold identity through the picker. That creates hidden state and still risks accidental time conversion.

### 3. Refresh the relevant administrator queries

The display page already invalidates assignment and schedule-preview queries on successful edits. Also invalidate the selected display's Overview simulation query. Since the administrator normally navigates away from Overview to edit, its card is usually unmounted; the invalidated query should fetch a fresh manifest when that display's card is next shown. Do not restart a public player or change player polling.

Alternative considered: rely on the Overview card's 30-second poll. That leaves the administrator briefly seeing a stale simulation immediately after saving.

### 4. Keep playback semantics unchanged

Subsequent manifest requests use the edited rule with the existing normal-queue rollover and exact-time Override semantics. Targeted tests should confirm a priority-only Override edit does not move its boundaries and an Append edit does not change its identity or unrelated assignment data. Player-browser coverage is needed only if a changed-field edit exposes a playback regression; existing playback behavior is not being redesigned.

Alternative considered: forcing an immediate player reload on every edit. That would alter Append queue semantics and is outside this hardening change.

## Risks / Trade-offs

- **A displayed minute or DST-overlap time cannot round-trip the original instant** → Omit untouched date fields and verify the saved instants after editing another field.
- **A recurrence mode switch requires clearing obsolete fields** → Compare recurrence drafts as a group and cover daily, weekly, monthly, and one-time transitions in tests.
- **The Overview card is normally unmounted during editing** → Invalidate by its stable display-specific query key and test the updated manifest when returning to Overview.
- **Another administrator edits the same assignment** → Retain the existing `expectedVersion` conflict behavior; the user reloads current settings before retrying.

## Migration Plan

No database migration, API contract change, or infrastructure change is required. Update the existing form and query invalidation, clarify the operator walkthrough, and run focused and full local checks. Rollback is a frontend code rollback; persisted rules and manifests remain compatible.
