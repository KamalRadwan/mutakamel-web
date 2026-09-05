# CRM — Catalogues & Settings

Status: **verified**

Last source verification: **2026-08-27**

Owning app: **crm-app**

Portal status: **built** — all five screens are server-backed. Not exercised
against a live session: CRM is blocked twice over, by P4 and by Q17.

Covers the tenant-configured vocabulary the workspaces depend on: lead stages,
acquisition sources, custom fields, CRM settings, and the read-only static
catalogue.

Source inspected:
`crm-app/src/crm/lead-stages/lead-stages.controller.ts`,
`acquisition-sources/acquisition-sources.controller.ts`,
`custom-fields/custom-fields.controller.ts`,
`settings/`, `static-data/`.

## Lead stages

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
answers `422 LEAD_STAGE_REORDER_INVALID` unless **both** hold:

| Rule | What the UI must do |
| --- | --- |
| Every non-deleted stage appears exactly once | Build the list from the unfiltered catalogue, never a searched subset — so the reorder controls are suppressed while a search is active |
| The single `NEW`-flagged stage stays first, at rank 1 | Pin it: refuse a move that would drag it or drop another stage above it, rather than round-tripping into a 422 |

The response is the whole catalogue in its new order, densely re-ranked from 1
— so it replaces the list rather than patching one row into it.

Both rules re-verified against that service on **2026-09-04**, when the portal
started calling this route: the lead-stages table reorders by dragging a row's
grip.

Consequences for the UI:

- Always render in `sortOrder`. Never alphabetize.
- Never hardcode a stage name or assume a count.
- The flag, not the name, determines the status badge role and whether a move
  into it is terminal.

Deleting a stage that holds leads is a `409`. Surface it and refetch.

### `stage.isDefault` is the only authority. `settings.defaultLeadStageId` is dead

**Decided 2026-08-31**, from the CRM audit review's open question 3: *which of
the two fields decides where a new lead lands?*

There are two candidates, and this looked like a genuine ambiguity. It is not —
**one of them is already dead**, and this was settled by finding the reader
rather than by argument:

| Field | Read by anything? |
| --- | --- |
| `crm_lead_stages.is_default` | **Yes.** `leads.service.ts:1085` resolves the stage for a new lead with `where: { isDefault: true, isActive: true }` |
| `crm_settings.default_lead_stage_id` | **No.** It is seeded, stored, exposed on `GET /settings` and accepted on `PATCH /settings` — and no code path consults it when creating a lead |

So `stage.isDefault` is the authority, and `defaultLeadStageId` should be deleted
from Settings or turned into a read-through of it.

**Why this matters more than a tidy-up:** a settings screen that offers
`defaultLeadStageId` is a control that lies. The user picks a stage, the request
succeeds, the value is stored and echoed back — and new leads keep landing
somewhere else. There is no error to notice. **Do not build an editor for
`defaultLeadStageId` in this portal.** If it has to appear at all, it is
read-only and labelled as reflecting the stage catalogue.

The `isDefault` side already carries its own protections, verified in
`lead-stages.service.ts`. A default always exists, and it is always a stage a
lead can legitimately start in:

| Rule | Outcome |
| --- | --- |
| The first stage created becomes the default whether or not you ask | line 33 |
| Setting a default clears the previous one in the same transaction | line 92 |
| A `CONVERTED`-flagged stage cannot be the default | `422 LEAD_STAGE_DEFAULT_CONVERTED` |
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

| Method | Canonical path | Permission |
| --- | --- | --- |
| GET | `/api/tenant/crm/v1/settings` | `crm.settings.read` |
| PUT | `/api/tenant/crm/v1/settings` | `crm.settings.manage` |

**The write is `PUT`, not `PATCH`** — it replaces the settings document, so
send the full object. A partial body will clear the fields you omitted.

**The write permission is `crm.settings.manage`, not `crm.settings.update`.**
`crm.settings.update` exists in the permission catalogue but does *not* guard
this route — a user holding only it cannot save. Verified against
`@RequirePermissions` on `crm-settings.controller.ts`.

Tenant-wide CRM configuration. Some sections are read-only in the portal by
deliberate decision — telephony/Asterisk topology is exposed but must not be
edited from here, because a wrong value breaks call routing tenant-wide and
the safe editing surface is elsewhere.

## Static data catalogue

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

- All four mutable catalogues use `FormDrawer` for create and edit, and
  `ConfirmActionModal` for delete.
- All five screens render through `DataTable`.
- These catalogues are **fetched by the workspaces that depend on them** —
  Leads needs lead stages for its board axis, and both Leads and Customer
  Profiles need acquisition sources for their filters. Cache them per session;
  they change rarely.
- A `409` on delete means the catalogue entry is in use. Show which records
  block it if the response says; otherwise surface the code and refetch.

## Portal status

| Screen | Status |
| --- | --- |
| Lead stages | live — list, create, delete, set-default |
| Acquisition sources | live |
| Custom fields | live |
| CRM settings | live — safe subset writable |
| Static data catalogue | live — read-only, contract-tested |
