# Reusable UI Components

Status: **Target component behavior; not runtime integration evidence**

Last source verification: **2026-08-26**

The API guides and
[frontend capability matrix](../audit/frontend-capability-matrix.md) determine
whether a component is live, partial, missing, or gated. Implementation
paths below are relative to `admin-portal/src/`; see
[design-system/patterns.md](../design-system/patterns.md) for the full
pattern inventory, including the patterns below that have no written spec.

## Shared component registry

| Component | Specification | Implementation | Common usage |
|:---|:---|:---|:---|
| `AuditLogViewer` | [Audit log viewer](audit-log-viewer.md) | **Not built.** Audit events currently render as ad hoc cards inline in `features/admin/control-plane-audit/components/control-plane-audit-screen.tsx`, not through a shared pattern — see [design-system/migration.md](../design-system/migration.md) | Database Server, settings, and tenant audit evidence |
| `DataTable` | [Data table](data-table.md) | `design-system/patterns/data-table/` | Directory and operational history screens |
| `FilterBar` | [Filter bar](filter-bar.md) | `design-system/patterns/filter-bar/` | Server-backed search, status, and date filters |
| `StatusBadge` | [Status badge](status-badge.md) | `design-system/patterns/status-badge/` | Lifecycle and operation states |
| `OperationTimeline` | [Operation timeline](operation-timeline.md) | `design-system/patterns/operation-timeline/OperationTimeline.tsx` | Provisioning DAG and operation evidence |
| `FloatingWebPhone` | [Floating WebPhone](floating-webphone.md) | `components/layout/WebRTCPhoneWidget.tsx` (outside the design system — browser-only SIP, not a themable pattern) | Admin WebRTC controls and call logs |
| `ConfirmActionModal` | [Confirm action modal](confirm-action-modal.md) | `design-system/patterns/confirm-action/` | Destructive, critical, and lifecycle commands |
| `FormDrawer` | [Form drawer](form-drawer.md) | `design-system/patterns/form-drawer/FormDrawer.tsx` | Focused create/edit workflows |
| Storage Server flows | [Storage Server modal](storage-server-modal.md) | `features/admin/storage-servers/` | Registration, edit, and critical confirmations |

## Design rules

- Use logical Tailwind direction utilities so RTL and LTR layouts mirror.
- Keep dense operational screens readable, responsive, and keyboard accessible.
- Export strict TypeScript props and event contracts.
- Keep transient state local and synchronize shareable filters with the URL.
