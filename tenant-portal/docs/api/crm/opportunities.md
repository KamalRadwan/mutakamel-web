# CRM opportunities and stage history

> Status: `verified-current`
> Last source verification: `2026-08-25`
> Owner: CRM (`crm-app`)
> Canonical browser prefix: `/api/tenant/crm/v1`
> Controller-relative prefix: `/api/v1/crm`
> Tenant Portal replacement: `server-backed-board-minimal`
> Historical consolidated frontend: `absent-from-current-checkout`
> Authorship: hand-written from current backend source; historical frontend evidence is non-authoritative

Opportunities belong to a branch, customer, pipeline, and pipeline-stage membership. Stage transitions derive lifecycle status and append immutable history snapshots.

## Endpoint catalogue

| Method | Canonical browser path | Controller/upstream path | Permission | Success |
|---|---|---|---|---|
| `POST` | `/api/tenant/crm/v1/opportunities` | `/api/v1/crm/opportunities` | `crm.opportunities.create.{own|team|all}` | `201`, opportunity |
| `GET` | `/api/tenant/crm/v1/opportunities` | `/api/v1/crm/opportunities` | `crm.opportunities.read.{own|team|all}` | `200`, page |
| `GET` | `/api/tenant/crm/v1/opportunities/capabilities` | `/api/v1/crm/opportunities/capabilities` | accessible branch; actions are projected separately | `200`, owner-aware capabilities |
| `GET` | `/api/tenant/crm/v1/opportunities/:id` | `/api/v1/crm/opportunities/:id` | `crm.opportunities.read.{own|team|all}` | `200`, opportunity |
| `PATCH` | `/api/tenant/crm/v1/opportunities/:id` | `/api/v1/crm/opportunities/:id` | `crm.opportunities.update.{own|team|all}` | `200`, opportunity |
| `POST` | `/api/tenant/crm/v1/opportunities/:id/stage` | `/api/v1/crm/opportunities/:id/stage` | `crm.opportunities.update.{own|team|all}` | `201`, opportunity |
| `PUT` | `/api/tenant/crm/v1/opportunities/:id/pipeline` | `/api/v1/crm/opportunities/:id/pipeline` | `crm.opportunities.update.{own|team|all}` | `200`, opportunity |
| `GET` | `/api/tenant/crm/v1/opportunities/:id/stage-history` | `/api/v1/crm/opportunities/:id/stage-history` | `crm.opportunities.read.{own|team|all}` | `200`, history array |
| `DELETE` | `/api/tenant/crm/v1/opportunities/:id` | `/api/v1/crm/opportunities/:id` | `crm.opportunities.delete.{own|team|all}` | `204` |

Pipeline board/list routes are documented in [Pipelines and opportunity stages](./pipelines-opportunity-stages.md).

The capabilities response exposes `create`, `update`, and `delete`. Each action is either `null`, `{ scope, ownerUserIds }`, or all-scope with `ownerUserIds: null`. The Tenant Portal uses the update boundary to disable drag-and-drop and importance changes for records the current actor cannot modify.

## Wire enums

- status: `IN_PROGRESS`, `ON_HOLD`, `WON`, `LOST`
- stage flag: `NEW`, `DISCOVERY`, `QUALIFICATION`, `PROPOSAL`, `NEGOTIATION`, `CONTRACTING`, `ON_HOLD`, `WON`, `LOST`
- stage category: `OPEN`, `POSITIVE`, `NEGATIVE`, `IN_PROGRESS`

Status is derived from stage semantics. Do not patch status directly.

## Create and update

Create requires:

| Field | Contract |
|---|---|
| `branchId` | UUIDv7 |
| `customerProfileId` | UUIDv7 |
| `pipelineId` | UUIDv7 |
| `stageId` | UUIDv7 pipeline-stage membership |
| `title` | nonempty, maximum 180 |

Optional fields:

- UUIDv7 `leadId`, `contactPartyId`, `ownerUserId`
- integer `importance 0..3`
- nonnegative `amount` with at most two decimals
- `description` up to 2,000
- `currencyCode`, exactly three characters and normalized to uppercase
- ISO `expectedCloseDate`
- integer `probabilityPercent 0..100`
- `customFields` object

Update accepts title, importance, amount, description, currency, owner, contact, expected close date, probability, and custom fields. It does not accept branch, customer, lead, pipeline, or stage; use the dedicated transition routes.

The service verifies customer/lead/contact relationship, branch, pipeline assignment, stage membership, active state, and scope. A blacklisted customer cannot be used.

## List

`branchId` is required. Common pagination/search applies. Optional filters:

- UUIDv7 `pipelineId`, `stageId`, `customerProfileId`, `ownerUserId`
- `status`
- ISO `expectedCloseFrom`, `expectedCloseTo`

Allowed `sortBy` values: `title`, `amount`, `probabilityPercent`, `expectedCloseDate`, `createdAt`. Results use the common raw page shape.

## Stage transition

`POST /:id/stage` body:

```json
{
  "stageId": "0191e9a8-7f51-7b32-8d72-19f9217a41b5",
  "reason": "Commercial terms agreed",
  "lostReason": "Required only for a lost transition"
}
```

`stageId` is UUIDv7. `reason` and `lostReason` are nonempty when supplied and at most 1,000 characters. A transition into a `LOST` semantic stage requires a lost reason. The stage must belong to the current pipeline.

This mutation has no Gateway idempotency contract. After an ambiguous response, load the opportunity/history before retrying.

## Pipeline transfer

`PUT /:id/pipeline` requires UUIDv7 `pipelineId`; optional UUIDv7 `stageId`, `reason`, and `lostReason` follow transition constraints. If stage is omitted, the service chooses the target pipeline's valid initial stage. Transferring to the unchanged pipeline is rejected.

This route requires:

```http
x-idempotency-key: <UUIDv7>
```

Keep the same key only for an exact retry. A changed target/reason needs a new key. See [Gateway idempotency](./common-contract.md#idempotency-and-retry).

## Stage history

The history response is a raw chronological array. Entries include:

```text
id
opportunityId
fromStageId, fromStatus
toStageId, toStatus
changedByUserId
reason
changedAt
fromStage, toStage
```

Each stage snapshot can contain membership ID, pipeline ID and Arabic/English pipeline name, opportunity-stage ID and Arabic/English stage name, flag, category, and rank. Snapshot labels remain available after a catalogue stage is renamed or retired; render the snapshot, not the current catalogue, for audit history.

## Errors and security

- `OPPORTUNITY_NOT_FOUND`
- `CUSTOMER_PROFILE_NOT_FOUND`
- `CUSTOMER_PROFILE_BLACKLISTED`
- `LEAD_NOT_FOUND`
- `OPPORTUNITY_CONTACT_CUSTOMER_MISMATCH`
- `OPPORTUNITY_LEAD_CUSTOMER_MISMATCH`
- `CRM_BRANCH_MISMATCH`
- `OPPORTUNITY_LOST_REASON_REQUIRED`
- `OPPORTUNITY_PIPELINE_UNCHANGED`
- `PIPELINE_STAGE_NOT_FOUND`

Every record/reference is tenant and branch checked. Pipeline access can be narrower than branch access. A not-found response can conceal a record outside the actor's scope.

Create, stage change, transfer, and delete are synchronous database operations. There is no asynchronous completion state in these routes.

## Safe create example

```json
{
  "branchId": "0191e9a8-7f51-7b32-8d72-19f9217a41b3",
  "customerProfileId": "0191e9a8-7f51-7b32-8d72-19f9217a41b4",
  "pipelineId": "0191e9a8-7f51-7b32-8d72-19f9217a41b5",
  "stageId": "0191e9a8-7f51-7b32-8d72-19f9217a41b6",
  "title": "Example annual agreement",
  "amount": 12500,
  "currencyCode": "EGP",
  "probabilityPercent": 40
}
```

## Sources

- `../backend/mutakamel-apps/crm-app/src/crm/opportunities/opportunities.controller.ts`
- `../backend/mutakamel-apps/crm-app/src/crm/opportunities/dto/opportunity.dto.ts`
- `../backend/mutakamel-apps/crm-app/src/crm/opportunities/opportunities.service.ts`
- `../backend/mutakamel-apps/crm-app/src/crm/opportunities/opportunities.service.spec.ts`
- `../backend/mutakamel-apps/crm-app/src/crm/common/dto/crm-list-query.dto.ts`
- `../backend/mutakamel-apps/crm-app/packages/common/src/enums/crm.enums.ts`
- `../backend/mutakamel-apps/api-gateway-app/src/routing-proxy/route-contracts/crm.route-contracts.ts`
- `../backend/mutakamel-apps/mutakamel-web-app/src/features/tenant/opportunities/opportunity-api.ts`
