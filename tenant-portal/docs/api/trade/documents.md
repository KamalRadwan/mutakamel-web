# Trade Quotations and Sales Orders API

> Contract status: source-verified backend contract; replacement frontend not implemented
> Verification date: 2026-07-25
> Backend owner: Trade
> Documentation: source-generated from verified Gateway routes, Trade controllers/DTOs/services/tests, and dated historical frontend evidence
> Canonical browser prefix: `/api/tenant/trade/v1`
> Controller-relative prefixes: `/trade/quotations`, `/trade/sales-orders`
> Tenant Portal status: The standalone `tenant-portal` replacement is not implemented. The consolidated `mutakamel-web-app` references below are dated 2026-07-25 historical evidence; that workspace is absent from the current checkout and does not prove a live frontend.

## Capability

Quotation authoring/revisions/transitions/conversion and sales-order authoring, confirmation orchestration, holds, and cancellation.

- Controller feature requirement: none declared; Trade module entitlement, seat, permission, and branch scope still apply.
- Gateway routes assigned to this page: **22**.
- These are browser contracts. The Trade upstream remains `/api/v1/trade/...`; the browser must use the canonical prefix above.

## Source evidence

Current backend source references below are relative to
`C:\mutakamel.ai\frontend`. Consolidated frontend paths are explicitly dated
historical references; their absent workspace is not current runtime evidence.

- `../backend/mutakamel-apps/api-gateway-app/src/routing-proxy/route-contracts/trade.route-contracts.ts`
- `../backend/mutakamel-apps/trade-app/src/modules/documents/documents.controller.ts`
- `../backend/mutakamel-apps/trade-app/src/modules/documents/dto/documents.dto.ts`
- `../backend/mutakamel-apps/trade-app/src/modules/documents/documents.service.ts`
- `../backend/mutakamel-apps/trade-app/src/modules/documents/sales-order-confirmation-results.service.ts`
- `../backend/mutakamel-apps/trade-app/src/modules/documents/documents.service.spec.ts`
- `../backend/mutakamel-apps/mutakamel-web-app/src/features/tenant/trade/trade-operations-api.ts`
- `../backend/mutakamel-apps/mutakamel-web-app/src/features/tenant/trade/quotations-operations-section.tsx`
- `../backend/mutakamel-apps/mutakamel-web-app/src/features/tenant/trade/sales-orders-operations-section.tsx`

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
| GET | `/api/tenant/trade/v1/quotations` | `/trade/quotations` | `trade.quotations.read` | `BRANCH` | `query: DocumentListQueryDto` | — | 200 | `AUTHENTICATED`; gateway-idempotent=true |
| POST | `/api/tenant/trade/v1/quotations/search` | `/trade/quotations/search` | `trade.quotations.read` | `BRANCH` | `body: DocumentListQueryDto` | — | 200 | `READ_HEAVY`; gateway-idempotent=true |
| GET | `/api/tenant/trade/v1/quotations/customer-options` | `/trade/quotations/customer-options` | `trade.quotations.create` | `BRANCH` | `query: QuotationCustomerOptionsQueryDto` | — | 200 | `READ_HEAVY`; gateway-idempotent=true |
| GET | `/api/tenant/trade/v1/quotations/:id` | `/trade/quotations/:id` | `trade.quotations.read` | `BRANCH` | — | — | 200 | `AUTHENTICATED`; gateway-idempotent=true |
| POST | `/api/tenant/trade/v1/quotations` | `/trade/quotations` | `trade.quotations.create` | `BRANCH` | `body: CreateQuotationDto` | `X-Idempotency-Key` | 201 | `WRITE_SENSITIVE`; gateway-idempotent=true |
| PATCH | `/api/tenant/trade/v1/quotations/:id` | `/trade/quotations/:id` | `trade.quotations.update` | `BRANCH` | `body: UpdateQuotationDto` | `X-Idempotency-Key`, `If-Match` | 200 | `WRITE_SENSITIVE`; gateway-idempotent=true |
| POST | `/api/tenant/trade/v1/quotations/:id/revisions` | `/trade/quotations/:id/revisions` | `trade.quotations.update` | `BRANCH` | `body: CreateQuotationRevisionDto` | `X-Idempotency-Key`, `If-Match` | 201 | `WRITE_SENSITIVE`; gateway-idempotent=true |
| POST | `/api/tenant/trade/v1/quotations/:id/send` | `/trade/quotations/:id/send` | `trade.quotations.send` | `BRANCH` | — | `X-Idempotency-Key`, `If-Match` | 200 | `WRITE_SENSITIVE`; gateway-idempotent=true |
| POST | `/api/tenant/trade/v1/quotations/:id/accept` | `/trade/quotations/:id/accept` | `trade.quotations.accept` | `BRANCH` | — | `X-Idempotency-Key`, `If-Match` | 200 | `WRITE_SENSITIVE`; gateway-idempotent=true |
| POST | `/api/tenant/trade/v1/quotations/:id/reject` | `/trade/quotations/:id/reject` | `trade.quotations.reject` | `BRANCH` | `body: DocumentReasonDto` | `X-Idempotency-Key`, `If-Match` | 200 | `WRITE_SENSITIVE`; gateway-idempotent=true |
| POST | `/api/tenant/trade/v1/quotations/:id/cancel` | `/trade/quotations/:id/cancel` | `trade.quotations.cancel` | `BRANCH` | `body: DocumentReasonDto` | `X-Idempotency-Key`, `If-Match` | 200 | `WRITE_SENSITIVE`; gateway-idempotent=true |
| POST | `/api/tenant/trade/v1/quotations/:id/convert-to-sales-order` | `/trade/quotations/:id/convert-to-sales-order` | `trade.quotations.convert` | `BRANCH` | `body: ConvertQuotationDto` | `X-Idempotency-Key`, `If-Match` | 201 | `WRITE_SENSITIVE`; gateway-idempotent=true |
| GET | `/api/tenant/trade/v1/sales-orders` | `/trade/sales-orders` | `trade.sales_orders.read` | `BRANCH` | `query: DocumentListQueryDto` | — | 200 | `AUTHENTICATED`; gateway-idempotent=true |
| POST | `/api/tenant/trade/v1/sales-orders` | `/trade/sales-orders` | `trade.sales_orders.create` | `BRANCH` | `body: CreateSalesOrderDto` | `X-Idempotency-Key` | 201 | `WRITE_SENSITIVE`; gateway-idempotent=true |
| GET | `/api/tenant/trade/v1/sales-orders/:id` | `/trade/sales-orders/:id` | `trade.sales_orders.read` | `BRANCH` | — | — | 200 | `AUTHENTICATED`; gateway-idempotent=true |
| PATCH | `/api/tenant/trade/v1/sales-orders/:id` | `/trade/sales-orders/:id` | `trade.sales_orders.update` | `BRANCH` | `body: UpdateSalesOrderDto` | `X-Idempotency-Key`, `If-Match` | 200 | `WRITE_SENSITIVE`; gateway-idempotent=true |
| POST | `/api/tenant/trade/v1/sales-orders/:id/confirm` | `/trade/sales-orders/:id/confirm` | `trade.sales_orders.confirm` | `BRANCH` | `body: ConfirmSalesOrderDto` | `X-Idempotency-Key`, `If-Match` | 200 or 202 | `WRITE_SENSITIVE`; gateway-idempotent=true |
| GET | `/api/tenant/trade/v1/sales-orders/:id/confirmation-attempts/:attemptId` | `/trade/sales-orders/:id/confirmation-attempts/:attemptId` | `trade.sales_orders.read` | `BRANCH` | — | — | 200 | `AUTHENTICATED`; gateway-idempotent=true |
| POST | `/api/tenant/trade/v1/sales-orders/:id/confirmation-attempts/:attemptId/cancel` | `/trade/sales-orders/:id/confirmation-attempts/:attemptId/cancel` | `trade.sales_orders.confirm` | `BRANCH` | `body: DocumentReasonDto` | `X-Idempotency-Key`, `If-Match` | 200 | `WRITE_SENSITIVE`; gateway-idempotent=true |
| POST | `/api/tenant/trade/v1/sales-orders/:id/hold` | `/trade/sales-orders/:id/hold` | `trade.sales_orders.hold` | `BRANCH` | `body: DocumentReasonDto` | `X-Idempotency-Key`, `If-Match` | 200 | `WRITE_SENSITIVE`; gateway-idempotent=true |
| POST | `/api/tenant/trade/v1/sales-orders/:id/release-hold` | `/trade/sales-orders/:id/release-hold` | `trade.sales_orders.hold` | `BRANCH` | `body: DocumentReasonDto` | `X-Idempotency-Key`, `If-Match` | 200 | `WRITE_SENSITIVE`; gateway-idempotent=true |
| POST | `/api/tenant/trade/v1/sales-orders/:id/cancel` | `/trade/sales-orders/:id/cancel` | `trade.sales_orders.cancel` | `BRANCH` | `body: DocumentReasonDto` | `X-Idempotency-Key`, `If-Match` | 200 | `WRITE_SENSITIVE`; gateway-idempotent=true |

`gateway-idempotent` is Gateway transport metadata. `X-Idempotency-Key` in the header column is the independent Trade domain replay contract.

## Validation and enum wire values

The global validation pipe transforms primitive query values, whitelists declared fields, rejects unknown fields, accumulates validation failures, and returns `TRADE.VALIDATION_FAILED`. Exact property decorators are in [validation-reference.md](validation-reference.md).

- Document/line/party/UOM references use UUIDv7. Currency is three uppercase letters. Quantities and money are decimal strings with at most 8 fractional digits.
- Sales-order creation and quotation conversion require explicit nested legal financial evidence and totals; the server does not reconstruct it from current pricing or PDF state.
- Revision and order lines are bounded to 1,000. Quotation validity and requested deadlines use strict ISO-8601.
- `DocumentListQueryDto.status` is not enum-constrained; lifecycle transition services remain authoritative.

- Shared lifecycle projections include document `DRAFT`, `CONFIRMED`, `CANCELLED`, `CLOSED`; approval, confirmation, fulfillment, billing, and settlement enums are in `static-data.md`.
- Quotation-specific transition values are service-owned and not exposed as a request enum.

## Response, errors, security, idempotency and async behavior

- Normal non-204 success: `{ success: true, data, correlationId, timestamp }`. A versioned object also sets `ETag: "<version>"`; a domain replay sets `Idempotency-Replayed`. A 204 has no body.
- A required idempotency key is a UUIDv7. Reusing it with a different canonical request returns an idempotency mismatch; an in-flight duplicate conflicts. A required `If-Match` accepts a positive quoted integer ETag unless the route explicitly documents create sentinel `"0"`.
- Common failures: 400 validation/missing precondition; 401 absent, stale or invalidated tenant session; 403 missing seat/entitlement/feature/permission; 404 missing scoped resource; 409 stale aggregate or in-flight duplicate; 422 semantic/scope/idempotency mismatch; 503 entitlement or dependency unavailable. Gateway-originated failures use Problem Details. Trade-originated validation, guard, and domain errors remain raw Nest exception bodies and are passed through unchanged by the Gateway; successes use the envelope above.
- Domain error codes observed in the owning module: `TRADE.BUSINESS_DOCUMENT.PDF_ARTIFACT_UNAVAILABLE`, `TRADE.BUSINESS_DOCUMENT.PDF_BUNDLE_UNAVAILABLE`, `TRADE.BUSINESS_DOCUMENT.PDF_INPUT_EXPIRED`, `TRADE.BUSINESS_DOCUMENT.PDF_NOT_FOUND`, `TRADE.BUSINESS_DOCUMENT.PDF_RENDER_FAILED`, `TRADE.BUSINESS_DOCUMENT.PDF_RESULT_CONFLICT`, `TRADE.BUSINESS_DOCUMENT.PDF_SOURCE_NOT_ELIGIBLE`, `TRADE.BUSINESS_DOCUMENT.PDF_TEMPLATE_INCOMPATIBLE`, `TRADE.CONCURRENCY.STALE_VERSION`, `TRADE.DEPENDENCY.TIMEOUT`, `TRADE.DOCUMENT_PROFILE.PUBLICATION_UNAVAILABLE`, `TRADE.FINALIZED_DOCUMENT.SNAPSHOT_INCOMPLETE`, `TRADE.IDEMPOTENCY.KEY_REQUIRED`, `TRADE.IDEMPOTENCY.MISMATCH`, `TRADE.INVENTORY.NODE_INVALID`, `TRADE.POLICY.DECISION_UNAVAILABLE`, `TRADE.PRICE.BOOK_REQUIRED`, `TRADE.PRICE.LOCK_INVALID`, `TRADE.PRICE.MARGIN_GUARD`, `TRADE.PURCHASE_ORDER.SUPPLIER_INVALID`, `TRADE.QUOTE.COMMERCIAL_ACCOUNT_BLOCKED`, `TRADE.QUOTE.CUSTOMER_ELIGIBILITY_UNAVAILABLE`, `TRADE.QUOTE.CUSTOMER_INVALID`, `TRADE.QUOTE.CUSTOMER_NOT_ELIGIBLE`, `TRADE.QUOTE.EXPIRED`, `TRADE.QUOTE.LINE_INVALID`, `TRADE.QUOTE.PDF_ARTIFACT_UNAVAILABLE`, `TRADE.QUOTE.PDF_BUNDLE_UNAVAILABLE`, `TRADE.QUOTE.PDF_INPUT_EXPIRED`, `TRADE.QUOTE.PDF_NOT_FOUND`, `TRADE.QUOTE.PDF_RENDER_FAILED`, `TRADE.QUOTE.PDF_RESULT_CONFLICT`, `TRADE.QUOTE.PDF_REVISION_NOT_ELIGIBLE`, `TRADE.QUOTE.PDF_TEMPLATE_INCOMPATIBLE`, `TRADE.QUOTE.TRANSITION_NOT_ALLOWED`, `TRADE.QUOTE.VALIDITY_INVALID`, `TRADE.SALES_ORDER.CANCEL_NOT_ALLOWED`, `TRADE.SALES_ORDER.CONFIRMATION_RESULT_INVALID`, `TRADE.SALES_ORDER.CONFIRM_NOT_ALLOWED`, `TRADE.SALES_ORDER.CUSTOMER_BLOCKED`, `TRADE.SALES_ORDER.HOLD_TRANSITION_INVALID`, `TRADE.SALES_ORDER.SOURCE_INVALID`.

- All commands require a UUIDv7 idempotency key; updates/transitions also require the current ETag in `If-Match`. All routes require branch scope.
- Sales-order confirm returns 200 when completed synchronously or 202 with canonical `Location` and `Retry-After: 2`; poll the confirmation-attempt GET and allow explicit cancellation of a pending attempt.
- PDF routes are intentionally documented in `pdf-render-jobs.md` and excluded from this page route count.

## Safe example

Use the tenant portal's authenticated same-origin API client; it owns the session/cookie behavior. This read example contains only browser-authorized scope headers:

```ts
const result = await tenantTradeApi.request(
  "/api/tenant/trade/v1/quotations/019f98a0-1234-7abc-8def-1234567890ab",
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

- Do not assume a fixed quotation status enum from the free-form list query. Do not treat a 202 confirmation as confirmed inventory.
- Never infer writable fields from response entities. Use only the DTO named in the route table.
- Never call Trade directly from the browser and never call Worker. Use the canonical Gateway path.
- See [examples.md](examples.md) for safe request patterns and [route-coverage.md](route-coverage.md) for the complete 226-route assignment.
