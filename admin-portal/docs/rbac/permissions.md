# Admin Portal — Guards & RBAC Permissions Inventory

Complete inventory of NestJS Guards, Custom Decorators, and RBAC Permission Keys used across the Admin Portal backend (`core-app`).

Last source verification: **2026-08-02**.

---

## 🛡️ Admin Guards & Decorators Overview

| Guard / Decorator | Scope & Behavior | Frontend Action / Integration |
|:---|:---|:---|
| **`AdminGuard`** | Primary auth guard applied across all `/admin/*` controllers. Validates the Gateway-forwarded admin access token and ensures identity belongs to an admin user (`SUPER_ADMIN`, `ADMIN`, or `USER` tier). | Use the shared cookie client with `credentials: "include"`; browser feature code must not select an auth mode or read/attach a bearer token. |
| **`@Public()`** | Bypasses `AdminGuard` for unauthenticated routes (`login`, `refresh`, `accept-invite`, `forgot-password`, `reset-password`, `logout`). | Use the documented public auth flow through the same-origin Gateway; do not invent service-direct or browser bearer-token behavior. |
| **`@RequirePermissions(...)`** | Method/Controller level RBAC check. Verifies that `actor.permissions` contains all specified keys. | Use ONE/ALL frontend requirements and render `403` as forbidden. |
| **`@RequireAnyPermissions(...)`** | Explicit ANY-permission check. The current Admin route inventory uses it for FQDN validation. | Use an ANY requirement; do not convert it to ALL. |
| **`@IdempotencyRequired()`** | Requires `X-Idempotency-Key` header (UUIDv7) for mutation requests (create/update/cancel). Prevents duplicate operations on network retries. | Generate a fresh UUIDv7 for each confirmed intent and attach it as `X-Idempotency-Key`. `crypto.randomUUID()` returns UUIDv4 and is not valid for these routes. |
| **`@CurrentActor()`** | Injects `CurrentUserContext` into controller handlers. | Hydrated automatically by `AdminGuard` from JWT claims. |
| **`@Language()`** | Extracts language header/query (`ar` / `en`) for localized email delivery or messages. | Send `Accept-Language: ar` or `Accept-Language: en` header. |

---

## 🔑 Admin Portal RBAC Permission Matrix

This is a frontend-focused domain inventory. The backend seed contains
additional internal and newer capability keys; each API document remains
authoritative for its exact route permissions.

### 1. Auth (`admin/auth`)
- **Guards**: `@Public()` for login/refresh/reset/invite; `AdminGuard` for `/me` and `/logout-all`.
- **Permissions**: Public (No RBAC permissions required).

### 2. Admin Staff Users (`admin.users.*`)
- **Guard**: `AdminGuard`
- `admin.users.read` — List users, view profile, view webphone config
- `admin.users.invite` — Invite new admin staff
- `admin.users.update` — Update admin staff details, update webphone settings
- `admin.users.suspend` — Suspend or reactivate admin staff
- `admin.users.delete` — Soft delete admin staff
- `admin.users.assign_roles` — Replace assigned roles for an admin user

### 3. Admin Roles (`admin.roles.*`)
- **Guard**: `AdminGuard`
- `admin.roles.read` — List and view custom/system roles
- `admin.roles.create` — Create custom admin role
- `admin.roles.update` — Update role details and replace permission grants
- `admin.roles.delete` — Delete custom role

### 4. Admin Permission Catalogue (`admin.permissions.*`)
- **Guard**: `AdminGuard`
- `admin.permissions.read` — Read-only catalogue of all permissions for role builder matrix

### 5. Dashboard & Reports (`admin.reports.*`)
- **Guard**: `AdminGuard`
- `admin.reports.read` — Open the dashboard endpoint; does not grant any report group by itself
- `admin.reports.tenants` — Tenant report group
- `admin.reports.domains` — Domain verification report group
- `admin.reports.subscriptions` — Subscription report group
- `admin.reports.billing` — Billing and receivables report group
- `admin.reports.payments` — Payment and refund report group
- `admin.reports.wallets` — Canonical wallet report group
- `admin.reports.database-server` — Database Server report group
- `admin.reports.storage` — Storage Server report group
- `admin.reports.provisioning` — Provisioning report group
- `admin.reports.catalogue` — Application Catalogue report group
- `admin.reports.notifications` — Notification delivery report group
- `admin.reports.usage` — Usage report group; current backend projection is unavailable
- `admin.reports.security` — Administrator security report group
- `admin.reports.audit` — Control-plane audit report group

### 6. Tenants Control (`admin.tenants.*`)
- **Guard**: `AdminGuard`
- `admin.tenants.create` — Validate identity, placement options, reverse geocode, preview provisioning, create tenant
- `admin.tenants.read` — Directory list, tenant details, view operations history & timeline
- `admin.tenants.update` — Update tenant profile metadata
- `admin.tenants.suspend` — Suspend or activate tenant
- `admin.tenants.reprovision` — Reprovision tenant, cancel provisioning, retry/cancel operations
- `admin.tenants.destroy` — Hard delete / destroy tenant (permanent)
- `admin.tenants.delete` — Soft delete tenant
- `admin.tenants.manage_fqdns` — Add/remove secondary FQDNs, set primary FQDN

### 7. Tenant User Access (`admin.tenant_users.*`)
- **Guard**: `AdminGuard`
- `admin.tenant_users.read` — List tenant database users, user summary, branch/dept/team catalogues
- `admin.tenant_users.invite` — Invite tenant user, resend invite
- `admin.tenant_users.update` — Update tenant user profile
- `admin.tenant_users.reset_password` — Trigger password reset or force change password
- `admin.tenant_users.manage_webphone` — Update tenant user WebPhone settings
- `admin.tenant_users.suspend` — Suspend or activate tenant user
- `admin.tenant_users.assign_roles` — Assign tenant roles to user
- `admin.tenant_users.delete` — Soft delete tenant user
- `admin.tenant_users.restore` — Restore deleted tenant user

### 8. Provisioning Operations (`admin.provisioning.*`)
- **Guard**: `AdminGuard`
- `admin.provisioning.add-application` — Provision a newly entitled application for an active tenant
- `admin.provisioning.repair` — Repair tenant provisioning state
- `admin.provisioning.decommission` — Decommission tenant components
- `admin.provisioning.prerequisites.request` — Request backup or maintenance evidence for a blocked provisioning update
- `admin.provisioning.prerequisites.read` — Read bounded provisioning prerequisite evidence

### 9. Subscriptions (`admin.subscriptions.*`)
- **Guard**: `AdminGuard`
- `admin.subscriptions.read` — List tenant subscriptions and entitlement details
- `admin.subscriptions.create` — Seed the initial subscription for a tenant
- `admin.subscriptions.update` — Preview and apply subscription plan changes
- `admin.subscriptions.cancel` — Cancel subscription at period end or immediately

### 10. Invoices (`admin.invoices.*`)
- **Guard**: `AdminGuard`
- `admin.invoices.read` — List invoices, view invoice details and line items
- `admin.invoices.create` — Generate draft invoice from subscription
- `admin.invoices.update` — Update draft invoice, issue invoice
- `admin.invoices.void` — Void invoice

### 11. Wallet & Ledger (`admin.wallet.*`)
- **Guard**: `AdminGuard`
- `admin.wallet.read` — View tenant wallet balances, ledger entries, input currencies
- `admin.wallet.manage` — Preview and confirm manual wallet balance adjustments

### 12. Database Servers (`admin.database_servers.*`)
- **Guard**: `AdminGuard`
- `admin.database_servers.read` — List database hosts, view capacity, audit history
- `admin.database_servers.create` — Register new database server, check connectivity
- `admin.database_servers.update` — Update capacity/connection, drain, activate, set offline
- `admin.database_servers.delete` — Soft-delete an eligible database server host
- `admin.database_servers.delete.hard` — Permanently destroy a soft-deleted database server
- `admin.database_servers.critical` — Required with bootstrap, configuration, lifecycle, and delete commands
- `admin.database_servers.credentials.rotate` — Required with `.critical` for manual regeneration and reconciliation

There is no `admin.database_servers.credentials.export` permission. Database
Application passwords are never returned to administrators or browsers.

### 13. Storage Servers (`admin.storage_servers.*`)
- **Guard**: `AdminGuard`
- `admin.storage_servers.read` — List/view Storage Servers, history, exact verification runs, public attestation-key registry, recovery destinations, and source-bound recovery policies
- `admin.storage_servers.create` — Register a DRAFT Storage Server; every create route also requires `.critical`
- `admin.storage_servers.update` — Update empty DRAFT/OFFLINE configuration, replace routing, rotate principal evidence, verify, lifecycle, manage attestation keys, register recovery destinations, and verify/revoke recovery policies; every route also requires `.critical`
- `admin.storage_servers.delete` — Soft-delete an eligible empty DRAFT/OFFLINE Storage Server; the route also requires `.critical`
- `admin.storage_servers.critical` — Required together with create, update, lifecycle, verification, routing, key-management, rotation, and delete permissions

See [Storage Servers](../api/storage-servers.md) for the exact permission pair
beside every endpoint.

### 14. Tenant Storage Server Migrations (`admin.storage_migrations.*`)

- **Guard**: `AdminGuard`
- `admin.storage_migrations.read` — Read an exact tenant migration by tenant and migration ID
- `admin.storage_migrations.create` — Start a fenced migration; also requires `.critical`
- `admin.storage_migrations.manage` — Retry or cancel the main migration; also requires `.critical`
- `admin.storage_migrations.rollback` — Start a retained-source rollback; also requires `.critical`
- `admin.storage_migrations.finalize` — Finalize and purge retained source after the rollback deadline; also requires `.critical`
- `admin.storage_migrations.post_cutover.retry` — Retry a failed rollback/finalize operation; also requires `.critical`
- `admin.storage_migrations.post_cutover.cancel` — Cancel an eligible rollback/finalize operation; also requires `.critical`
- `admin.storage_migrations.critical` — Required together with every migration mutation permission

These APIs are default-off and not yet safe to expose in the Admin Portal
because the public read model cannot originate and recover the complete
workflow. See
[Tenant Storage Server Migrations](../api/tenant-storage-migrations.md).

### 15. Backups & Restores (`admin.backups.*`)
- **Guard**: `AdminGuard`
- `admin.backups.read` — View policies, backup runs, artifacts, restore runs
- `admin.backups.manage` — Upsert backup policy, database overrides, start backup run
- `admin.backups.delete` — Delete backup run or artifact
- `admin.backups.restore` — Start database restore run, promote restore

### 16. System Settings (`admin.settings.*`)
- **Guard**: `AdminGuard`
- `admin.settings.read` — List/get the 31-key platform registry, read the SMTP and Realtime fatal-alert singletons, and view the latest 25 SMTP audit entries
- `admin.settings.update` — Upsert generic setting overrides, patch the SMTP and Realtime fatal-alert singletons, and verify the saved SMTP connection

All four settings mutations are also Gateway `WRITE_SENSITIVE` routes and
require an `x-idempotency-key` UUIDv7. Fatal-alert and generic/SMTP updates
also require `admin.settings.critical`.

### 17. Application Catalogue (`admin.applications.*`, `admin.catalog.*`, and `admin.billing.*`)
- **Guard**: `AdminGuard`
- `admin.applications.read` — List/read Applications, safe database-manifest evidence, and derived technical readiness
- `admin.applications.create` — Register a DRAFT Application
- `admin.applications.update` — Update mutable Application metadata
- `admin.applications.delete` — Delete an eligible unused DRAFT Application; requires `admin.applications.critical`
- `admin.applications.critical` — Required with technical primary-component binding, database-policy, lifecycle, and delete commands
- `admin.catalog.read` — Read tiers, features, tier-feature grants, price ladders, managed currency rates, and catalogue audit
- `admin.catalog.manage` — Create tiers/features; update/delete tier/feature and replace grants/price ladders when paired with `admin.catalog.critical`
- `admin.catalog.critical` — Required with tier/feature update/delete, grant replacement, price-ladder replacement, and currency-rate mutation
- `admin.catalog.destroy` — Still present in the permission seed, but no current Application Catalogue V1 Gateway route consumes it
- `admin.billing.currency.manage` — Upsert individual or batched managed currency rates; requires `admin.catalog.critical`

Application metadata update requires only `admin.applications.update`.
Database-policy update and activate/deprecate/disable require
`admin.applications.update` plus `admin.applications.critical`. There is no
public `/modules` CRUD contract, and the portal must not invent an action merely
because the unconsumed `admin.catalog.destroy` seed key still exists.

### 18. Notifications (`admin.notifications.*`)
- **Guard**: `AdminGuard`
- `admin.notifications.read` — View notification config, inbox, unread count, preferences
- `admin.notifications.manage` — Upsert preferences, register/revoke device tokens, mark read, acknowledge, dismiss

### 19. Logging Overrides (`admin.logging.*`)
- **Guard**: `AdminGuard`
- `admin.logging.read` — View runtime log-level overrides, change history, effective level, SSE live stream
- `admin.logging.update` — Upsert or delete runtime log-level override

---

## 🌍 Bilingual API Payload & Critical Semantics

Starting with the Admin Portal v2 refactor, permissions are distributed as a bilingual catalogue item via `/api/admin/core/v1/permissions`:
```typescript
type AdminPermission = {
  id: string;
  key: string;              // e.g. "admin.database_servers.update"
  nameAr: string;           // Localized name (Arabic)
  nameEn: string;           // Localized name (English)
  group: string;            // Categorical UI grouping
  description?: string;     // Legacy fallback
};
```

### Authorization Rules:
1. **Never authorize by localized names**: Component guards (`RequirePermission`, `adminCan`) MUST strictly authorize using the immutable `key`.
2. **Critical Action Pairs**: Destructive and highly sensitive operations require a `.critical` pair.
   - Soft-deleting a database server requires **both** `["admin.database_servers.delete", "admin.database_servers.critical"]`; permanent Destroy requires `["admin.database_servers.delete.hard", "admin.database_servers.critical"]`.
   - Storage registration requires **both** `["admin.storage_servers.create", "admin.storage_servers.critical"]`; storage update/lifecycle/verification/recovery-evidence mutation requires **both** `["admin.storage_servers.update", "admin.storage_servers.critical"]`; deletion requires **both** `["admin.storage_servers.delete", "admin.storage_servers.critical"]`.
   - Tenant Storage Server migration mutations require their exact
     `admin.storage_migrations.*` action permission together with
     `admin.storage_migrations.critical`; read permission alone never enables
     a migration command.
   - A super admin (`isSuperAdmin: true`) bypasses all frontend `adminCan`/`adminCanAll` checks automatically.
3. **Permission requirement type**: frontend foundations must support
   `adminCan`, `adminCanAll`, and `adminCanAny`, plus ONE/ALL/ANY component
   requirements. The current source still lacks `adminCanAny`.
4. **Independent nested access**: tenant detail access does not imply tenant
   user, subscription, wallet, payment, invoice, audit, or provisioning access.
