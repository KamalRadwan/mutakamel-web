# Trade Purchase Quotations API

> Contract status: source-verified backend contract; replacement frontend not implemented
> Verification date: 2026-07-25
> Backend owner: Trade
> Documentation: source-generated from verified Gateway routes, Trade controllers/DTOs/services/tests, and legacy frontend evidence
> Canonical browser prefix: `/api/tenant/trade/v1`
> Controller-relative prefixes: `/trade/purchase-quotations`
> Tenant Portal status: `tenant-portal` replaces the legacy tenant Trade UI; No dedicated purchase-quotation client or screen was found in the legacy Trade frontend. The replacement `tenant-portal` is not implemented.

## Capability

Supplier quotation/RFQ draft listing, search, creation, mutation, issuance, and PDF linkage.

- Controller feature requirement: none declared; Trade module entitlement, seat, permission, and branch scope still apply.
- Gateway routes assigned to this page: **6**.
- These are browser contracts. The Trade upstream remains `/api/v1/trade/...`; the browser must use the canonical prefix above.

## Source evidence

Backend source references below are relative to `C:\mutakamel.ai\frontend`.

- `../backend/mutakamel-apps/api-gateway-app/src/routing-proxy/route-contracts/trade.route-contracts.ts`
- `../backend/mutakamel-apps/trade-app/src/modules/purchase-quotations/purchase-quotations.controller.ts`
- `../backend/mutakamel-apps/trade-app/src/modules/purchase-quotations/dto/purchase-quotation.dto.ts`
- `../backend/mutakamel-apps/trade-app/src/modules/purchase-quotations/purchase-quotations.service.ts`
- `../backend/mutakamel-apps/trade-app/src/modules/purchase-quotations/purchase-quotations.controller.spec.ts`
- `../backend/mutakamel-apps/trade-app/src/modules/purchase-quotations/purchase-quotations.service.spec.ts`

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
| GET | `/api/tenant/trade/v1/purchase-quotations` | `/trade/purchase-quotations` | `trade.purchase_quotations.read` | `BRANCH` | `query: DocumentListQueryDto` | — | 200 | `AUTHENTICATED`; gateway-idempotent=true |
| POST | `/api/tenant/trade/v1/purchase-quotations/search` | `/trade/purchase-quotations/search` | `trade.purchase_quotations.read` | `BRANCH` | `body: DocumentListQueryDto` | — | 200 | `AUTHENTICATED`; gateway-idempotent=true |
| POST | `/api/tenant/trade/v1/purchase-quotations` | `/trade/purchase-quotations` | `trade.purchase_quotations.create` | `BRANCH` | `body: CreatePurchaseQuotationDto` | `X-Idempotency-Key` | 201 | `WRITE_SENSITIVE`; gateway-idempotent=true |
| GET | `/api/tenant/trade/v1/purchase-quotations/:id` | `/trade/purchase-quotations/:id` | `trade.purchase_quotations.read` | `BRANCH` | — | — | 200 | `AUTHENTICATED`; gateway-idempotent=true |
| PATCH | `/api/tenant/trade/v1/purchase-quotations/:id` | `/trade/purchase-quotations/:id` | `trade.purchase_quotations.update` | `BRANCH` | `body: UpdatePurchaseQuotationDto` | `X-Idempotency-Key`, `If-Match` | 200 | `WRITE_SENSITIVE`; gateway-idempotent=true |
| POST | `/api/tenant/trade/v1/purchase-quotations/:id/issue` | `/trade/purchase-quotations/:id/issue` | `trade.purchase_quotations.issue` | `BRANCH` | — | `X-Idempotency-Key`, `If-Match` | 200 | `WRITE_SENSITIVE`; gateway-idempotent=true |

`gateway-idempotent` is Gateway transport metadata. `X-Idempotency-Key` in the header column is the independent Trade domain replay contract.

## Validation and enum wire values

The global validation pipe transforms primitive query values, whitelists declared fields, rejects unknown fields, accumulates validation failures, and returns `TRADE.VALIDATION_FAILED`. Exact property decorators are in [validation-reference.md](validation-reference.md).

- Supplier/item/UOM/line IDs are UUIDv7. Currency is three uppercase letters. Quantities and unit prices are decimal strings.
- Create/update line arrays and strict validity dates are defined in the DTO; exact validators are in `validation-reference.md`.
- Search uses `DocumentListQueryDto` in the request body and the Gateway class is `AUTHENTICATED`, not `READ_HEAVY`.

- List/search status is a free-form string at transport validation. Issued/draft transition values are service-owned.

## Response, errors, security, idempotency and async behavior

- Normal non-204 success: `{ success: true, data, correlationId, timestamp }`. A versioned object also sets `ETag: "<version>"`; a domain replay sets `Idempotency-Replayed`. A 204 has no body.
- A required idempotency key is a UUIDv7. Reusing it with a different canonical request returns an idempotency mismatch; an in-flight duplicate conflicts. A required `If-Match` accepts a positive quoted integer ETag unless the route explicitly documents create sentinel `"0"`.
- Common failures: 400 validation/missing precondition; 401 absent, stale or invalidated tenant session; 403 missing seat/entitlement/feature/permission; 404 missing scoped resource; 409 stale aggregate or in-flight duplicate; 422 semantic/scope/idempotency mismatch; 503 entitlement or dependency unavailable. Gateway-originated failures use Problem Details. Trade-originated validation, guard, and domain errors remain raw Nest exception bodies and are passed through unchanged by the Gateway; successes use the envelope above.
- Domain error codes observed in the owning module: `TRADE.CONCURRENCY.STALE_VERSION`, `TRADE.DEPENDENCY.TIMEOUT`, `TRADE.FINALIZED_DOCUMENT.SNAPSHOT_INCOMPLETE`, `TRADE.PURCHASE_QUOTATION.DRAFT_NOT_MUTABLE`, `TRADE.PURCHASE_QUOTATION.LINE_INVALID`, `TRADE.PURCHASE_QUOTATION.NOT_FOUND`, `TRADE.PURCHASE_QUOTATION.REPRICING_REQUIRED`, `TRADE.PURCHASE_QUOTATION.SUPPLIER_INVALID`, `TRADE.PURCHASE_QUOTATION.VALIDITY_INVALID`.

- All routes are branch-scoped. Create/update/issue require UUIDv7 idempotency; update/issue also require `If-Match`.
- Issue is synchronous and returns 200. PDF is asynchronous and documented separately.

## Safe example

Use the tenant portal's authenticated same-origin API client; it owns the session/cookie behavior. This read example contains only browser-authorized scope headers:

```ts
const result = await tenantTradeApi.request(
  "/api/tenant/trade/v1/purchase-quotations/019f98a0-1234-7abc-8def-1234567890ab",
  {
    method: "GET",
  headers: {
    "X-Mutakamel-Company-Id": "019f98a1-1234-7abc-8def-1234567890ab",
    "X-Mutakamel-Branch-Id": "019f98a2-1234-7abc-8def-1234567890ab"
  }
  },
);
```

Do not add `x-mutakamel-tenant-id`, `x-mutakamel-tenant-db-name`, or `x-internal-gateway-secret`. Replace illustrative UUIDv7 values with IDs from authorized Core/Trade projections.

## Ambiguities and AI rules

- Legacy frontend parity is absent. The term purchase quotation here is a supplier quotation aggregate; do not equate it with customer quotation routes.
- Never infer writable fields from response entities. Use only the DTO named in the route table.
- Never call Trade directly from the browser and never call Worker. Use the canonical Gateway path.
- See [examples.md](examples.md) for safe request patterns and [route-coverage.md](route-coverage.md) for the complete 226-route assignment.
