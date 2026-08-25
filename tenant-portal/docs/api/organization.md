# Tenant organization API

> **Contract status:** Current
> **Last verified:** 2026-07-25
> **Backend owner:** Core (`core-app`)
> **Canonical browser prefix:** `/api/tenant/core/v1/organization`
> **Controller-relative prefix:** `/tenant/organization`
> **Tenant Portal status:** Planned. The legacy settings area consumes the organization tree but does not provide a complete replacement-grade administration flow.
> **Documentation:** Hand-written and source-verified; not generated.

## Source of truth

- Gateway contracts: `../backend/mutakamel-apps/api-gateway-app/src/routing-proxy/route-contracts/core.route-contracts.ts`
- Controller/service/DTOs: `../backend/mutakamel-apps/core-app/src/tenant/organization`
- Database enums/entities: `../backend/mutakamel-apps/core-app/packages/database/src/entities/tenant`
- Historical consolidated-frontend reference (absent from the current checkout): `../backend/mutakamel-apps/mutakamel-web-app/src/features/tenant/settings`

## Security and shared transport

Every route requires a tenant JWT, a verified host matching that token, current session/subscription, the listed permission, and the actor's effective company/branch scope. A permission does not grant visibility outside that scope. The browser must use the canonical path and must not send trusted scope headers.

Core rejects unknown DTO fields. All resource IDs are UUIDv7. List routes use common pagination (`page` default 1, `limit` default 20/max 100, `search` max 200, whitelisted `sortBy`, `sortDir=ASC|DESC`) and return item arrays in `data` with `meta`. JSON errors use the standard Core error envelope. Mutations do not declare application-level idempotency; avoid automatic retry after an ambiguous response.

## Routes

| Resource | Method and canonical browser path | Permission |
|---|---|---|
| Tree | `GET /api/tenant/core/v1/organization/tree` | `org.company.read` |
| Company | `POST /api/tenant/core/v1/organization/companies` | `org.company.manage` |
| Company | `GET /api/tenant/core/v1/organization/companies`, `GET /api/tenant/core/v1/organization/companies/:id` | `org.company.read` |
| Company | `PATCH /api/tenant/core/v1/organization/companies/:id`, `DELETE /api/tenant/core/v1/organization/companies/:id` | `org.company.manage` |
| Branch | `POST /api/tenant/core/v1/organization/branches` | `org.branch.manage` |
| Branch | `GET /api/tenant/core/v1/organization/branches`, `GET /api/tenant/core/v1/organization/branches/:id` | `org.branch.read` |
| Branch | `PATCH /api/tenant/core/v1/organization/branches/:id`, `DELETE /api/tenant/core/v1/organization/branches/:id` | `org.branch.manage` |
| Department | `POST /api/tenant/core/v1/organization/departments` | `org.department.manage` |
| Department | `GET /api/tenant/core/v1/organization/departments`, `GET /api/tenant/core/v1/organization/departments/:id` | `org.department.read` |
| Department | `PATCH /api/tenant/core/v1/organization/departments/:id`, `DELETE /api/tenant/core/v1/organization/departments/:id` | `org.department.manage` |
| Team | `POST /api/tenant/core/v1/organization/teams` | `org.team.manage` |
| Team | `GET /api/tenant/core/v1/organization/teams`, `GET /api/tenant/core/v1/organization/teams/:id` | `org.team.read` |
| Team | `PATCH /api/tenant/core/v1/organization/teams/:id`, `DELETE /api/tenant/core/v1/organization/teams/:id` | `org.team.manage` |

## Validation and static values

All nodes use case-sensitive status `ACTIVE|INACTIVE`. Codes are trimmed/uppercased, maximum 32, and unique within the owning level.

### Company

Create requires `code` and `name` (maximum 120). Optional: `legalName` (200), `taxNumber` (64), and `currencyCode` (exactly three uppercased characters referencing an active tenant currency). Update accepts `name`, `legalName`, `taxNumber`, `currencyCode`, and `status`.

Company list accepts optional `status`.

### Branch

Create requires `companyId`, `code`, and `name` (120). Optional: `address` (2,000), `phone` (32), `isHeadquarters` boolean. Update accepts `name`, `address`, `phone`, `isHeadquarters`, and `status`.

Branch list accepts `companyId` and `status`. Only one headquarters branch may exist for a company.

### Department

Create requires `branchId`, `code`, and `name` (120). Update accepts `name` and `status`. List accepts `branchId` and `status`.

### Team

Create requires `departmentId`, `code`, and `name` (120); optional `leadUserId` UUIDv7. Update accepts `name`, nullable/updated `leadUserId`, and `status`. List accepts `departmentId` and `status`.

Safe branch-create example:

```http
POST /api/tenant/core/v1/organization/branches
Cookie: __Host-mutakamel-tenant-access=<redacted>; __Host-mutakamel-tenant-session=<redacted>; __Host-mutakamel-tenant-csrf=<csrf-proof>
X-CSRF-Token: <csrf-proof>
Content-Type: application/json

{
  "companyId":"019f9872-0a1a-7cc0-914d-a57aa437fc41",
  "code":"CAI",
  "name":"Cairo",
  "isHeadquarters":true
}
```

## Domain rules and errors

- A child can only be created below an active parent.
- Deactivation is rejected when dependent active placement would become unsafe.
- Delete is soft-delete and only succeeds when the node has no child nodes or directly placed users.
- Company currency must be enabled.
- Team lead must exist and be valid for the scope.
- Branch/company authorization is enforced in addition to the route permission.

Expected errors include `ORG_NODE_NOT_FOUND`, `ORG_CODE_TAKEN`, `ORG_NODE_NOT_EMPTY`, `ORG_PARENT_INACTIVE`, `ORG_HQ_EXISTS`, `ORG_LEAD_USER_NOT_FOUND`, `CURRENCY_NOT_ENABLED`, and `PERMISSION_SCOPE_UNAVAILABLE`.

Organization reads are private tenant data and must not be shared-cached across actors/scopes. Commands are synchronous and expose no client-polled asynchronous job.

## AI implementation rules

- Use the tree for navigation but refetch the specific collection after a mutation.
- Do not infer access from tree presence; backend scope remains authoritative.
- Ask for confirmation before deactivation/delete because dependent placements can make the operation fail.
- Treat `204` delete responses as having no JSON body.
