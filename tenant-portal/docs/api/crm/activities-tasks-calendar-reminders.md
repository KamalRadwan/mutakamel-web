# CRM activities, tasks, calendar, and reminders

> Status: `verified-current`
> Last source verification: `2026-07-25`
> Owner: CRM (`crm-app`)
> Canonical browser prefix: `/api/tenant/crm/v1`
> Controller-relative prefix: `/api/v1/crm`
> Tenant Portal replacement: `not-started`
> Historical consolidated frontend: `absent-from-current-checkout`
> Authorship: hand-written from current backend source; historical frontend evidence is non-authoritative

These resources attach operational work to a CRM source inside one branch. All successful JSON responses are raw CRM projections; list routes use the [common offset page](./common-contract.md#validation).

## Endpoint catalogue

| Method | Canonical browser path | Controller/upstream path | Permission | Success |
|---|---|---|---|---|
| `POST` | `/api/tenant/crm/v1/activities` | `/api/v1/crm/activities` | `crm.activities.create.{own|team|all}` | `201`, activity |
| `GET` | `/api/tenant/crm/v1/activities` | `/api/v1/crm/activities` | `crm.activities.read.{own|team|all}` | `200`, page |
| `POST` | `/api/tenant/crm/v1/tasks` | `/api/v1/crm/tasks` | `crm.activities.create.{own|team|all}` | `201`, task |
| `GET` | `/api/tenant/crm/v1/tasks` | `/api/v1/crm/tasks` | `crm.activities.read.{own|team|all}` | `200`, page |
| `PATCH` | `/api/tenant/crm/v1/tasks/:id` | `/api/v1/crm/tasks/:id` | `crm.activities.update.{own|team|all}` | `200`, task |
| `POST` | `/api/tenant/crm/v1/calendar/events` | `/api/v1/crm/calendar/events` | `crm.activities.create.{own|team|all}` | `201`, event |
| `GET` | `/api/tenant/crm/v1/calendar/events` | `/api/v1/crm/calendar/events` | `crm.activities.read.{own|team|all}` | `200`, page |
| `PATCH` | `/api/tenant/crm/v1/calendar/events/:id` | `/api/v1/crm/calendar/events/:id` | `crm.activities.update.{own|team|all}` | `200`, event |
| `POST` | `/api/tenant/crm/v1/reminders` | `/api/v1/crm/reminders` | `crm.activities.create.{own|team|all}` | `201`, reminder |
| `GET` | `/api/tenant/crm/v1/reminders` | `/api/v1/crm/reminders` | `crm.activities.read.{own|team|all}` | `200`, page |
| `PATCH` | `/api/tenant/crm/v1/reminders/:id/cancel` | `/api/v1/crm/reminders/:id/cancel` | `crm.activities.update.{own|team|all}` | `200`, cancelled reminder |

All create/list requests validate `branchId` against branch membership. Record mutations resolve the stored branch and scoped owner boundary. An owner filter only narrows results.

## Wire enums

| Field | Accepted values |
|---|---|
| activity `type` | `CALL`, `MEETING`, `EMAIL`, `VISIT`, `NOTE`, `FOLLOW_UP`, `OTHER` |
| activity `direction` | `INBOUND`, `OUTBOUND`, `INTERNAL` |
| activity `status` | `OPEN`, `DONE` |
| task `priority` | `LOW`, `MEDIUM`, `HIGH`, `URGENT` |
| task `status` | `OPEN`, `IN_PROGRESS`, `DONE`, `CANCELLED` |
| reminder `targetType` | `TASK`, `CALENDAR_EVENT` |
| reminder `channel` | `IN_APP`, `EMAIL`, `SMS` |
| reminder `status` | `PENDING`, `SENT`, `CANCELLED` |
| activity source | `LEAD`, `CUSTOMER_PROFILE`, `PARTY`, `OPPORTUNITY` |
| task/event source | activity source values plus `ACTIVITY` |

## Request validation

### Activity

`POST /activities` requires:

- `branchId`: UUIDv7
- `type`: activity type
- `subject`: nonempty string, maximum 180
- `sourceType`: activity source enum
- `sourceId`: UUIDv7

Optional fields are `ownerUserId` UUIDv7, `direction`, `description` and `outcome` up to 2,000 characters, and ISO `activityAt`.

`GET /activities` requires `branchId`, accepts common pagination, and optionally accepts `type`, `sourceType`, `sourceId`, and `ownerUserId`. `sourceType` and `sourceId` are a semantic pair; sending only one is rejected by the service. The safe sort default is `createdAt`.

### Task

`POST /tasks` requires `branchId`, nonempty `title` up to 180 characters, `sourceType`, and UUIDv7 `sourceId`. Optional fields are `status`, `description` up to 2,000, UUIDv7 `assigneeUserId`, `priority`, and ISO `dueAt`.

`PATCH /tasks/:id` accepts the mutable task fields only. The path ID is UUIDv7. `GET /tasks` requires `branchId`, accepts common pagination, and optionally filters by task `status`.

### Calendar event

`POST /calendar/events` requires `branchId`, `title` up to 180 characters, `sourceType`, `sourceId`, and ISO `startsAt` and `endsAt`. `endsAt` must be later than `startsAt`. Optional fields include `description` up to 2,000, `location` up to 180, and `attendees`.

The DTO currently validates `attendees` as an array of at most 100 items without a public item schema. Treat attendee objects as unresolved and do not build new writes around a guessed structure. `PATCH` accepts mutable event fields. `GET` requires `branchId` plus common pagination.

### Reminder

`POST /reminders` requires `branchId`, `targetType`, UUIDv7 `targetId`, and ISO `remindAt`. Optional `channel` uses the server default when omitted. The target must exist in the same branch. `GET` requires `branchId`, supports common pagination, and optionally filters by reminder `status`.

Cancellation has no body. Only a pending reminder is safely cancellable.

## Responses and state

Entity responses include server IDs, branch/source references, ownership/assignment, enum state, timestamps, and domain fields. No dedicated public response DTO freezes every projection field, so clients should validate the fields they consume and tolerate additive fields.

Reminder creation records the reminder synchronously. Delivery through the selected channel is asynchronous; `201` does not mean `SENT`. Poll the reminder list for state because there is no reminder-detail route.

None of these 11 routes uses Gateway idempotency. Do not automatically retry a create/update/cancel request after an ambiguous transport failure; first re-read the relevant list/detail state.

## Domain errors

In addition to common authorization/validation errors:

- `CRM_SOURCE_INVALID`
- `CRM_SOURCE_NOT_FOUND`
- `CRM_SOURCE_BRANCH_MISMATCH`
- `CRM_EVENT_TIME_INVALID`
- `CRM_REMINDER_TIME_INVALID`
- `CRM_TASK_NOT_FOUND`
- `CRM_EVENT_NOT_FOUND`
- `CRM_REMINDER_NOT_FOUND`
- `CRM_OWNER_SCOPE_REQUIRED`

An inaccessible record can be returned as not found. Do not reveal whether an ID exists in another branch.

## Safe example

```http
POST /api/tenant/crm/v1/tasks
Cookie: __Host-mutakamel-tenant-access=<redacted>; __Host-mutakamel-tenant-session=<redacted>; __Host-mutakamel-tenant-csrf=<csrf-proof>
X-CSRF-Token: <csrf-proof>
Content-Type: application/json

{
  "branchId": "0191e9a8-7f51-7b32-8d72-19f9217a41b3",
  "title": "Follow up on qualification",
  "sourceType": "LEAD",
  "sourceId": "0191e9a8-7f51-7b32-8d72-19f9217a41b4",
  "priority": "HIGH",
  "dueAt": "2026-07-30T09:00:00.000Z"
}
```

## Sources

- `../backend/mutakamel-apps/crm-app/src/crm/activities/activities.controller.ts`
- `../backend/mutakamel-apps/crm-app/src/crm/activities/dto/activity.dto.ts`
- `../backend/mutakamel-apps/crm-app/src/crm/activities/activities.service.ts`
- `../backend/mutakamel-apps/crm-app/src/crm/activities/activities.service.spec.ts`
- `../backend/mutakamel-apps/crm-app/src/crm/common/dto/crm-list-query.dto.ts`
- `../backend/mutakamel-apps/crm-app/packages/common/src/enums/crm.enums.ts`
- `../backend/mutakamel-apps/api-gateway-app/src/routing-proxy/route-contracts/crm.route-contracts.ts`
