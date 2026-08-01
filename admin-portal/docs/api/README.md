# Admin Portal API Index

Status: **Current**

Last source verification: **2026-07-30**

All browser routes use API Gateway. Core Admin routes begin with
`/api/admin/core/v1/`; Worker backup/restore routes begin with
`/api/admin/worker/v1/`.

## Core domain guides

| Domain | Frontend status | Guide |
| --- | --- | --- |
| Authentication | `DONE/PARTIAL/BROKEN` | [auth.md](auth.md) |
| Dashboard | `DONE/REFACTOR` | [dashboard.md](dashboard.md) |
| Reports | `MISSING` | [reports.md](reports.md) |
| Admin users/profile/WebPhone | `DONE/PARTIAL` | [users.md](users.md) |
| Roles/permissions | `DONE/PARTIAL/REFACTOR` | [roles-permissions.md](roles-permissions.md) |
| Database Servers | `DONE/REFACTOR` | [database-servers.md](database-servers.md) |
| Storage Servers | `DONE/PARTIAL/GATED` | [storage-servers.md](storage-servers.md) |
| Tenants | `PARTIAL/BROKEN` | [tenants.md](tenants.md) |
| Tenant users/access | `PARTIAL/BROKEN` | [tenant-users.md](tenant-users.md) |
| Tenant operations | `PARTIAL/MISSING` | [tenant-operations.md](tenant-operations.md) |
| Storage migrations | `GATED` | [tenant-storage-migrations.md](tenant-storage-migrations.md) |
| Provisioning governance | `MISSING` | [provisioning-governance.md](provisioning-governance.md) |
| Catalogue | `DONE/PARTIAL/REFACTOR` | [catalog.md](catalog.md) |
| Subscriptions | `MISSING/PARTIAL/BROKEN` | [subscriptions.md](subscriptions.md) |
| Wallet | `BROKEN/MISSING` | [wallet.md](wallet.md) |
| Payments/reconciliation | `MISSING` | [payments-reconciliation.md](payments-reconciliation.md) |
| Invoices | `MISSING` | [invoices.md](invoices.md) |
| Settings/SMTP | `DONE/PARTIAL/REFACTOR` | [system-settings.md](system-settings.md) |
| Notifications | `MISSING` | [notifications.md](notifications.md) |
| Logging | `MISSING` | [logging.md](logging.md) |
| Control-plane audit | `MISSING` | [control-plane-audit.md](control-plane-audit.md) |

## Exhaustive route evidence

The source-generated [Admin Core route inventory](../generated/admin-core-api-routes.md)
contains all 243 Gateway routes, permissions, route classes, and idempotency
metadata.

## Secondary Worker domain

[Backup and restore](backups-restores.md) is owned by Worker and is not part of
the 243 Core Admin route count.

## Contract rules

- Core success data is under `data`; paginated totals are under `meta.total`.
- Core errors use `errorCode`; Gateway Problem Details use `code`.
- Preserve `correlationId`.
- Use exact permission mode and UUIDv7 idempotency behavior from the Gateway
  route.
- Keep financial and byte values as strings.
- Do not present a `GATED` backend foundation as missing frontend work.
