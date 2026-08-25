# Trade Dashboard Builder API

> Contract status: source-verified backend contract; replacement frontend not implemented
> Verification date: 2026-07-25
> Backend owner: Trade
> Documentation: source-generated from verified Gateway routes, Trade controllers/DTOs/services/tests, and dated historical frontend evidence
> Canonical browser prefix: `/api/tenant/trade/v1`
> Controller-relative prefixes: `/trade/dashboards`
> Tenant Portal status: The standalone `tenant-portal` replacement is not implemented. The consolidated `mutakamel-web-app` references below are dated 2026-07-25 historical evidence; that workspace is absent from the current checkout and does not prove a live frontend.

## Capability

Dashboard catalogue/navigation, definitions, templates, preferences, layouts, placements, sharing, and execution.

- Controller feature requirement: none declared; Trade module entitlement, seat, permission, and dashboard target authorization still apply.
- Gateway routes assigned to this page: **20**.
- These are browser contracts. The Trade upstream remains `/api/v1/trade/...`; the browser must use the canonical prefix above.

## Source evidence

Current backend source references below are relative to
`C:\mutakamel.ai\frontend`. Consolidated frontend paths are explicitly dated
historical references; their absent workspace is not current runtime evidence.

- `../backend/mutakamel-apps/api-gateway-app/src/routing-proxy/route-contracts/trade.route-contracts.ts`
- `../backend/mutakamel-apps/trade-app/src/modules/dashboards/dashboard.controller.ts`
- `../backend/mutakamel-apps/trade-app/src/modules/dashboards/dto/dashboard.dto.ts`
- `../backend/mutakamel-apps/trade-app/src/modules/dashboards/dashboard-definition.service.ts`
- `../backend/mutakamel-apps/trade-app/src/modules/dashboards/dashboard-execution.service.ts`
- `../backend/mutakamel-apps/trade-app/src/modules/dashboards/dashboard-scope.service.ts`
- `../backend/mutakamel-apps/trade-app/src/modules/dashboards/dashboard-controller-contract.spec.ts`
- `../backend/mutakamel-apps/mutakamel-web-app/src/features/tenant/trade/dashboards/dashboard-api.ts`
- `../backend/mutakamel-apps/mutakamel-web-app/src/features/tenant/trade/dashboards/trade-dashboard-workspace.tsx`

## Authorization and scope

Every route requires an authenticated active `TENANT_USER`, an active unexpired
`sid` with all four exact Auth epochs, a Trade/Sales module seat unless the actor
is the tenant owner, an enabled Trade entitlement, the feature gate above when
declared, the exact permission in the table, and an authorized company/branch
context. Tenant owners bypass permission-row lookup, not session, entitlement,
feature, or scope validation. Dashboard-context exceptions are called out below.

- `COMPANY`: send an authorized `X-Mutakamel-Company-Id`.
- `BRANCH`: send both company and branch UUIDv7 headers.
- `COMPANY_OR_BRANCH`: branch wins when present; otherwise company is required.
- `OPERATING_CONTEXT`: resolves branch, then company, then tenant from supplied context.
- `DASHBOARD_CONTEXT`: may begin without one company header; service authorization validates every resolved target.
- A channel header always requires company and must belong to the company; with a branch it must be assigned and active. Browser code must never forge trusted tenant/database/internal-secret headers.

## Routes

| Method | Canonical browser path | Controller-relative path | Permission | Scope target | Validated input | Required command headers | Success | Gateway contract |
|---|---|---|---|---|---|---|---|---|
| GET | `/api/tenant/trade/v1/dashboards/catalog` | `/trade/dashboards/catalog` | `trade.dashboards.read` | `DASHBOARD_CONTEXT` | — | — | 200 | `AUTHENTICATED`; gateway-idempotent=true |
| GET | `/api/tenant/trade/v1/dashboards/navigation` | `/trade/dashboards/navigation` | `trade.dashboards.read` | `DASHBOARD_CONTEXT` | `query: DashboardPreferenceQueryDto` | — | 200 | `AUTHENTICATED`; gateway-idempotent=true |
| GET | `/api/tenant/trade/v1/dashboards/default` | `/trade/dashboards/default` | `trade.dashboards.read` | `DASHBOARD_CONTEXT` | `query: DashboardPreferenceQueryDto` | — | 200 | `AUTHENTICATED`; gateway-idempotent=true |
| GET | `/api/tenant/trade/v1/dashboards/share-targets` | `/trade/dashboards/share-targets` | `trade.dashboards.share` | `DASHBOARD_CONTEXT` | `query: ShareTargetsQueryDto` | — | 200 | `AUTHENTICATED`; gateway-idempotent=true |
| GET | `/api/tenant/trade/v1/dashboards` | `/trade/dashboards` | `trade.dashboards.read` | `DASHBOARD_CONTEXT` | `query: DashboardListQueryDto` | — | 200 | `AUTHENTICATED`; gateway-idempotent=true |
| POST | `/api/tenant/trade/v1/dashboards` | `/trade/dashboards` | `trade.dashboards.create` | `DASHBOARD_CONTEXT` | `body: CreateDashboardDto` | `X-Idempotency-Key` | 201 | `WRITE_SENSITIVE`; gateway-idempotent=false |
| POST | `/api/tenant/trade/v1/dashboards/from-template/:templateKey` | `/trade/dashboards/from-template/:templateKey` | `trade.dashboards.create` | `DASHBOARD_CONTEXT` | `body: CreateDashboardFromTemplateDto` | `X-Idempotency-Key` | 200 or 201 | `WRITE_SENSITIVE`; gateway-idempotent=false |
| GET | `/api/tenant/trade/v1/dashboards/:id` | `/trade/dashboards/:id` | `trade.dashboards.read` | `DASHBOARD_CONTEXT` | — | — | 200 | `AUTHENTICATED`; gateway-idempotent=true |
| PATCH | `/api/tenant/trade/v1/dashboards/:id` | `/trade/dashboards/:id` | `trade.dashboards.update` | `DASHBOARD_CONTEXT` | `body: UpdateDashboardDto` | `If-Match` | 200 | `WRITE_SENSITIVE`; gateway-idempotent=false |
| DELETE | `/api/tenant/trade/v1/dashboards/:id` | `/trade/dashboards/:id` | `trade.dashboards.delete` | `DASHBOARD_CONTEXT` | — | `If-Match` | 204 | `WRITE_SENSITIVE`; gateway-idempotent=false |
| POST | `/api/tenant/trade/v1/dashboards/:id/duplicate` | `/trade/dashboards/:id/duplicate` | `trade.dashboards.create` | `DASHBOARD_CONTEXT` | `body: DuplicateDashboardDto` | `X-Idempotency-Key` | 201 | `WRITE_SENSITIVE`; gateway-idempotent=false |
| POST | `/api/tenant/trade/v1/dashboards/:id/set-default` | `/trade/dashboards/:id/set-default` | `trade.dashboards.read` | `DASHBOARD_CONTEXT` | `body: SetDashboardDefaultDto` | `X-Idempotency-Key` | 200 | `WRITE_SENSITIVE`; gateway-idempotent=false |
| POST | `/api/tenant/trade/v1/dashboards/:id/set-favorite` | `/trade/dashboards/:id/set-favorite` | `trade.dashboards.read` | `DASHBOARD_CONTEXT` | `body: SetDashboardFavoriteDto` | `X-Idempotency-Key` | 200 | `WRITE_SENSITIVE`; gateway-idempotent=false |
| PATCH | `/api/tenant/trade/v1/dashboards/:id/layout` | `/trade/dashboards/:id/layout` | `trade.dashboards.update` | `DASHBOARD_CONTEXT` | `body: UpdateDashboardLayoutDto` | `If-Match` | 200 | `WRITE_SENSITIVE`; gateway-idempotent=false |
| POST | `/api/tenant/trade/v1/dashboards/:id/run` | `/trade/dashboards/:id/run` | `trade.dashboards.read` | `DASHBOARD_CONTEXT` | `body: RunDashboardDto` | — | 200 | `READ_HEAVY`; gateway-idempotent=true |
| POST | `/api/tenant/trade/v1/dashboards/:id/placements` | `/trade/dashboards/:id/placements` | `trade.dashboards.update` | `DASHBOARD_CONTEXT` | `body: CreatePlacementDto` | `X-Idempotency-Key` | 201 | `WRITE_SENSITIVE`; gateway-idempotent=false |
| DELETE | `/api/tenant/trade/v1/dashboards/:id/placements/:placementId` | `/trade/dashboards/:id/placements/:placementId` | `trade.dashboards.update` | `DASHBOARD_CONTEXT` | — | `If-Match` | 204 | `WRITE_SENSITIVE`; gateway-idempotent=false |
| GET | `/api/tenant/trade/v1/dashboards/:id/shares` | `/trade/dashboards/:id/shares` | `trade.dashboards.share` | `DASHBOARD_CONTEXT` | — | — | 200 | `AUTHENTICATED`; gateway-idempotent=true |
| POST | `/api/tenant/trade/v1/dashboards/:id/shares/bulk-upsert` | `/trade/dashboards/:id/shares/bulk-upsert` | `trade.dashboards.share` | `DASHBOARD_CONTEXT` | `body: BulkUpsertSharesDto` | `X-Idempotency-Key` | 200 | `WRITE_SENSITIVE`; gateway-idempotent=false |
| DELETE | `/api/tenant/trade/v1/dashboards/:id/shares/:shareId` | `/trade/dashboards/:id/shares/:shareId` | `trade.dashboards.share` | `DASHBOARD_CONTEXT` | — | `If-Match` | 204 | `WRITE_SENSITIVE`; gateway-idempotent=false |

`gateway-idempotent` is Gateway transport metadata. `X-Idempotency-Key` in the header column is the independent Trade domain replay contract.

## Validation and enum wire values

The global validation pipe transforms primitive query values, whitelists declared fields, rejects unknown fields, accumulates validation failures, and returns `TRADE.VALIDATION_FAILED`. Exact property decorators are in [validation-reference.md](validation-reference.md).

- Dashboard and share identifiers use UUIDv7. Name/description, placements, layout, filters, scopes, series, and share arrays are bounded by DTO validators and dashboard constants.
- Runtime scope selection and saved targets are nested validated structures. Date presets and custom ranges are mutually constrained by service validation.
- Template keys are path strings; registry membership is checked by the service, not a DTO.

- Scope mode: `CURRENT_CONTEXT`, `SAVED_TARGETS`, `SELECTED_SCOPES`, `ALL_ACCESSIBLE`.
- Coverage: `SINGLE_COMPANY`, `MULTI_COMPANY_AUTHORIZED_UNION`. Preference context: `COMPANY`, `CONSOLIDATED`.
- Date preset: `TODAY`, `CURRENT_WEEK`, `CURRENT_MONTH`, `CURRENT_QUARTER`, `CURRENT_YEAR`, `LAST_30_DAYS`, `CUSTOM`.
- Run status: `COMPLETE`, `PARTIAL`. Full visualization and execution enums are in `static-data.md`.

## Response, errors, security, idempotency and async behavior

- Normal non-204 success: `{ success: true, data, correlationId, timestamp }`. A versioned object also sets `ETag: "<version>"`; a domain replay sets `Idempotency-Replayed`. A 204 has no body.
- A required idempotency key is a UUIDv7. Reusing it with a different canonical request returns an idempotency mismatch; an in-flight duplicate conflicts. A required `If-Match` accepts a positive quoted integer ETag unless the route explicitly documents create sentinel `"0"`.
- Common failures: 400 validation/missing precondition; 401 absent, stale or invalidated tenant session; 403 missing seat/entitlement/feature/permission; 404 missing scoped resource; 409 stale aggregate or in-flight duplicate; 422 semantic/scope/idempotency mismatch; 503 entitlement or dependency unavailable. Gateway-originated failures use Problem Details. Trade-originated validation, guard, and domain errors remain raw Nest exception bodies and are passed through unchanged by the Gateway; successes use the envelope above.
- Domain error codes observed in the owning module: `TRADE.DASHBOARD.COMPANY_BRANCH_MISMATCH`, `TRADE.DASHBOARD.DEFINITION_INVALID`, `TRADE.DASHBOARD.EXECUTION_BUDGET_EXCEEDED`, `TRADE.DASHBOARD.EXECUTION_FAILED`, `TRADE.DASHBOARD.FILTER_INVALID`, `TRADE.DASHBOARD.LAYOUT_INVALID`, `TRADE.DASHBOARD.LAYOUT_OVERLAP`, `TRADE.DASHBOARD.LIMIT_EXCEEDED`, `TRADE.DASHBOARD.METRIC_INCOMPATIBLE`, `TRADE.DASHBOARD.METRIC_NOT_REGISTERED`, `TRADE.DASHBOARD.METRIC_PERMISSION_REQUIRED`, `TRADE.DASHBOARD.NAME_CONFLICT`, `TRADE.DASHBOARD.NOT_FOUND`, `TRADE.DASHBOARD.REVISION_CONFLICT`, `TRADE.DASHBOARD.SCOPE_DENIED`, `TRADE.DASHBOARD.SCOPE_EMPTY`, `TRADE.DASHBOARD.SHARE_ACCESS_INVALID`, `TRADE.DASHBOARD.SHARE_TARGET_INVALID`, `TRADE.DASHBOARD.SOURCE_PERMISSION_REQUIRED`, `TRADE.DASHBOARD.SOURCE_UNAVAILABLE`, `TRADE.DASHBOARD.TRANSITIVE_SHARE_FORBIDDEN`, `TRADE.DASHBOARD.VISUALIZATION_INCOMPATIBLE`, `TRADE.DASHBOARD.WIDGET_ALREADY_PLACED`, `TRADE.DASHBOARD.WIDGET_UNAVAILABLE`.

- Dashboard routes use special `DASHBOARD_CONTEXT`: the generic permission guard defers to dashboard services, which authorize every resolved target and resource share. Never replace this with one company-level check.
- Create/duplicate/preference/share/placement writes require UUIDv7 idempotency keys. PATCH/DELETE routes use `If-Match` without a domain idempotency key.
- `run` is a synchronous read-heavy POST and may return partial/unavailable widget results; it is not a background job. `from-template` returns 201 when created or 200 on its domain replay path.

## Safe example

Use the tenant portal's authenticated same-origin API client; it owns the session/cookie behavior. This read example contains only browser-authorized scope headers:

```ts
const result = await tenantTradeApi.request(
  "/api/tenant/trade/v1/dashboards/catalog",
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

- Gateway marks dashboard writes `idempotent: false` even where the Trade controller requires a domain idempotency key. Treat Gateway retry policy and domain replay protection as separate facts.
- Never infer writable fields from response entities. Use only the DTO named in the route table.
- Never call Trade directly from the browser and never call Worker. Use the canonical Gateway path.
- See [examples.md](examples.md) for safe request patterns and [route-coverage.md](route-coverage.md) for the complete 226-route assignment.
