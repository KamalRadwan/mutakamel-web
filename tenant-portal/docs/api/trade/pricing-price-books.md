# Trade Pricing and Price Books API

> Contract status: source-verified backend contract; replacement frontend not implemented
> Verification date: 2026-07-25
> Backend owner: Trade
> Documentation: source-generated from verified Gateway routes, Trade controllers/DTOs/services/tests, and legacy frontend evidence
> Canonical browser prefix: `/api/tenant/trade/v1`
> Controller-relative prefixes: `/trade/price-books`, `/trade/price-book-versions`, `/trade/pricing/evaluate`, `/trade/configuration/company-default-price-books`
> Tenant Portal status: `tenant-portal` replaces the legacy tenant Trade UI; Legacy `mutakamel-web-app` has live pricing management/evaluation clients and UI. The replacement `tenant-portal` is not implemented.

## Capability

Price-book definitions/versions, company defaults, test/publish lifecycle, and contextual price evaluation.

- Controller feature requirement: none declared; Trade module entitlement, seat, permission, and scope still apply.
- Gateway routes assigned to this page: **10**.
- These are browser contracts. The Trade upstream remains `/api/v1/trade/...`; the browser must use the canonical prefix above.

## Source evidence

Backend source references below are relative to `C:\mutakamel.ai\frontend`.

- `../backend/mutakamel-apps/api-gateway-app/src/routing-proxy/route-contracts/trade.route-contracts.ts`
- `../backend/mutakamel-apps/trade-app/src/modules/pricing/pricing.controller.ts`
- `../backend/mutakamel-apps/trade-app/src/modules/pricing/pricing-read.controller.ts`
- `../backend/mutakamel-apps/trade-app/src/modules/pricing/dto/pricing.dto.ts`
- `../backend/mutakamel-apps/trade-app/src/modules/pricing/pricing.service.ts`
- `../backend/mutakamel-apps/trade-app/src/modules/pricing/pricing-read-projection.service.ts`
- `../backend/mutakamel-apps/trade-app/src/modules/pricing/pricing.service.spec.ts`
- `../backend/mutakamel-apps/mutakamel-web-app/src/features/tenant/trade/trade-management-api.ts`
- `../backend/mutakamel-apps/mutakamel-web-app/src/features/tenant/trade/pricing-management-section.tsx`

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
| GET | `/api/tenant/trade/v1/configuration/company-default-price-books/:purpose/:currencyCode` | `/trade/configuration/company-default-price-books/:purpose/:currencyCode` | `trade.configuration.read` | `COMPANY` | — | — | 200 | `AUTHENTICATED`; gateway-idempotent=true |
| POST | `/api/tenant/trade/v1/configuration/company-default-price-books/:purpose/:currencyCode/upsert` | `/trade/configuration/company-default-price-books/:purpose/:currencyCode/upsert` | `trade.configuration.manage` | `COMPANY` | `body: UpsertCompanyDefaultPriceBookDto` | `X-Idempotency-Key`, `If-Match` | 200 or 201 | `WRITE_SENSITIVE`; gateway-idempotent=true |
| DELETE | `/api/tenant/trade/v1/configuration/company-default-price-books/:purpose/:currencyCode` | `/trade/configuration/company-default-price-books/:purpose/:currencyCode` | `trade.configuration.manage` | `COMPANY` | — | `X-Idempotency-Key`, `If-Match` | 200 | `WRITE_SENSITIVE`; gateway-idempotent=true |
| GET | `/api/tenant/trade/v1/price-books` | `/trade/price-books` | `trade.pricing.read` | `COMPANY` | `query: PriceBookListQueryDto` | — | 200 | `AUTHENTICATED`; gateway-idempotent=true |
| POST | `/api/tenant/trade/v1/price-books` | `/trade/price-books` | `trade.pricing.manage` | `COMPANY` | `body: CreatePriceBookDto` | `X-Idempotency-Key` | 201 | `WRITE_SENSITIVE`; gateway-idempotent=true |
| POST | `/api/tenant/trade/v1/price-books/:id/versions` | `/trade/price-books/:id/versions` | `trade.pricing.manage` | `COMPANY` | `body: CreatePriceBookVersionDto` | `X-Idempotency-Key`, `If-Match` | 201 | `WRITE_SENSITIVE`; gateway-idempotent=true |
| GET | `/api/tenant/trade/v1/price-book-versions/:id` | `/trade/price-book-versions/:id` | `trade.pricing.read` | `COMPANY` | — | — | 200 | `AUTHENTICATED`; gateway-idempotent=true |
| POST | `/api/tenant/trade/v1/price-book-versions/:id/test` | `/trade/price-book-versions/:id/test` | `trade.pricing.manage` | `COMPANY` | — | `X-Idempotency-Key`, `If-Match` | 200 | `WRITE_SENSITIVE`; gateway-idempotent=true |
| POST | `/api/tenant/trade/v1/price-book-versions/:id/publish` | `/trade/price-book-versions/:id/publish` | `trade.policy.publish` | `COMPANY` | — | `X-Idempotency-Key`, `If-Match` | 200 | `WRITE_SENSITIVE`; gateway-idempotent=true |
| POST | `/api/tenant/trade/v1/pricing/evaluate` | `/trade/pricing/evaluate` | `trade.pricing.read` | `COMPANY_OR_BRANCH` | `body: PricingEvaluateDto` | — | 200 | `READ_HEAVY`; gateway-idempotent=true |

`gateway-idempotent` is Gateway transport metadata. `X-Idempotency-Key` in the header column is the independent Trade domain replay contract.

## Validation and enum wire values

The global validation pipe transforms primitive query values, whitelists declared fields, rejects unknown fields, accumulates validation failures, and returns `TRADE.VALIDATION_FAILED`. Exact property decorators are in [validation-reference.md](validation-reference.md).

- Purpose is enum validated; currency is exactly three uppercase letters; IDs are UUIDv7. Prices/quantities are decimal strings with up to 8 fractional digits.
- A version requires 1-10,000 entries and at most 500 promotions. Effective timestamps are strict ISO-8601; the service enforces non-overlap and effective ordering.
- Promotion benefit type and targeting fields are validated; registry/service checks cross-field meaning, currency, UOM and scope.

- Purpose: `SALES`, `PURCHASE`. Promotion benefit: `PERCENTAGE`, `FIXED_AMOUNT`.
- Price-book/version status query is a string at transport level; handle service-returned values and unknown future values.

## Response, errors, security, idempotency and async behavior

- Normal non-204 success: `{ success: true, data, correlationId, timestamp }`. A versioned object also sets `ETag: "<version>"`; a domain replay sets `Idempotency-Replayed`. A 204 has no body.
- A required idempotency key is a UUIDv7. Reusing it with a different canonical request returns an idempotency mismatch; an in-flight duplicate conflicts. A required `If-Match` accepts a positive quoted integer ETag unless the route explicitly documents create sentinel `"0"`.
- Common failures: 400 validation/missing precondition; 401 absent, stale or invalidated tenant session; 403 missing seat/entitlement/feature/permission; 404 missing scoped resource; 409 stale aggregate or in-flight duplicate; 422 semantic/scope/idempotency mismatch; 503 entitlement or dependency unavailable. Gateway-originated failures use Problem Details. Trade-originated validation, guard, and domain errors remain raw Nest exception bodies and are passed through unchanged by the Gateway; successes use the envelope above.
- Domain error codes observed in the owning module: `TRADE.APPROVAL.MAKER_CHECKER_REQUIRED`, `TRADE.AUTH.TARGET_DENIED`, `TRADE.CONCURRENCY.STALE_VERSION`, `TRADE.CONFIGURATION.DEFAULT_PRICE_BOOK_INCOMPATIBLE`, `TRADE.CONFIGURATION.DEFAULT_PRICE_BOOK_NOT_FOUND`, `TRADE.PRICE.AMBIGUOUS_RULES`, `TRADE.PRICE.BOOK_ALREADY_EXISTS`, `TRADE.PRICE.BOOK_INVALID`, `TRADE.PRICE.BOOK_NOT_FOUND`, `TRADE.PRICE.ENTRY_INVALID`, `TRADE.PRICE.LOCK_CONTEXT_MISMATCH`, `TRADE.PRICE.LOCK_EXPIRED`, `TRADE.PRICE.LOCK_INVALID`, `TRADE.PRICE.NO_ELIGIBLE_PRICE`, `TRADE.PRICE.PUBLISH_NOT_ALLOWED`, `TRADE.PRICE.RULE_INVALID`, `TRADE.PRICE.TEST_FAILED`, `TRADE.PRICE.TEST_NOT_ALLOWED`, `TRADE.PRICE.TIER_OVERLAP`, `TRADE.PRICE.VERSION_OVERLAP`.

- Price-book management is company-scoped. Evaluation accepts company or branch scope and is a synchronous read-heavy POST without a domain idempotency header.
- Company-default upsert uses `If-Match: "0"` only to assert no mapping exists; existing mappings require their positive ETag. It returns 201 on create or 200 on replace.
- Publishing a price-book version requires `trade.policy.publish`. All management writes require UUIDv7 idempotency.

## Safe example

Use the tenant portal's authenticated same-origin API client; it owns the session/cookie behavior. This read example contains only browser-authorized scope headers:

```ts
const result = await tenantTradeApi.request(
  "/api/tenant/trade/v1/configuration/company-default-price-books/019f98a0-1234-7abc-8def-1234567890ab/019f98a0-1234-7abc-8def-1234567890ab",
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

- There is no routed price-lock endpoint in the Gateway contract even though an internal `price-lock.service.ts` exists. Do not expose it from Tenant Portal.
- Never infer writable fields from response entities. Use only the DTO named in the route table.
- Never call Trade directly from the browser and never call Worker. Use the canonical Gateway path.
- See [examples.md](examples.md) for safe request patterns and [route-coverage.md](route-coverage.md) for the complete 226-route assignment.
