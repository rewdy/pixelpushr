# Proposal

## Why

Entering an IANA timezone by hand is error prone, and the current text field gives no indication of its UTC offset. Choosing a recognizable zone should be straightforward during first-run setup and later settings changes.

## What Changes

- Replace free-form timezone entry in workspace setup and settings with a searchable timezone selector.
- Show each zone's current UTC offset and identifier, and clearly label the offset as current because daylight saving time can change it.
- Preserve the existing IANA timezone value and schedule interpretation when saving a selection.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `digital-signage-platform`: Add discoverable, offset-labeled timezone selection to organization setup and settings.

## Impact

- Admin setup and settings screens, shared timezone option generation, and UI coverage.
- No API contract or database migration is expected; the API continues to validate and store IANA timezone identifiers.
