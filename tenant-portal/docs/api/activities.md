# Tenant activities API

> **Contract status:** Current
> **Last verified:** 2026-07-25
> **Backend owner:** Core (`core-app`), with target authorization delegated to Core/CRM/Trade resolvers
> **Canonical browser prefixes:** `/api/tenant/core/v1/activities`, `/api/tenant/core/v1/activity-types`
> **Controller-relative prefixes:** `/tenant/activities`, `/tenant/activity-types`
> **Tenant Portal status:** Planned. A live legacy client exists at `../backend/mutakamel-apps/mutakamel-web-app/src/features/tenant/activities/activity-api.ts`.
> **Documentation:** Hand-written and source-verified; not generated.

## Source of truth

- Gateway contracts: `../backend/mutakamel-apps/api-gateway-app/src/routing-proxy/route-contracts/core.route-contracts.ts`
- Controller, DTO, service, authorizer: `../backend/mutakamel-apps/core-app/src/tenant/activities`
- Wire enums: `../backend/mutakamel-apps/core-app/packages/common/src/enums/activity.enum.ts`
- Legacy client: `../backend/mutakamel-apps/mutakamel-web-app/src/features/tenant/activities/activity-api.ts`

## Routes

| Method and canonical browser path | Permission | Important contract |
|---|---|---|
| `GET /api/tenant/core/v1/activity-types` | `activities.read` | Static activity-type catalog |
| `GET /api/tenant/core/v1/activities/assignees` | `activities.assign` | Exact target/branch authority is checked before enumeration |
| `GET /api/tenant/core/v1/activities` | `activities.read` | Paginated, private/no-store |
| `POST /api/tenant/core/v1/activities` | `activities.create` | UUIDv7 idempotency key required |
| `GET /api/tenant/core/v1/activities/:id` | `activities.read` | Returns `ETag: "<version>"`, private/no-store |
| `PATCH /api/tenant/core/v1/activities/:id` | `activities.update` | `If-Match` plus UUIDv7 idempotency key |
| `POST /api/tenant/core/v1/activities/:id/complete` | `activities.complete` | `If-Match` plus UUIDv7 idempotency key |
| `POST /api/tenant/core/v1/activities/:id/cancel` | `activities.cancel` | `If-Match` plus UUIDv7 idempotency key |

All IDs are UUIDv7. All routes require a tenant JWT, matching verified host, current session, subscription access, global permission, target-app entitlement, and exact target/branch authorization. Unauthorized target lookups are deliberately mapped to non-leaking not-found behavior where applicable.

## Static wire values

- Type: `TODO`, `CALL`, `MEETING`, `EMAIL`, `VISIT`, `FOLLOW_UP`, `OTHER`.
- Status: `PLANNED`, `DONE`, `CANCELLED`.
- Priority: `LOW`, `NORMAL`, `HIGH`, `URGENT`.
- Direction: `INBOUND`, `OUTBOUND`, `INTERNAL`.
- Target app/type pairs: `CRM` → `LEAD|CUSTOMER_PROFILE|OPPORTUNITY`; `CORE` → `PARTY`; `TRADE` → `QUOTATION|SALES_ORDER`.

These are case-sensitive. Do not invent a new target pair in the UI.

## Validation

Create:

- `target`: `{app,type,id}`; `type` non-blank, maximum 40, `id` UUIDv7.
- `type`: one activity type above.
- `subject`: non-blank, maximum 180.
- `description`: optional/nullable, maximum 4,000.
- `direction`: optional/nullable enum; `priority`: optional enum.
- `dueAt`: required ISO value transformable to a valid date.
- `assigneeUserId`: optional UUIDv7.

Update accepts the same mutable fields except `target`. Complete accepts optional `outcome` up to 2,000; cancel accepts optional `reason` up to 2,000.

List accepts common `page`/`limit`/`search`/`sortDir`, with `sortBy` limited to `dueAt`, plus `branchId`, `status`, `assigneeUserId`, `targetApp`, `targetType` (maximum 40), and `targetId`. Assignee lookup requires `targetApp`, `targetType`, `targetId`, and optional `search` up to 100.

Safe command example:

```http
POST /api/tenant/core/v1/activities
Authorization: Bearer <tenant-access-token>
Content-Type: application/json
X-Idempotency-Key: 019f9871-fd40-7680-bfbb-fd535b5880c8

{
  "target":{"app":"CRM","type":"LEAD","id":"019f9872-0a1a-7cc0-914d-a57aa437fc41"},
  "type":"FOLLOW_UP",
  "subject":"Confirm requirements",
  "priority":"NORMAL",
  "dueAt":"2026-07-28T09:00:00.000Z"
}
```

## Concurrency, idempotency, cache, and envelopes

Reads and command responses are `Cache-Control: no-store, private`. Item/command responses carry an ETag containing the integer version. `If-Match` accepts a positive integer ETag, including weak/quoted forms; missing or invalid input returns `428 ACTIVITY_VERSION_REQUIRED`. A stale value returns a version conflict.

Every mutation requires `X-Idempotency-Key` as UUIDv7 even though Gateway classifies these routes without its generic idempotency layer. Core retains the domain replay record for seven days. An exact replay returns the original result and `Idempotency-Replayed: true`; reuse with another payload fails.

Ordinary successes/errors use the Core envelopes. Paginated list results expose the item array as `data` and page metadata as `meta`.

Expected errors include `ACTIVITY_NOT_FOUND`, `ACTIVITY_ACCESS_DENIED`, `ACTIVITY_INVALID`, `ACTIVITY_TARGET_RESOLVER_UNAVAILABLE`, `ACTIVITY_VERSION_REQUIRED`, version conflict, target entitlement/access failures, and idempotency mismatch/in-progress failures.

Security is enforced both at Core permission level and by the owning target resolver. There is no client-polled asynchronous activity command; create/update/complete/cancel return the resulting record synchronously.

## AI implementation rules

- Preserve the returned ETag with the local record and send it on every state change.
- Generate one UUIDv7 key per user command and retain it for retries of that exact payload only.
- Refetch after version conflict; never overwrite the newer server record.
- Do not show assignee search until the target tuple is known.
