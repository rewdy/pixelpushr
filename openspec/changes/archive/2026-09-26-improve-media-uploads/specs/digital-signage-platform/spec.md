# Spec Delta

## ADDED Requirements

### Requirement: Batch media intake
The media library SHALL accept multiple image and video files from one file selection or one drop onto the media library page. It SHALL show the status and failure reason for each file independently. A failure or rejection of one file SHALL NOT prevent other supported files in the same batch from becoming ready. Existing per-file format, size, and readiness rules SHALL apply to every file.

#### Scenario: Select several files
- **WHEN** an administrator selects multiple supported files through the upload control
- **THEN** each file enters an upload queue and can reach a ready state independently

#### Scenario: Drop files on the media library
- **WHEN** an administrator drops multiple files onto the media library page
- **THEN** the same upload queue accepts them and displays each file's progress state

#### Scenario: Mixed success and failure
- **WHEN** one file in a batch fails validation or upload while another succeeds
- **THEN** the failed file shows its reason and the successful file remains available in the library

#### Scenario: Non-file drag or drop
- **WHEN** a drag or drop contains no files
- **THEN** the media library does not begin an upload or replace existing content
