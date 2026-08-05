# Admin Portal Frontend Integration Guide

Status: **[Verified]**

Last source verification: **2026-08-04**

Application Catalogue integration reverified: **2026-08-05**.

## Scope

This guide connects the current Admin Portal source to the Core and Worker
Admin Gateway contracts. It does not claim full parity, authenticated runtime
success, release readiness, or deployment. The checked generated inventory
contains the canonical Application publish route and no `/modules` root, but a
route inventory remains transport evidence rather than frontend-completion or
runtime evidence.

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
| `/dashboard` | `DONE/SOURCE_INTEGRATED`: grouped permission-filtered dashboard with 14 report groups and unavailable states; standalone report modules remain absent | [Dashboard](api/dashboard.md), [Reports](api/reports.md) |
| `/database-servers` | `DONE/SOURCE_INTEGRATED`: real typed list/filter/pagination, permission-aware soft delete, deleted-only review, and separately permissioned permanent Destroy | [Database Servers](api/database-servers.md) |
| `/database-servers/new` | `DONE/SOURCE_INTEGRATED`: accepts only the write-only security-admin and TLS material, then starts server-side service and Application credential assembly; generated access is not returned to the browser | [Database Servers](api/database-servers.md) |
| `/database-servers/[id]` | `DONE/SOURCE_INTEGRATED`: provisioning and Application principals, maintenance-aware rotation, retry/reconciliation, history, and fail-closed activation; a zero-active-Application blocker links to Application Catalogue before retry; Backup is represented only by an aggregate dependency notice linking to `/backup/access` | [Database Servers](api/database-servers.md) |
| `/backup` | `DONE/SOURCE_INTEGRATED/RELEASE_BLOCKED`: separate protection-chain overview; Worker safe-response DTOs and exact start-command recovery remain backend gates | [Backup and Restore](api/backups-restores.md) |
| `/backup/access` | `DONE/SOURCE_INTEGRATED`: Core-backed fixed `mutakamel_backup` status, hour-based rotation policy, secret-free regeneration, and exact-candidate reconciliation | [Backup and Restore](api/backups-restores.md) |
| `/backup/policies` | `DONE/SOURCE_INTEGRATED`: Worker policy and per-database override editor with exact critical permission pairs | [Backup and Restore](api/backups-restores.md) |
| `/backup/runs` | `DONE/SOURCE_INTEGRATED`: bounded Worker run history, manual start, deletion, and ambiguous-outcome reconciliation | [Backup and Restore](api/backups-restores.md) |
| `/backup/artifacts` | `DONE/SOURCE_INTEGRATED`: bounded safe artifact evidence, critical deletion, and restore hand-off without storage-path exposure | [Backup and Restore](api/backups-restores.md) |
| `/backup/restores` | `DONE/SOURCE_INTEGRATED`: isolated restore tests, verification-presence status, and separately confirmed critical promotion | [Backup and Restore](api/backups-restores.md) |
| `/storage-servers` | `DONE/PARTIAL`: live bounded registry; critical advanced controls intentionally absent | [Storage Servers](api/storage-servers.md) |
| `/storage-servers/[id]` | `DONE/PARTIAL/GATED`: detail/edit/history/verification/lifecycle live; recovery/attestation gated | [Storage Servers](api/storage-servers.md) |
| `/tenants` | `PARTIAL/BROKEN`: real foundation mixed with weak types/local behaviors | [Tenants](api/tenants.md) |
| `/tenants/new` | `PARTIAL/BROKEN`: real quote/Storage placement foundation; simulated/hardcoded sequence remains | [Tenants](api/tenants.md) |
| `/tenants/[id]` | `PARTIAL/BROKEN`: real detail mixed with wrong routes/methods, mock catalogues, and local wallet/lifecycle | [Tenants](api/tenants.md), [Tenant users](api/tenant-users.md), [Operations](api/tenant-operations.md) |
| `/applications-catalogue` | `DONE/SOURCE_INTEGRATED`: real list/create/filtering includes independent publication state and its column, totals, retry, and global catalogue audit; authenticated runtime evidence remains open | [Application Catalogue](api/catalog.md) |
| `/applications-catalogue/[applicationKey]` | `DONE/SOURCE_INTEGRATED`: real detail includes the release-authority rail, dual-fence publish flow, attributable-publication plus technical-readiness activation gate, exact readiness projection, stored runtime target, explicit component binding, stable-intent recovery, manifests, metadata/policy/lifecycle, and commercial controls; authenticated runtime evidence remains open | [Application Catalogue](api/catalog.md) |
| `/users` | `DONE/PARTIAL`: real user list/invite/lifecycle; error/state hardening remains | [Users](api/users.md) |
| `/users/[id]` | `DONE/PARTIAL`: real user/roles/WebPhone; self profile is separate and missing | [Users](api/users.md) |
| `/roles` | `DONE/PARTIAL/REFACTOR`: real roles/permissions; ordinary metadata permission must remain non-critical | [Roles](api/roles-permissions.md) |
| `/roles/[id]` | `DONE/PARTIAL/REFACTOR`: real role detail/permission replacement | [Roles](api/roles-permissions.md) |
| `/settings/*` | `DONE/PARTIAL/REFACTOR`: real settings/SMTP/Asterisk foundation with remaining permission/fallback issues | [Settings](api/system-settings.md) |

The app has no frontend route yet for reports, provisioning governance,
subscriptions, invoices, payments/reconciliation, control-plane audit, logging,
real notifications, or self-profile/auth completion. Managed currency list,
single-rate update, and transactional batch update remain under
`/settings/billing`.

## Application Catalogue release authority

The browser must render three independent states: lifecycle, publication, and
technical readiness. `runtimeTarget` is signed/stored identity and must never
be reconstructed as `${applicationKey}-app`.

- List reads support a `publicationStatus=UNPUBLISHED|PUBLISHED` filter and
  must show publication separately from lifecycle.
- `POST /api/admin/core/v1/applications/:applicationKey/publish` requires
  `admin.applications.update` plus `admin.applications.critical`, a caller-owned
  UUIDv7 idempotency key, both current revision fences, and a reason.
- Metadata edits invalidate an existing publication and never auto-publish.
- Activation requires attributable publication plus technical
  `activationAllowed`; new selection uses complete `selectionAllowed`.
- Existing installed runtime may retain a `PUBLISHED` `ACTIVE` or `DEPRECATED`
  Application. Deprecation must not be presented as automatic tenant removal.

Current frontend source adopts these fields and actions. That establishes
source integration only; it is not authenticated runtime, deployment, or
release-readiness proof.

## Database and Backup module boundary

The UI route namespace deliberately separates database infrastructure from
backup operations:

```text
/database-servers  -> connection, TLS, lifecycle, provisioning, Applications
/backup            -> access, policies, runs, artifacts, restores
```

Database Servers owns `mutakamel_provisioner` and per-Application principal
controls. It consumes only Core's aggregate Backup-readiness signal and links
the operator to `/backup/access?databaseServerId=:id` when that dependency
blocks activation. The Backup module's Core adapter owns `mutakamel_backup`
rotation-policy, regenerate, and reconcile calls. Worker operation clients keep
the plural browser APIs `/api/admin/worker/v1/backups/*` and
`/api/admin/worker/v1/restores/*`; `/backups` is not a frontend route.

Database Server deletion has two explicit stages. `DELETE /:id` performs the
recoverable registry soft delete. The list sends `deleted=true` to review only
deleted rows, and `DELETE /:id/destroy` is available only for an authoritative
non-null `deletedAt` projection with `admin.database_servers.delete.hard` plus
`admin.database_servers.critical`.

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
- Explicitly non-replayable backup/restore writes are the exception: return the
  first `401` to the caller and never refresh then repeat that request.
- Only definitive refresh `401/403` clears the session.
- Never treat isolated unauthenticated `/auth/me` as failed-login evidence.

## Permissions

Permission lists use ALL semantics unless Gateway explicitly declares ANY.
FQDN validation is the current explicit ANY route. The frontend needs
`adminCan`, `adminCanAll`, `adminCanAny`, and a ONE/ALL/ANY requirement
component.

The `/backup` shell requires `admin.backups.read`. Backup policy and database
override mutations require `admin.backups.manage` plus
`admin.backups.critical`; manual backup start requires only
`admin.backups.manage`; run/artifact deletion requires `admin.backups.delete`
plus `admin.backups.critical`; restore start and promotion require
`admin.backups.restore` plus `admin.backups.critical`. Backup database-access
reads require `admin.database_servers.read`; its rotation-policy mutation
requires `admin.database_servers.update` plus
`admin.database_servers.critical`, while regenerate/reconcile require
`admin.database_servers.credentials.rotate` plus
`admin.database_servers.critical`.

Nested tenant permissions are independent. `admin.tenants.read` does not grant
tenant-user, subscription, invoice, wallet, payment, audit, or provisioning
access. A `403` renders forbidden, not empty.

## Idempotency

Write-sensitive commands use UUIDv7 keys. One exact user intent owns one key
through pending and exact retry. The current auto-generating interceptor is not
enough for exact retry because the mutation caller must retain the original
intent key.

For Database Server creation, a definitive `4xx` response ends the failed
intent, so a later submission receives a fresh key. `GW.IDEM.IN_FLIGHT`, a
network failure, and `5xx` preserve the original key because the outcome is
still processing or unknown.

Treat `GW.IDEM.IN_FLIGHT` as processing/reconcile. Treat mismatch/reuse errors
as client defects.

Backup policy/override writes, Worker delete commands, and Core Backup-principal
credential commands retain stable caller-owned UUIDv7 keys for the exact
intent. Manual backup start, restore start, and restore promotion are explicitly
non-idempotent: suppress automatic key injection, prevent duplicate submission,
persist minimal non-secret attempt evidence across reloads, and review
target-scoped Worker evidence before retry. Do not attach an idempotency key or
automatic authentication/transport retry to those three commands. Exact
server-side identity/recovery for start commands remains a release gate.

## Data-state and numeric rules

Each independent resource must distinguish loading, refreshing, data, empty,
forbidden, unavailable, validation, conflict, stale, transport, replay, and
terminal async failure.

Keep money, FX, byte quotas, and capacities as strings. Do not use `parseFloat`
for authoritative financial calculations.

Backup UI must not render passwords, `storageKey`, `storagePrefix`,
`manifestKey`, raw artifact `metadata`, or raw restore `verification`. It may
show only allowlisted status/evidence projections and verification presence.
The frontend adapter strips raw entity fields from application state; Worker
must still stop returning those fields in its HTTP response before release.

## Gated boundaries

- Existing-tenant Storage Server migration remains default-off and must not be
  exposed.
- Normal tenant PATCH must never accept `storageServerId`.
- Admin Realtime is not activated; notification UX falls back to REST polling.
- Storage attestation/recovery remains gated until its operator-safe evidence
  contract is confirmed.
- Backup production readiness remains gated until Worker exposes explicit safe
  response DTOs and durable command identity/recovery for non-idempotent starts.

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
