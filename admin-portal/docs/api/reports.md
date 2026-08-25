# Administrative Reports API

Status: **[Verified]**

Last source verification: **2026-08-12**

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

## Source map

- `../backend/mutakamel-apps/core-app/src/admin/reports/`
- `../backend/mutakamel-apps/core-app/src/admin/reports/dto/`
- `../backend/mutakamel-apps/api-gateway-app/src/routing-proxy/route-contracts/core.route-contracts.ts`
