# Archived Modules Catalogue UI Agent Prompt

> **SUPERSEDED — DO NOT USE FOR CURRENT IMPLEMENTATION.** This historical
> 2026-07-25 prompt covered the former 21-route catalogue snapshot. The current
> Gateway exposes 26 catalogue route-key entries and the frontend is no longer
> fully mocked. Use [the current Catalogue contract](api/catalog.md), the
> [generated route inventory](generated/admin-core-api-routes.md), and
> [AI Start Here](ai/START_HERE.md).

## Archived copy

```text
You are implementing the production Admin Portal Modules / Catalogue feature.

Repository: C:\mutakamel.ai\frontend\admin-portal
Backend sibling: C:\mutakamel.ai\backend\mutakamel-apps

Goal: replace every mock/local mutation in /modules and /modules/[id] with the
real Core Catalogue APIs described below. Do not change backend routes, invent
fields, call Core directly, or create fake successful states.

Non-negotiable transport rules:
1. Browser requests use ONLY /api/admin/core/v1/... through axiosClient.
2. Read `response.data.data`; only the modules list additionally uses
   `response.data.meta`. Successful DELETE is HTTP 204 with no body.
3. All IDs in paths and payloads are UUIDv7. Never use module/tier/feature keys
   as route IDs. Currency rates use a three-letter currency code instead.
4. Send `Authorization` and cookies through the shared axiosClient. Do not use
   raw fetch.
5. Every mutation marked IDEMPOTENT must receive one new UUIDv7
   `x-idempotency-key` per user intent. Reuse it only for an exact retry.
6. Use JSON booleans, transport values `MONTHLY | ANNUAL`, and decimal money as
   strings. Never send `YEARLY`, floats, invented `status`, `category`, counts,
   `valueType`, or `defaultValue` fields.
7. Handle both Core error envelopes (`errorCode`) and Gateway Problem Details
   (`code`); preserve correlationId in the visible error/support detail.
8. Do not hide inactive rows. `isActive` on modules, tiers, and features is
   independent. Deactivation has tenant-access impact and needs confirmation.

Use these pages:
- /modules: paginated module list, search, active/all filter, create drawer,
  delete confirmation, and currency-rate summary link/panel.
- /modules/[id]: load module plus tiers/features in parallel. Use tabs:
  Overview, Tiers, Features, Entitlements, Pricing. Use a drawer/modal for
  mutations; keep URL IDs as UUIDv7.
- In Entitlements, select a tier, load its grants, join locally with that
  module's feature list by featureId, and save the complete set for one tier.
- In Pricing, select a tier and MONTHLY/ANNUAL, load its ladder, edit a local
  draft, validate contiguity before save, then replace the whole cycle.
- Currency Rates may be a panel in /modules or a dedicated child route if the
  existing design system needs it. It must use its own permission.

Permission gates:
- Read all catalogue screens: admin.catalog.read
- Create/update/reorder modules, tiers, features, grants, prices:
  admin.catalog.manage
- Delete a module only: admin.catalog.destroy
- Currency-rate edits only: admin.billing.currency.manage

UX requirements:
- Implement loading, empty, forbidden, validation, conflict, retry, and
  destructive-confirmation states. Never fall back to mock rows.
- Disable duplicate create submission. Create APIs have no idempotency replay.
- A 409 GW.IDEM.IN_FLIGHT is a pending state: keep the same command key and
  refetch; do not auto-send a second command.
- On PATCH/DELETE success refetch the affected resource/list from the server.
- Show field validation `details` beside the relevant inputs. For a 422/409
  domain error, show the returned message plus an actionable recovery.
- Treat a deleted/inactive module or tier as removal from effective tenant
  access. Warn before deactivation; never infer child isActive from parent.

The following API catalogue is exhaustive. Implement exactly these contracts.
```

## Shared success and error envelopes

```json
{
  "success": true,
  "data": {},
  "correlationId": "019f0000-0000-7000-8000-000000000001",
  "timestamp": "2026-07-25T10:00:00.000Z"
}
```

Module list only appends this top-level field:

```json
"meta": { "page": 1, "limit": 20, "total": 1, "totalPages": 1, "hasNext": false, "hasPrev": false }
```

Core validation/domain failure:

```json
{
  "success": false,
  "statusCode": 422,
  "errorCode": "PRICE_LADDER_INVALID",
  "errorCategory": "VALIDATION",
  "message": "Price brackets must be contiguous.",
  "details": { "brackets": ["The next minUsers must follow the previous maxUsers."] },
  "correlationId": "019f0000-0000-7000-8000-000000000002",
  "timestamp": "2026-07-25T10:00:00.000Z",
  "path": "/api/admin/core/v1/tiers/019f0000-0000-7000-8000-000000000102/price-tiers"
}
```

Gateway failure, for example a missing idempotency key:

```json
{
  "type": "about:blank",
  "title": "Bad Request",
  "status": 400,
  "code": "GW.IDEM.MISSING",
  "detail": "x-idempotency-key is required.",
  "instance": "/api/admin/core/v1/modules/019f0000-0000-7000-8000-000000000101/rank",
  "correlationId": "019f0000-0000-7000-8000-000000000003"
}
```

## Canonical examples for all APIs

Example IDs below are UUIDv7-shaped fixtures. Replace them with server values.
All `PATCH` and `DELETE` calls marked **idempotent** require the header:

```http
x-idempotency-key: 019f0000-0000-7000-8000-000000000900
```

### 1. List modules

```http
GET /api/admin/core/v1/modules?page=1&limit=20&search=crm&isActive=true
```

```json
{
  "success": true,
  "data": [{
    "id": "019f0000-0000-7000-8000-000000000101",
    "key": "crm",
    "name": "CRM",
    "description": "Customer relationship management.",
    "avatarDataUrl": null,
    "rank": 1,
    "isActive": true,
    "createdAt": "2026-07-25T10:00:00.000Z",
    "updatedAt": "2026-07-25T10:00:00.000Z"
  }],
  "meta": { "page": 1, "limit": 20, "total": 1, "totalPages": 1, "hasNext": false, "hasPrev": false },
  "correlationId": "019f0000-0000-7000-8000-000000000001",
  "timestamp": "2026-07-25T10:00:00.000Z"
}
```

Failure example: `403` / `FORBIDDEN` when `admin.catalog.read` is absent. Hide
the list and show a permission state; do not render mock modules.

### 2. Create module

```http
POST /api/admin/core/v1/modules
Content-Type: application/json

{
  "key": "analytics",
  "name": "Analytics",
  "description": "Reporting and analytics capabilities.",
  "isActive": true
}
```

```json
{
  "success": true,
  "data": {
    "id": "019f0000-0000-7000-8000-000000000111",
    "key": "analytics", "name": "Analytics",
    "description": "Reporting and analytics capabilities.", "avatarDataUrl": null,
    "rank": 2, "isActive": true,
    "createdAt": "2026-07-25T10:01:00.000Z", "updatedAt": "2026-07-25T10:01:00.000Z"
  },
  "correlationId": "019f0000-0000-7000-8000-000000000004",
  "timestamp": "2026-07-25T10:01:00.000Z"
}
```

Failure example: `409 MODULE_KEY_TAKEN` for `{ "key": "crm" }`. Mark the key
field. A PNG `avatarDataUrl` that exceeds the Gateway body limit returns
`413 GW.BODY.TOO_LARGE`; do not assume the DTO's 2M character allowance is
deployable.

### 3. Get one module

```http
GET /api/admin/core/v1/modules/019f0000-0000-7000-8000-000000000101
```

```json
{
  "success": true,
  "data": {
    "id": "019f0000-0000-7000-8000-000000000101", "key": "crm", "name": "CRM",
    "description": "Customer relationship management.", "avatarDataUrl": null,
    "rank": 1, "isActive": true,
    "createdAt": "2026-07-25T10:00:00.000Z", "updatedAt": "2026-07-25T10:00:00.000Z"
  },
  "correlationId": "019f0000-0000-7000-8000-000000000005",
  "timestamp": "2026-07-25T10:02:00.000Z"
}
```

Failure example: `422 MODULE_NOT_FOUND` for an unknown valid UUIDv7. Show a
not-found state and link back to `/modules`.

### 4. Reorder module — idempotent

```http
PATCH /api/admin/core/v1/modules/019f0000-0000-7000-8000-000000000111/rank
x-idempotency-key: 019f0000-0000-7000-8000-000000000901
Content-Type: application/json

{ "targetId": "019f0000-0000-7000-8000-000000000101" }
```

```json
{
  "success": true,
  "data": { "id": "019f0000-0000-7000-8000-000000000111", "key": "analytics", "name": "Analytics", "description": "Reporting and analytics capabilities.", "avatarDataUrl": null, "rank": 1, "isActive": true, "createdAt": "2026-07-25T10:01:00.000Z", "updatedAt": "2026-07-25T10:03:00.000Z" },
  "correlationId": "019f0000-0000-7000-8000-000000000006", "timestamp": "2026-07-25T10:03:00.000Z"
}
```

Failure example: `400 GW.IDEM.MISSING` without the header. Do not PATCH a
numeric rank; refetch the list because all ranks can change.

### 5. Update module — idempotent

```http
PATCH /api/admin/core/v1/modules/019f0000-0000-7000-8000-000000000101
x-idempotency-key: 019f0000-0000-7000-8000-000000000902
Content-Type: application/json

{ "name": "CRM Suite", "description": null, "isActive": false }
```

```json
{ "success": true, "data": { "id": "019f0000-0000-7000-8000-000000000101", "key": "crm", "name": "CRM Suite", "description": null, "avatarDataUrl": null, "rank": 1, "isActive": false, "createdAt": "2026-07-25T10:00:00.000Z", "updatedAt": "2026-07-25T10:04:00.000Z" }, "correlationId": "019f0000-0000-7000-8000-000000000007", "timestamp": "2026-07-25T10:04:00.000Z" }
```

Failure example: `400` validation for an unknown `key` field or invalid avatar.
`key` is immutable: never put it in this form. Confirm before `isActive:false`
because it recalculates tenant access.

### 6. Delete module — idempotent

```http
DELETE /api/admin/core/v1/modules/019f0000-0000-7000-8000-000000000111
x-idempotency-key: 019f0000-0000-7000-8000-000000000903
```

Success: `204 No Content` — refetch/remove the row. Failure: `409 MODULE_IN_USE`
when a non-deleted subscription item references it. Offer deactivation instead.

### 7. Create tier

```http
POST /api/admin/core/v1/modules/019f0000-0000-7000-8000-000000000101/tiers
Content-Type: application/json

{ "key": "professional", "name": "Professional", "color": "#0b6ff4", "isActive": true }
```

```json
{ "success": true, "data": { "id": "019f0000-0000-7000-8000-000000000102", "moduleId": "019f0000-0000-7000-8000-000000000101", "key": "professional", "name": "Professional", "rank": 1, "color": "#0b6ff4", "isActive": true, "createdAt": "2026-07-25T10:05:00.000Z", "updatedAt": "2026-07-25T10:05:00.000Z" }, "correlationId": "019f0000-0000-7000-8000-000000000008", "timestamp": "2026-07-25T10:05:00.000Z" }
```

Failure: `409 TIER_KEY_TAKEN` for a duplicate key in the same module; `400`
for a malformed colour or moduleId.

### 8. List tiers

```http
GET /api/admin/core/v1/modules/019f0000-0000-7000-8000-000000000101/tiers
```

```json
{ "success": true, "data": [{ "id": "019f0000-0000-7000-8000-000000000102", "moduleId": "019f0000-0000-7000-8000-000000000101", "key": "professional", "name": "Professional", "rank": 1, "color": "#0b6ff4", "isActive": true, "createdAt": "2026-07-25T10:05:00.000Z", "updatedAt": "2026-07-25T10:05:00.000Z" }], "correlationId": "019f0000-0000-7000-8000-000000000009", "timestamp": "2026-07-25T10:05:00.000Z" }
```

Failure: `400` for an invalid UUIDv7. A valid missing module can currently
return `data: []`; do not treat this as proof that the module exists.

### 9. Update tier — idempotent

```http
PATCH /api/admin/core/v1/tiers/019f0000-0000-7000-8000-000000000102
x-idempotency-key: 019f0000-0000-7000-8000-000000000904
Content-Type: application/json

{ "name": "Professional Plus", "color": "#7c3aed", "isActive": true }
```

```json
{ "success": true, "data": { "id": "019f0000-0000-7000-8000-000000000102", "moduleId": "019f0000-0000-7000-8000-000000000101", "key": "professional", "name": "Professional Plus", "rank": 1, "color": "#7c3aed", "isActive": true, "createdAt": "2026-07-25T10:05:00.000Z", "updatedAt": "2026-07-25T10:06:00.000Z" }, "correlationId": "019f0000-0000-7000-8000-000000000010", "timestamp": "2026-07-25T10:06:00.000Z" }
```

Failure: `409 TIER_RANK_TAKEN` if editing rank into an occupied rank. Do not
build tier drag/drop swapping; there is no atomic tier reorder API.

### 10. Delete tier — idempotent

```http
DELETE /api/admin/core/v1/tiers/019f0000-0000-7000-8000-000000000102
x-idempotency-key: 019f0000-0000-7000-8000-000000000905
```

Success: `204 No Content`. Failure: `409 TIER_IN_USE`; present deactivate as
the recovery action. This route needs `admin.catalog.manage`, not destroy.

### 11. Create feature

```http
POST /api/admin/core/v1/modules/019f0000-0000-7000-8000-000000000101/features
Content-Type: application/json

{ "key": "crm.leads", "name": "Lead management", "description": "Create and manage leads.", "rank": 0, "isActive": true }
```

```json
{ "success": true, "data": { "id": "019f0000-0000-7000-8000-000000000103", "moduleId": "019f0000-0000-7000-8000-000000000101", "key": "crm.leads", "name": "Lead management", "description": "Create and manage leads.", "rank": 0, "isActive": true, "createdAt": "2026-07-25T10:07:00.000Z", "updatedAt": "2026-07-25T10:07:00.000Z" }, "correlationId": "019f0000-0000-7000-8000-000000000011", "timestamp": "2026-07-25T10:07:00.000Z" }
```

Failure: `409 FEATURE_KEY_TAKEN` is global, not module-local. `400` for a key
without at least one dot. Never send valueType/defaultValue.

### 12. List features

```http
GET /api/admin/core/v1/modules/019f0000-0000-7000-8000-000000000101/features
```

```json
{ "success": true, "data": [{ "id": "019f0000-0000-7000-8000-000000000103", "moduleId": "019f0000-0000-7000-8000-000000000101", "key": "crm.leads", "name": "Lead management", "description": "Create and manage leads.", "rank": 0, "isActive": true, "createdAt": "2026-07-25T10:07:00.000Z", "updatedAt": "2026-07-25T10:07:00.000Z" }], "correlationId": "019f0000-0000-7000-8000-000000000012", "timestamp": "2026-07-25T10:07:00.000Z" }
```

Failure: `400` for malformed moduleId; valid missing module currently returns
an empty array. The response is complete and non-paginated.

### 13. Update feature — idempotent

```http
PATCH /api/admin/core/v1/features/019f0000-0000-7000-8000-000000000103
x-idempotency-key: 019f0000-0000-7000-8000-000000000906
Content-Type: application/json

{ "description": null, "isActive": false }
```

```json
{ "success": true, "data": { "id": "019f0000-0000-7000-8000-000000000103", "moduleId": "019f0000-0000-7000-8000-000000000101", "key": "crm.leads", "name": "Lead management", "description": null, "rank": 0, "isActive": false, "createdAt": "2026-07-25T10:07:00.000Z", "updatedAt": "2026-07-25T10:08:00.000Z" }, "correlationId": "019f0000-0000-7000-8000-000000000013", "timestamp": "2026-07-25T10:08:00.000Z" }
```

Failure: `404 FEATURE_NOT_FOUND`. `key` and `moduleId` are immutable. Confirm
before deactivating because entitlement materialization changes.

### 14. Delete feature — idempotent

```http
DELETE /api/admin/core/v1/features/019f0000-0000-7000-8000-000000000103
x-idempotency-key: 019f0000-0000-7000-8000-000000000907
```

Success: `204 No Content`. Failure: `404 FEATURE_NOT_FOUND`. Refetch both
features and tier grants; existing grants may need a complete replacement to
remove the deleted feature.

### 15. List tier-feature grants

```http
GET /api/admin/core/v1/tiers/019f0000-0000-7000-8000-000000000102/features
```

```json
{ "success": true, "data": [{ "id": "019f0000-0000-7000-8000-000000000104", "tierId": "019f0000-0000-7000-8000-000000000102", "featureId": "019f0000-0000-7000-8000-000000000103", "config": null, "configRevision": 1, "createdAt": "2026-07-25T10:09:00.000Z", "updatedAt": "2026-07-25T10:09:00.000Z" }], "correlationId": "019f0000-0000-7000-8000-000000000014", "timestamp": "2026-07-25T10:09:00.000Z" }
```

Failure: `422 TIER_NOT_FOUND`. The UI must join `featureId` with the module's
feature list locally; the API does not return feature names.

### 16. Replace tier-feature grants — idempotent

```http
PATCH /api/admin/core/v1/tiers/019f0000-0000-7000-8000-000000000102/features
x-idempotency-key: 019f0000-0000-7000-8000-000000000908
Content-Type: application/json

{
  "features": [
    { "featureId": "019f0000-0000-7000-8000-000000000103" },
    { "featureId": "019f0000-0000-7000-8000-000000000105", "config": { "dailyQuota": 5000, "rateLimitPerMin": 60 } }
  ]
}
```

```json
{ "success": true, "data": [{ "id": "019f0000-0000-7000-8000-000000000104", "tierId": "019f0000-0000-7000-8000-000000000102", "featureId": "019f0000-0000-7000-8000-000000000103", "config": null, "configRevision": 1, "createdAt": "2026-07-25T10:09:00.000Z", "updatedAt": "2026-07-25T10:09:00.000Z" }], "correlationId": "019f0000-0000-7000-8000-000000000015", "timestamp": "2026-07-25T10:10:00.000Z" }
```

Failure: `422 DUPLICATE_FEATURE`, `FEATURE_MODULE_MISMATCH`, or
`CRM_OUTBOUND_EMAIL_POLICY_INVALID`. `features: []` intentionally revokes all
grants. This is full replacement, never a single toggle mutation.

### 17. List price tiers

```http
GET /api/admin/core/v1/tiers/019f0000-0000-7000-8000-000000000102/price-tiers?billingCycle=MONTHLY
```

```json
{ "success": true, "data": [{ "id": "019f0000-0000-7000-8000-000000000106", "tierId": "019f0000-0000-7000-8000-000000000102", "billingCycle": "MONTHLY", "minUsers": 1, "maxUsers": 10, "unitPrice": "15.0000", "createdAt": "2026-07-25T10:11:00.000Z", "updatedAt": "2026-07-25T10:11:00.000Z" }, { "id": "019f0000-0000-7000-8000-000000000107", "tierId": "019f0000-0000-7000-8000-000000000102", "billingCycle": "MONTHLY", "minUsers": 11, "maxUsers": null, "unitPrice": "12.5000", "createdAt": "2026-07-25T10:11:00.000Z", "updatedAt": "2026-07-25T10:11:00.000Z" }], "correlationId": "019f0000-0000-7000-8000-000000000016", "timestamp": "2026-07-25T10:11:00.000Z" }
```

Failure: `422 TIER_NOT_FOUND`. Restrict the UI selector to `MONTHLY` and
`ANNUAL`; invalid raw query values can currently appear as an empty response.

### 18. Replace one price ladder — idempotent

```http
PATCH /api/admin/core/v1/tiers/019f0000-0000-7000-8000-000000000102/price-tiers
x-idempotency-key: 019f0000-0000-7000-8000-000000000909
Content-Type: application/json

{
  "billingCycle": "MONTHLY",
  "brackets": [
    { "minUsers": 1, "maxUsers": 10, "unitPrice": "15.00" },
    { "minUsers": 11, "maxUsers": null, "unitPrice": "12.5000" }
  ]
}
```

```json
{ "success": true, "data": [{ "id": "019f0000-0000-7000-8000-000000000106", "tierId": "019f0000-0000-7000-8000-000000000102", "billingCycle": "MONTHLY", "minUsers": 1, "maxUsers": 10, "unitPrice": "15.0000", "createdAt": "2026-07-25T10:12:00.000Z", "updatedAt": "2026-07-25T10:12:00.000Z" }, { "id": "019f0000-0000-7000-8000-000000000107", "tierId": "019f0000-0000-7000-8000-000000000102", "billingCycle": "MONTHLY", "minUsers": 11, "maxUsers": null, "unitPrice": "12.5000", "createdAt": "2026-07-25T10:12:00.000Z", "updatedAt": "2026-07-25T10:12:00.000Z" }], "correlationId": "019f0000-0000-7000-8000-000000000017", "timestamp": "2026-07-25T10:12:00.000Z" }
```

Failure: `422 PRICE_LADDER_INVALID` for gaps, overlap, a first `minUsers`
other than 1, non-final open bracket, or a numeric `unitPrice`. Keep price
values as strings and show ladder validation beside the draft.

### 19. List managed currency rates

```http
GET /api/admin/core/v1/billing/currency-rates
```

```json
{ "success": true, "data": [{ "currencyCode": "EGP", "currencyUnitsPerUsd": "48.500000000000", "isActive": true }, { "currencyCode": "SAR", "currencyUnitsPerUsd": "3.750000000000", "isActive": false }], "correlationId": "019f0000-0000-7000-8000-000000000018", "timestamp": "2026-07-25T10:13:00.000Z" }
```

Failure: `403 FORBIDDEN` without `admin.catalog.read`. USD is fixed and never
appears in `data`; display it separately only when useful.

### 20. Batch upsert currency rates — idempotent

```http
PATCH /api/admin/core/v1/billing/currency-rates
x-idempotency-key: 019f0000-0000-7000-8000-000000000910
Content-Type: application/json

{
  "rates": [
    { "currencyCode": "EGP", "currencyUnitsPerUsd": "48.5", "isActive": true },
    { "currencyCode": "SAR", "currencyUnitsPerUsd": "3.75", "isActive": false }
  ]
}
```

```json
{ "success": true, "data": [{ "currencyCode": "EGP", "currencyUnitsPerUsd": "48.500000000000", "isActive": true }, { "currencyCode": "SAR", "currencyUnitsPerUsd": "3.750000000000", "isActive": false }], "correlationId": "019f0000-0000-7000-8000-000000000019", "timestamp": "2026-07-25T10:14:00.000Z" }
```

Failure: `422 DUPLICATE_CURRENCY_RATE` for duplicate normalized codes, `409`
`BASE_CURRENCY_FIXED` if USD is included, or `400` for a numeric/zero/invalid
decimal string. This is an atomic batch upsert, not a full replacement.

### 21. Upsert one currency rate — idempotent

```http
PATCH /api/admin/core/v1/billing/currency-rates/egp
x-idempotency-key: 019f0000-0000-7000-8000-000000000911
Content-Type: application/json

{ "currencyUnitsPerUsd": "48.500000000000", "isActive": true }
```

```json
{ "success": true, "data": { "currencyCode": "EGP", "currencyUnitsPerUsd": "48.500000000000", "isActive": true }, "correlationId": "019f0000-0000-7000-8000-000000000020", "timestamp": "2026-07-25T10:15:00.000Z" }
```

Failure: `409 BASE_CURRENCY_FIXED` for `/USD`; `400` for a code not matching
three ASCII letters or invalid decimal. The path code is normalized to upper
case by the backend.

## Required implementation acceptance checklist

```text
[ ] No mock module/tier/feature/rate records or simulated save timers remain.
[ ] Every request uses its canonical /api/admin/core/v1 path and axiosClient.
[ ] The module detail route uses module.id (UUIDv7), never module.key.
[ ] All 21 routes above are represented by typed API helpers and used only when
    their permission is present.
[ ] Each idempotent mutation creates/reuses command IDs correctly and handles
    GW.IDEM.IN_FLIGHT, GW.IDEM.MISMATCH, and IDEMPOTENCY_KEY_REUSED.
[ ] Grant and price editors submit full replacement arrays, with client-side
    validation before network calls.
[ ] Currency inputs remain decimal strings; USD cannot be edited.
[ ] All API success/error states preserve correlationId and refetch authoritative
    state after a successful mutation.
[ ] Tests cover success, validation, forbidden, conflict, missing, idempotency,
    and loading/empty states for the screen behavior.
```

## Reference sources for the implementation agent

- `docs/api/catalog.md` — complete Catalogue contract and edge cases.
- `src/lib/api/axiosClient.ts` — browser auth, error and UUIDv7 support.
- `../backend/mutakamel-apps/api-gateway-app/src/routing-proxy/route-contracts/core.route-contracts.ts`
  — public route authority.
- `../backend/mutakamel-apps/core-app/src/admin/catalog/` — controller, DTOs,
  services, and tests.
