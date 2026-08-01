# Trade Control Tower API

> Contract status: source-verified backend contract; replacement frontend not implemented
> Verification date: 2026-07-25
> Backend owner: Trade
> Documentation: source-generated from verified Gateway routes, Trade controllers/DTOs/services/tests, and legacy frontend evidence
> Canonical browser prefix: `/api/tenant/trade/v1`
> Controller-relative prefixes: `/trade/control-tower/exceptions`
> Tenant Portal status: `tenant-portal` replaces the legacy tenant Trade UI; Legacy `mutakamel-web-app` has live control-tower clients and an operations section. The replacement `tenant-portal` is not implemented.

## Capability

Operational exception listing, detail, asynchronous retry dispatch, and evidence-backed resolution.

- Controller feature requirement: all of `trade.analytics` and any of `trade.catalog`, `trade.pricing`, `trade.sales`, `trade.purchasing`, `trade.inventory`, `trade.policy_studio`, or `trade.automation`.
- Gateway routes assigned to this page: **4**.
- These are browser contracts. The Trade upstream remains `/api/v1/trade/...`; the browser must use the canonical prefix above.

## Source evidence

Backend source references below are relative to `C:\mutakamel.ai\frontend`.

- `../backend/mutakamel-apps/api-gateway-app/src/routing-proxy/route-contracts/trade.route-contracts.ts`
- `../backend/mutakamel-apps/trade-app/src/modules/control-tower/control-tower.controller.ts`
- `../backend/mutakamel-apps/trade-app/src/modules/control-tower/dto/control-tower.dto.ts`
- `../backend/mutakamel-apps/trade-app/src/modules/control-tower/control-tower.service.ts`
- `../backend/mutakamel-apps/trade-app/src/modules/control-tower/control-tower-retry.registry.ts`
- `../backend/mutakamel-apps/trade-app/src/modules/control-tower/control-tower.service.spec.ts`
- `../backend/mutakamel-apps/mutakamel-web-app/src/features/tenant/trade/trade-operations-api.ts`
- `../backend/mutakamel-apps/mutakamel-web-app/src/features/tenant/trade/control-tower-operations-section.tsx`

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
| GET | `/api/tenant/trade/v1/control-tower/exceptions` | `/trade/control-tower/exceptions` | `trade.control_tower.read` | `OPERATING_CONTEXT` | `query: ExceptionListQueryDto` | — | 200 | `AUTHENTICATED`; gateway-idempotent=true |
| GET | `/api/tenant/trade/v1/control-tower/exceptions/:id` | `/trade/control-tower/exceptions/:id` | `trade.control_tower.read` | `OPERATING_CONTEXT` | — | — | 200 | `AUTHENTICATED`; gateway-idempotent=true |
| POST | `/api/tenant/trade/v1/control-tower/exceptions/:id/retry` | `/trade/control-tower/exceptions/:id/retry` | `trade.control_tower.retry` | `OPERATING_CONTEXT` | `body: RetryExceptionDto` | `X-Idempotency-Key`, `If-Match` | 202 | `WRITE_SENSITIVE`; gateway-idempotent=true |
| POST | `/api/tenant/trade/v1/control-tower/exceptions/:id/resolve` | `/trade/control-tower/exceptions/:id/resolve` | `trade.control_tower.resolve` | `OPERATING_CONTEXT` | `body: ResolveExceptionDto` | `X-Idempotency-Key`, `If-Match` | 200 | `WRITE_SENSITIVE`; gateway-idempotent=true |

`gateway-idempotent` is Gateway transport metadata. `X-Idempotency-Key` in the header column is the independent Trade domain replay contract.

## Validation and enum wire values

The global validation pipe transforms primitive query values, whitelists declared fields, rejects unknown fields, accumulates validation failures, and returns `TRADE.VALIDATION_FAILED`. Exact property decorators are in [validation-reference.md](validation-reference.md).

- List pagination is capped at 100; category is at most 64 characters.
- Resolve requires a closed resolution code, a reason up to 240 characters, and an evidence object. Retry reason is optional and capped at 240.

- Status: `OPEN`, `ACKNOWLEDGED`, `ACTION_PENDING`, `RECONCILIATION_PENDING`, `RESOLVED`, `QUARANTINED`.
- Severity query: `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`.
- Resolution: `SOURCE_CORRECTED`, `OWNER_RESULT_APPLIED`.

## Response, errors, security, idempotency and async behavior

- Normal non-204 success: `{ success: true, data, correlationId, timestamp }`. A versioned object also sets `ETag: "<version>"`; a domain replay sets `Idempotency-Replayed`. A 204 has no body.
- A required idempotency key is a UUIDv7. Reusing it with a different canonical request returns an idempotency mismatch; an in-flight duplicate conflicts. A required `If-Match` accepts a positive quoted integer ETag unless the route explicitly documents create sentinel `"0"`.
- Common failures: 400 validation/missing precondition; 401 absent, stale or invalidated tenant session; 403 missing seat/entitlement/feature/permission; 404 missing scoped resource; 409 stale aggregate or in-flight duplicate; 422 semantic/scope/idempotency mismatch; 503 entitlement or dependency unavailable. Gateway-originated failures use Problem Details. Trade-originated validation, guard, and domain errors remain raw Nest exception bodies and are passed through unchanged by the Gateway; successes use the envelope above.
- Domain error codes observed in the owning module: `TRADE.CONCURRENCY.STALE_VERSION`, `TRADE.CONTROL_TOWER.NOT_FOUND`, `TRADE.CONTROL_TOWER.OWNER_UNAVAILABLE`, `TRADE.CONTROL_TOWER.PROJECTION_UNAVAILABLE`, `TRADE.CONTROL_TOWER.RESOLUTION_INVALID`, `TRADE.CONTROL_TOWER.RETRY_IN_PROGRESS`, `TRADE.CONTROL_TOWER.RETRY_NOT_ALLOWED`, `TRADE.CONTROL_TOWER.SCOPE_DENIED`, `TRADE.CONTROL_TOWER.TARGET_STALE`.

- Retry returns `202`; it dispatches owner work and does not mean the exception is resolved. Poll the exception detail/list projection.
- Retry and resolution require both idempotency and `If-Match`; sensitive details additionally remain subject to service-level redaction.

## Safe example

Use the tenant portal's authenticated same-origin API client; it owns the session/cookie behavior. This read example contains only browser-authorized scope headers:

```ts
const result = await tenantTradeApi.request(
  "/api/tenant/trade/v1/control-tower/exceptions/019f98a0-1234-7abc-8def-1234567890ab",
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

- The common `ExceptionSeverity` enum uses `INFO/WARNING/HIGH/CRITICAL`, while this controller query accepts `LOW/MEDIUM/HIGH/CRITICAL`. Use the controller DTO for this endpoint.
- Never infer writable fields from response entities. Use only the DTO named in the route table.
- Never call Trade directly from the browser and never call Worker. Use the canonical Gateway path.
- See [examples.md](examples.md) for safe request patterns and [route-coverage.md](route-coverage.md) for the complete 226-route assignment.
