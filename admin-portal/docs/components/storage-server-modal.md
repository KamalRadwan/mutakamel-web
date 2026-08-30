# Storage Server Screens and Dialogs

Status: **[Verified current-source behavior; approved cross-cutting target applies]**

Last source verification: **2026-08-05**

This specification complements the authoritative
[Storage Servers API contract](../api/storage-servers.md).

The cold-blue update does not change Storage Server transport or safety
semantics. Presentation must also follow
[Operational UX](../design-system/operational-ux.md),
[Data experiences](../design-system/data-experiences.md), and
[Accessibility, responsive behavior, and localization](../design-system/accessibility-responsive-and-localization.md).

## Route ownership

The routing files are intentionally thin:

- `/storage-servers` renders the registry screen;
- `/storage-servers/new` renders the registration screen;
- `/storage-servers/[id]` renders the operational detail screen;
- `/storage-servers/layout.tsx` supplies the portal navigation and shell.

Product behavior, API calls, mutation state, and UI are owned by
`src/features/admin/storage-servers`. Do not restore API clients or hooks below
`src/app/storage-servers`.

## Registry screen

The screen provides:

- debounced server-side search;
- server-side lifecycle filter and sorting;
- truthful page/total metadata and previous/next controls;
- explicit “on this page” labels for derived active/fresh counts;
- lifecycle and connection evidence as separate columns;
- safe failure code and last-test timestamp;
- keyboard-labelled refresh and pagination controls.

An `ACTIVE` row is not automatically described as healthy. Freshness requires
`connectionEvidenceFresh` and `PASSED` evidence.

## Registration screen

Registration is a dedicated route, not a one-time credential download flow.
The form contains exactly the create DTO fields: immutable code, name, HTTPS
endpoint, region, bucket, optional tenant limit, access-key ID, and secret key.

Client validation rejects endpoint credentials, path, query, fragment, and
plain HTTP. Server validation remains authoritative. Credential values live
only in component memory, use password-manager-safe autocomplete attributes,
and are never displayed after submission.

Success redirects to the new `DRAFT` detail. Copy must say that registration
saved encrypted configuration; it must not claim the connection was tested.
The screen owns one UUIDv7 for the exact submitted intent and retains it across
coordinated `401`, network failure, `5xx`, or an in-progress response. Core's
durable registration command can replay or recover the same preallocated DRAFT
after Gateway-cache loss; the UI must not manufacture another ID or rotate the
key merely because the first response was unknown.

## Detail screen

The detail screen separates three concerns:

1. lifecycle (`DRAFT`, `ACTIVE`, `OFFLINE`);
2. connection evidence (`NOT_TESTED`, `PASSED`, `FAILED` plus freshness);
3. placement policy (active plus fresh evidence).

The 24-hour evidence rail displays last test, expiry, next 12-hour automatic
probe due time, and safe failure code. It also states that Worker schedules the
check while Core performs it.

Actions:

- “Run connection test” is independent and does not change lifecycle;
- “Test & activate” appears for `DRAFT`/`OFFLINE`;
- “Take offline” appears for non-default `ACTIVE` servers and requires
  confirmation;
- “Make platform default” is enabled only for non-default `ACTIVE` servers
  with fresh successful evidence;
- delete is enabled only for non-default, unassigned `DRAFT`/`OFFLINE` rows;
- credential rotation is disabled for assigned servers until `OFFLINE`.

Connection edits explain that changing endpoint/region/bucket/credentials
invalidates evidence and returns the server to `DRAFT`. When an assigned server
is not `OFFLINE`, connection inputs are disabled but safe metadata/capacity
updates remain possible; Core rechecks all invariants under lock.

## Dialog behavior

- Critical offline/delete actions use accessible confirmations.
- Edit/credential dialogs keep values only in memory and never prefill current
  credentials.
- Mutation controls are disabled while a command is in flight.
- Success closes the dialog and renders the authoritative returned/refetched
  state.
- Ambiguous failures retain the exact UUIDv7 key for an unchanged retry.
- Definitive validation/state failures rotate the key before a changed intent.
- Errors preserve the normalized message and correlation ID when available.

## Accessibility and bilingual behavior

- Use logical `start`/`end` spacing and direction-aware back arrows.
- Keep wire enums untranslated in select values.
- Every icon-only button has an accessible label.
- Loading, error, empty, probe result, and forbidden states use text, not color
  or animation alone.
- Progress exposes `role=progressbar` and numeric ARIA values.
- Toasts are secondary feedback; persistent lifecycle/evidence remains on the
  page.

## Focused tests

Cover URL origin validation, API query/header serialization, safe probe result
shape, ambiguous/definitive idempotency behavior, and storage-placement
projection stripping. A browser E2E should additionally exercise keyboard
focus, dark/light, RTL/LTR, delayed list responses, failed probes on an
`ACTIVE` row, and an activation revision conflict.
