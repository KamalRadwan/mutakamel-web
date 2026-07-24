# Component Specification: `OperationTimeline` (DAG & Progress Visualizer)

Visualizes complex multi-step background operations, tenant provisioning DAGs, step execution states, progress bars, and real-time event updates.

---

## 📍 Use Cases Across Admin Portal

- **Tenant Provisioning Detail** (`/admin/tenants/:id/operations/:operationId`)
- **Operation Timeline Drawer** (Opened from Tenant Operations list)
- **Provisioning Health Report** (`/admin/reports/provisioning`)

---

## ⚙️ Component API

```typescript
export interface OperationStep {
  id: string;
  kind: TenantOperationStepKindEnum;
  status: TenantOperationStepStatusEnum; // PENDING, RUNNING, SUCCEEDED, FAILED, SKIPPED
  message?: string;
  startedAt?: string;
  completedAt?: string;
}

export interface OperationTimelineProps {
  operationId: string;
  tenantId: string;
  status: TenantOperationStatusEnum;
  progress: {
    totalSteps: number;
    completedSteps: number;
    failedSteps: number;
    percent: number;
  };
  steps: OperationStep[];
  onRetry?: () => void;
  onCancel?: () => void;
}
```

---

## 🎨 Layout Features

1. **Top Progress Bar**: Smooth percentage progress bar colored blue when running, green when succeeded, red when failed.
2. **Step List (DAG)**: Chronological list showing Step Kind (DATABASE, SCHEMA, SYSTEM_SEED, IDENTITY, etc.) with animated spinners for `RUNNING` steps.
3. **Actions Bar**: Action buttons for `Retry Operation` (requires `admin.tenants.reprovision`) and `Cancel Operation`.
