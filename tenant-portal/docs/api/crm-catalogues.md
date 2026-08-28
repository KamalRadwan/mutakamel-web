# CRM — Catalogues & Settings

Status: **verified**

Last source verification: **2026-08-27**

Owning app: **crm-app**

Portal status: **live** — all five screens are server-backed.

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

Consequences for the UI:

- Always render in `sortOrder`. Never alphabetize.
- Never hardcode a stage name or assume a count.
- The flag, not the name, determines the status badge role and whether a move
  into it is terminal.

Deleting a stage that holds leads is a `409`. Surface it and refetch.

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
