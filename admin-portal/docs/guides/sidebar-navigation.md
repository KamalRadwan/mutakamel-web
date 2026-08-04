# Admin Portal Navigation and Permission Mapping

Last verified against the current frontend routes plus Core and Worker Gateway
contracts on **2026-08-04**.

Frontend page paths and API paths are different namespaces. Navigation must use
paths such as `/tenants`; data requests must use paths such as
`/api/admin/core/v1/tenants`.

## Current top navigation

| UI item | Frontend route | Required permission | Current data status |
|:---|:---|:---|:---|
| Dashboard | `/dashboard` | `admin.reports.read` | `DONE/REFACTOR` |
| Database Servers | `/database-servers` | `admin.database_servers.read` | `DONE/SOURCE_INTEGRATED`; provisioning and Application principals only |
| Backup & Restore | `/backup` | `admin.backups.read` | `DONE/SOURCE_INTEGRATED/RELEASE_BLOCKED`; separate Worker operations and Core Backup-principal access |
| Storage Servers | `/storage-servers` | `admin.storage_servers.read` | Live bounded registry list/detail subset |
| Tenants | `/tenants` | `admin.tenants.read` | `PARTIAL/BROKEN` |
| Applications | `/applications-catalogue` | `admin.applications.read` | `PARTIAL/REFACTOR`; list/detail/delete only in active UI |
| Admin → Users | `/users` | `admin.users.read` | `DONE/PARTIAL` |
| Admin → Roles | `/roles` | `admin.roles.read` | `DONE/PARTIAL/REFACTOR` |
| Settings | `/settings` | At least one visible settings permission; individual screens use `admin.settings.read` | `DONE/PARTIAL/REFACTOR` |

The current `Navbar` permission-filters Infrastructure children, Backup &
Restore, and Admin dropdown children from the `permissions` array returned by
`GET /api/admin/core/v1/auth/me`. The same filtered destinations are rendered
in the responsive mobile menu; the hamburger is not a no-op. Direct route
guards and backend authorization remain authoritative; hiding navigation is not
an authorization boundary.

## Current route families

```text
/dashboard

/database-servers
├─ /database-servers/new
└─ /database-servers/[id]

/backup
├─ /backup/access
├─ /backup/policies
├─ /backup/runs
├─ /backup/artifacts
└─ /backup/restores

/storage-servers
└─ /storage-servers/[id]

/tenants
├─ /tenants/new
└─ /tenants/[id]

/applications-catalogue
└─ /applications-catalogue/[applicationKey]

/users
└─ /users/[id]

/roles
└─ /roles/[id]

/settings
├─ /settings/platform
├─ /settings/auth
├─ /settings/billing
├─ /settings/asterisk
├─ /settings/notifications
└─ /settings/smtp
```

See [the integration guide](../frontend-integration-guide.md) for redirect-only
legacy routes and live/mock status.

`/database-servers` and `/backup` are intentionally separate modules. Database
Servers owns connection/TLS, lifecycle, `mutakamel_provisioner`, and
per-Application principals. It can show only an aggregate Backup dependency
notice and link to `/backup/access?databaseServerId=:id`. Backup & Restore owns
the `mutakamel_backup` status and credential controls plus Worker policy, run,
artifact, and restore workflows. The UI route is singular `/backup`; its Worker
API paths remain plural `/backups` and `/restores`.

## Backend-ready modules without current pages

These backend capabilities can become navigation groups, but no matching
frontend page exists yet:

| Proposed item | Proposed frontend route | API owner/prefix | Permission |
|:---|:---|:---|:---|
| Subscriptions | `/subscriptions` | Core `/api/admin/core/v1/subscriptions` | `admin.subscriptions.read` |
| Invoices | `/invoices` | Core `/api/admin/core/v1/invoices` | `admin.invoices.read` |
| Reports | `/reports` | Core `/api/admin/core/v1/reports` | `admin.reports.read` |
| Payments and reconciliation | `/payments` | Core `/api/admin/core/v1/payments` | `admin.wallet.read` / `admin.billing.reconcile` |
| Provisioning governance | `/provisioning` | Core `/api/admin/core/v1/provisioning` | Domain-specific `admin.provisioning.*` |
| Control-plane audit | `/audit` | Core `/api/admin/core/v1/audit` | `admin.audit.read` |
| Logging | `/logging` | Core `/api/admin/core/v1/logging` | `admin.logging.read` |

Wallet, tenant users, provisioning operations, and the future tenant Storage
Server migration panel are naturally nested under `/tenants/[id]` rather than
primary navigation items.

Notifications currently appear as a static navbar dropdown. A server-backed
inbox should use `admin.notifications.read` and REST polling until Admin
Realtime is released.

The live bounded Storage Servers module uses an add modal on `/storage-servers` and
one `/storage-servers/[id]` route for both view and embedded edit mode. It does
not require `/storage-servers/new` or `/storage-servers/[id]/edit`. See
[Storage Servers](../api/storage-servers.md).

Do not add a top-level tenant-storage-migrations route. When the feature's
read-model and operational release gates close, expose it as a permissioned
panel under `/tenants/[id]`. Ordinary profile edit must continue to exclude
`storageServerId`. See
[Tenant Storage Server Migrations](../api/tenant-storage-migrations.md).

The planned Storage Servers module uses an add modal on `/storage-servers` and
one `/storage-servers/[id]` route for both view and embedded edit mode. It does
not require `/storage-servers/new` or `/storage-servers/[id]/edit`. See
[Storage Servers](../api/storage-servers.md).

## Permission-gating rules

1. Complete `/auth/me` before rendering protected navigation.
2. Show a group when the user has access to at least one visible child.
3. Gate read navigation separately from create/update/delete actions.
4. Re-check permission at page entry so a direct URL cannot display an
   unauthorized screen shell.
5. Treat HTTP `403` as authoritative even if the cached permission array
   suggested access.
6. Do not replace backend authorization with hidden buttons.

## Known broken links

The current UI still contains links to frontend routes that do not exist:

```text
/admin/users/me/profile
/admin/roles
/admin/tenants
/admin/reports
```

Do not copy these into new components. Use the current route namespace or add a
real page and navigation decision first.
