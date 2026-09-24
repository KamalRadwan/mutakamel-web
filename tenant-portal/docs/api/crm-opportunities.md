# CRM — Opportunities & Pipelines

Status: **verified**

Last source verification: **2026-09-18**

Owning app: **crm-app**

Canonical prefix: `/api/tenant/crm/v1/opportunities`, `/pipelines`,
`/opportunity-stages`

Portal status: **built** — board, rich card and table views, persistent
importance and card colour, plus delete. See the full breakdown below. Not
exercised against a live session: CRM is blocked twice over, by P4 and by Q17.

Source inspected:
`crm-app/src/crm/opportunities/opportunities.controller.ts`,
`opportunity-board.controller.ts`,
`crm-app/src/crm/pipelines/pipelines.controller.ts`,
`opportunity-stages.controller.ts`,
`crm-app/src/crm/common/dto/crm-list-query.dto.ts`.

## Routes

| Method | Canonical path | Permission | Branch guard |
| --- | --- | --- | --- |
| POST | `/api/tenant/crm/v1/opportunities` | `crm.opportunities.create` (scoped) | body |
| GET | `/api/tenant/crm/v1/opportunities` | `crm.opportunities.read` (scoped) | query |
| POST | `/api/tenant/crm/v1/opportunities/search` | `crm.opportunities.read` (scoped) | body |
| GET | `/api/tenant/crm/v1/opportunities/capabilities` | **none** — branch membership | query |
| GET | `/api/tenant/crm/v1/opportunities/:id/tags` | `crm.opportunities.read` (scoped) | record |
| POST | `/api/tenant/crm/v1/opportunities/:id/tags` | `crm.opportunities.update` (scoped) | record |
| DELETE | `/api/tenant/crm/v1/opportunities/:id/tags/:tagId` | `crm.opportunities.update` (scoped) | record |
| GET | `/api/tenant/crm/v1/opportunities/:id` | `crm.opportunities.read` (scoped) | record |
| PATCH | `/api/tenant/crm/v1/opportunities/:id` | `crm.opportunities.update` (scoped) | record |
| POST | `/api/tenant/crm/v1/opportunities/:id/stage` | `crm.opportunities.update` (scoped) | record |
| PUT | `/api/tenant/crm/v1/opportunities/:id/pipeline` | `crm.opportunities.update` (scoped) | record |
| GET | `/api/tenant/crm/v1/opportunities/:id/stage-history` | `crm.opportunities.read` (scoped) | record |
| DELETE | `/api/tenant/crm/v1/opportunities/:id` | `crm.opportunities.delete` (scoped) | record |

Pipelines and stages:

| Method | Canonical path | Permission |
| --- | --- | --- |
| GET | `/api/tenant/crm/v1/pipelines` | `crm.pipelines.read` |
| GET | `/api/tenant/crm/v1/pipelines/:id` | `crm.pipelines.read` |
| GET | `/api/tenant/crm/v1/pipelines/configuration` | `crm.pipelines.read` |
| GET | `/api/tenant/crm/v1/opportunity-stages` | `crm.pipelines.manage` |
| GET | `/api/tenant/crm/v1/opportunity-stages/:id` | `crm.pipelines.manage` |
| POST | `/api/tenant/crm/v1/opportunity-stages` | `crm.pipelines.manage` |
| PATCH | `/api/tenant/crm/v1/opportunity-stages/:id` | `crm.pipelines.manage` |
| DELETE | `/api/tenant/crm/v1/opportunity-stages/:id` | `crm.pipelines.manage` |

**Both GETs require `.manage`, not `.read`** — every one of the five routes on
`opportunity-stages.controller.ts` carries `@RequirePermissions('crm.pipelines.manage')`.
This table said `.read` for the two reads until 2026-08-31. Gating a screen on
`.read` would admit an actor whose every subsequent request answers 403, which
is worse than not showing them the screen: `PermissionGate` would never fire,
and they would meet the refusal one control at a time.

The same applies to `GET /pipelines/configuration`.
| PUT | `/api/tenant/crm/v1/pipelines/:id/default` | `crm.pipelines.manage` |
| PATCH | `/api/tenant/crm/v1/pipelines/:id/stages/reorder` | `crm.pipelines.manage` |
| DELETE | `/api/tenant/crm/v1/pipelines/:id/stages/:pipelineStageId` | `crm.pipelines.manage` |
| POST | `/api/tenant/crm/v1/pipelines/:id/reset` | `crm.pipelines.manage` |
| GET | `/api/tenant/crm/v1/pipelines/:id/assignments` | `crm.pipelines.manage` |
| PUT | `/api/tenant/crm/v1/pipelines/:id/assignments` | `crm.pipelines.manage` |
| GET | `/api/tenant/crm/v1/pipelines/assignment-options` | `crm.pipelines.manage` |

Complete list: [crm-reference.md](crm-reference.md).

`assignments` is how a `RESTRICTED` pipeline
(`PipelineAccessModeEnum`) grants access to specific users or teams. Stage
reordering is a dedicated endpoint — never a per-stage `PATCH` of rank, which
races.

**Two different stage resources, easy to confuse:**

| Resource | Meaning |
| --- | --- |
| `/opportunity-stages` | The tenant-wide **stage catalogue** — the vocabulary |
| `/pipelines/:id/stages/:pipelineStageId` | One stage's **membership in a pipeline** |

Deleting from the catalogue removes the definition everywhere; deleting a
pipeline stage removes that stage from that one pipeline. They are not
interchangeable, and the second is what a pipeline editor calls.

**`POST /pipelines/:id/reset` is destructive** — it returns the pipeline to its
default stage configuration. Anything that depends on the removed stages is
affected. Require an explicit typed confirmation, not a plain
"are you sure".

## The board and card endpoints — use these, not the list

**This is the single most important thing on this page.** There are
purpose-built read models for the board and card views. The generic
`GET /opportunities` list is for the **table view only**.

| Method | Canonical path | Purpose |
| --- | --- | --- |
| GET | `/api/tenant/crm/v1/pipelines/:id/board` | Every ranked stage, each with its own first page, totals and cursor |
| GET | `/api/tenant/crm/v1/pipelines/:id/cards` | Display-ready cards, cursor-paginated |
| GET | `/api/tenant/crm/v1/pipelines/:id/stages/:stageId/opportunities` | The next page for one stage column |

All three: `crm.opportunities.read` (scoped), `@RequireBranchAccess('query')`.

Source: `crm-app/src/crm/opportunities/opportunity-board.controller.ts`.

### Why this matters

Grouping the generic list client-side by stage **cannot work at scale**. One
paginated list of 50 cannot fill eight columns, and it cannot produce accurate
per-column totals. The board endpoint solves exactly that: each stage gets an
independently limited page plus its own cursor, so columns paginate separately.

### Board response

```json
{
  "pipeline": { "id": "0192…", "stages": [] },
  "stages": [{
    "stage": { "id": "0192…", "rank": 1, "nameEn": "New" },
    "items": [{
      "id": "0192…",
      "title": "Renew annual subscription",
      "customerProfileType": "CORPORATE",
      "customerDisplayName": "Acme Trading",
      "customerCompanyName": "Acme Trading LLC",
      "contactDisplayName": "Mona Hassan",
      "importance": 3,
      "cardColor": "BLUE",
      "amount": "250000.00",
      "currencyCode": "EGP",
      "probabilityPercent": 65,
      "expectedCloseDate": "2026-10-31",
      "ownerDisplayName": "Sara Sales",
      "ownerAvatarUrl": "/api/tenant/core/v1/directory/parties/0192…/image?v=1784023200000",
      "openActivityCount": 2,
      "nextOpenActivityAt": "2026-09-19T08:00:00.000Z",
      "activityState": "TODAY",
      "tags": [{ "id": "0192…", "name": "Renewal", "backgroundColor": "#DBEAFE", "textColor": "#1E40AF" }]
    }],
    "summary": {
      "totalCount": 143,
      "amountsByCurrency": [{ "currencyCode": "EGP", "amount": "250000.00" }]
    },
    "activitySummary": {
      "totalCount": 143, "noOpenCount": 39,
      "overdueCount": 12, "todayCount": 18, "futureCount": 74
    },
    "pageInfo": { "limit": 50, "hasMore": true, "nextCursor": "opaque-cursor" }
  }]
}
```

- `summary.amountsByCurrency` is a **per-stage, per-currency** array of decimal
  strings. There is no single total, because a pipeline can mix currencies —
  render each currency separately and never add across them.
- `activitySummary` gives the column an at-a-glance follow-up state
  (`overdueCount` is the one worth surfacing).
- Stage order is `stage.rank`, not a client sort.
- Board items use the compact read model needed by the lane card. They include
  customer/company/contact display names, deal values, tags (each
  `{ id, name, backgroundColor, textColor }`, verified 2026-09-24), public owner,
  activity state, `importance` and `cardColor`. They deliberately omit phone,
  email, address, the full primary-contact object and acquisition-source
  details; those belong to Card/Table and detail responses.

### Card response

```json
{
  "pipeline": { "id": "0192…", "stages": [] },
  "selectedStageId": null,
  "totalCount": 143,
  "items": [{
    "id": "0192…",
    "title": "Renew annual subscription",
    "stageId": "0192…",
    "status": "IN_PROGRESS",
    "amount": "250000.00",
    "currencyCode": "EGP",
    "probabilityPercent": 65,
    "expectedCloseDate": "2026-10-31",
    "customerProfileType": "CORPORATE",
    "customerDisplayName": "Acme Trading",
    "customerCompanyName": "Acme Trading LLC",
    "customerPhone": "+201000000000",
    "customerEmail": "sales@acme.example",
    "customerCountry": "Egypt",
    "customerCity": "Cairo",
    "primaryContact": {
      "displayName": "Mona Hassan",
      "jobTitle": "Procurement Manager",
      "phones": ["+201011111111"],
      "email": "mona@acme.example",
      "isPrimary": true
    },
    "leadSourceName": "Website",
    "leadSourceIconUrl": "/api/tenant/crm/v1/acquisition-sources/0192…/icon?v=1784023200000",
    "ownerDisplayName": "Sara Sales",
    "ownerAvatarUrl": "/api/tenant/core/v1/directory/parties/0192…/image?v=1784023200000",
    "importance": 3,
    "cardColor": "BLUE",
    "openActivityCount": 2,
    "nextOpenActivityAt": "2026-09-19T08:00:00.000Z",
    "activityState": "TODAY",
    "tags": [{ "id": "0192…", "name": "Renewal", "backgroundColor": null, "textColor": null }]
  }],
  "pageInfo": { "limit": 50, "hasMore": true, "nextCursor": "opaque-cursor" }
}
```

- `stageId` is an **optional** query parameter on this route, and omitting it
  is the All case — `OpportunityCardQueryDto` says it is optional "so the UI
  can offer an All tab without downloading all stages into the browser first".
  It echoes back as `selectedStageId`; a stage id outside the pipeline is a
  **404**. Send no key rather than an empty one: `@IsOptional()` skips only
  null/undefined, so `stageId=` reaches `@IsUUID('7')` and is a 400.
- Card items are the enriched opportunity read model. They retain the exact
  per-opportunity `amount`, `currencyCode`, `probabilityPercent`,
  `expectedCloseDate` and `status` alongside the customer/contact projection.
  The board's stage `summary` remains the authoritative aggregate; never add
  card amounts in the browser.
- `ownerAvatarUrl` is a **safe, cache-busted server path**. Render it as given;
  never construct an avatar URL by hand.
- `importance` is an integer, rendered as stars.
- `cardColor` is the persisted CRM card colour and uses the same palette as
  Lead and Customer cards.
- `openActivityCount` counts planned activities without exposing the activity
  records themselves.
- Cursors are **opaque and filter-bound**. The same filters sent for the
  initial request must be resent with the cursor, or the page is rejected.

### Cursor pagination, not page numbers

Board and card views are cursor-paginated; the table view is page-numbered.
Do not try to unify them — `DataTable` uses `page`/`limit` against
`GET /opportunities`, while the board and card views follow `nextCursor`.

## GET /opportunities — list

`OpportunitiesQueryDto extends BranchListQueryDto`:

| Parameter | Type | Required |
| --- | --- | --- |
| `branchId` | UUIDv7 | **yes** |
| `page`, `limit`, `sortBy`, `sortDir` | pagination | no — `sortDir` is `ASC`/`DESC`, see [README.md#sort-parameters-differ-per-endpoint](README.md#sort-parameters-differ-per-endpoint) |
| `search`, `searchField` | text plus `opportunity` \| `customer` \| `email` \| `phone` | no |
| `pipelineId` | UUIDv7 | no |
| `stageId` | UUIDv7 | no |
| `status` | `OpportunityStatusEnum` | no |
| `stageFlag` | `OpportunityStageFlagEnum` | no |
| `customerProfileId` | UUIDv7 | no |
| `ownerUserId` | UUIDv7 | no — **narrows only** |
| `expectedCloseFrom` | ISO date string | no |
| `expectedCloseTo` | ISO date string | no |

`expectedCloseFrom`/`To` are `@IsDateString()` — send ISO strings, not
`Date` objects.

Response `200` is the flat CRM page
`{ items, total, page, limit, totalPages, hasNext, hasPrev }`. Each item is the
same enriched read row used by Card view, including customer/contact, source,
owner, activity, tags, `importance`, `cardColor` and the commercial fields.
Table view must preserve the exact decimal `amount` string.

Advanced search uses `POST /opportunities/search`; its filter tree supports
`importance` and `cardColor` alongside pipeline, stage, status, customer,
owner, source and commercial conditions. Basic search remains the token input
and keeps its default **My Opportunities** scope.

## PATCH /opportunities/:id — rank and card colour

The ordinary opportunity update route persists the two card controls:

```json
{ "importance": 2, "cardColor": "BLUE" }
```

- `importance` is the opportunity rank, an integer from `0` through `3` and is
  rendered as three stars. No duplicate `rating` field is introduced.
- `cardColor` accepts the shared CRM palette or `null`; `null` clears it and an
  omitted key leaves it unchanged.
- Optimistic clients update only the changed presentation/rank keys and keep
  the remaining rich Board/Card/Table row intact.

## POST /opportunities/:id/stage — move stage

The board's drag target. Success **`201`**.

The backend derives `status` from the destination stage's semantic flag.
**Do not send `status`.** Stages flagged `WON` or `LOST` are terminal and
require confirmation before the request.

## PUT /opportunities/:id/pipeline — transfer

Moves an opportunity to a **different pipeline**. Distinct from a stage move,
and a `PUT`, not a `POST`.

This is destructive to stage position — the opportunity lands in the target
pipeline's entry stage. Confirm before sending.

## GET /opportunities/capabilities

Same contract as leads. No opportunities permission required, only branch
membership. Drives every action control. `null` means unavailable.

It reports **only** `opportunities.{create,update,delete}` —
`OpportunitiesService.getCapabilities` resolves nothing else. Notes and
attachments capabilities exist only on `GET /leads/capabilities`, which is
resource-and-branch scoped rather than lead scoped and needs no leads
permission.

Like the leads one, this route is `BRANCH_REQUIRED`: the two scope headers are
mandatory alongside the query parameter, and omitting them is a Gateway 400
before crm-app sees the request.

See [README.md](README.md#capabilities-endpoints).

## Amounts are decimal strings

Opportunity amount arrives as an **exact decimal string**.

```ts
// ❌ loses precision
const total = Number(opportunity.amount);

// ✅
const display = formatCurrency(opportunity.amount, currency, locale);
```

Never sum a column in the browser. Pipeline totals come from the server or
they do not exist.

## Frontend notes

- **The board axis is the selected pipeline's stages**, ordered by
  `sortOrder`. The board is meaningless without a pipeline, so the pipeline
  selector is required and `pipelineId` belongs in the URL.
- Stage names are tenant-configured. Never hardcode them, never assume a count.
- Stage move is `POST /:id/stage`; pipeline transfer is `PUT /:id/pipeline`.
  They are not interchangeable.
- Importance and card colour persist across Board, Card and Table. Move,
  colour, rank and delete actions must each use their own row-level capability
  check.
- Nine `OpportunityStageFlagEnum` values is why stage is never encoded by hue —
  see [../design/tokens.md](../design/tokens.md#status-mapping).

## Portal status

| Capability | Status |
| --- | --- |
| List, branch-scoped, paginated | live — table view |
| Board view + stage move | live — 50 rows per independently paginated stage, compact opportunity read model |
| Card view | live — rich customer/contact/source data, commercial fields, PQ/SO/IN, importance and card colour |
| Advanced search | live — includes importance and card colour |
| Capabilities-driven actions | live — owner-scoped update (drag/importance) and delete; enriched rows provide customer/contact and owner display data |
| Delete | live — `DELETE /:id`, capability-gated |
| Create | live — `POST /opportunities` against an existing customer, plus the lead-conversion route |
| Update | live — `PATCH /:id`, changed keys only; no pipeline or stage, which the DTO does not carry |
| Pipeline transfer | live — `PUT /:id/pipeline`, confirmed, terminal target stages filtered out |
| Stage history | live — `GET /:id/stage-history` on `Timeline`, in the server order |
| Detail route | live — `/crm/opportunities/[id]`; the Gateway admits the CRM detail path |
