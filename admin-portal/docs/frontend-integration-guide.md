# Admin Portal Frontend Integration Guide

Status: **Current source integration guide**

Last source verification: **2026-07-30**

## Scope

This guide connects the current Admin Portal source to the 243 Core Admin
Gateway routes. It does not claim full parity, authenticated runtime success,
release readiness, or deployment.

Read the [documentation contract](DOCUMENTATION_CONTRACT.md) and
[AI Start Here](ai/START_HERE.md) before changing a server-backed feature.

## Canonical transport

Browser code uses:

```text
/api/admin/core/v1/<relative>
```

Worker backup/restore uses:

```text
/api/admin/worker/v1/<relative>
```

`/admin/*` and `/api/v1/admin/*` are backend/internal paths, not browser URLs.

Use `src/lib/api/axiosClient.ts` so cookie-mode credentials and coordinated
refresh behavior remain consistent. The current client is a foundation, not the
final typed domain API architecture.

## Source verification order

1. Gateway typed route entry.
2. Core/Worker controller and guards.
3. DTOs, response contracts, services, and tests.
4. Current frontend hooks/types/tests.
5. Markdown.
6. Mocks and fixtures only as frontend defect evidence.

See [Source of Truth](ai/SOURCE_OF_TRUTH.md).

## Current frontend routes

| Frontend route | Source status | Primary contract |
| --- | --- | --- |
| `/login` | `DONE/PARTIAL/BROKEN`: login/refresh/me/logout real; forgot password simulated; accept/reset/logout-all absent | [Auth](api/auth.md) |
| `/dashboard` | `DONE/REFACTOR`: real dashboard and unavailable states; report modules absent | [Dashboard](api/dashboard.md), [Reports](api/reports.md) |
| `/database-servers` | `DONE/REFACTOR`: real list/actions; typing/filter/error/metric work remains | [Database Servers](api/database-servers.md) |
| `/database-servers/new` | `DONE/REFACTOR`: real registration/connectivity; validation/error hardening remains | [Database Servers](api/database-servers.md) |
| `/database-servers/[id]` | `DONE/REFACTOR`: real detail/history/lifecycle/delete | [Database Servers](api/database-servers.md) |
| `/storage-servers` | `DONE/PARTIAL`: live bounded registry; critical advanced controls intentionally absent | [Storage Servers](api/storage-servers.md) |
| `/storage-servers/[id]` | `DONE/PARTIAL/GATED`: detail/edit/history/verification/lifecycle live; recovery/attestation gated | [Storage Servers](api/storage-servers.md) |
| `/tenants` | `PARTIAL/BROKEN`: real foundation mixed with weak types/local behaviors | [Tenants](api/tenants.md) |
| `/tenants/new` | `PARTIAL/BROKEN`: real quote/Storage placement foundation; simulated/hardcoded sequence remains | [Tenants](api/tenants.md) |
| `/tenants/[id]` | `PARTIAL/BROKEN`: real detail mixed with wrong routes/methods, mock catalogues, and local wallet/lifecycle | [Tenants](api/tenants.md), [Tenant users](api/tenant-users.md), [Operations](api/tenant-operations.md) |
| `/modules` | `DONE/PARTIAL/REFACTOR`: main catalogue calls exist; bounded delete/audit/batch/Storage gaps remain | [Catalogue](api/catalog.md) |
| `/modules/[id]` | `DONE/PARTIAL/REFACTOR`: real nested catalogue foundation; decimal/enum/error hardening remains | [Catalogue](api/catalog.md) |
| `/users` | `DONE/PARTIAL`: real user list/invite/lifecycle; error/state hardening remains | [Users](api/users.md) |
| `/users/[id]` | `DONE/PARTIAL`: real user/roles/WebPhone; self profile is separate and missing | [Users](api/users.md) |
| `/roles` | `DONE/PARTIAL/REFACTOR`: real roles/permissions; ordinary metadata permission must remain non-critical | [Roles](api/roles-permissions.md) |
| `/roles/[id]` | `DONE/PARTIAL/REFACTOR`: real role detail/permission replacement | [Roles](api/roles-permissions.md) |
| `/settings/*` | `DONE/PARTIAL/REFACTOR`: real settings/SMTP/Asterisk foundation with remaining permission/fallback issues | [Settings](api/system-settings.md) |

The app has no frontend route yet for reports, provisioning governance,
subscriptions, invoices, payments/reconciliation, control-plane audit, logging,
real notifications, or self-profile/auth completion.

## Broken tenant contracts

The current tenant detail hook contains the following confirmed defects:

| Current behavior | Required behavior |
| --- | --- |
| Calls nonexistent separate FQDN GET | Read nested FQDN projection from tenant detail |
| Uses `PATCH` for tenant-user suspend/activate/restore | Use `POST` |
| Sends `{ domain }` to FQDN create | Send `{ fqdn }` |
| Uses `PATCH` for primary FQDN | Use `POST` |
| Calls tenant-nested subscription cancel | Use `/subscriptions/:tenantId/cancel` |
| Calls wallet credit/debit routes | Preview and confirm wallet adjustment |
| Uses mock access catalogues | Load role/branch/department/team APIs independently |

Tenant creation also contains hardcoded database IDs, hardcoded
module/tier choices, `YEARLY`, simulated identity validation, simulated
provisioning preview, and incomplete FQDN/reverse-geocode behavior.

## Shared HTTP contract

Core success:

```ts
interface SuccessResponse<T> {
  success: true;
  data: T;
  meta?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  correlationId: string;
  timestamp: string;
}
```

Use `data` for rows and `meta.total` for pagination. A successful `DELETE 204`
has no body.

Normalize Core `errorCode` and Gateway `code` into one error while preserving
field errors and `correlationId`. See
[HTTP and Error Contract](architecture/http-and-error-contract.md).

## Authentication

- Use HttpOnly cookie auth.
- Send `credentials: "include"` and `x-auth-cookie-mode: 1`.
- Store only non-secret session timing/generation and validated profile data.
- Coordinate one refresh across callers and retry a protected request once.
- Only definitive refresh `401/403` clears the session.
- Never treat isolated unauthenticated `/auth/me` as failed-login evidence.

## Permissions

Permission lists use ALL semantics unless Gateway explicitly declares ANY.
FQDN validation is the current explicit ANY route. The frontend needs
`adminCan`, `adminCanAll`, `adminCanAny`, and a ONE/ALL/ANY requirement
component.

Nested tenant permissions are independent. `admin.tenants.read` does not grant
tenant-user, subscription, invoice, wallet, payment, audit, or provisioning
access. A `403` renders forbidden, not empty.

## Idempotency

Write-sensitive commands use UUIDv7 keys. One exact user intent owns one key
through pending and exact retry. The current auto-generating interceptor is not
enough for exact retry because the mutation caller must retain the original
intent key.

Treat `GW.IDEM.IN_FLIGHT` as processing/reconcile. Treat mismatch/reuse errors
as client defects.

## Data-state and numeric rules

Each independent resource must distinguish loading, refreshing, data, empty,
forbidden, unavailable, validation, conflict, stale, transport, replay, and
terminal async failure.

Keep money, FX, byte quotas, and capacities as strings. Do not use `parseFloat`
for authoritative financial calculations.

## Gated boundaries

- Existing-tenant Storage Server migration remains default-off and must not be
  exposed.
- Normal tenant PATCH must never accept `storageServerId`.
- Admin Realtime is not activated; notification UX falls back to REST polling.
- Storage attestation/recovery remains gated until its operator-safe evidence
  contract is confirmed.

## Implementation order

1. HTTP/error contracts, RBAC ONE/ALL/ANY, stable intent keys, decimal/byte
   helpers, and shared API states.
2. Repair false-live tenant/auth workflows.
3. Complete the live tenant-creation sequence.
4. Add operational modules.
5. Add provisioning governance.
6. Add bounded catalogue/infrastructure gaps while preserving gates.

See the full [implementation playbook](ai/IMPLEMENTATION_PLAYBOOK.md) and
[test matrix](ai/TEST_MATRIX.md).
