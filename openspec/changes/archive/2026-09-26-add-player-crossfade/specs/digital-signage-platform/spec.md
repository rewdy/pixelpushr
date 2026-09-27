# Spec Delta

## ADDED Requirements

### Requirement: Player item crossfade
The public player SHALL crossfade over 500 milliseconds between consecutive playable items in a stable normal or override queue, including when that queue loops. The overlap SHALL fit within the outgoing item's configured playback duration or, for a play-once video, its remaining playback time when known; it SHALL NOT add 500 milliseconds to every item. Override activation, expiration, and winner changes SHALL cut immediately at their effective times without a crossfade. The transition SHALL leave no prior item visibly displayed after it completes.

#### Scenario: Image or repeating video advances
- **WHEN** an image or repeat-for-duration video approaches the end of its configured duration and another playable item follows
- **THEN** the player overlaps the outgoing and incoming items for up to 500 milliseconds and completes the transition by the configured item boundary

#### Scenario: Play-once video finishes
- **WHEN** a play-once video with known remaining time approaches its end
- **THEN** the player fades to the next item during its final 500 milliseconds and advances no later than video completion

#### Scenario: Queue loops or normal update arrives
- **WHEN** playback reaches the end of a stable queue or a pending normal queue update is adopted at rollover
- **THEN** the transition to the next item uses the same crossfade without changing the rule that normal updates wait for a queue boundary

#### Scenario: Exact-time override transition
- **WHEN** an override starts, expires, or a different override wins while a crossfade is in progress
- **THEN** the player immediately cancels the fade and shows only the newly effective queue at the scheduled server-adjusted time

#### Scenario: No next playable item
- **WHEN** the effective queue is empty or the next item cannot be loaded
- **THEN** the player does not leave a stale or blank crossfade layer over otherwise playable content
