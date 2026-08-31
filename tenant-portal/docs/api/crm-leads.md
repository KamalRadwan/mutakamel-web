# CRM — Leads

Status: **verified**

Last source verification: **2026-08-31**

Owning app: **crm-app**

Canonical prefix: `/api/tenant/crm/v1/leads`

Upstream: `/api/v1/crm/leads` (`@Controller({ path: 'crm/leads', version: '1' })`)

Portal status: **built** — list, create, delete, stage move, detail, update
and conversion are all server-backed. Not exercised against a live session:
CRM is blocked twice over, by P4 and by Q17.

`GET /leads/capabilities` is `BRANCH_REQUIRED` in the Gateway route contract:
it needs `x-mutakamel-company-id` and `x-mutakamel-branch-id` as well as the
`branchId` query parameter. Without them `RouteContextMiddleware` answers
`400 GW.REQUEST.INVALID` before crm-app sees the request, which reads exactly
like "no capabilities" and is not a permission answer.

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
| `sortDir` | `ASC` \| `DESC` | no | Uppercase. **Not** `sortOrder`, which is a lead-stage *field* — see [README.md#sort-parameters-differ-per-endpoint](README.md#sort-parameters-differ-per-endpoint) |
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
after success.

### Conversion cannot change a Party from a person into an organization

**Decided 2026-08-31**, from the CRM audit review's open question 1. The audit
asked whether an Individual lead converting to a Corporate customer should
change the Party's type. **It must not, and it already cannot.**

`crm-app/src/common/party-directory.adapter.ts:195` — `ensureParty` is called
during conversion with the lead's **existing** `partyId` and a `partyType`
derived from `dto.profileType`. When those disagree it throws:

```
409  PARTY_TYPE_IMMUTABLE
     "An existing party cannot change between person and organization."
```

So converting a lead whose Party is a `PERSON` with `profileType: "CORPORATE"`
is a **409, not a silent mutation**. That is the correct behaviour and this page
now says so rather than leaving the reader to discover it: Party type is an
identity invariant, and every projection that has already resolved that Party
would be corrupted by changing it. A workflow's convenience does not outrank an
identity invariant.

The right shape for a genuine individual-to-corporate promotion is a **new
organization Party plus a relationship**, with lineage kept on both — not a type
change. That is not built, in this portal or in crm-app.

> **Portal gap, recorded here rather than assumed away.** `PARTY_TYPE_IMMUTABLE`
> appears nowhere in `src/` — the conversion drawer does not name it, so a user
> who picks the wrong profile type gets the generic 409 copy instead of the one
> sentence that would tell them what to do. It is a real reachable outcome of a
> live screen.

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
| Table view | live — `DataTable`, first column links to the detail screen |
| Capabilities-driven actions | live — every control on the list and the detail screen |
| Detail route | live — `/crm/leads/[id]`; **the proxy does not admit the path yet, see OPEN-QUESTIONS.md Q40** |
| Update | live — `PATCH /:id`, changed keys only |
| Convert flow | live — three-step drawer, one idempotency key per attempt |
| Company options | live — both routes, in the create drawer |
