# CRM — Leads

Status: **verified**

Last source verification: **2026-08-27**

Owning app: **crm-app**

Canonical prefix: `/api/tenant/crm/v1/leads`

Upstream: `/api/v1/crm/leads` (`@Controller({ path: 'crm/leads', version: '1' })`)

Portal status: **live** — server-backed list/create/delete/stage-move.
Outstanding: table view conversion, conversion flow, detail route.

Source inspected:
`crm-app/src/crm/leads/leads.controller.ts`,
`crm-app/src/crm/leads/dto/lead.dto.ts`,
`crm-app/src/crm/common/dto/crm-list-query.dto.ts`,
`api-gateway-app/src/routing-proxy/route-contracts/crm.route-contracts.ts`.

## Routes

| Method | Canonical path | Route key | Class | Permission |
| --- | --- | --- | --- | --- |
| POST | `/leads` | `crm.leads.post` | WRITE_SENSITIVE | `crm.leads.create` (scoped) |
| GET | `/leads` | `crm.leads.get` | AUTHENTICATED | `crm.leads.read` (scoped) |
| GET | `/leads/capabilities` | `crm.leads.capabilities.get` | AUTHENTICATED | **none** — branch membership only |
| GET | `/leads/company-options` | `crm.leads.company.options.get` | AUTHENTICATED | `crm.leads.create` (scoped) |
| GET | `/leads/company-options/:companyPartyId/contacts` | — | AUTHENTICATED | `crm.leads.create` (scoped) |
| GET | `/leads/:id` | `crm.leads.by.id.get` | AUTHENTICATED | `crm.leads.read` (scoped) |
| PATCH | `/leads/:id` | `crm.leads.by.id.patch` | WRITE_SENSITIVE | `crm.leads.update` (scoped) |
| POST | `/leads/:id/stage` | `crm.leads.by.id.stage.post` | WRITE_SENSITIVE | `crm.leads.update` (scoped) |
| POST | `/leads/:id/convert` | `crm.leads.by.id.convert.post` | WRITE_SENSITIVE | `crm.leads.convert` (scoped) |
| DELETE | `/leads/:id` | `crm.leads.by.id.delete` | WRITE_SENSITIVE | `crm.leads.delete` (scoped) |

Branch guards: `@RequireBranchAccess('body')` on create,
`@RequireBranchAccess('query')` on the list and both option routes,
`@RequireRecordBranchAccess('LEAD')` on every `:id` route.

## GET /leads — list

Query (`LeadsQueryDto extends BranchListQueryDto extends PaginationQueryDto`):

| Parameter | Type | Required | Notes |
| --- | --- | --- | --- |
| `branchId` | UUIDv7 | **yes** | `@IsUUID('7')`, not optional |
| `page` | integer ≥ 1 | no | |
| `limit` | integer | no | endpoint-bounded |
| `sortBy` | string | no | default `createdAt` |
| `sortOrder` | `ASC` \| `DESC` | no | |
| `leadProfileType` | `CrmProfileTypeEnum` | no | `INDIVIDUAL` \| `CORPORATE` |
| `status` | `LeadStatusEnum` | no | `OPEN` \| `CONVERTED` \| `DISQUALIFIED` \| `ON_HOLD` |
| `stageFlag` | `LeadStageFlagEnum` | no | 8 values — see [enums](../reference/enums.md#leadstageflagenum) |
| `stageId` | UUIDv7 | no | tenant lead-stage catalogue id |
| `acquisitionSourceId` | UUIDv7 | no | |
| `ownerUserId` | UUIDv7 | no | **narrows only — never grants access** |

Response: `200`, paginated `{ items, meta }` — **raw CRM shape, not a Core
envelope.**

Scoped read narrows results by the actor's own/team/all scope on top of the
branch filter. An empty page is not proof that no leads exist.

## GET /leads/capabilities

Query: `branchId` (required). **No leads permission required** — branch
membership is enough, so it is safe to call before the list resolves.

Response `200`:

```json
{
  "branchId": "018f0000-0000-7000-8000-000000000001",
  "leads": {
    "create":  { "scope": "team", "ownerUserIds": ["018f…101"] },
    "update":  { "scope": "own",  "ownerUserIds": ["018f…101"] },
    "delete":  null,
    "convert": { "scope": "all",  "ownerUserIds": null }
  },
  "activities":    { "create": { "scope": "team", "ownerUserIds": ["018f…101"] } },
  "notes":         { "create": { … }, "delete": null },
  "attachments":   { "create": { … }, "delete": null },
  "opportunities": { "create": { "scope": "all", "ownerUserIds": null } }
}
```

**This drives every action control on the screen.** `null` = unavailable.
`ownerUserIds: null` with `scope: "all"` = no owner boundary; a non-null array
is the explicit owner boundary for `own`/`team`.

Do not infer action availability from `/auth/me` permission strings when this
endpoint exists — it already accounts for branch and owner scope.

## POST /leads — create

Body: `CreateLeadDto` (`crm-app/src/crm/leads/dto/lead.dto.ts`). Must include
the branch, since `@RequireBranchAccess('body')` reads it from the payload.

Success `201` with the created lead. Errors: `409` conflict, `422` validation.

`forbidNonWhitelisted` is on — send only documented keys.

## POST /leads/:id/stage — move stage

The board view's drag-and-drop target.

Body: `MoveLeadStageDto` — the destination tenant lead-stage id.

Success **`201`** (not 200) with the lead after movement. Errors: `404`, `422`.

The backend derives lifecycle `status` from the destination stage's semantic
flag. **Do not set `status` yourself** — moving into a stage flagged
`CONVERTED` or `DISQUALIFIED` is what changes the status, server-side.

Both of those are terminal and require confirmation before the request — see
[../design/views.md](../design/views.md#board-view).

## POST /leads/:id/convert

Converts a qualified lead into customer/contact records and optionally an
opportunity.

Body: `ConvertLeadDto`. Success `201`:

```json
{ "lead": { … }, "customerProfile": { … }, "opportunity": { … } }
```

Errors: `404`, `409`, `422`. Show the returned customer and opportunity links
after success. **Not yet implemented in the portal.**

## PATCH /leads/:id · DELETE /leads/:id

Update returns `200` with the updated lead (`404`, `409`, `422`).
Delete is a **soft delete**, returns **`204` with no body** (`404`, `409`).

## Company options

For linking a corporate lead to an existing organization party:

- `GET /leads/company-options?branchId=` → `[{ id, displayName, legalName, branchId }]`
- `GET /leads/company-options/:companyPartyId/contacts?branchId=` → active
  contact people for that party

Both require `crm.leads.create`. Both are Gateway-exposed (previously
documented otherwise — that was wrong).

## Frontend notes

- Board axis is the **tenant lead-stage catalogue**, ordered by `sortOrder` —
  fetch from `/lead-stages`. Never hardcode stage names or assume a count.
- Stage move is `POST /:id/stage`, never a generic `PATCH`.
- Move optimistically; roll back on failure.
- Every action control is gated by `capabilities`, not by permission strings.
- Status renders through `StatusBadge`; never display the raw wire value.
- `ownerUserId` is a filter, not an authorization mechanism.

## Portal status

| Capability | Status |
| --- | --- |
| List, branch-scoped, paginated | live |
| Create | live |
| Delete | live |
| Stage move + board | live |
| Card view | live |
| **Table view** | **`list` view exists; must become `DataTable`** |
| Capabilities-driven actions | **not wired — uses permission strings today** |
| Detail route | not started |
| Convert flow | not started |
| Company options | not started |
