# Spec Delta

## ADDED Requirements

### Requirement: Preserve untouched assignment settings during edits
When an administrator edits an existing Append or Override assignment, the system SHALL preserve the exact stored start and end instants and recurrence settings for fields the administrator did not change. Changed wall-clock times SHALL use the assignment's saved timezone. A settings edit SHALL retain the assignment's identity, playlist, mode, and queue position; the existing validation and stale-edit protections SHALL continue to apply.

#### Scenario: Priority-only edit preserves an immediate start
- **WHEN** an administrator changes only the priority of a one-time **Activate now** Override whose stored start has seconds
- **THEN** its priority changes, its exact start and end instants remain unchanged, and subsequent manifests use the new priority without moving either boundary

#### Scenario: Recurrence edit preserves ambiguous instants
- **WHEN** an administrator changes only the recurrence settings of an Append or Override assignment whose saved start or end falls in a daylight-saving overlap
- **THEN** the unchanged boundary retains its original instant and timezone rather than being reinterpreted from the displayed minute

#### Scenario: Edit a scheduled Append assignment
- **WHEN** an administrator changes a saved Append assignment's interval, selected days, or other recurrence settings without changing its dates
- **THEN** future occurrences follow the edited rule while the saved start and end instants, playlist, mode, identity, and queue position remain unchanged

#### Scenario: Explicitly change a boundary
- **WHEN** an administrator changes a start or end in the saved timezone and saves valid settings
- **THEN** the changed boundary is applied according to existing schedule validation while the untouched boundary keeps its original instant

#### Scenario: Leave an edit unchanged
- **WHEN** an administrator opens and closes the settings form without making changes
- **THEN** no assignment or schedule write occurs

### Requirement: Refresh administrator previews after assignment edits
After a successful settings edit, the display's assignment summary and schedule preview SHALL refresh, and the Overview simulation SHALL show the updated manifest when the administrator returns to it without waiting for its normal polling interval. This administrator preview refresh SHALL NOT force a public player reload or change existing Append rollover or exact-time Override behavior.

#### Scenario: Inspect an edited Override
- **WHEN** an administrator saves a priority or window change and returns to Overview
- **THEN** that display's simulation fetches the updated manifest and reflects the resolved winning content without waiting for its next scheduled poll

#### Scenario: Inspect an edited Append rule
- **WHEN** an administrator saves a valid Append recurrence change and views the display's schedule preview
- **THEN** the preview reflects the edited occurrences without requiring a manual reload
