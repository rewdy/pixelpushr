# Spec Delta

## ADDED Requirements

### Requirement: Media library edit drawer
The media library SHALL make an asset title and its Edit row action open a side drawer over the library. The drawer SHALL let an administrator rename the asset, edit its tags, and start a same-kind replacement for a ready asset using the existing validation and identity-preservation rules. The row SHALL retain a separate Delete action with the existing impact confirmation.

#### Scenario: Open media editing from its title
- **WHEN** an administrator activates a media title or Edit action
- **THEN** the same asset's edit drawer opens without leaving the library

#### Scenario: Edit asset metadata
- **WHEN** an administrator saves a valid new name or tag set in the drawer
- **THEN** the library and existing playlist views reflect the change while the asset identity and playback settings remain unchanged

#### Scenario: Replace from the drawer
- **WHEN** an administrator replaces a ready asset from its edit drawer
- **THEN** only a valid same-kind file becomes playable and the existing asset and playlist item identities remain intact

#### Scenario: Delete from the row
- **WHEN** an administrator activates the row's Delete action
- **THEN** the existing single-asset impact review appears before any in-use deletion

### Requirement: Media library selection and bulk tagging
The media library SHALL offer a checkbox for each listed asset, a Select all action for the currently visible listing, and a bulk Add tags action. Selection SHALL clear when the search, tag filter, or listing page changes. Bulk Add tags SHALL add the chosen tags to every selected asset without removing existing tags; if any selected asset or tag input is invalid, no selected asset SHALL be changed.

#### Scenario: Select visible assets
- **WHEN** an administrator selects all while a filtered or paged media listing is shown
- **THEN** only the currently visible assets are selected and the bulk actions reflect that count

#### Scenario: Change listing context
- **WHEN** an administrator changes the media search, tag filter, or listing page
- **THEN** the previous selection is cleared

#### Scenario: Add tags to mixed existing tags
- **WHEN** an administrator bulk-adds valid tags to selected assets with different existing tags
- **THEN** each selected asset retains its existing tags and gains the new tags once, with case-insensitive tag reuse

#### Scenario: Reject invalid bulk tagging
- **WHEN** a bulk tag request includes an inaccessible asset or would violate tag limits
- **THEN** none of the selected assets' tags change and an error is shown

### Requirement: Combined informed media deletion
The media library SHALL provide one impact review for a selected set of assets before bulk deletion. The review SHALL identify all selected assets and summarize every affected saved playlist and item count. A confirmation SHALL delete the selected assets and their saved playlist item instances as one atomic operation, preserving unrelated items and assignments. If selected assets or their saved uses differ from the reviewed snapshot, deletion SHALL stop without deleting any asset and require a refreshed review. Existing seven-day object handoff SHALL apply to every deleted file.

#### Scenario: Review a mixed selection
- **WHEN** an administrator chooses bulk Delete for used and unused media
- **THEN** one confirmation identifies all selected assets, affected playlists, item counts, and the deletion consequence

#### Scenario: Confirm unchanged impact
- **WHEN** an administrator confirms a current impact snapshot
- **THEN** all selected assets and their saved playlist item instances are deleted together, with unrelated playlist order and display assignments preserved

#### Scenario: Impact changes after review
- **WHEN** a selected asset or its saved playlist uses changes before confirmation
- **THEN** no selected asset is deleted and the administrator must review the updated impact

#### Scenario: Old player manifest after bulk deletion
- **WHEN** a player still holds a manifest referencing a bulk-deleted file
- **THEN** that file remains available during the existing bounded handoff period
