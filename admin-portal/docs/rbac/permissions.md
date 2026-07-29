# Admin Portal — Guards & RBAC Permissions Inventory

Complete inventory of NestJS Guards, Custom Decorators, and RBAC Permission Keys used across the Admin Portal backend (`core-app`).

---

## 🛡️ Admin Guards & Decorators Overview

| Guard / Decorator | Scope & Behavior | Frontend Action / Integration |
|:---|:---|:---|
| **`AdminGuard`** | Primary auth guard applied across all `/admin/*` controllers. Validates Bearer access token and ensures identity belongs to an admin user (`SUPER_ADMIN`, `ADMIN`, or `USER` tier). | Include Bearer Token header: `Authorization: Bearer <accessToken>`. On 401/403, trigger token refresh or redirect to `/login`. |
| **`@Public()`** | Bypasses `AdminGuard` for unauthenticated routes (`login`, `refresh`, `accept-invite`, `forgot-password`, `reset-password`, `logout`). | Public forms — do not attach bearer token unless session cookie is used. |
| **`@RequirePermissions(...)`** | Method/Controller level RBAC check. Verifies that `actor.permissions` array contains all specified permission keys. | Drive UI element visibility (hide buttons/links when user lacks the key) and route guards (`hasPermission('admin.users.create')`). |
| **`@IdempotencyRequired()`** | Requires `X-Idempotency-Key` header (UUID v7) for mutation requests (create/update/cancel). Prevents duplicate operations on network retries. | Generate a fresh `crypto.randomUUID()` or UUIDv7 for each form submission and attach as `X-Idempotency-Key` header. |
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
- `admin.reports.read` — Access dashboard KPI tiles and all report views (Overview, Tenants, DB Servers, Billing, Provisioning)

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
- `admin.provisioning.add-module` — Add module to active tenant
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
- `admin.database_servers.delete` — Delete database server host

### 13. Storage Servers (`admin.storage_servers.*`)
- **Guard**: `AdminGuard`
- `admin.storage_servers.read` — List/view Storage Servers, history, exact verification runs, and public attestation-key registry
- `admin.storage_servers.create` — Register a DRAFT Storage Server; every create route also requires `.critical`
- `admin.storage_servers.update` — Update empty DRAFT/OFFLINE configuration, replace routing, rotate principal evidence, verify, lifecycle, and manage attestation keys; every route also requires `.critical`
- `admin.storage_servers.delete` — Soft-delete an eligible empty DRAFT/OFFLINE Storage Server; the route also requires `.critical`
- `admin.storage_servers.critical` — Required together with create, update, lifecycle, verification, routing, key-management, rotation, and delete permissions

See [Storage Servers](../api/storage-servers.md) for the exact permission pair
beside every endpoint.

### 14. Backups & Restores (`admin.backups.*`)
- **Guard**: `AdminGuard`
- `admin.backups.read` — View policies, backup runs, artifacts, restore runs
- `admin.backups.manage` — Upsert backup policy, database overrides, start backup run
- `admin.backups.delete` — Delete backup run or artifact
- `admin.backups.restore` — Start database restore run, promote restore

### 15. System Settings (`admin.settings.*`)
- **Guard**: `AdminGuard`
- `admin.settings.read` — List/get the 31-key platform registry, read the SMTP singleton, and view its latest 25 audit entries
- `admin.settings.update` — Upsert generic setting overrides, patch the SMTP singleton, and verify its saved connection

All three settings mutations are also Gateway `WRITE_SENSITIVE` routes and
require an `x-idempotency-key` UUIDv7.

### 16. Catalogue & Billing Currency (`admin.catalog.*` & `admin.billing.*`)
- **Guard**: `AdminGuard`
- `admin.catalog.read` — View modules, tiers, features, price brackets, currency rates
- `admin.catalog.manage` — Create/update/reorder modules, tiers, features, tier-feature grants, price tiers
- `admin.catalog.destroy` — Delete catalogue modules
- `admin.billing.currency.manage` — Update currency exchange rates

### 17. Notifications (`admin.notifications.*`)
- **Guard**: `AdminGuard`
- `admin.notifications.read` — View notification config, inbox, unread count, preferences
- `admin.notifications.manage` — Upsert preferences, register/revoke device tokens, mark read, acknowledge, dismiss

### 18. Logging Overrides (`admin.logging.*`)
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
   - E.g., deleting a database server requires **both** `["admin.database_servers.delete", "admin.database_servers.critical"]`.
   - Storage registration requires **both** `["admin.storage_servers.create", "admin.storage_servers.critical"]`; storage update/lifecycle/verification requires **both** `["admin.storage_servers.update", "admin.storage_servers.critical"]`; deletion requires **both** `["admin.storage_servers.delete", "admin.storage_servers.critical"]`.
   - A super admin (`isSuperAdmin: true`) bypasses all frontend `adminCan`/`adminCanAll` checks automatically.
