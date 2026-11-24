# Spec Delta

## ADDED Requirements

### Requirement: Public player startup media readiness
On startup with a nonempty effective queue, the public player SHALL show a large white loading spinner on a dark background and defer visible playback and item timing until the queue's media are ready or have failed preparation within a bounded wait. Images SHALL be fully loaded and decoded before presentation. Videos SHALL be ready to begin playback. The player SHALL start automatically with the first ready item in queue order and SHALL recover when content becomes playable if startup yields no ready items.

#### Scenario: Startup queue contains a slow image
- **WHEN** one image in the effective startup queue is still loading or decoding and the preparation deadline has not elapsed
- **THEN** the loading indicator remains visible and no media or item countdown begins
- **AND** when all assets are ready, the indicator disappears and the first image begins its configured duration

#### Scenario: An asset fails or stalls during startup
- **WHEN** an asset fails to load or reaches the preparation deadline without becoming ready
- **THEN** the player skips unavailable assets and starts with the first ready item in queue order
- **AND** if none are ready, the player shows a waiting state and retries automatically

#### Scenario: Startup from cached media
- **WHEN** the player opens offline with a valid cached manifest and the effective queue's media available in cache
- **THEN** it uses the cached assets to satisfy readiness and starts without waiting for the network

#### Scenario: Effective queue changes during startup
- **WHEN** a manifest update or server-timed override changes the effective queue before playback begins
- **THEN** the player prepares the newly effective queue and begins playback only from that queue
