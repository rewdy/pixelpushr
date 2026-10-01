# Design

## Context

See [proposal.md](proposal.md) and [specs/digital-signage-platform/spec.md](specs/digital-signage-platform/spec.md). The three admin list routes currently return every organization record. `MediaPage` applies name and tag filters in the browser, though the media API already accepts those filters while still loading all candidate assets. `PlaylistEditorPage` consumes the unpaged media route for its picker; display detail uses unpaged playlists and displays; Overview consumes unpaged displays. Pagination must change listing behavior without silently truncating these other views.

## Goals / Non-Goals

**Goals:** Use one consistent top-level paging interaction and bounded server queries, preserve existing unpaged API behavior for current non-list consumers, and keep filtering and selection correct across page boundaries.

**Non-Goals:** Paging playlist draft items, display assignments, the ready-media picker, or Overview simulations; changing playlist or display data models; public player endpoints.

## Decisions

### Add opt-in page parameters to current admin list routes

Support validated `page` and `pageSize` query parameters on `/admin/media`, `/admin/playlists`, and `/admin/displays`. When supplied, return the existing record array plus pagination metadata (`page`, `pageSize`, `total`); cap `pageSize` and reject malformed values. Use a common default of 25 rows in the UI. Keep requests without paging parameters and their current array-shaped responses working for the picker, detail pages, Overview, and existing clients. Changing the default response to one page would hide valid assignment choices and displays; separate list-only routes would duplicate the resource API.

### Filter in SQL before selecting a media page

Apply organization scope, case-insensitive name search, and OR-matched selected tag IDs before counting and limiting results. Keep the existing rule that name search and tag filtering both must match. Query the page IDs with deterministic name-plus-ID ordering, then fetch tag and serialized asset data only for those IDs while restoring that order. Playlists and displays use their existing name ordering with ID as a tie-breaker. Offset paging is adequate for these administrator lists; stable ordering plus a reset when data changes avoids ambiguous positions without adding opaque cursor state.

### Share one paging control and URL state

Use a small shared React paging control built from Mantine components showing current page, total results, and navigation. Keep page and media filters in URL query parameters so refresh and direct links preserve the view; include the current parameters in TanStack Query keys. A filter change returns to page one. After a mutation, invalidate the relevant page query and move to the last valid page if the prior page is empty. Distinguish no records, no filter matches, loading, and request errors. The media list clears its selected IDs on any page or filter change, matching the media-management change.

### Leave ordered editor collections complete

Do not page playlist draft items or display assignments: their order and bulk actions need the whole collection in one editing context. Keep current unpaged calls from the playlist media picker, display assignment chooser, and Overview until those surfaces have their own scale requirements. This is an explicit trade-off: top-level listing performance improves without changing editing workflows.

## Risks / Trade-offs

- **Records change between page requests** → Use deterministic secondary ID ordering, refresh totals after mutations, and move off invalid pages; concurrent edits may still shift offset pages during browsing.
- **Filtering after paging hides matches** → Implement media filters in the database before total/count and page selection, with integration coverage for later-page matches.
- **Legacy consumers receive truncated data** → Require explicit paging parameters and cover unpaged picker, detail, and Overview consumers in tests.
- **URL state and selection drift apart** → Derive list queries from URL parameters and clear selection whenever those parameters change.
- **Unpaged picker and Overview can still grow large** → Keep them complete for this change; revisit only with a separate interaction design for those views.

## Migration Plan

No schema migration. Deploy the API before or with the web bundle; the old web continues using unpaged requests. Roll back the web first if the new paging UI fails, then the API if needed.
