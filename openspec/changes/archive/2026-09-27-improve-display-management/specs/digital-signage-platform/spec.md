# Spec Delta

## ADDED Requirements

### Requirement: Unified display playlist assignment
The display management view SHALL provide one Add playlist flow in which an administrator chooses a playlist, selects always-on or scheduled timing, and, for scheduled timing, chooses additive or override behavior. The flow SHALL show only fields relevant to the chosen mode and SHALL save the assignment according to the existing queue, recurrence, override priority, and expiration rules. Administrators SHALL be able to inspect and remove all modes of assignment from the display view.

#### Scenario: Always-on assignment
- **WHEN** an administrator adds a playlist as always-on
- **THEN** it joins the display's normal queue after the existing always-on playlists without requiring schedule fields

#### Scenario: Scheduled additive assignment
- **WHEN** an administrator chooses scheduled timing and Append behavior
- **THEN** the form collects its time window and recurrence and saves an additive schedule

#### Scenario: Scheduled override assignment
- **WHEN** an administrator chooses scheduled timing and Override behavior
- **THEN** the form collects an explicit expiration and relevant start or activate-now and priority fields, and saves an override that displaces normal playback while active

#### Scenario: Invalid mode or window
- **WHEN** the selected assignment mode lacks a required time or has an invalid window
- **THEN** the form identifies the problem and does not create an assignment

#### Scenario: Manage existing assignments
- **WHEN** an administrator views a display with always-on, scheduled additive, and override assignments
- **THEN** each assignment's mode and timing are visible and it can be removed from that display

### Requirement: Overview display simulations
The Overview page SHALL show a locally simulated playback preview for each registered display using the display's currently resolved queue. Each preview SHALL be labeled as a simulation and SHALL NOT claim to mirror the physical player's exact item or playback position. Preview activity SHALL NOT update the display's heartbeat or device health.

#### Scenario: Preview configured display
- **WHEN** an administrator opens Overview while displays have playable assignments
- **THEN** each display card shows a simulated loop of its currently effective content and a link to manage that display

#### Scenario: Preview active override
- **WHEN** an override becomes active or expires while Overview remains open
- **THEN** the corresponding simulation switches between override and normal content according to the resolved manifest

#### Scenario: Empty or unavailable display
- **WHEN** a display has no playable items or its manifest cannot be loaded
- **THEN** its card shows a clear empty or unavailable state without implying that the device is online
