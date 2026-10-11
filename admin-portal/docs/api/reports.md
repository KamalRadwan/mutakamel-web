# Administrative Reports API

Status: **[Verified]**

Last source verification: **2026-08-12**; the provisioning report was
re-verified on **2026-10-11** (see
[`stuck` is not the stall rule](#provisioning-report-stuck-is-not-the-stall-rule)).

Owner: **Core**

All routes require `admin.reports.read`.

## Routes

| Method and canonical browser path | Purpose |
| --- | --- |
| `GET /api/admin/core/v1/reports/overview` | Cross-domain control-plane summary |
| `GET /api/admin/core/v1/reports/tenants` | Paginated tenant report |
| `GET /api/admin/core/v1/reports/servers` | Database Server capacity/health |
| `GET /api/admin/core/v1/reports/billing` | Invoice/billing buckets |
| `GET /api/admin/core/v1/reports/provisioning` | Provisioning health/stuck work |

These five routes are separate from the live
`GET /api/admin/core/v1/dashboard` aggregation.

## Shared query behavior

Date filters are ISO date/datetime strings as defined by each report DTO. When
both `from` and `to` are present, `to` must not precede `from`. Paginated report
rows use `data` with `meta.total`.

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

## Provisioning report: `stuck` is not the stall rule

Source verified **2026-10-11** against Core
`src/admin/admin-reports/admin-reports.service.ts` (`provisioning()`),
`admin-reports.controller.ts` and
`src/admin/admin-dashboard/providers/dashboard-provisioning.provider.ts`.

The **Provisioning** tab reads `GET /api/admin/core/v1/reports/provisioning`
through `readProvisioningReport`: the **Stuck tenants** tile is `data.stuck`
and the table is `data.items` (`id`, `name`, `status`, `createdAt`). Core
computes `stuck` as the number of tenants whose lifecycle status is
`PROVISIONING`, within the optional `createdAt` window, and returns those
tenants oldest first. It never evaluates `operationStall`, so a tenant whose
provisioning is progressing normally counts as stuck, and a stalled update,
repair or retry on an `ACTIVE` tenant is not counted at all.

Only the dashboard applies the stall rule:
`provisioning.snapshot.stalledOperations` counts the open operations whose
`operationStall` is set ([dashboard](dashboard.md#provisioning-group-stalled-operations)).
Core's `uq_tenant_operations_open` index allows one open operation per tenant,
so that count is also the number of tenants with a stalled operation. The
report rows carry no operation, step or progress timestamps, so the portal
cannot derive the signal from them. It does not borrow the dashboard figure
either: that group needs `admin.reports.provisioning` on top of
`admin.reports.read`, names no tenant, and would contradict the rows beside it.

The tile therefore renders Core's `stuck` as returned. Closing the gap needs
Core to:

1. compute `stuck` with `operationStall` at `asOf`: the tenants whose open
   operation of any type is stalled, whatever their lifecycle status;
2. return those tenants as `items`, each with its open operation (`id`, `type`,
   `status`, `currentPhase`, `generation`) and the operation detail's `stall`
   object (`stepKey`, `since`, `ageSeconds`, `reason`: `NO_PROGRESS`,
   `DISPATCH_LEASE_EXPIRED` or `CANCEL_PENDING`);
3. say whether the `createdAt` window still applies to a current-state signal.

The portal then only has to read and show the new row fields; the tile's label
already describes a stall-based `stuck`.

## Source map

- `../backend/mutakamel-apps/core-app/src/admin/admin-reports/`
- `../backend/mutakamel-apps/core-app/src/admin/admin-reports/dto/`
- `../backend/mutakamel-apps/core-app/src/admin/admin-dashboard/providers/dashboard-provisioning.provider.ts`
- `../backend/mutakamel-apps/api-gateway-app/src/routing-proxy/route-contracts/core.route-contracts.ts`
