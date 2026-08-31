# Admin Portal Navigation and Permission Mapping

Last verified against current frontend routes and Core/Worker Gateway contracts
on **2026-08-29**.

Frontend page paths and API paths are separate namespaces. Navigation uses
paths such as `/tenants`; requests use `/api/admin/core/v1/tenants`.

This guide is the RBAC-and-route-family reference. For the sidebar/topbar
component structure, the full 15-section × 54-route table, and how the
permission-filtered navigation is actually built (`nav-config.ts` +
`useNavTree.ts`), see
[design-system/shell-and-navigation.md](../design-system/shell-and-navigation.md)
— the table below is a condensed route-family summary.

Route existence is not the same as direct sidebar or command-palette
reachability. Current `NAV_SECTIONS` contains top-level entries; many subroutes
and dynamic detail/create routes below exist without being individual command
search results. The approved target is one nested route tree shared by sidebar,
mobile navigation, breadcrumbs, SubNav, and command search.

## Current sidebar navigation

The horizontal, permanently-dark 15-item navbar this table originally
described has been replaced by a collapsible sidebar (`AppShell` /
`Sidebar` / `Topbar`, see the design-system doc above). The route/permission
mapping itself is unchanged by that replacement:

| UI item | Frontend route | Required permission | Source status |
|:---|:---|:---|:---|
| Dashboard | `/dashboard` | `admin.reports.read` | `DONE/SOURCE_INTEGRATED` |
| Database Servers | `/database-servers` | `admin.database_servers.read` | `DONE/SOURCE_INTEGRATED` |
| Backup & Restore | `/backup` | `admin.backups.read` | `DONE/SOURCE_INTEGRATED/RELEASE_BLOCKED` |
| Storage Servers | `/storage-servers` | `admin.storage_servers.read` | `DONE/SOURCE_INTEGRATED` |
| Tenants | `/tenants` | `admin.tenants.read` | `DONE/SOURCE_INTEGRATED` |
| Applications | `/applications-catalogue` | `admin.applications.read` | `DONE/SOURCE_INTEGRATED` |
| Admin - Users | `/users` | `admin.users.read` | `DONE/SOURCE_INTEGRATED` |
| Admin - Roles | `/roles` | `admin.roles.read` | `DONE/SOURCE_INTEGRATED` |
| Admin - Audit | `/audit` | `admin.audit.read` | `DONE/SOURCE_INTEGRATED` |
| Admin - Reports | `/reports` | `admin.reports.read` | `DONE/SOURCE_INTEGRATED` |
| Admin - Subscriptions | `/subscriptions` | `admin.subscriptions.read` | `DONE/SOURCE_INTEGRATED` |
| Admin - Invoices | `/invoices` | `admin.invoices.read` | `DONE/SOURCE_INTEGRATED` |
| Admin - Logging | `/logging` | `admin.logging.read` | `DONE/SOURCE_INTEGRATED` |
| Admin - Provisioning | `/provisioning` | Any visible provisioning read permission | `DONE/SOURCE_INTEGRATED` |
| Settings | `/settings` | At least one visible child permission | `DONE/SOURCE_INTEGRATED` |

Notifications are exposed through both the topbar and `/notifications`;
topbar access and each action are permission filtered.

The same top-level permission-filtered destinations render in the desktop
sidebar and responsive mobile sheet (`MobileNav`, `Sheet side="start"`). A
parent renders only when at least one child is visible. Direct
page guards and backend authorization remain authoritative; hidden navigation
is not an authorization boundary.

## Current route families

```text
/dashboard
/reports
/audit
/notifications
/subscriptions
/invoices
|-- /invoices/new
`-- /invoices/[id]
/logging

/database-servers
|-- /database-servers/new
`-- /database-servers/[id]

/backup
|-- /backup/access
|-- /backup/policies
|-- /backup/runs
|-- /backup/artifacts
`-- /backup/restores

/storage-servers
|-- /storage-servers/new
`-- /storage-servers/[id]

/tenants
|-- /tenants/new
`-- /tenants/[id]

/applications-catalogue
|-- /applications-catalogue/audit
`-- /applications-catalogue/[applicationKey]

/provisioning
|-- /provisioning/fleet
|   |-- /provisioning/fleet/previews/[previewId]
|   `-- /provisioning/fleet/rollouts/[rolloutId]
|-- /provisioning/publisher-keys
`-- /provisioning/releases
    |-- /provisioning/releases/[releaseId]
    |-- /provisioning/releases/drafts/new
    `-- /provisioning/releases/drafts/[draftId]

/users
`-- /users/[id]
/roles
`-- /roles/[id]
/profile

/settings
|-- /settings/platform
|-- /settings/auth
|-- /settings/billing
|-- /settings/webphone
|-- /settings/notifications
|-- /settings/smtp
|-- /settings/fatal-alerts
`-- /settings/storage
```

Payments/reconciliation, wallet, tenant users, and tenant provisioning
operations are intentionally nested in `/tenants/[id]` rather than duplicated
as primary navigation items.

## Infrastructure and gated boundaries

`/database-servers` and `/backup` are separate modules. Database Servers owns
connection/TLS, lifecycle, `mutakamel_provisioner`, and per-Application
principals. Backup owns `mutakamel_backup` plus Worker policies, runs, artifacts,
and restores. Worker paths remain plural `/backups` and `/restores` while the UI
route is singular `/backup`.

Do not add a tenant-storage-migrations route or action. The eight historical
Core Admin routes are absent from current Core/Gateway source. If a new contract
is released, expose it only after a new inventory and safety audit; ordinary
tenant profile edit must continue to exclude `storageServerId`.

Use REST notifications until Admin Realtime has a released and deployed
admission/reconnect contract.

## Permission-gating rules

1. Complete `/auth/me` before rendering protected navigation.
2. Show a group only when at least one child is visible.
3. Gate read navigation separately from create/update/delete/critical actions.
4. Re-check permission at page entry before protected reads.
5. Treat HTTP `403` as authoritative, never as an empty resource.
6. Do not replace backend authorization with hidden controls.
7. Use exact ALL/ANY composition from the Gateway contract.

## Canonical link namespace

Use `/profile`, `/roles`, `/tenants`, and `/reports`. Do not reintroduce stale
`/admin/users/me/profile`, `/admin/roles`, `/admin/tenants`, or `/admin/reports`
links.
