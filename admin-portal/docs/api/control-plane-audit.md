# Control-Plane Audit API

Status: **[Verified]**

Last source verification: **2026-08-27**

Owner: **Core**

## Routes

| Method and canonical browser path | Permissions | Purpose |
| --- | --- | --- |
| `GET /api/admin/core/v1/audit` | `admin.audit.read` | Paginated cross-domain event explorer (summary rows) |
| `GET /api/admin/core/v1/audit/entities/:entityType/:entityId` | `admin.audit.read` | Immutable history for one entity (summary rows) |
| `GET /api/admin/core/v1/audit/:id` | `admin.audit.read` | Full evidence for one event, including its before/after snapshots, diff, and metadata |

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

The list and entity-history routes return a **summary** row. It omits the
before/after snapshots, diff, and metadata, since a page of events doesn't
render them inline and they can be large (up to ~145KB per row worst case).
Fetch the detail route by `id` to inspect them.

```ts
interface ControlPlaneAuditEventSummary {
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
  reason: string | null;
  ip: string | null;
  userAgent: string | null;
  occurredAt: string;
}

interface ControlPlaneAuditEventDetail extends ControlPlaneAuditEventSummary {
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  diff: Array<{ field: string; before?: unknown; after?: unknown }>;
  metadata: Record<string, unknown> | null;
}
```

`GET /api/admin/core/v1/audit/:id` returns `ControlPlaneAuditEventDetail`
under the standard `{ success, data }` envelope (not paginated); a missing id
returns `404`.

## Frontend rules

- Treat events as immutable evidence.
- Use `meta.total` for pagination.
- Preserve filter state and `correlationId`.
- Fetch the detail route on demand (e.g. when the evidence panel opens) rather
  than eagerly for every row; cache per event id so repeated opens don't
  refetch.
- Render `before`, `after`, and `metadata` defensively; redact secret-like
  keys even if an unexpected producer includes them.
- A forbidden response is not an empty audit trail.
- Do not mutate or “correct” historical events in the browser.

## Current frontend status

Status: **[Source Integrated]**

The Admin Portal now exposes `/audit` for operators with `admin.audit.read`.
The page implements all three routes, exact filter validation, list and
entity-history modes, pagination, retry/forbidden/empty/unavailable states,
stale-request cancellation, on-demand per-row evidence fetch (before/after/
diff/metadata, fetched only when a row's evidence panel is opened), and
defensive secret-safe JSON evidence rendering. The navigation entry is
permission-filtered.

Source integration was verified with focused API, utility, hook, and component
tests plus TypeScript and targeted ESLint. Authenticated deployment verification
is still required before changing this status to runtime verified.

## Frontend implementation map

- Page: `src/app/audit/page.tsx`
- Screen: `src/features/admin/control-plane-audit/components/control-plane-audit-screen.tsx`
- Hooks: `src/features/admin/control-plane-audit/hooks/use-control-plane-audit.ts`,
  `src/features/admin/control-plane-audit/hooks/use-audit-event-detail.ts`
- API: `src/features/admin/control-plane-audit/api/control-plane-audit-api.ts`
- Validation and redaction: `src/features/admin/control-plane-audit/lib/control-plane-audit-utils.ts`
- Tests: `src/features/admin/control-plane-audit/**/*.test.ts*` and
  `src/components/layout/hooks/useNavbar.test.ts`

## Source map

- `../backend/mutakamel-apps/core-app/src/admin/audit/control-plane-audit.controller.ts`
- `../backend/mutakamel-apps/core-app/src/admin/audit/control-plane-audit.types.ts`
- `../backend/mutakamel-apps/core-app/src/admin/audit/control-plane-audit.service.ts`
- `../backend/mutakamel-apps/api-gateway-app/src/routing-proxy/route-contracts/core.route-contracts.ts`
