# Reusable UI Components Architecture — Admin Portal

To enforce visual consistency, high information density, RTL/LTR support, and prevent code duplication across the Admin Portal, all pages must utilize the standardized shared components defined in this folder.

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

---

## General Design & Technical Principles

1. **Tailwind CSS First**: Use Tailwind utility classes with logical directional properties (`start-*`, `end-*`, `ms-*`, `me-*`, `border-s-*`) for seamless Arabic (RTL) & English (LTR) mirroring.
2. **Dense & Professional**: Maximize screen real estate. Use compact 36px–44px row heights, crisp borders (`border-slate-200 / dark:border-slate-800`), and subtle hover states.
3. **TypeScript First**: Every reusable component must export strict TypeScript interfaces for its props and event handlers.
4. **State Management**: Complex components manage transient state locally and sync shareable state (e.g. page, limit, search, status filters) with URL query parameters via Next.js `useSearchParams` / `useRouter`.
