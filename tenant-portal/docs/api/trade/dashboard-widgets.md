# Trade Dashboard Widgets API

> Contract status: source-verified backend contract; replacement frontend not implemented
> Verification date: 2026-07-25
> Backend owner: Trade
> Documentation: source-generated from verified Gateway routes, Trade controllers/DTOs/services/tests, and legacy frontend evidence
> Canonical browser prefix: `/api/tenant/trade/v1`
> Controller-relative prefixes: `/trade/widgets`
> Tenant Portal status: `tenant-portal` replaces the legacy tenant Trade UI; Legacy `mutakamel-web-app` has live widget builder/renderer clients and tests. The replacement `tenant-portal` is not implemented.

## Capability

Reusable widget definitions, preview execution, cloning, sharing, and widget lifecycle.

- Controller feature requirement: none declared; Trade module entitlement, seat, permission, and dashboard target authorization still apply.
- Gateway routes assigned to this page: **11**.
- These are browser contracts. The Trade upstream remains `/api/v1/trade/...`; the browser must use the canonical prefix above.

## Source evidence

Backend source references below are relative to `C:\mutakamel.ai\frontend`.

- `../backend/mutakamel-apps/api-gateway-app/src/routing-proxy/route-contracts/trade.route-contracts.ts`
- `../backend/mutakamel-apps/trade-app/src/modules/dashboards/widget.controller.ts`
- `../backend/mutakamel-apps/trade-app/src/modules/dashboards/dto/dashboard.dto.ts`
- `../backend/mutakamel-apps/trade-app/src/modules/dashboards/dashboard-widget.service.ts`
- `../backend/mutakamel-apps/trade-app/src/modules/dashboards/dashboard-execution.service.ts`
- `../backend/mutakamel-apps/trade-app/src/modules/dashboards/dashboard-widget.service.spec.ts`
- `../backend/mutakamel-apps/mutakamel-web-app/src/features/tenant/trade/dashboards/dashboard-api.ts`
- `../backend/mutakamel-apps/mutakamel-web-app/src/features/tenant/trade/dashboards/widget-builder-dialog.tsx`
- `../backend/mutakamel-apps/mutakamel-web-app/src/features/tenant/trade/dashboards/dashboard-widget-renderer.tsx`

## Authorization and scope

Every route requires an authenticated active `TENANT_USER`, a current session version, a Trade/Sales module seat unless the actor is the tenant owner, an enabled Trade entitlement, the feature gate above when declared, the exact permission in the table, and an authorized company/branch context. Tenant owners bypass permission-row lookup, not session, entitlement, feature, or scope validation. Dashboard-context exceptions are called out below.

- `COMPANY`: send an authorized `X-Mutakamel-Company-Id`.
- `BRANCH`: send both company and branch UUIDv7 headers.
- `COMPANY_OR_BRANCH`: branch wins when present; otherwise company is required.
- `OPERATING_CONTEXT`: resolves branch, then company, then tenant from supplied context.
- `DASHBOARD_CONTEXT`: may begin without one company header; service authorization validates every resolved target.
- A channel header always requires company and must belong to the company; with a branch it must be assigned and active. Browser code must never forge trusted tenant/database/internal-secret headers.

## Routes

| Method | Canonical browser path | Controller-relative path | Permission | Scope target | Validated input | Required command headers | Success | Gateway contract |
|---|---|---|---|---|---|---|---|---|
| POST | `/api/tenant/trade/v1/widgets/preview` | `/trade/widgets/preview` | `trade.dashboards.read` | `DASHBOARD_CONTEXT` | `body: PreviewWidgetDto` | — | 200 | `READ_HEAVY`; gateway-idempotent=true |
| GET | `/api/tenant/trade/v1/widgets/share-targets` | `/trade/widgets/share-targets` | `trade.widgets.share` | `DASHBOARD_CONTEXT` | `query: ShareTargetsQueryDto` | — | 200 | `AUTHENTICATED`; gateway-idempotent=true |
| GET | `/api/tenant/trade/v1/widgets` | `/trade/widgets` | `trade.widgets.read` | `DASHBOARD_CONTEXT` | — | — | 200 | `AUTHENTICATED`; gateway-idempotent=true |
| POST | `/api/tenant/trade/v1/widgets` | `/trade/widgets` | `trade.widgets.create` | `DASHBOARD_CONTEXT` | `body: CreateWidgetDto` | `X-Idempotency-Key` | 201 | `WRITE_SENSITIVE`; gateway-idempotent=false |
| GET | `/api/tenant/trade/v1/widgets/:id` | `/trade/widgets/:id` | `trade.widgets.read` | `DASHBOARD_CONTEXT` | — | — | 200 | `AUTHENTICATED`; gateway-idempotent=true |
| PATCH | `/api/tenant/trade/v1/widgets/:id` | `/trade/widgets/:id` | `trade.widgets.update` | `DASHBOARD_CONTEXT` | `body: UpdateWidgetDto` | `If-Match` | 200 | `WRITE_SENSITIVE`; gateway-idempotent=false |
| DELETE | `/api/tenant/trade/v1/widgets/:id` | `/trade/widgets/:id` | `trade.widgets.delete` | `DASHBOARD_CONTEXT` | — | `If-Match` | 204 | `WRITE_SENSITIVE`; gateway-idempotent=false |
| POST | `/api/tenant/trade/v1/widgets/:id/clone` | `/trade/widgets/:id/clone` | `trade.widgets.create` | `DASHBOARD_CONTEXT` | `body: CloneWidgetDto` | `X-Idempotency-Key` | 201 | `WRITE_SENSITIVE`; gateway-idempotent=false |
| GET | `/api/tenant/trade/v1/widgets/:id/shares` | `/trade/widgets/:id/shares` | `trade.widgets.share` | `DASHBOARD_CONTEXT` | — | — | 200 | `AUTHENTICATED`; gateway-idempotent=true |
| POST | `/api/tenant/trade/v1/widgets/:id/shares/bulk-upsert` | `/trade/widgets/:id/shares/bulk-upsert` | `trade.widgets.share` | `DASHBOARD_CONTEXT` | `body: BulkUpsertSharesDto` | `X-Idempotency-Key` | 200 | `WRITE_SENSITIVE`; gateway-idempotent=false |
| DELETE | `/api/tenant/trade/v1/widgets/:id/shares/:shareId` | `/trade/widgets/:id/shares/:shareId` | `trade.widgets.share` | `DASHBOARD_CONTEXT` | — | `If-Match` | 204 | `WRITE_SENSITIVE`; gateway-idempotent=false |

`gateway-idempotent` is Gateway transport metadata. `X-Idempotency-Key` in the header column is the independent Trade domain replay contract.

## Validation and enum wire values

The global validation pipe transforms primitive query values, whitelists declared fields, rejects unknown fields, accumulates validation failures, and returns `TRADE.VALIDATION_FAILED`. Exact property decorators are in [validation-reference.md](validation-reference.md).

- Widget query and display specs are nested DTOs; metric, visualization, series, filters, and options are checked against the runtime dashboard catalogue.
- Share subjects are `USER` or `TEAM`; mutable shares allow only `VIEW` or `EDIT`.

- Visualization types include `METRIC_CARD`, `LINE`, `AREA`, `LINE_AREA`, `COLUMN`, `BAR`, `STACKED_BAR`, `PIE`, `DONUT`, `SCATTER`, `BUBBLE`, `GANTT`, `FLOWCHART`, four gauge types, `TABLE`, `FUNNEL`, `HEATMAP`.
- Execution status: `READY`, `EMPTY`, `LIMITED`, `STALE`, `UNAVAILABLE`, `FAILED`.

## Response, errors, security, idempotency and async behavior

- Normal non-204 success: `{ success: true, data, correlationId, timestamp }`. A versioned object also sets `ETag: "<version>"`; a domain replay sets `Idempotency-Replayed`. A 204 has no body.
- A required idempotency key is a UUIDv7. Reusing it with a different canonical request returns an idempotency mismatch; an in-flight duplicate conflicts. A required `If-Match` accepts a positive quoted integer ETag unless the route explicitly documents create sentinel `"0"`.
- Common failures: 400 validation/missing precondition; 401 absent, stale or invalidated tenant session; 403 missing seat/entitlement/feature/permission; 404 missing scoped resource; 409 stale aggregate or in-flight duplicate; 422 semantic/scope/idempotency mismatch; 503 entitlement or dependency unavailable. Gateway-originated failures use Problem Details. Trade-originated validation, guard, and domain errors remain raw Nest exception bodies and are passed through unchanged by the Gateway; successes use the envelope above.
- Domain error codes observed in the owning module: `TRADE.DASHBOARD.COMPANY_BRANCH_MISMATCH`, `TRADE.DASHBOARD.DEFINITION_INVALID`, `TRADE.DASHBOARD.EXECUTION_BUDGET_EXCEEDED`, `TRADE.DASHBOARD.EXECUTION_FAILED`, `TRADE.DASHBOARD.FILTER_INVALID`, `TRADE.DASHBOARD.LAYOUT_INVALID`, `TRADE.DASHBOARD.LAYOUT_OVERLAP`, `TRADE.DASHBOARD.LIMIT_EXCEEDED`, `TRADE.DASHBOARD.METRIC_INCOMPATIBLE`, `TRADE.DASHBOARD.METRIC_NOT_REGISTERED`, `TRADE.DASHBOARD.METRIC_PERMISSION_REQUIRED`, `TRADE.DASHBOARD.NAME_CONFLICT`, `TRADE.DASHBOARD.NOT_FOUND`, `TRADE.DASHBOARD.REVISION_CONFLICT`, `TRADE.DASHBOARD.SCOPE_DENIED`, `TRADE.DASHBOARD.SCOPE_EMPTY`, `TRADE.DASHBOARD.SHARE_ACCESS_INVALID`, `TRADE.DASHBOARD.SHARE_TARGET_INVALID`, `TRADE.DASHBOARD.SOURCE_PERMISSION_REQUIRED`, `TRADE.DASHBOARD.SOURCE_UNAVAILABLE`, `TRADE.DASHBOARD.TRANSITIVE_SHARE_FORBIDDEN`, `TRADE.DASHBOARD.VISUALIZATION_INCOMPATIBLE`, `TRADE.DASHBOARD.WIDGET_ALREADY_PLACED`, `TRADE.DASHBOARD.WIDGET_UNAVAILABLE`.

- Widget authorization uses `DASHBOARD_CONTEXT` and resource ownership/shares plus source-metric permissions. Preview is synchronous/read-heavy and must not persist a widget.
- Create/clone/share writes require idempotency. Update/delete require `If-Match` without a domain idempotency key.

## Safe example

Use the tenant portal's authenticated same-origin API client; it owns the session/cookie behavior. This read example contains only browser-authorized scope headers:

```ts
const result = await tenantTradeApi.request(
  "/api/tenant/trade/v1/widgets",
  {
    method: "GET",
  headers: {
    "X-Mutakamel-Company-Id": "019f98a1-1234-7abc-8def-1234567890ab"
  }
  },
);
```

Do not add `x-mutakamel-tenant-id`, `x-mutakamel-tenant-db-name`, or `x-internal-gateway-secret`. Replace illustrative UUIDv7 values with IDs from authorized Core/Trade projections.

## Ambiguities and AI rules

- The catalog endpoint is the runtime authority for metric-to-visualization compatibility; static enum membership alone does not make a combination valid.
- Never infer writable fields from response entities. Use only the DTO named in the route table.
- Never call Trade directly from the browser and never call Worker. Use the canonical Gateway path.
- See [examples.md](examples.md) for safe request patterns and [route-coverage.md](route-coverage.md) for the complete 226-route assignment.
