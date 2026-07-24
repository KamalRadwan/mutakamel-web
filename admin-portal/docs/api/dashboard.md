# Admin Dashboard API

Verified against the current `core-app` controller, query DTO, service response
types, and API Gateway route contract on 2026-07-24.

## Route and authorization

| Concern | Contract |
|:---|:---|
| Browser-facing route | `GET /api/admin/core/v1/dashboard` |
| Core upstream route | `GET /api/v1/admin/dashboard` |
| Controller | `AdminDashboardController` |
| Guard | `AdminGuard` |
| Permission | `admin.reports.read` |
| Gateway class | `READ_HEAVY` |
| Response envelope | Canonical Core success envelope; the dashboard object is in `data` |

Frontend code must call the browser-facing API Gateway route. `/admin/dashboard`
is only the Nest controller-relative route and must not be called from the
browser.

## Query DTO

`AdminDashboardQueryDto` accepts only these optional fields:

```ts
interface AdminDashboardQuery {
  date?: string;
  from?: string;
  to?: string;
}
```

Validation and range behavior:

- Every supplied value must pass `@IsDateString()`. Prefer the unambiguous
  `YYYY-MM-DD` form for date pickers.
- A date-only `date` selects one UTC calendar day and overrides both `from` and
  `to`.
- With both `from` and `to`, the range starts at `from` and ends at `to`.
- With only `from` or only `to`, a date-only value is treated as a single UTC
  day. A lone full timestamp currently produces an empty range and HTTP `422`,
  so the UI should not send that form.
- With no query, the backend returns the current UTC calendar month.
- Date-only `to` is inclusive: the backend internally advances to the next UTC
  day and exposes the inclusive end as `23:59:59.999Z`.
- A full-timestamp `to` is used as the exclusive query boundary; the response
  reports one millisecond earlier as the inclusive `range.to`.
- A full timestamp supplied as `date` currently produces HTTP `422`; use
  `YYYY-MM-DD` for the single-day control.
- `from` later than `to` returns HTTP `422` with code
  `DASHBOARD_RANGE_INVALID`.
- Invalid date strings or unknown query keys are rejected by the global strict
  validation pipe with HTTP `400`.

Examples:

```text
GET /api/admin/core/v1/dashboard
GET /api/admin/core/v1/dashboard?date=2026-07-24
GET /api/admin/core/v1/dashboard?from=2026-07-01&to=2026-07-24
```

Do not send `date` together with a UI-visible custom range. Although the server
accepts it, `date` silently takes precedence and can make the selected filters
look incorrect.

## Response types

```ts
type DashboardMetricKind = "integer" | "money" | "percent" | "ratio";
type DashboardRangeGranularity = "day" | "month";
type DashboardMetricTone =
  | "amber"
  | "blue"
  | "cyan"
  | "green"
  | "purple"
  | "red";

interface DashboardMetric {
  key: string;
  label: string;
  value: number | string;
  kind: DashboardMetricKind;
  description: string;
  tone: DashboardMetricTone;
}

interface DashboardBreakdownItem {
  key: string;
  label: string;
  value: number;
  ratio: number; // normalized 0..1, not 0..100
  tone: DashboardMetricTone;
  description?: string;
}

interface DashboardResponse {
  asOf: string;
  range: {
    from: string;
    to: string;
    label: string;
    granularity: DashboardRangeGranularity;
  };

  sections: Array<{
    key: "tenants" | "databaseServers" | "subscriptions" | "invoices";
    title: string;
    cards: DashboardMetric[];
  }>;

  panels: {
    tenantStatus: {
      title: string;
      subtitle: string;
      items: Array<{
        key: string;
        label: string;
        count: number;
        description: string;
        ratio: number; // normalized 0..1
        tone: DashboardMetricTone;
      }>;
    };
    databaseCapacity: {
      title: string;
      subtitle: string;
      items: Array<{
        id: string;
        name: string;
        metadata: string;
        currentTenants: number;
        maxTenants: number;
        utilization: number; // normalized 0..1
        tone: DashboardMetricTone;
      }>;
    };
  };

  overview: {
    kpis: DashboardMetric[];
    tenantLifecycle: {
      total: number;
      current: number;
      deleted: number;
      items: DashboardBreakdownItem[];
      stats: DashboardMetric[];
    };
    databaseHealth: {
      capacity: {
        current: number;
        maximum: number;
        utilization: number; // normalized 0..1
      };
      stats: DashboardMetric[];
    };
    subscriptionStatus: {
      total: number;
      items: DashboardBreakdownItem[];
      stats: DashboardMetric[];
    };
    billingSummary: {
      totalAmount: number;
      collectedRatio: number; // normalized 0..1
      items: DashboardBreakdownItem[];
    };
    domainHealth: {
      totalDomains: number;
      verifiedDomains: number;
      fullyVerified: number;
      invalidDomains: number;
      countries: number;
      regions: Array<{
        key: string;
        countryName: string;
        countryIsoCode: string;
        count: number;
        ratio: number; // normalized 0..1
        tone: DashboardMetricTone;
      }>;
      actionRequired: boolean;
      message: string;
    };
    tenantBillingGrowth: {
      year: number;
      currencyCode: string; // current backend value: "USD"
      granularity: DashboardRangeGranularity;
      points: Array<{
        month: string; // formatted bucket label; may represent a day
        tenants: number;
        collected: number;
      }>;
    };
    recentTenants: {
      items: Array<{
        id: string;
        name: string;
        status: string; // humanized label, not a raw TenantStatusEnum value
        plan: string; // humanized subscription status + " Plan", or "No Plan"
        createdAt: string;
      }>;
    };
  };
}
```

The literal section keys above are the keys currently emitted by the service,
but the frontend should still render `sections` dynamically so additive cards
do not require a UI release.

## UI mapping

| Dashboard view | Backend source | UI notes |
|:---|:---|:---|
| Main KPI cards | `overview.kpis` | Format by `kind`; never infer formatting from `key` |
| Tenant lifecycle | `overview.tenantLifecycle` | Render `items`; multiply `ratio` by 100 only at presentation time |
| Tenant status panel | `panels.tenantStatus` | The backend omits zero-count statuses except for its empty-state fallback |
| Database capacity | `panels.databaseCapacity.items` | `utilization` is `0..1`; the item does not expose a raw server `status` field |
| Database health summary | `overview.databaseHealth` | Use the separate `capacity` and `stats` fields |
| Subscription status | `overview.subscriptionStatus` | Use for subscription cards/charts |
| Billing | `overview.billingSummary` | Currency amounts are numeric; use `tenantBillingGrowth.currencyCode` when formatting the growth series |
| Domain health | `overview.domainHealth` | Use `actionRequired` for the alert state and `message` as server-authored supporting text |
| Growth chart | `overview.tenantBillingGrowth.points` | The property is named `month` even when granularity is `day` |
| Recent tenants | `overview.recentTenants.items` | No `companyName` is returned by this endpoint |

### Metric formatting

```ts
function formatDashboardMetric(
  metric: DashboardMetric,
  currencyCode = "USD",
): string {
  if (metric.kind === "money" && typeof metric.value === "number") {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currencyCode,
    }).format(metric.value);
  }

  if (metric.kind === "percent" && typeof metric.value === "number") {
    return new Intl.NumberFormat(undefined, {
      style: "percent",
      maximumFractionDigits: 1,
    }).format(metric.value);
  }

  return String(metric.value);
}
```

`ratio` metrics may contain a preformatted string such as `"45 / 200"`, while
ratio fields inside capacity and breakdown objects are numeric `0..1` values.

## Current frontend integration status

`src/app/dashboard/hooks/useDashboard.ts` currently supplies mock data and does
not call this endpoint. Its local shape is not the backend contract:

- it uses `money` and `percent` display values as preformatted strings;
- it stores server utilization as `0..100`, while the API uses `0..1`;
- it expects raw server statuses that `panels.databaseCapacity.items` does not
  provide;
- it flattens tenant lifecycle counts instead of consuming `items`;
- it includes `companyName` on recent tenants, which the API does not return;
- its billing summary shape differs from `overview.billingSummary`.

Integrate through an adapter or update the view props before replacing the
mock. Do not cast the API response to the current mock type.

## Error handling

| Status | UI behavior |
|:---|:---|
| `400` | Mark the date filter invalid; do not retry unchanged input |
| `401` | Let the shared client perform its single coordinated refresh, then redirect to login if refresh fails |
| `403` | Show a permission-denied state and hide dashboard navigation when `admin.reports.read` is absent |
| `422` | Show the backend range message next to the date controls |
| `429` | Preserve the last successful dashboard and offer a delayed manual retry |
| `5xx` / network | Keep stale data if available, identify it as stale, and provide retry |

## Backend source map

Paths below are relative to `C:\mutakamel.ai\frontend`:

- `../backend/mutakamel-apps/core-app/src/admin/admin-dashboard/admin-dashboard.controller.ts`
- `../backend/mutakamel-apps/core-app/src/admin/admin-dashboard/dto/admin-dashboard-query.dto.ts`
- `../backend/mutakamel-apps/core-app/src/admin/admin-dashboard/admin-dashboard.service.ts`
- `../backend/mutakamel-apps/api-gateway-app/src/routing-proxy/route-contracts/core.route-contracts.ts`
