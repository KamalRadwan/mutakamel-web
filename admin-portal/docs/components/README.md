# Reusable UI Components

Status: **Target component behavior; not runtime integration evidence**

Last source verification: **2026-08-05**

The API guides and
[frontend capability matrix](../audit/frontend-capability-matrix.md) determine
whether a component is live, partial, missing, or gated.

## Shared component registry

| Component | Specification | Common usage |
|:---|:---|:---|
| `AuditLogViewer` | [Audit log viewer](audit-log-viewer.md) | Database Server, settings, and tenant audit evidence |
| `DataTable` | [Data table](data-table.md) | Directory and operational history screens |
| `FilterBar` | [Filter bar](filter-bar.md) | Server-backed search, status, and date filters |
| `StatusBadge` | [Status badge](status-badge.md) | Lifecycle and operation states |
| `OperationTimeline` | [Operation timeline](operation-timeline.md) | Provisioning DAG and operation evidence |
| `FloatingWebPhone` | [Floating WebPhone](floating-webphone.md) | Admin WebRTC controls and call logs |
| `ConfirmActionModal` | [Confirm action modal](confirm-action-modal.md) | Destructive, critical, and lifecycle commands |
| `FormDrawer` | [Form drawer](form-drawer.md) | Focused create/edit workflows |
| Storage Server flows | [Storage Server modal](storage-server-modal.md) | Registration, edit, and critical confirmations |

## Design rules

- Use logical Tailwind direction utilities so RTL and LTR layouts mirror.
- Keep dense operational screens readable, responsive, and keyboard accessible.
- Export strict TypeScript props and event contracts.
- Keep transient state local and synchronize shareable filters with the URL.
