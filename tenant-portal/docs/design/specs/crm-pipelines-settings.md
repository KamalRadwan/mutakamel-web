# CRM Pipelines settings

Reviewed 2026-11-04 against the supplied screenshot, Gateway pipeline routes,
PipelinesController, pipeline DTOs, service validations and current UI.

## Layout approved for implementation

```text
Settings / Pipelines                 Search      Reload   + New pipeline

# | Arabic name | English name | Code | Stages | Access | Status | Actions
1 | الافتراضي   | Default      | DEFAULT | 6  | Everyone | Active Default
                                                   [View] [Edit]
```

Use the shared DataTable surface, regular-weight body text and distinct
`dir="rtl"` / `dir="ltr"` isolated name cells. Names remain separate columns
in either interface language. Keep stage count numeric and access/status
labels explicit. Row activation opens the existing detail route. A visible
Edit button opens a centred card, including for the default pipeline.
Make default and Delete retain their eligibility hints and confirmations.
There is no selected configuration panel beneath the list.

```text
                  Edit pipeline                              Close
                  Code (read only)
                  Arabic name        English name
                  Description
                  Active (locked for the default pipeline)
                  Revert to saved                Cancel   Save
```

The edit card uses FormModal's focus management, scrollable body and dirty
discard guard. Its initial configuration read is authoritative; loading,
403, 404 and retry states block submission. Failed or uncertain writes retain
the draft, and recovery keeps the existing persistent session/actor fence.
Creation remains a modal, sized wide for identity and ordered stage selection.
Custom ordering, canonical default stages and all validation remain available.
Create errors appear after an explicit submit; blur never changes the modal
height underneath a pointer targeting Cancel. Code occupies its own row and
the two names share the next row. Read-only edit code is skipped in the tab
order so opening Edit focuses the first editable name.

The existing `/crm/pipelines/:id` page owns full stage attach/detach/reorder,
assignment replacement and default reset. The table's View action links there
directly. NEW remains first; NEW/WON/LOST cannot detach. Reset still confirms
shared canonical restoration, extra-stage removal, activation and ALL access.
Access Save/Revert controls wrap in the card body, preserving readable header
space even when the stage/access columns share a laptop viewport.

## Shared status treatment

Lead and opportunity lifecycle progress plus OPEN/IN_PROGRESS categories use
StatusBadge's existing brand tone and matching pending dot. WON/POSITIVE,
LOST/NEGATIVE and ON_HOLD retain positive, negative and caution semantics.
Unknown values remain neutral. This is one shared progress color, without
per-stage colors. Arabic and English retain identical type and badge sizes.

## Design review

- The table now scans across both names without a second text line or a large
  automatic editor competing with it.
- View and Edit have different outcomes and accessible names; Edit has visible
  text. Existing dedicated detail URLs preserve all configuration capabilities.
- Shared theme tokens, FormModal and DataTable cover light/dark and RTL/LTR.
- Keyboard focus remains visible; sticky modal bands do not cover its scroll
  area. Errors and action eligibility use text in addition to color.
- No new routes, DTO fields, permissions, metrics, pagination or backend writes.

Live browser review must be reported separately from source and unit checks.
