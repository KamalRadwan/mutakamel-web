# CRM preset dashboards

> Status: `verified-current`
> Last source verification: `2026-07-25`
> Owner: CRM (`crm-app`)
> Canonical browser prefix: `/api/tenant/crm/v1`
> Controller-relative prefix: `/api/v1/crm`
> Tenant Portal replacement: `not-started`
> Legacy frontend: `live`
> Authorship: hand-written from current source

Preset dashboards are server-defined, read-only analytical projections. User-authored definitions and widgets are documented in [Dashboard builder and widgets](./dashboard-builder-widgets.md).

## Endpoint catalogue

Every route requires `crm.dashboards.read.{own|team|all}`.

| Method | Canonical browser path | Controller/upstream path | Success |
|---|---|---|---|
| `GET` | `/api/tenant/crm/v1/dashboards/overview` | `/api/v1/crm/dashboards/overview` | `200`, dashboard |
| `GET` | `/api/tenant/crm/v1/dashboards/sales-pipeline` | `/api/v1/crm/dashboards/sales-pipeline` | `200`, dashboard |
| `GET` | `/api/tenant/crm/v1/dashboards/leads` | `/api/v1/crm/dashboards/leads` | `200`, dashboard |
| `GET` | `/api/tenant/crm/v1/dashboards/activities-productivity` | `/api/v1/crm/dashboards/activities-productivity` | `200`, dashboard |
| `GET` | `/api/tenant/crm/v1/dashboards/customer-intelligence` | `/api/v1/crm/dashboards/customer-intelligence` | `200`, dashboard |
| `GET` | `/api/tenant/crm/v1/dashboards/data-quality` | `/api/v1/crm/dashboards/data-quality` | `200`, dashboard |
| `GET` | `/api/tenant/crm/v1/dashboards/action-center` | `/api/v1/crm/dashboards/action-center` | `200`, dashboard |

These are Gateway read-heavy routes. There is no request body, mutation, idempotency key, or asynchronous completion state.

## Query contract

Every route accepts the same optional query:

| Query | Contract |
|---|---|
| `dateFrom`, `dateTo` | ISO date-time; when both are supplied, `dateFrom <= dateTo` |
| `branchId` | UUIDv7 |
| `ownerUserId` | UUIDv7, narrowing only |
| `pipelineId` | UUIDv7 and accessible |
| `currencyCode` | exactly three characters, normalized uppercase |
| `staleDays` | integer `1..365`, default `30` where used |
| `limit` | integer `1..100`, default `10` where used |

Without dates, the service uses the current month start through now. Without `branchId`, it aggregates the actor's accessible branch dataset according to effective dashboard read scope. The actor cannot expand access through owner/branch/pipeline filters.

Preset routes do not enforce the builder's two-year maximum date range. Clients should still request bounded business ranges and avoid expensive speculative queries.

## Response shape

All presets return raw JSON with this common shape:

```json
{
  "scope": {
    "resource": "crm.dashboards",
    "action": "read",
    "branches": [
      {
        "branchId": "0191e9a8-7f51-7b32-8d72-19f9217a41b3",
        "scope": "team",
        "ownerUserIds": ["0191e9a8-7f51-7b32-8d72-19f9217a41b4"]
      }
    ]
  },
  "filters": {
    "dateFrom": "2026-07-01T00:00:00.000Z",
    "dateTo": "2026-07-25T12:00:00.000Z"
  },
  "generatedAt": "2026-07-25T12:00:00.000Z",
  "widgets": {},
  "warnings": []
}
```

`ownerUserIds` can be `null` for all-scope access. Treat scope output as informative server evidence, not a reusable authorization token.

## Widget keys by preset

| Preset | Current widget keys |
|---|---|
| overview | `pipelineValue`, `wonValue`, `activeDeals`, `winLossSummary`, `newLeads`, `topReps`, `overdueWork`, `staleDeals` |
| sales pipeline | `stageDistribution`, `staleDeals`, `lostReasons`, `multiPipelineComparison`, `currencyBreakdown` |
| leads | `leadSources`, `conversionRate`, `sourceToValue`, `untouchedLeads`, `ownerBalance` |
| activities/productivity | `activityMix`, `overdueTasks`, `repWorkload`, `reminderSummary`, `calendarUtilization` |
| customer intelligence | `customerStatusMix`, `contactDepth`, `engagementSummary` |
| data quality | `missingOwner`, `missingAmount`, `missingCurrency`, `missingContact`, `missingCommercialData`, `duplicateSignals` |
| action center | `staleOpportunities`, `untouchedLeads`, `overdueTasks`, `dataCleanupItems` |

Widget projections vary by metric. There is no public response DTO freezing every row/series field. Validate the fields consumed, tolerate additive widgets/fields, preserve `warnings`, and never infer monetary totals across mixed currencies.

## Errors and security

- `CRM_DASHBOARD_FILTER_INVALID`
- `PIPELINE_NOT_FOUND` for absent or inaccessible pipeline filters
- common permission, branch, tenant, seat, subscription, throttling, and dependency errors

Dashboard results can expose aggregated customer and employee performance data. Keep them private/no-store, apply authorization on every request, and do not cache one user's scoped output for another actor.

## Safe request

```http
GET /api/tenant/crm/v1/dashboards/overview?dateFrom=2026-07-01T00%3A00%3A00.000Z&dateTo=2026-07-25T23%3A59%3A59.999Z&currencyCode=EGP
Accept: application/json
```

## Sources

- `../backend/mutakamel-apps/crm-app/src/crm/dashboards/dashboards.controller.ts`
- `../backend/mutakamel-apps/crm-app/src/crm/dashboards/dto/dashboard-query.dto.ts`
- `../backend/mutakamel-apps/crm-app/src/crm/dashboards/dashboards.service.ts`
- `../backend/mutakamel-apps/crm-app/src/crm/dashboards/dashboards.service.spec.ts`
- `../backend/mutakamel-apps/crm-app/src/crm/dashboards/dashboard-access.service.ts`
- `../backend/mutakamel-apps/api-gateway-app/src/routing-proxy/route-contracts/crm.route-contracts.ts`
- `../backend/mutakamel-apps/mutakamel-web-app/src/features/tenant/crm/dashboards/dashboard-api.ts`
