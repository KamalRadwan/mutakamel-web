# Component Specification: `AuditLogViewer` (History & Audit Logs)

Status: **Target reusable behavior; control-plane explorer MISSING**

Last source verification: **2026-07-30**

The `AuditLogViewer` component provides a unified, reusable timeline and table view for inspecting audit logs, entity change history, and system event logs across the Admin Portal.

---

## 📍 Use Cases Across Admin Portal

| Module / Page | Backend Endpoint | Log Item Structure |
|:---|:---|:---|
| **Database Server Audit** | `GET /api/admin/core/v1/database-servers/:id/history` | Success envelope whose `data` is a direct array of field changes (`field`, `label`, `previousValue`, `newValue`), exact action (`CREATE`, `UPDATE`, `ACTIVATE`, `DRAIN`, `OFFLINE`, `DELETE`), and `actorId` |
| **Storage Server Audit** | `GET /api/admin/core/v1/storage-servers/:id/history` | Success envelope whose `data` is `{ items, total }`; each item has exact action, revision triplet, `changes[]` with `previousValue`/`nextValue`, `actorId`, optional `correlationId`, and `createdAt` |
| **System SMTP Audit** | `GET /api/admin/core/v1/system-settings/email/audit` | SMTP configuration modifications, testing logs |
| **Logging Level Overrides** | `GET /api/admin/core/v1/logging/level-overrides/history` | Scope change, level adjustment (`previousLevel`, `level`), `reason`, `actorId` |
| **Tenant Operations Timeline** | `GET /api/admin/core/v1/tenants/:tenantId/operations/:operationId/timeline` | Operation step messages, status transitions, phase updates |
| **Control-plane audit** | `GET /api/admin/core/v1/audit` | Immutable cross-domain evidence; see [Control-plane audit](../api/control-plane-audit.md) |

---

## 🎨 Layout Modes

The component supports 2 display modes via the `variant` prop:

1. **`timeline` (Default)**: Vertical activity stream with icon badges, timestamps, actor labels, and collapsible JSON / diff details. Ideal for detail drawers and operation progress panels.
2. **`table`**: Dense table layout with sortable columns (`Date`, `Action / Event`, `Actor`, `Entity`, `Changes / Payload`). Ideal for dedicated audit pages.

---

## ⚙️ Component API (Props Interface)

```typescript
export interface AuditLogItem {
  id: string;
  timestamp: string; // ISO date string
  action: string;    // e.g. 'UPDATE', 'CREATE', 'SUSPEND', 'LIFECYCLE'
  actionTone?: 'blue' | 'green' | 'amber' | 'red' | 'neutral';
  actor?: {
    id: string | null;
    name?: string;
    email?: string;
    type?: 'ADMIN' | 'TENANT_USER' | 'SYSTEM';
  };
  entity?: {
    type: string;    // e.g. 'DatabaseServer', 'Tenant', 'SystemSetting'
    id: string;
    name?: string;
  };
  changes?: Array<{
    field: string;
    label: string;
    previousValue: unknown;
    newValue: unknown;
  }>;
  message?: string;
  payload?: Record<string, unknown>;
}

export interface AuditLogViewerProps {
  items: AuditLogItem[];
  isLoading?: boolean;
  variant?: 'timeline' | 'table';
  emptyMessageEn?: string;
  emptyMessageAr?: string;
  /** Optional pagination handle */
  pagination?: {
    page: number;
    limit: number;
    totalItems: number;
    onPageChange: (page: number) => void;
  };
  /** Optional filter controls */
  onFilterChange?: (filters: { action?: string; search?: string; from?: string; to?: string }) => void;
}
```

---

## 🌍 Bilingual (RTL/LTR) Features

- **Timeline Border**: Uses `border-s-2 border-slate-200 dark:border-slate-800` (RTL mirrors line to right side).
- **Badges & Margins**: Uses `ms-3`, `me-2`, `start-0` to maintain perfect alignment in Arabic and English.
- **Diff Display**: Green badge for `newValue` addition, red strikethrough/badge for `previousValue` removal.

---

## 💻 Usage Example

```tsx
import { AuditLogViewer } from '@/components/shared/AuditLogViewer';

export function DatabaseServerAuditPanel({ serverId }: { serverId: string }) {
  const { data, isLoading } = useGetDatabaseServerHistoryQuery({ id: serverId });

  const items: AuditLogItem[] = (data?.data ?? []).map((entry) => ({
    id: entry.id,
    timestamp: entry.createdAt,
    action: entry.action,
    actor: { id: entry.actorId },
    entity: {
      type: 'DatabaseServer',
      id: entry.databaseServerId,
      name: entry.serverName,
    },
    changes: entry.changes,
  }));

  return (
    <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
      <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
        سجل التغييرات (Audit History)
      </h3>
      <AuditLogViewer
        items={items}
        isLoading={isLoading}
        variant="timeline"
      />
    </div>
  );
}
```

Database-server history uses `createdAt`, not `timestamp`, and supplies only
`actorId`; resolve an actor label separately if the product requires one. The
adapter above intentionally does not invent an actor name or email.
