# Administrative Reports API

Status: **[Verified]**

Last source verification: **2026-08-12**; the provisioning report was
re-verified on **2026-10-11** after Core made it stall-based (see
[Provisioning report: stalled tenants](#provisioning-report-stalled-tenants)).

Owner: **Core**

All routes require `admin.reports.read`.

## Routes

| Method and canonical browser path | Purpose |
| --- | --- |
| `GET /api/admin/core/v1/reports/overview` | Cross-domain control-plane summary |
| `GET /api/admin/core/v1/reports/tenants` | Paginated tenant report |
| `GET /api/admin/core/v1/reports/servers` | Database Server capacity/health |
| `GET /api/admin/core/v1/reports/billing` | Invoice/billing buckets |
| `GET /api/admin/core/v1/reports/provisioning` | Tenants whose open operation is stalled now |

These five routes are separate from the live
`GET /api/admin/core/v1/dashboard` aggregation.

## Shared query behavior

Date filters are ISO date/datetime strings as defined by each report DTO. When
both `from` and `to` are present, `to` must not precede `from`. Paginated report
rows use `data` with `meta.total`. The overview and billing reports take a
`[from, to)` window; the provisioning report takes none and Core rejects one.

Do not create one global report sort/filter allowlist; read the exact DTO for
the selected report.

## Response rules

- Keep all money as decimal strings.
- Do not fabricate unsupported metrics.
- Render backend-unavailable analytics as unavailable.
- A `403` is forbidden, not an empty report.
- Preserve `asOf`, source timestamps, and `correlationId`.
- Unknown/additive status buckets require a safe fallback.

## Current frontend status

`/reports` source-integrates all five standalone report reads through typed
domain clients, shared validated filters, exact permission gates, independent
loading/empty/forbidden/unavailable states, bilingual copy, and focused tests.
The Dashboard remains a separate grouped overview. Authenticated runtime and
deployment verification remain separate gates.

## Provisioning report: stalled tenants

Source verified **2026-10-11** against Core
`src/admin/admin-reports/admin-reports.service.ts` (`provisioning()`),
`stalled-tenants.query.ts`, `admin-reports.controller.ts`,
`dto/admin-report-query.dto.ts` and
`src/admin/tenants/provisioning/tenant-operation-exits.ts` (`operationStall`).

```ts
// GET /api/admin/core/v1/reports/provisioning?limit=50
interface ProvisioningReport {
  asOf: string;            // the instant every stall is measured at
  stuck: number;           // every tenant whose open operation is stalled
  items: Array<{           // at most `limit` of them, longest stall first
    id: string;            // tenant UUID v7
    name: string;          // tenant slug
    status: string;        // tenant lifecycle status, any of them
    createdAt: string;
    operation: {
      id: string;
      type: TenantOperationType;      // any type, not only initial provisioning
      status: TenantOperationStatus;  // an open status
      currentPhase: string;
      generation: number;
    };
    stall: TenantOperationStall;      // exactly the operation detail's `stall`
  }>;
}
```

`stuck` counts the tenants whose open tenant operation is stalled at `asOf`,
by the same `operationStall` rule as the operation detail's `stall`: a running
step silent for three missed heartbeats, otherwise no progress for twice the
Worker step lease, the prerequisite window added while a plan awaits
backup/maintenance evidence, never `WAITING_RETRY`. Every operation type and
every tenant status counts, so the figure equals the dashboard's
`provisioning.snapshot.stalledOperations`
([dashboard](dashboard.md#provisioning-group-stalled-operations)):
`uq_tenant_operations_open` admits one open operation per tenant. It used to
count every tenant still in `PROVISIONING`, which read a healthy first
provisioning as stuck and never counted a stalled update or repair.

The report is current state. `limit` (1–100, default 50) is its only query
field; Core rejects `from`, `to` and the shared paging fields with `400`, so
the **Provisioning** tab shows only **Rows per report** and `buildProvisioningQuery`
sends `limit` alone.

The tab renders the **Stuck tenants** tile (with the rule in its description)
and one row per listed tenant: tenant link, tenant status, operation type and
generation, the step the stall is attributed to (or `Phase` with
`operation.currentPhase` when `stall.stepKey` is null), the reason (**No
progress**, **Dispatch lease expired**, **Cancellation not confirmed**), and
the `stall.since` instant with its age through `formatProvisioningDuration`.
When `stuck` exceeds the listed rows a status line says how many of how many
are shown. The reader validates `stall` with the provisioning workspace's
`readTenantOperationStall`, the operation type and status against the
provisioning enums, and refuses a list longer than `stuck`. The empty state is
"No tenant's open operation is stalled."

## Source map

- `../backend/mutakamel-apps/core-app/src/admin/admin-reports/`
- `../backend/mutakamel-apps/core-app/src/admin/admin-reports/dto/`
- `../backend/mutakamel-apps/core-app/src/admin/tenants/provisioning/tenant-operation-exits.ts`
- `../backend/mutakamel-apps/core-app/src/admin/admin-dashboard/providers/dashboard-provisioning.provider.ts`
- `../backend/mutakamel-apps/api-gateway-app/src/routing-proxy/route-contracts/core.route-contracts.ts`
