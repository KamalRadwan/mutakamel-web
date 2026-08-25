# CRM pipelines, boards, and opportunity stages

> Status: `verified-current`
> Last source verification: `2026-07-25`
> Owner: CRM (`crm-app`)
> Canonical browser prefix: `/api/tenant/crm/v1`
> Controller-relative prefix: `/api/v1/crm`
> Tenant Portal replacement: `not-started`
> Historical consolidated frontend: `absent-from-current-checkout`
> Authorship: hand-written from current backend source; historical frontend evidence is non-authoritative

This contract covers tenant pipeline administration, pipeline assignments, the reusable opportunity-stage catalogue, and branch/scoped board projections.

## Endpoint catalogue

### Pipeline administration

| Method | Canonical browser path | Controller/upstream path | Permission | Success |
|---|---|---|---|---|
| `POST` | `/api/tenant/crm/v1/pipelines` | `/api/v1/crm/pipelines` | `crm.pipelines.manage` | `201`, pipeline |
| `GET` | `/api/tenant/crm/v1/pipelines` | `/api/v1/crm/pipelines` | `crm.pipelines.read` | `200`, array |
| `GET` | `/api/tenant/crm/v1/pipelines/configuration` | `/api/v1/crm/pipelines/configuration` | `crm.pipelines.manage` | `200`, configuration |
| `GET` | `/api/tenant/crm/v1/pipelines/assignment-options` | `/api/v1/crm/pipelines/assignment-options` | `crm.pipelines.manage` | `200`, users/teams |
| `GET` | `/api/tenant/crm/v1/pipelines/:id` | `/api/v1/crm/pipelines/:id` | `crm.pipelines.read` | `200`, pipeline |
| `PATCH` | `/api/tenant/crm/v1/pipelines/:id` | `/api/v1/crm/pipelines/:id` | `crm.pipelines.manage` | `200`, pipeline |
| `DELETE` | `/api/tenant/crm/v1/pipelines/:id` | `/api/v1/crm/pipelines/:id` | `crm.pipelines.manage` | `204` |
| `PUT` | `/api/tenant/crm/v1/pipelines/:id/default` | `/api/v1/crm/pipelines/:id/default` | `crm.pipelines.manage` | `200`, pipeline |
| `POST` | `/api/tenant/crm/v1/pipelines/:id/reset` | `/api/v1/crm/pipelines/:id/reset` | `crm.pipelines.manage` | `200`, pipeline |
| `GET` | `/api/tenant/crm/v1/pipelines/:id/assignments` | `/api/v1/crm/pipelines/:id/assignments` | `crm.pipelines.manage` | `200`, assignments |
| `PUT` | `/api/tenant/crm/v1/pipelines/:id/assignments` | `/api/v1/crm/pipelines/:id/assignments` | `crm.pipelines.manage` | `200`, assignments |
| `POST` | `/api/tenant/crm/v1/pipelines/:id/stages` | `/api/v1/crm/pipelines/:id/stages` | `crm.pipelines.manage` | `201`, membership |
| `PATCH` | `/api/tenant/crm/v1/pipelines/:id/stages/reorder` | `/api/v1/crm/pipelines/:id/stages/reorder` | `crm.pipelines.manage` | `200`, memberships |
| `DELETE` | `/api/tenant/crm/v1/pipelines/:id/stages/:pipelineStageId` | `/api/v1/crm/pipelines/:id/stages/:pipelineStageId` | `crm.pipelines.manage` | `204` |

### Opportunity-stage catalogue

All five catalogue routes require `crm.pipelines.manage`, including reads.

| Method | Canonical browser path | Controller/upstream path | Success |
|---|---|---|---|
| `GET` | `/api/tenant/crm/v1/opportunity-stages` | `/api/v1/crm/opportunity-stages` | `200`, array |
| `GET` | `/api/tenant/crm/v1/opportunity-stages/:id` | `/api/v1/crm/opportunity-stages/:id` | `200`, stage |
| `POST` | `/api/tenant/crm/v1/opportunity-stages` | `/api/v1/crm/opportunity-stages` | `201`, stage |
| `PATCH` | `/api/tenant/crm/v1/opportunity-stages/:id` | `/api/v1/crm/opportunity-stages/:id` | `200`, stage |
| `DELETE` | `/api/tenant/crm/v1/opportunity-stages/:id` | `/api/v1/crm/opportunity-stages/:id` | `204` |

### Opportunity boards

| Method | Canonical browser path | Controller/upstream path | Permission | Success |
|---|---|---|---|---|
| `GET` | `/api/tenant/crm/v1/pipelines/:id/cards` | `/api/v1/crm/pipelines/:pipelineId/cards` | `crm.opportunities.read.{own|team|all}` | `200`, cursor page |
| `GET` | `/api/tenant/crm/v1/pipelines/:id/board` | `/api/v1/crm/pipelines/:pipelineId/board` | `crm.opportunities.read.{own|team|all}` | `200`, board |
| `GET` | `/api/tenant/crm/v1/pipelines/:id/stages/:stageId/opportunities` | `/api/v1/crm/pipelines/:pipelineId/stages/:stageId/opportunities` | `crm.opportunities.read.{own|team|all}` | `200`, cursor page |

Board routes require branch access and effective pipeline assignment in addition to opportunity scope. Pipeline administration routes are tenant-wide but assignment state controls which pipelines users can consume.

## Pipeline validation

Create fields:

| Field | Contract |
|---|---|
| `code` | required, maximum 48, normalized uppercase, `^[A-Z][A-Z0-9_-]*$` |
| `nameAr`, `nameEn` | required nonempty, trimmed, maximum 80 |
| `description` | optional, maximum 2,000 |
| `isDefault` | optional strict boolean |
| `stageIds` | optional nonempty unique array, at most 100 UUIDv7 values |

The selected stage set must contain exactly one semantic `NEW`, `WON`, and `LOST`; `NEW` must be first. Other active in-progress stages may be placed between them. The service prevents semantic duplicates.

Update accepts names, description, and strict `isActive`; `code` is immutable. Default, assignments, and stages use dedicated routes. A default pipeline must remain active, cannot be restricted, and cannot be deleted/deactivated while default.

`POST /:id/reset` restores the eligible default pipeline catalogue/memberships. It is only valid for the default pipeline and is blocked when catalogue/in-use rules make reset unsafe.

## Assignments

`GET /assignment-options` returns eligible active users and teams for administration. The server revalidates every ID during update.

`PUT /:id/assignments` body:

```json
{
  "accessMode": "RESTRICTED",
  "userIds": ["0191e9a8-7f51-7b32-8d72-19f9217a41b3"],
  "teamIds": []
}
```

Contract:

- `accessMode`: `ALL` or `RESTRICTED`;
- `userIds` and `teamIds`: required arrays, unique, at most 100 UUIDv7 values each;
- `ALL` requires both target arrays empty;
- `RESTRICTED` requires at least one user or team;
- the default pipeline must use `ALL`;
- users must be active and have the required CRM module seat; teams must be valid tenant teams.

This route requires a UUIDv7 `x-idempotency-key`.

## Opportunity-stage catalogue and memberships

Opportunity-stage create requires nonempty trimmed `nameAr` and `nameEn` up to 80 plus:

- `flag`: `NEW`, `DISCOVERY`, `QUALIFICATION`, `PROPOSAL`, `NEGOTIATION`, `CONTRACTING`, `ON_HOLD`, `WON`, or `LOST`;
- `category`: `OPEN`, `POSITIVE`, `NEGATIVE`, or `IN_PROGRESS`.

Update additionally accepts strict boolean `isActive`. Semantic combinations are service validated. System/in-use stages cannot be mutated or deleted in ways that invalidate active pipelines.

Add one stage membership:

```json
{ "opportunityStageId": "<uuid-v7>" }
```

The stage must be active, not already assigned, and the pipeline cannot exceed 100 memberships.

Reorder body contains `orderedIds`: the pipeline-stage membership IDs, not opportunity-stage catalogue IDs. It must be a nonempty unique UUIDv7 array of at most 100, exactly matching the current membership set, with the `NEW` membership first. Reorder requires UUIDv7 `x-idempotency-key`.

Delete membership uses `pipelineStageId` and returns no body. It is rejected when the membership is in use or required for pipeline semantics.

## Default pipeline idempotency

`PUT /pipelines/:id/default` has no body and requires UUIDv7 `x-idempotency-key`. Setting the default updates tenant pipeline state atomically. The three pipeline idempotent routes are:

1. `PUT /pipelines/:id/default`
2. `PUT /pipelines/:id/assignments`
3. `PATCH /pipelines/:id/stages/reorder`

Other pipeline/catalogue writes have no Gateway replay contract. Re-read state after an ambiguous response.

## Board queries

All board queries require UUIDv7 `branchId`. Shared optional filters:

| Query | Contract |
|---|---|
| `search` | maximum 200 |
| `status` | `OPEN`, `IN_PROGRESS`, `ON_HOLD`, `WON`, `LOST` |
| `ownerUserId` | UUIDv7; only narrows scoped results |
| `closing` | `OVERDUE`, `NEXT_7_DAYS`, `NEXT_30_DAYS`, `NO_DATE` |

`GET /board` accepts `limitPerStage` of exactly `25`, `50`, or `100`, default `50`. It returns pipeline/stage metadata plus an initial bounded card set for each visible stage. It does not apply `activityState`.

`GET /cards` accepts optional UUIDv7 `stageId`, `limit` of `25|50|100` default `50`, and opaque `cursor` up to 1,024 characters. Omit `stageId` for the all-stage card projection.

`GET /stages/:stageId/opportunities` accepts the same limit/cursor and optionally:

```text
activityState = NO_OPEN | OVERDUE | TODAY | FUTURE
```

The cursor belongs to the actor, branch, pipeline, stage, filters, and ordering that produced it. Do not decode, edit, persist across sign-in, or reuse after filters change. `OPPORTUNITY_BOARD_CURSOR_INVALID` means restart without a cursor.

Board card projections are enriched for the current portal view. There is no public response DTO freezing every card field; validate the properties consumed and tolerate additive fields. Pipeline/stage metadata and `nextCursor`/`hasNext` are server-owned.

## Seed pipeline

Fresh tenants have one default all-access pipeline with these semantic stages:

| Rank | Flag | Category |
|---:|---|---|
| 1 | `NEW` | `OPEN` |
| 2 | `QUALIFICATION` | `IN_PROGRESS` |
| 3 | `PROPOSAL` | `IN_PROGRESS` |
| 4 | `NEGOTIATION` | `IN_PROGRESS` |
| 5 | `WON` | `POSITIVE` |
| 6 | `LOST` | `NEGATIVE` |

Read IDs, bilingual labels, and current order from the API. Never hardcode seed identifiers or assume a tenant has not customized the catalogue.

## Errors and security

Pipeline/stage errors include:

```text
PIPELINE_NOT_FOUND
PIPELINE_CODE_TAKEN
PIPELINE_DEFAULT_DEACTIVATE
PIPELINE_DEFAULT_DELETE
PIPELINE_DEFAULT_INACTIVE
PIPELINE_DEFAULT_MISSING
PIPELINE_DEFAULT_RESTRICTED
PIPELINE_IN_USE
PIPELINE_RESET_BLOCKED
PIPELINE_RESET_CATALOG_MISSING
PIPELINE_RESET_DEFAULT_ONLY
PIPELINE_ASSIGNMENT_TEAMS_INVALID
PIPELINE_ASSIGNMENT_USERS_INVALID
PIPELINE_ASSIGNMENTS_INVALID
PIPELINE_STAGE_ALREADY_ASSIGNED
PIPELINE_STAGE_IN_USE
PIPELINE_STAGE_LIMIT
PIPELINE_STAGE_NOT_FOUND
PIPELINE_STAGE_REORDER_INVALID
PIPELINE_STAGE_REQUIRED
PIPELINE_STAGE_SELECTION_INVALID
PIPELINE_STAGE_SEMANTIC_DUPLICATE
PIPELINE_STAGES_REQUIRED
OPPORTUNITY_STAGE_CATEGORY_INVALID
OPPORTUNITY_STAGE_IN_USE
OPPORTUNITY_STAGE_NOT_FOUND
OPPORTUNITY_STAGE_SYSTEM_PROTECTED
CRM_USER_INACTIVE
CRM_MODULE_SEAT_REQUIRED
OPPORTUNITY_BOARD_CURSOR_INVALID
```

Pipeline read permission is not enough to manage catalogue/assignments. Opportunity read scope is not enough to bypass pipeline assignment or branch membership. Avoid revealing restricted pipeline/record existence in client error text.

All success JSON is raw service output; `204` has no body. These operations are synchronous.

## Sources

- `../backend/mutakamel-apps/crm-app/src/crm/pipelines/pipelines.controller.ts`
- `../backend/mutakamel-apps/crm-app/src/crm/pipelines/dto/pipeline.dto.ts`
- `../backend/mutakamel-apps/crm-app/src/crm/pipelines/pipelines.service.ts`
- `../backend/mutakamel-apps/crm-app/src/crm/pipelines/pipeline-access.service.ts`
- `../backend/mutakamel-apps/crm-app/src/crm/pipelines/opportunity-stages.controller.ts`
- `../backend/mutakamel-apps/crm-app/src/crm/pipelines/opportunity-stages.service.ts`
- `../backend/mutakamel-apps/crm-app/src/crm/opportunities/opportunity-board.controller.ts`
- `../backend/mutakamel-apps/crm-app/src/crm/opportunities/dto/opportunity-board.dto.ts`
- `../backend/mutakamel-apps/crm-app/src/crm/opportunities/opportunity-board.service.ts`
- `../backend/mutakamel-apps/crm-app/packages/common/src/enums/crm.enums.ts`
- `../backend/mutakamel-apps/crm-app/packages/database/src/seeds/v0.0.1/catalogue.ts`
- `../backend/mutakamel-apps/api-gateway-app/src/routing-proxy/route-contracts/crm.route-contracts.ts`
- `../backend/mutakamel-apps/mutakamel-web-app/src/features/tenant/crm/pipelines/pipeline-settings-api.ts`
