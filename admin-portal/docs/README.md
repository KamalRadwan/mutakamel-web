# Admin Portal Documentation

Status: **[Verified]**

Last source verification: **2026-08-02**

This documentation describes the current Admin Portal source, all
browser-visible Core Admin capabilities, exact integration defects, required
frontend contracts, and backend/release gates. Documentation completion does
not mean frontend parity or deployment completion.

## Start here

1. [Documentation contract](DOCUMENTATION_CONTRACT.md)
2. [AI Start Here](ai/START_HERE.md)
3. [Frontend integration guide](frontend-integration-guide.md)
4. [Frontend capability matrix](audit/frontend-capability-matrix.md)
5. [API domain index](api/README.md)
6. [Generated 232-route inventory](generated/admin-core-api-routes.md)
7. [Known gaps](ai/KNOWN_GAPS.md)
8. [Implementation playbook](ai/IMPLEMENTATION_PLAYBOOK.md)
9. [Test matrix](ai/TEST_MATRIX.md)

## Critical browser rules

```text
Core Admin:   /api/admin/core/v1/*
Worker Admin: /api/admin/worker/v1/*
```

API Gateway is the only browser edge. Never use controller-relative
`/admin/*` or upstream `/api/v1/admin/*` paths in frontend requests.

Protected requests use the shared authenticated client with:

```ts
credentials: "include";
"x-auth-cookie-mode": "1";
```

Do not store JWT access or refresh tokens in browser-readable storage.

## Documentation map

| Area | Reference |
| --- | --- |
| Source precedence/status evidence | [DOCUMENTATION_CONTRACT.md](DOCUMENTATION_CONTRACT.md) |
| System ownership | [ai/SYSTEM_CONTEXT.md](ai/SYSTEM_CONTEXT.md) |
| Source verification workflow | [ai/SOURCE_OF_TRUTH.md](ai/SOURCE_OF_TRUTH.md) |
| Current frontend/live/mock status | [audit/frontend-capability-matrix.md](audit/frontend-capability-matrix.md) |
| API contracts | [api/README.md](api/README.md) |
| Full Gateway method/path inventory | [generated/admin-core-api-routes.md](generated/admin-core-api-routes.md) |
| HTTP success/error envelopes | [architecture/http-and-error-contract.md](architecture/http-and-error-contract.md) |
| Permissions/idempotency/data states | [architecture/permissions-idempotency-and-state.md](architecture/permissions-idempotency-and-state.md) |
| Shared DTOs | [models/dtos.md](models/dtos.md) |
| Wire enums | [models/enums.md](models/enums.md) |
| Browser projections | [models/interfaces.md](models/interfaces.md) |
| Permission catalogue | [rbac/permissions.md](rbac/permissions.md) |
| Navigation mapping | [guides/sidebar-navigation.md](guides/sidebar-navigation.md) |
| Reusable component behavior | [components/README.md](components/README.md) |

## Current route evidence

The Gateway Core route table contains 443 routes across all masters. Exactly
232 have `core.admin.*` route keys and canonical Admin browser paths. Of those,
133 are write-sensitive and one uses explicit ANY permissions.

The generated inventory is transport evidence only. Controller/DTO behavior
comes from the hand-written domain guides and owning backend source.

## Status boundaries

- `DONE`, `PARTIAL`, `BROKEN`, `MISSING`, `GATED`, and `REFACTOR` describe
  frontend source state.
- Tests, typecheck, lint, and build are reported independently.
- Live authenticated status requires a real authorized Gateway/Core session.
- Deployment-verified status requires evidence from the target environment.

Never say “full parity” while any BROKEN/MISSING item, required validation, live
runtime check, or release gate remains open.

## Validation

Run from `C:\mutakamel.ai\frontend\admin-portal`:

```powershell
npm run docs:check
npx tsc --noEmit
npx vitest run
npm run lint -- --max-warnings=0
npm run build
```

Regenerate the route inventory after Gateway changes:

```powershell
npm run docs:routes
```

## Backend source roots

Paths below are relative to `C:\mutakamel.ai\frontend`:

```text
../backend/mutakamel-apps/api-gateway-app
../backend/mutakamel-apps/core-app
../backend/mutakamel-apps/worker-app
../backend/mutakamel-apps/realtime-app
```

Backend source is read-only unless a separate backend task explicitly
authorizes changes.


## API Documentation

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


## Components

# Reusable UI Components Architecture — Admin Portal

Status: **Target component behavior; not runtime integration evidence**

Last source verification: **2026-07-30**

To enforce visual consistency, high information density, RTL/LTR support, and prevent code duplication across the Admin Portal, all pages must utilize the standardized shared components defined in this folder.

The API guides and
[frontend capability matrix](../audit/frontend-capability-matrix.md) determine
whether a component is live, partial, missing, or gated.

---

## Shared Component Registry

| Component | Specification Doc | Common Usage Locations |
|:---|:---|:---|
| `AuditLogViewer` | [audit-log-viewer.md](audit-log-viewer.md) | DB Server audit history, SMTP config audit, Logging level change history, Tenant activity logs |
| `DataTable` | [data-table.md](data-table.md) | Directory views (Tenants, Users, Roles, Invoices, Subscriptions, DB Servers, Backup Runs) |
| `FilterBar` | [filter-bar.md](filter-bar.md) | Header search, status dropdowns, date pickers, filter tags across all data tables |
| `StatusBadge` | [status-badge.md](status-badge.md) | Lifecycle statuses (`TenantStatus`, `UserStatus`, `InvoiceStatus`, `OperationStatus`, etc.) |
| `OperationTimeline` | [operation-timeline.md](operation-timeline.md) | Tenant provisioning DAG progress, operations history, step execution status |
| `FloatingWebPhone` | [floating-webphone.md](floating-webphone.md) | Admin shell floating WebRTC phone widget, call controls, call logs |
| `ConfirmActionModal` | [confirm-action-modal.md](confirm-action-modal.md) | Destructive/lifecycle actions (Suspend, Delete, Void, Cancel, Reprovision) |
| `FormDrawer` | [form-drawer.md](form-drawer.md) | Slide-over panels for Create User, Edit Role, Add FQDN, System Setting overrides |
| Storage Server modal/edit flows | [storage-server-modal.md](storage-server-modal.md) | Add Storage Server, embedded detail edit mode, and critical storage confirmations |
| Tenant Storage Server migration | [tenant-storage-migrations.md](../api/tenant-storage-migrations.md) | Future tenant-detail migration panel; default-off and blocked on a complete safe read model |

---

## General Design & Technical Principles

1. **Tailwind CSS First**: Use Tailwind utility classes with logical directional properties (`start-*`, `end-*`, `ms-*`, `me-*`, `border-s-*`) for seamless Arabic (RTL) & English (LTR) mirroring.
2. **Dense & Professional**: Maximize screen real estate. Use compact 36px–44px row heights, crisp borders (`border-slate-200 / dark:border-slate-800`), and subtle hover states.
3. **TypeScript First**: Every reusable component must export strict TypeScript interfaces for its props and event handlers.
4. **State Management**: Complex components manage transient state locally and sync shareable state (e.g. page, limit, search, status filters) with URL query parameters via Next.js `useSearchParams` / `useRouter`.
