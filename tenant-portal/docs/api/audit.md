# Tenant Audit Log API

> **Contract status:** Current
> **Last verified:** 2026-07-29
> **Backend owner:** Core (`core-app`)
> **Canonical browser prefix:** `/api/tenant/core/v1/audit`
> **Controller-relative prefix:** `/tenant/audit`
> **Tenant Portal status:** Operational / Available for audit inspection.
> **Documentation:** Source-verified.

## Source of truth

- Gateway contracts: `../backend/mutakamel-apps/api-gateway-app/src/routing-proxy/route-contracts/core.route-contracts.ts`
- Controller & DTOs: `../backend/mutakamel-apps/core-app/src/tenant/audit`

## Routes

| Method and canonical browser path | Permission | Important contract |
|---|---|---|
| `GET /api/tenant/core/v1/audit` | `core.tenant.audit.list` | Paginated tenant audit logs query |
| `GET /api/tenant/core/v1/audit/entities/:entityType/:entityId` | `core.tenant.audit.entity-history` | Audit log history for a specific entity |

## Validation & Query Parameters

List accepts query filters: `page`, `limit`, `search`, `action`, `actorId`, `entityType`, `fromDate`, `toDate`.
Entity history accepts `entityType` parameter (e.g. `COMPANY`, `BRANCH`, `USER`) and `entityId` UUIDv7.

Responses return canonical success envelope:
```json
{
  "success": true,
  "status": "SUCCESS",
  "statusCode": 200,
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 0
  }
}
```
