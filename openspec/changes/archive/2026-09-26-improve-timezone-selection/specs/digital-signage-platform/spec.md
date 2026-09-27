# Spec Delta

## ADDED Requirements

### Requirement: Discoverable organization timezone selection
The system SHALL let an administrator choose the organization's IANA timezone from a searchable list during first-run setup and view or change that selection in workspace settings according to existing permissions. The selector SHALL display each zone's identifier and current UTC offset, identify that the offset can change with daylight saving time, and preserve the selected timezone identifier when saved. Schedule evaluation SHALL continue to use the saved IANA timezone.

#### Scenario: Select timezone during setup
- **WHEN** the first owner searches for and selects a timezone while creating the workspace
- **THEN** the selector shows its identifier and current UTC offset and setup saves that identifier

#### Scenario: Change timezone in settings
- **WHEN** the owner selects and saves a different timezone in workspace settings
- **THEN** the saved IANA identifier changes and subsequent schedule evaluation uses it

#### Scenario: Existing timezone remains selectable
- **WHEN** workspace settings opens with a previously saved valid timezone
- **THEN** that timezone remains selected and recognizable even if the browser's common-zone list uses a different alias

#### Scenario: Read-only administrator settings
- **WHEN** an administrator who is not the owner views workspace settings
- **THEN** the timezone and its current offset are visible but cannot be changed
