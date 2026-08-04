# Admin Portal API Index

Status: **Current**

Last source verification: **2026-08-04**

All browser routes use API Gateway. Core Admin routes begin with
`/api/admin/core/v1/`; Worker backup/restore routes begin with
`/api/admin/worker/v1/`.

## Core domain guides

| Domain | Frontend status | Guide |
| --- | --- | --- |
| Authentication | `DONE/PARTIAL/BROKEN` | [auth.md](auth.md) |
| Dashboard | `DONE/SOURCE_INTEGRATED` | [dashboard.md](dashboard.md) |
| Reports | `MISSING` | [reports.md](reports.md) |
| Admin users/profile/WebPhone | `DONE/PARTIAL` | [users.md](users.md) |
| Roles/permissions | `DONE/PARTIAL/REFACTOR` | [roles-permissions.md](roles-permissions.md) |
| Database Servers | `DONE/SOURCE_INTEGRATED` | [database-servers.md](database-servers.md) |
| Storage Servers | `DONE/PARTIAL/GATED` | [storage-servers.md](storage-servers.md) |
| Tenants | `PARTIAL/BROKEN` | [tenants.md](tenants.md) |
| Tenant users/access | `PARTIAL/BROKEN` | [tenant-users.md](tenant-users.md) |
| Tenant operations | `PARTIAL/MISSING` | [tenant-operations.md](tenant-operations.md) |
| Storage migrations | `GATED` | [tenant-storage-migrations.md](tenant-storage-migrations.md) |
| Provisioning governance | `MISSING` | [provisioning-governance.md](provisioning-governance.md) |
| Application Catalogue | `DONE/SOURCE_INTEGRATED` | [catalog.md](catalog.md) |
| Subscriptions | `MISSING/PARTIAL/BROKEN` | [subscriptions.md](subscriptions.md) |
| Wallet | `BROKEN/MISSING` | [wallet.md](wallet.md) |
| Payments/reconciliation | `MISSING` | [payments-reconciliation.md](payments-reconciliation.md) |
| Invoices | `MISSING` | [invoices.md](invoices.md) |
| Settings/SMTP | `DONE/PARTIAL/REFACTOR` | [system-settings.md](system-settings.md) |
| Notifications | `MISSING` | [notifications.md](notifications.md) |
| Logging | `MISSING` | [logging.md](logging.md) |
| Control-plane audit | `MISSING` | [control-plane-audit.md](control-plane-audit.md) |

## Route evidence

The source-generated [Admin Core route inventory](../generated/admin-core-api-routes.md)
is a historical snapshot and still contains the removed `/modules` contract.
Until it is regenerated from the current Gateway registry, use the hand-written
Application Catalogue and Database Server guides plus current Gateway/Core
source for route, permission, and idempotency authority.

## Secondary Worker domain

| Domain | Frontend status | Guide |
| --- | --- | --- |
| Backup and Restore | `DONE/SOURCE_INTEGRATED/RELEASE_BLOCKED` | [backups-restores.md](backups-restores.md) |

Backup operations are owned by Worker and are not part of the Core Admin route
set. The separate frontend module uses the singular route `/backup` with
`/access`, `/policies`, `/runs`, `/artifacts`, and `/restores` children. Worker
browser APIs remain plural `/api/admin/worker/v1/backups/*` and
`/api/admin/worker/v1/restores/*`.

The Backup module also has a narrowly scoped Core adapter for the fixed
`mutakamel_backup` principal. It owns that principal's rotation-policy,
regenerate, and reconcile UI. `/database-servers` owns only provisioning and
per-Application principal controls, plus an aggregate Backup dependency link.

## Contract rules

- Core success data is under `data`; paginated totals are under `meta.total`.
- Core errors use `errorCode`; Gateway Problem Details use `code`.
- Preserve `correlationId`.
- Use exact permission mode and UUIDv7 idempotency behavior from the Gateway
  route.
- Backup policy/override writes, delete commands, and Core Backup-principal
  credential commands retain stable exact-intent keys. Manual backup start,
  restore start, and restore promotion send no idempotency key and must not be
  replayed automatically after authentication refresh or transport failure.
- Keep financial and byte values as strings.
- Never expose database passwords, artifact storage/manifest keys, raw artifact
  metadata, or raw restore verification payloads.
- Do not present a `GATED` backend foundation as missing frontend work.
