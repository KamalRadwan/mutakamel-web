# Control-Plane Audit API

Status: **[Verified]**

Last source verification: **2026-07-30**

Owner: **Core**

## Routes

| Method and canonical browser path | Permissions | Purpose |
| --- | --- | --- |
| `GET /api/admin/core/v1/audit` | `admin.audit.read` | Paginated cross-domain event explorer |
| `GET /api/admin/core/v1/audit/entities/:entityType/:entityId` | `admin.audit.read` | Immutable history for one entity |

## Query

```ts
interface ControlPlaneAuditQuery {
  page?: number;
  limit?: number; // 1..100, default 25
  actorType?:
    | "SUPER_ADMIN"
    | "TENANT_USER"
    | "SYSTEM"
    | "WORKER"
    | "WEBHOOK"
    | "UNKNOWN";
  actorId?: string;
  tenantId?: string;
  action?: string;
  entityType?: string;
  entityId?: string;
  outcome?: "SUCCESS" | "FAILURE";
  sourceApp?: string;
  sourceType?: string;
  correlationId?: string;
  from?: string;
  to?: string;
}
```

## Event projection

```ts
interface ControlPlaneAuditEventView {
  id: string;
  schemaVersion: number;
  actorType: string;
  actorId: string | null;
  actorLabel: string | null;
  tenantId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  outcome: "SUCCESS" | "FAILURE";
  sourceApp: string;
  sourceType: string;
  sourceId: string | null;
  sourceRoute: string | null;
  operationId: string | null;
  correlationId: string | null;
  requestId: string | null;
  idempotencyKey: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  diff: Array<{ field: string; before?: unknown; after?: unknown }>;
  reason: string | null;
  ip: string | null;
  userAgent: string | null;
  metadata: Record<string, unknown> | null;
  occurredAt: string;
}
```

## Frontend rules

- Treat events as immutable evidence.
- Use `meta.total` for pagination.
- Preserve filter state and `correlationId`.
- Render `before`, `after`, and `metadata` defensively; redact secret-like
  keys even if an unexpected producer includes them.
- A forbidden response is not an empty audit trail.
- Do not mutate or “correct” historical events in the browser.

## Current frontend status

The existing `AuditLogViewer` document/component concept is not a live
control-plane audit explorer. No route or API client implements these endpoints.

## Source map

- `../backend/mutakamel-apps/core-app/src/admin/audit/control-plane-audit.controller.ts`
- `../backend/mutakamel-apps/core-app/src/admin/audit/control-plane-audit.types.ts`
- `../backend/mutakamel-apps/core-app/src/admin/audit/control-plane-audit.service.ts`
- `../backend/mutakamel-apps/api-gateway-app/src/routing-proxy/route-contracts/core.route-contracts.ts`
