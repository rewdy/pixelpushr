# Spec Delta

## ADDED Requirements

### Requirement: General recurring display assignments
The system SHALL let an administrator configure an Append or Override assignment as one-time, every N days, every N weeks on one or more selected weekdays, or every N months on a numbered day or ordinal weekday (such as the second Tuesday or last Friday). A repeating rule SHALL have an explicit first local start and end, a positive interval, and MAY have a last occurrence date that includes starts on that local date. Each occurrence SHALL retain the first window's local wall-clock start and end span across daylight-saving changes and follow the existing organization-timezone-change behavior. Monthly numbered-day occurrences that do not exist in a month SHALL be skipped rather than moved to another date. Administrators SHALL be able to inspect and edit these settings without replacing the assignment.

#### Scenario: Daily recurrence
- **WHEN** an administrator schedules a window every two days
- **THEN** the assignment is active on the corresponding calendar days at the configured local times, starting no earlier than its first start

#### Scenario: Selected weekdays
- **WHEN** an administrator selects Monday and Thursday for a weekly rule with a two-week interval
- **THEN** those days in each eligible two-week cycle receive occurrences and other days do not

#### Scenario: Monthly numbered day
- **WHEN** a rule repeats monthly on the 31st
- **THEN** months without a 31st have no occurrence, and a later valid month still uses the 31st

#### Scenario: Monthly ordinal weekday
- **WHEN** a rule repeats on the last Friday of every month
- **THEN** each month's occurrence starts on that month's last Friday at the configured local time

#### Scenario: Optional end date
- **WHEN** a rule has a last occurrence date
- **THEN** starts on that local date may occur but no later starts occur; an occurrence that started by that date may finish afterward

#### Scenario: Existing weekly rotation
- **WHEN** an existing every-N-weeks Append assignment is evaluated after the model change
- **THEN** it has the same occurrence dates, window length, ordering, and normal-queue rollover behavior as before

#### Scenario: Edit a repeating assignment
- **WHEN** an administrator changes a saved assignment's recurrence pattern, interval, weekdays, monthly selection, first window, or last occurrence date
- **THEN** future occurrences follow the edited rule without changing its playlist, mode, identity, or queue position

#### Scenario: Overlapping occurrences of one assignment
- **WHEN** two occurrences of the same assignment overlap
- **THEN** an active Append assignment contributes its playlist only once to the normal queue, and an active Override remains continuous until no occurrence remains active or another Override wins

#### Scenario: Invalid recurrence
- **WHEN** a repeating rule has an invalid interval, missing dates, empty weekly weekday selection, invalid monthly selection, or end date before the first occurrence
- **THEN** it is not saved and the administrator sees an actionable validation error

### Requirement: Recurring Override playback
Each active recurring Override occurrence SHALL use the existing highest-priority, exact-time Override behavior. A one-time **Activate now** Override SHALL remain available and SHALL NOT implicitly repeat; repeating Overrides SHALL require an explicit first start and end. One-time Overrides already saved SHALL retain their absolute boundaries.

#### Scenario: Repeated event countdown
- **WHEN** a five-minute Override countdown occurs at a scheduled daily, weekly, or monthly start
- **THEN** it alone displaces the normal queue at its exact start and the player cuts back at its exact end

#### Scenario: Competing Override occurrences
- **WHEN** recurring and one-time Overrides overlap
- **THEN** only the highest-priority active Override is presented, with the existing deterministic tie-break and exact-time winner changes

#### Scenario: Activate now is one-time
- **WHEN** an administrator selects both **Activate now** and a repeating pattern
- **THEN** saving is rejected with a clear explanation; a valid one-time **Activate now** still works as before

### Requirement: Bounded recurring Override transitions
The system SHALL resolve recurring Override rules into absolute, unambiguous windows for any currently active occurrence and a bounded near-future period. The public player SHALL use those windows and server time for exact-time start, end, and winner changes without evaluating recurrence rules. The player SHALL honor the end of a known active occurrence during a temporary outage; a cached manifest SHALL NOT be treated as an unlimited calendar of future occurrences.

#### Scenario: Active occurrence at manifest fetch
- **WHEN** a manifest is fetched during a recurring Override occurrence
- **THEN** the manifest includes that occurrence's absolute end and the player exits it at that time, including if connectivity is lost afterward

#### Scenario: Upcoming occurrence
- **WHEN** a recurring Override occurrence falls within the manifest's lookahead period
- **THEN** the manifest carries its absolute start and end and the player cuts at those boundaries using its server-clock estimate

#### Scenario: Refresh before a later occurrence
- **WHEN** a later recurring occurrence was outside an earlier manifest's bounded lookahead and the player remains online
- **THEN** a subsequent manifest refresh supplies its boundaries before it starts
