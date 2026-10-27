# CRM — Catalogues & Settings

Status: **verified**

Last source verification: **2026-09-24**

Lead-stage protection, ordering and deactivation re-verified: **2026-10-17**
(D-030/D-031, DOCS-FE-001).

Acquisition-source and custom-field editing/creation re-verified: **2026-10-17**
(FE-CRM-CONFIG-003), against Gateway routes, controllers, DTOs and services.

Settings default-stage removal source-verified: **2026-10-19**
(S3-CRM-SRC-001), against the settings DTO, repository and current CRM entity.

Owning app: **crm-app**

Portal status: **built** — all six screens are server-backed. Not exercised
against a live session: CRM is blocked twice over, by P4 and by Q17.

Covers the tenant-configured vocabulary the workspaces depend on: lead stages,
acquisition sources, tags, custom fields, CRM settings, and the read-only
static catalogue.

Source inspected:
`crm-app/src/crm/lead-stages/lead-stages.controller.ts`,
`acquisition-sources/acquisition-sources.controller.ts`,
`tags/tags.controller.ts`, `tags/tags.service.ts`, `tags/dto/tag.dto.ts`,
`custom-fields/custom-fields.controller.ts`,
`settings/`, `static-data/`.

## Lead stages

**Planned commercial extension, 2026-09-07:** [Application Addons target](application-addons-target.md)
belongs to Core catalogue/subscription and Company/Branch admission, not CRM
static-data CRUD. The CRM-owned catalogues and custom-field behavior on this
page remain in place. Installing an industry addon does not itself grant its
business actions or justify a tenant-global industry switch.

Canonical prefix: `/api/tenant/crm/v1/lead-stages`

| Method | Canonical path | Permission |
| --- | --- | --- |
| GET | `/api/tenant/crm/v1/lead-stages` | `crm.lead_stages.read` |
| POST | `/api/tenant/crm/v1/lead-stages` | `crm.lead_stages.manage` |
| PATCH | `/api/tenant/crm/v1/lead-stages/:id` | `crm.lead_stages.manage` |
| DELETE | `/api/tenant/crm/v1/lead-stages/:id` | `crm.lead_stages.manage` |
| POST | `/api/tenant/crm/v1/lead-stages/:id/default` | `crm.lead_stages.manage` |
| PATCH | `/api/tenant/crm/v1/lead-stages/reorder` | `crm.lead_stages.manage` |

**Tenant-wide, ordered, and the board column axis for Leads.** Each stage
carries a `sortOrder` and a semantic `LeadStageFlagEnum` — the tenant names the
stage, the flag tells the backend what it means.

`PATCH /lead-stages/reorder` is how column order changes. **Reordering is a
dedicated endpoint, not a `PATCH` of each stage's `sortOrder`** — sending
individual updates races and can produce duplicate ranks. `POST
/lead-stages/:id/default` sets the stage new leads land in.

The body is `{ orderedIds }`, and `assertExactOrder` in
`../backend/mutakamel-apps/crm-app/src/crm/lead-stages/lead-stages.service.ts`
answers `422 LEAD_STAGE_REORDER_INVALID` unless **all** hold:

| Rule | What the UI must do |
| --- | --- |
| Every non-deleted stage appears exactly once | Build the list from the unfiltered catalogue, never a searched subset — so the reorder controls are suppressed while a search is active |
| The single `NEW`-flagged stage stays first, at rank 1 | Pin it: refuse a move that would drag it or drop another stage above it, rather than round-tripping into a 422 |
| The single `DISQUALIFIED` and `CONVERTED` stages stay in the final two ranks, in that order | Pin both terminal rows. Tenant-created stages are inserted before them and may only move through the middle of the catalogue |

The response is the whole catalogue in its new order, densely re-ranked from 1
— so it replaces the list rather than patching one row into it.

All rules re-verified against that service on **2026-09-18**. The lead-stages
table reorders by dragging a row's grip, while the three protected rows carry
no grip.

Frontend: `crm/lead-stages/hooks/useLeadStageOrdering.ts` owns the reorder and
set-default writes (composed by `useLeadStageMutations`), and the paths and
request options both use live in `hooks/lead-stage-requests.ts`. Reorder keeps
auto-idempotency on because the Gateway declares that route `idempotent: true`;
set-default is sent non-replayable.

Consequences for the UI:

- Always render in `sortOrder`. Never alphabetize.
- Never hardcode a stage name or assume a count.
- The flag, not the name, determines the status badge role and whether a move
  into it is terminal.
- `NEW`, `DISQUALIFIED`, and `CONVERTED` are system stages. They cannot be
  created, renamed, re-flagged, deactivated, or deleted. Create and update use
  centered `FormModal` surfaces; protected rows do not open the update modal.

An unprotected, non-default stage may be deactivated even while live leads use
it; those leads stay in that stage (D-031). The active-stage board omits its
lane, so deactivation does not imply a transfer. Changing its flag or deleting
it while live (non-soft-deleted) leads use it returns
`409 LEAD_STAGE_IN_USE`. Surface the conflict and refetch. Protected stages
remain immutable, and the default stage cannot be deactivated or deleted.

### `stage.isDefault` is the only default lead-stage authority

The default is stored in `crm_lead_stages.is_default` and changed through the
lead-stage set-default action. Settings no longer accept or return
`defaultLeadStageId`; sending that removed key to
`PUT /api/tenant/crm/v1/settings` returns `400 CRM_VALIDATION_FAILED`.
Resolve the displayed default from the stage catalogue. Do not send a stage
reference through the settings endpoint.

The `isDefault` side already carries its own protections, verified in
`lead-stages.service.ts`. A default always exists, and it is always a stage a
lead can legitimately start in:

| Rule | Outcome |
| --- | --- |
| The first stage created becomes the default whether or not you ask | line 33 |
| Setting a default clears the previous one in the same transaction | line 92 |
| A `DISQUALIFIED`- or `CONVERTED`-flagged stage cannot be the default | `422 LEAD_STAGE_DEFAULT_TERMINAL` |
| The default stage cannot be deactivated | `422 LEAD_STAGE_DEFAULT_DEACTIVATE` |
| The default stage cannot be deleted | `422 LEAD_STAGE_DEFAULT_DELETE` |

All three are `422`, not `409` — a stage-catalogue screen that routes every
"cannot do that" through its conflict path will show the wrong recovery.

## Acquisition sources

Canonical prefix: `/api/tenant/crm/v1/acquisition-sources`

| Method | Canonical path | Permission |
| --- | --- | --- |
| GET | `/api/tenant/crm/v1/acquisition-sources` | `crm.acquisition_sources.read` |
| POST | `/api/tenant/crm/v1/acquisition-sources` | `crm.acquisition_sources.manage` |
| GET | `/api/tenant/crm/v1/acquisition-sources/:id` | `crm.acquisition_sources.read` |
| PATCH | `/api/tenant/crm/v1/acquisition-sources/:id` | `crm.acquisition_sources.manage` |
| DELETE | `/api/tenant/crm/v1/acquisition-sources/:id` | `crm.acquisition_sources.manage` |
| GET | `/api/tenant/crm/v1/acquisition-sources/:id/icon` | `crm.acquisition_sources.read` |
| POST | `/api/tenant/crm/v1/acquisition-sources/:id/icon` | `crm.acquisition_sources.manage` |
| PATCH | `/api/tenant/crm/v1/acquisition-sources/reorder` | `crm.acquisition_sources.manage` |

Tenant-wide catalogue referenced by `acquisitionSourceId` on both leads and
customer profiles. Populates the filter dropdown on both workspaces.

Sources carry an **icon** — `GET /:id/icon` serves it, `POST /:id/icon`
uploads it. Treat the icon URL as an opaque, cache-busted path; do not
construct it by hand. Reordering uses the dedicated `reorder` endpoint, same
reasoning as lead stages.

The source edit drawer requires `crm.acquisition_sources.manage` and sends
`{ nameAr, nameEn, isActive }` to `PATCH /:id`. Both names are trimmed,
required, and at most 120 characters. Deactivation retains the source and its
historical references. The raw updated source is runtime-validated before
updating the list.

## Tags

Canonical prefix: `/api/tenant/crm/v1/tags`

| Method | Canonical path | Permission |
| --- | --- | --- |
| GET | `/api/tenant/crm/v1/tags` | `crm.tags.read` |
| POST | `/api/tenant/crm/v1/tags` | `crm.tags.manage` |
| GET | `/api/tenant/crm/v1/tags/:id` | `crm.tags.read` |
| PATCH | `/api/tenant/crm/v1/tags/:id` | `crm.tags.manage` |
| DELETE | `/api/tenant/crm/v1/tags/:id` | `crm.tags.manage` |

Verified **2026-09-24** against `tags/tags.controller.ts`,
`tags/tags.service.ts` and `tags/dto/tag.dto.ts`.

The list is a raw, name-sorted array, not a Core envelope and not paginated.
Every catalogue response (`GET /tags`, `GET/POST/PATCH /tags/:id`) is one item
of this shape:

```json
{
  "id": "0192…",
  "name": "High priority",
  "backgroundColor": "#FEE2E2",
  "textColor": "#991B1B",
  "createdAt": "2026-09-24T09:00:00.000Z",
  "updatedAt": "2026-09-24T09:00:00.000Z"
}
```

A tenant can have at most 500 live tags. Names are trimmed, non-empty, at most
60 characters, and unique among live tags after case/whitespace normalization.

**Colour.** `backgroundColor` and `textColor` are a pair: both upper-case
`#RRGGBB`, or both `null` for an uncoloured tag. The server accepts either case
on input (`^#[0-9A-Fa-f]{6}$`) and stores the upper-case form.

| Request | Body | Rules |
| --- | --- | --- |
| `POST /tags` | `{ name, backgroundColor?, textColor? }` | Send both colours or neither |
| `PATCH /tags/:id` | any of `{ name?, backgroundColor?, textColor? }` | At least one key. Colours travel together; `backgroundColor: null, textColor: null` clears the colour |
| `DELETE /tags/:id` | — | `204`. Soft-deletes the tag and detaches it from every record in the same transaction |

| Status | Code | When |
| --- | --- | --- |
| `409` | `CRM_TAG_NAME_TAKEN` | Another live tag already has the normalized name |
| `422` | `CRM_TAG_LIMIT_EXCEEDED` | Creating the 501st live tag |
| `422` | `CRM_TAG_COLOR_INCOMPLETE` | Only one colour sent, or one `null` and the other not |
| `422` | `CRM_TAG_UPDATE_EMPTY` | `PATCH` with no field |
| `404` | `CRM_TAG_NOT_FOUND` | The tag does not exist or was deleted |

The same `{ id, name, backgroundColor, textColor }` summary is embedded in the
lead, customer-profile and opportunity read models, and
`GET /crm/{leads|customer-profiles|opportunities}/:id/tags` returns the full
catalogue shape above. The portal reads every one of them through
`crm/shared/tag-contract.ts`; a missing, half-set or malformed colour pair is
read as an uncoloured tag rather than failing the record that carries it.

`POST`, `PATCH` and `DELETE /tags*` are `idempotent: false` in the Gateway
contract, so the portal sends them with `nonReplayable` and no idempotency key.
A transport failure or `5xx` is an uncertain outcome: the catalogue is re-read
before anything else is sent.

The **Tags** screen at `/crm/tags` (Setup nav, gated on `crm.tags.read`;
create/edit/delete need `crm.tags.manage`) lists the catalogue with each chip,
creates and edits a tag's name and colour in one centred `FormModal size="card"` with the design
system's `TagColorPicker` — `PATCH` carries only the changed keys, colours as a
pair — and deletes through `ConfirmActionModal`.

The Create Lead modal loads this catalogue and sends the selected ids as
`CreateLeadDto.tagIds` in its single lead-creation request. Up to 50 unique ids
are saved atomically with the lead under scoped `crm.leads.create` authority.
Later attachment and detach are record operations under `/leads/:id/tags` and
require scoped `crm.leads.update`; neither path requires `crm.tags.manage`. See
[CRM — Leads](crm-leads.md#tags-during-creation).

## Custom fields

Canonical prefix: `/api/tenant/crm/v1/custom-fields`

| Method | Canonical path | Permission |
| --- | --- | --- |
| GET | `/api/tenant/crm/v1/custom-fields` | `crm.custom_fields.read` |
| POST | `/api/tenant/crm/v1/custom-fields` | `crm.custom_fields.manage` |
| PATCH | `/api/tenant/crm/v1/custom-fields/:id` | `crm.custom_fields.manage` |
| POST | `/api/tenant/crm/v1/custom-fields/:id/requirements` | `crm.custom_fields.manage` |
| GET | `/api/tenant/crm/v1/custom-fields/values` | `crm.custom_fields.read` |
| POST | `/api/tenant/crm/v1/custom-fields/values` | `crm.custom_fields.manage` |

**There is no `DELETE`.** A custom field is deactivated through `PATCH`, not
removed — deleting one would orphan every stored value. Do not build a delete
control for this screen.

The custom-field edit drawer requires `crm.custom_fields.manage` and sends
`{ nameAr, nameEn, isActive, isSearchable, options? }` to `PATCH /:id`.
The editor keeps `fieldKey`, `ownerType` and `type` fixed and omits unchanged
options when saving other metadata. PATCH does not
include requirements in its response, so the list retains its confirmed
requirement flags; requirements continue to use their separate operation.

Creation supports all eleven field types, including `SELECT` and
`MULTI_SELECT`, through the existing POST. Picklists require 1–100 options:
`{ key, nameAr, nameEn, sortOrder, isActive }`. Keys are unique, non-empty
strings of at most 64 characters; bilingual names are required and at most
120 characters; sort order is a positive integer. Other field types omit
`options` entirely. The option editor adds rows, edits labels, and toggles
active status. Persisted option keys are read-only and their rows cannot be
removed; retirement keeps the key with `isActive: false` to preserve history.
Only newly added, unsaved rows can be removed.

**Backend coordination (CRM-CF-002):** the currently inspected service returns
`409 CUSTOM_FIELD_OPTION_IN_USE` for both removal and deactivation of options
with stored values. The portal displays this conflict and retains the draft;
allowing deactivation of used options remains owned by CRM-CF-002.

Both metadata PATCH routes are non-idempotent in the Gateway contract. The
portal disables replay/automatic idempotency and refreshes the catalogue after
a transport, 5xx or malformed-response failure, closes the stale draft and
shows an uncertain-outcome message. A failed refresh explicitly asks for a
reload. Confirmed responses update the visible row without deleting history.

`/custom-fields/values` is how a record's custom-field **values** are read and
written. Definitions and values are separate resources: the definition list
tells you which inputs to render, `values` supplies and persists what the user
typed.

`POST /custom-fields/:id/requirements` sets the per-operation requirement flags
(`CREATE` / `UPDATE` / `CONVERT`) as one call — it is not a `PATCH` of the
definition.

### `fieldKey` is unique per `ownerType`, not per tenant

**Decided 2026-08-31**, from the CRM audit review's open question 4. The audit
found the documentation implying tenant-global uniqueness and the implementation
enforcing per-`ownerType` uniqueness, and asked which was intended.

**The implementation is right; the documentation was wrong.** Verified at
`custom-fields.service.ts:614`, where the uniqueness identity is built as:

```ts
const identity = `${row.ownerType}\u0000${row.fieldKey}`;
```

Scoped uniqueness is also the more useful model, which is why this is not merely
the cheaper answer: a `priority` field on a Lead and a `priority` field on an
Opportunity are genuinely different fields, and forcing `lead_priority` /
`opportunity_priority` makes every tenant re-encode the owner type into the key
by hand. Global uniqueness would buy nothing user-visible and cost a migration
with a collision survey attached.

Three consequences the screen must get right:

- **Validate duplicates within the chosen `ownerType` only.** A form that greys
  out a key because it exists under a different owner type is wrong, and the
  server will happily accept what the form refused.
- **`fieldKey` is normalized before it is stored** — trimmed, whitespace to
  underscores, lowercased — then matched against `^[a-z][a-z0-9_]{0,63}$`, else
  `422 CUSTOM_FIELD_KEY_INVALID`. Echo the normalized form back to the user
  rather than what they typed, or the next duplicate check disagrees with the
  server.
- **`422 CUSTOM_FIELD_KEY_AMBIGUOUS`** exists for a value write whose `fieldKey`
  resolves to more than one definition for that record. It is a distinct outcome
  from `404 CUSTOM_FIELD_NOT_FOUND` and needs its own message.

### Duplicate route family

The same six routes are also exposed under `/api/tenant/crm/v1/settings/custom-fields/*`.
Both families reach the same controller. **Use the `/custom-fields/*` form**
and treat the `/settings/` form as a compatibility alias; do not mix them in
one client.

Each field declares a `CrmCustomFieldOwnerTypeEnum` (which entity it attaches
to), a `CrmCustomFieldTypeEnum` (11 values), and per-operation requirement
flags via `CrmFieldRequirementOperationEnum` (`CREATE` / `UPDATE` / `CONVERT`).

The field type determines which primitive renders it — the mapping table is in
[../reference/enums.md](../reference/enums.md#crmcustomfieldtypeenum). Do not
invent a widget for a type not in that table.

A field marked required for `CREATE` must block submission on the create form
but not on edit. Requirements are per-operation, not global.

## CRM settings

Canonical prefix: `/api/tenant/crm/v1/settings`

`defaultLeadStageId` is absent from GET/PUT responses and is rejected as an
unknown PUT field (400). `defaultPipelineId` remains read-only on this
endpoint; pipeline selection uses the pipeline set-default action.

| Method | Canonical path | Permission |
| --- | --- | --- |
| GET | `/api/tenant/crm/v1/settings` | `crm.settings.read` |
| PUT | `/api/tenant/crm/v1/settings` | `crm.settings.manage` |

**The write is `PUT`, not `PATCH`**, with only changed writable fields;
omitted fields are retained. Retention saves must include
`expectedOutboundEmailRetentionPolicyRevision` from the loaded settings
whenever `outboundEmailContentRetentionDays` is supplied, and omit the token
otherwise. The response supplies the updated policy revision.

Retention contract source-verified **2026-10-18** (CXCRM-OPS-104) against the
Gateway settings routes, controller, DTO and compare-and-set service.
`409 CRM_OUTBOUND_EMAIL_RETENTION_POLICY_STALE` keeps the entire draft and
blocks further saves until the user reloads the policy. A successful reload
updates the confirmed server values and revision without replacing the draft.
A failed reload keeps the draft and recovery action. Compare the current server retention days
with the draft, then explicitly save again or discard the draft. No write is
retried automatically.

**The write permission is `crm.settings.manage`, not `crm.settings.update`.**
`crm.settings.update` exists in the permission catalogue but does *not* guard
this route — a user holding only it cannot save. Verified against
`@RequirePermissions` on `crm-settings.controller.ts`.

Tenant-wide CRM configuration. Some sections are read-only in the portal by
deliberate decision — telephony/Asterisk topology is exposed but must not be
edited from here, because a wrong value breaks call routing tenant-wide and
the safe editing surface is elsewhere.

## Static data catalogue

Presentation reviewed **2026-10-18** (FE-CRM-CONFIG-005): settings resolve
default stage and pipeline references through the validated catalogues, using
the selected language and an explicit unavailable label when access or lookup
fails. IDs and the retention revision appear only in closed technical details.
The static catalogue shows translated group names and server-provided labels;
unknown groups use an additional-options label. Wire keys and values remain
available in each row's closed technical details. Derived rules use the same
localized option labels, including a translated label for other stages.

Canonical prefix: `/api/tenant/crm/v1/static-data`

| Method | Canonical path | Permission |
| --- | --- | --- |
| GET | `/api/tenant/crm/v1/static-data` | `crm.settings.read` |

**Read-only runtime vocabulary.** There is no CRUD here and none must be
faked — an earlier version of this portal shipped a local CRUD fallback for
this screen, which is exactly the fabricated-behavior failure the unavailable
boundary now prevents.

Its values mirror the compiled enums in
[../reference/enums.md](../reference/enums.md). If the two disagree, the
installed package declaration wins and this documentation is stale.

## Frontend notes

Disabled-action feedback reviewed **2026-10-18** (FE-CRM-CONFIG-004): lead-stage,
pipeline and acquisition-source row actions expose cause-specific Arabic/English
tooltips on focusable wrappers, including inactive/default/protected/restricted
records, pending changes and reorder boundaries. Acquisition-source search also
shows a visible instruction to clear the search before reordering.

Error feedback verified by source review **2026-10-18** (FE-CRM-CONFIG-002):
settings, acquisition-source create/delete/reorder/icon upload and custom-field
creation use translated status/code outcomes without displaying server or parser
prose. Local name and retention validation use dictionary messages; uncertain
acquisition-source writes retain distinct refreshed/stale recovery messages.
Settings load failures render one error surface (or the permission boundary for
403); save and retention-conflict feedback stays beside the loaded form.

- All five mutable catalogues use `FormDrawer` for create and edit, and
  `ConfirmActionModal` for delete.
- All six screens render through `DataTable`.
- These catalogues are **fetched by the workspaces that depend on them** —
  Leads needs lead stages for its board axis, and both Leads and Customer
  Profiles need acquisition sources for their filters. Cache them per session;
  they change rarely.
- A `409` on delete means the catalogue entry is in use. Show which records
  block it if the response says; otherwise surface the code and refetch.

## Portal status

| Screen | Status |
| --- | --- |
| Lead stages | live — list, create, update/deactivate, delete, set-default and reorder; NEW first, DISQUALIFIED then CONVERTED last |
| Acquisition sources | live — list, create, edit names/active status, reorder, icon upload and delete |
| Tags | live — list, create, edit name/colour, delete |
| Custom fields | live — all field types creatable, edit names/active/searchable/options, requirements and values |
| CRM settings | live — safe subset writable |
| Static data catalogue | live — read-only, contract-tested |
