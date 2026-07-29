# Admin Portal Navigation and Permission Mapping

Last verified against the current frontend routes and Core permission
decorators on **2026-07-28**.

Frontend page paths and API paths are different namespaces. Navigation must use
paths such as `/tenants`; data requests must use paths such as
`/api/admin/core/v1/tenants`.

## Current top navigation

| UI item | Frontend route | Required permission | Current data status |
|:---|:---|:---|:---|
| Dashboard | `/dashboard` | `admin.reports.read` | Mock |
| Database Servers | `/database-servers` | `admin.database_servers.read` | Mock |
| Storage Servers | `/storage-servers` | `admin.storage_servers.read` | Planned; no page route exists |
| Tenants | `/tenants` | `admin.tenants.read` | Mock |
| Modules | `/modules` | `admin.catalog.read` | Mock |
| Admin → Users | `/users` | `admin.users.read` | Mock |
| Admin → Roles | `/roles` | `admin.roles.read` | Mock |
| Settings | `/settings` | At least one visible settings permission; individual screens use `admin.settings.read` | Mixed static/fallback |

The current `Navbar` does not permission-gate these items. When wiring RBAC,
derive visibility from the `permissions` array returned by
`GET /api/admin/core/v1/auth/me`.

## Current route families

```text
/dashboard

/database-servers
├─ /database-servers/new
└─ /database-servers/[id]

/storage-servers
└─ /storage-servers/[id]

/tenants
├─ /tenants/new
└─ /tenants/[id]

/modules
└─ /modules/[id]

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

## Backend-ready modules without current pages

These backend capabilities can become navigation groups, but no matching
frontend page exists yet:

| Proposed item | Proposed frontend route | API owner/prefix | Permission |
|:---|:---|:---|:---|
| Subscriptions | `/subscriptions` | Core `/api/admin/core/v1/subscriptions` | `admin.subscriptions.read` |
| Invoices | `/invoices` | Core `/api/admin/core/v1/invoices` | `admin.invoices.read` |
| Reports | `/reports` | Core `/api/admin/core/v1/reports` | `admin.reports.read` |
| Logging | `/logging` | Core `/api/admin/core/v1/logging` | `admin.logging.read` |
| Backup & Restore | `/backups` | Worker `/api/admin/worker/v1/backups` and `/restores` | `admin.backups.read` |

Wallet, tenant users, and provisioning operations are naturally nested under
`/tenants/[id]` rather than primary navigation items.

Notifications currently appear as a navbar dropdown. It should use
`admin.notifications.read` when it becomes server-backed.

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
