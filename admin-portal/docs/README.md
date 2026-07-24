# Admin Portal Documentation

Frontend-facing reference for building `admin-portal` against the current
Mutakamel backend applications.

Last source verification: **2026-07-24**

## Start here

Read [frontend-integration-guide.md](frontend-integration-guide.md) first. It
contains:

- backend ownership and canonical API Gateway URL rules;
- the complete frontend route and live/mock integration inventory;
- authentication, global validation, error, and RBAC conventions;
- known frontend/backend mismatches;
- a dated backend route-capability snapshot and recommended integration order.

For the current dashboard task, continue with the exact
[Dashboard API contract](api/dashboard.md).

## Critical routing rule

All endpoint pages in `api/` describe controller resources such as
`/admin/tenants`. Browser code must address them through API Gateway:

```text
Core admin controller /admin/<route>
→ /api/admin/core/v1/<route>

Worker admin controller /admin/<route>
→ /api/admin/worker/v1/<route>
```

Examples:

```text
/admin/dashboard       → /api/admin/core/v1/dashboard
/admin/tenants         → /api/admin/core/v1/tenants
/admin/backups/runs    → /api/admin/worker/v1/backups/runs
```

Never copy the unversioned controller-relative path into frontend request code.

## API references

| Domain | Reference | Owning app |
|:---|:---|:---|
| Authentication | [auth.md](api/auth.md) | Core |
| Dashboard | [dashboard.md](api/dashboard.md) | Core |
| Admin users | [users.md](api/users.md) | Core |
| Roles and permissions | [roles-permissions.md](api/roles-permissions.md) | Core |
| Tenants | [tenants.md](api/tenants.md) | Core |
| Tenant users | [tenant-users.md](api/tenant-users.md) | Core |
| Tenant/provisioning operations | [tenant-operations.md](api/tenant-operations.md) | Core |
| Subscriptions | [subscriptions.md](api/subscriptions.md) | Core |
| Catalogue and currency rates | [catalog.md](api/catalog.md) | Core |
| Invoices | [invoices.md](api/invoices.md) | Core |
| Wallet and ledger | [wallet.md](api/wallet.md) | Core |
| Database servers | [database-servers.md](api/database-servers.md) | Core |
| Reports | [reports.md](api/reports.md) | Core |
| System and SMTP settings | [system-settings.md](api/system-settings.md) | Core |
| Notifications | [notifications.md](api/notifications.md) | Core |
| Logging overrides | [logging.md](api/logging.md) | Core |
| Backup and restore | [backups-restores.md](api/backups-restores.md) | Worker through Gateway |

## Models and security

- [Selected DTOs and validation rules](models/dtos.md)
- [Transport enums](models/enums.md)
- [Key response interfaces](models/interfaces.md)
- [RBAC permission matrix](rbac/permissions.md)
- [Navigation/permission mapping](guides/sidebar-navigation.md)

The DTO and interface pages are shared high-use references. Domain-specific
request/response fields remain in the corresponding API page. Backend DTOs and
gateway route contracts remain authoritative if a markdown page is stale.

## Reusable UI specifications

- [Component index](components/README.md)
- [Data table](components/data-table.md)
- [Filter bar](components/filter-bar.md)
- [Status badge](components/status-badge.md)
- [Form drawer](components/form-drawer.md)
- [Confirmation modal](components/confirm-action-modal.md)
- [Audit log viewer](components/audit-log-viewer.md)
- [Operation timeline](components/operation-timeline.md)
- [Floating WebPhone](components/floating-webphone.md)

These component files describe intended UI behavior. They do not prove that
the corresponding frontend screen is server-backed; check the integration
inventory first.

## Backend source roots

Paths below are relative to `C:\mutakamel.ai\frontend`:

```text
../backend/mutakamel-apps/core-app
../backend/mutakamel-apps/api-gateway-app
../backend/mutakamel-apps/worker-app
../backend/mutakamel-apps/crm-app
../backend/mutakamel-apps/trade-app
```

For browser paths, inspect the gateway route contract first. For fields and
validation, inspect the owning controller and DTO next.
