# Trade Business Document PDF Render Jobs API

> Contract status: source-verified backend contract; replacement frontend not implemented
> Verification date: 2026-07-25
> Backend owner: Trade
> Documentation: source-generated from verified Gateway routes, Trade controllers/DTOs/services/tests, and legacy frontend evidence
> Canonical browser prefix: `/api/tenant/trade/v1`
> Controller-relative prefixes: `/trade/quotations/:id/render-pdf`, `/trade/sales-orders/:id/render-pdf`, `/trade/purchase-orders/:id/render-pdf`, `/trade/purchase-quotations/:id/render-pdf`, `/trade/invoices/:id/render-pdf`, `/trade/contracts/:id/render-pdf`
> Tenant Portal status: The standalone `tenant-portal` replacement is not implemented. A dated 2026-07-25 consolidated-frontend inventory recorded quotation PDF create/poll but no dedicated clients for the other five families; that workspace is absent from the current checkout and does not prove a live frontend.

## Capability

Asynchronous PDF job creation and polling for quotations, sales orders, purchase orders, purchase quotations, invoices, and contracts.

- Controller feature requirement: none declared on the PDF controllers; family read permission, Trade module entitlement, seat, and branch scope still apply.
- Gateway routes assigned to this page: **12**.
- These are browser contracts. The Trade upstream remains `/api/v1/trade/...`; the browser must use the canonical prefix above.

## Source evidence

Backend source references below are relative to `C:\mutakamel.ai\frontend`.

- `../backend/mutakamel-apps/api-gateway-app/src/routing-proxy/route-contracts/trade.route-contracts.ts`
- `../backend/mutakamel-apps/trade-app/src/modules/documents/documents.controller.ts`
- `../backend/mutakamel-apps/trade-app/src/modules/purchasing/purchasing.controller.ts`
- `../backend/mutakamel-apps/trade-app/src/modules/documents/business-document-pdf/business-document-pdf.controller.ts`
- `../backend/mutakamel-apps/trade-app/src/modules/documents/quotation-pdf/quotation-pdf.dto.ts`
- `../backend/mutakamel-apps/trade-app/src/modules/documents/business-document-pdf/business-document-pdf.dto.ts`
- `../backend/mutakamel-apps/trade-app/src/modules/documents/quotation-pdf/quotation-pdf.service.ts`
- `../backend/mutakamel-apps/trade-app/src/modules/documents/business-document-pdf/business-document-pdf.service.ts`
- `../backend/mutakamel-apps/worker-app/src/modules/template-renderer/playwright-template-pdf-renderer.adapter.ts`
- `../backend/mutakamel-apps/mutakamel-web-app/src/features/tenant/trade/trade-operations-api.ts`

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
| POST | `/api/tenant/trade/v1/quotations/:quotationId/render-pdf` | `/trade/quotations/:quotationId/render-pdf` | `trade.quotations.read` | `BRANCH` | `body: RenderQuotationPdfDto` | `X-Idempotency-Key` | 202 | `WRITE_SENSITIVE`; gateway-idempotent=true |
| GET | `/api/tenant/trade/v1/quotations/:quotationId/render-jobs/:renderJobId` | `/trade/quotations/:quotationId/render-jobs/:renderJobId` | `trade.quotations.read` | `BRANCH` | — | — | 200 | `AUTHENTICATED`; gateway-idempotent=true |
| POST | `/api/tenant/trade/v1/sales-orders/:documentId/render-pdf` | `/trade/sales-orders/:documentId/render-pdf` | `trade.sales_orders.read` | `BRANCH` | `body: RenderTradeBusinessPdfDto` | `X-Idempotency-Key` | 202 | `WRITE_SENSITIVE`; gateway-idempotent=true |
| GET | `/api/tenant/trade/v1/sales-orders/:documentId/render-jobs/:renderJobId` | `/trade/sales-orders/:documentId/render-jobs/:renderJobId` | `trade.sales_orders.read` | `BRANCH` | — | — | 200 | `AUTHENTICATED`; gateway-idempotent=true |
| POST | `/api/tenant/trade/v1/purchase-orders/:documentId/render-pdf` | `/trade/purchase-orders/:documentId/render-pdf` | `trade.purchase_orders.read` | `BRANCH` | `body: RenderTradeBusinessPdfDto` | `X-Idempotency-Key` | 202 | `WRITE_SENSITIVE`; gateway-idempotent=true |
| GET | `/api/tenant/trade/v1/purchase-orders/:documentId/render-jobs/:renderJobId` | `/trade/purchase-orders/:documentId/render-jobs/:renderJobId` | `trade.purchase_orders.read` | `BRANCH` | — | — | 200 | `AUTHENTICATED`; gateway-idempotent=true |
| POST | `/api/tenant/trade/v1/purchase-quotations/:documentId/render-pdf` | `/trade/purchase-quotations/:documentId/render-pdf` | `trade.purchase_quotations.read` | `BRANCH` | `body: RenderTradeBusinessPdfDto` | `X-Idempotency-Key` | 202 | `WRITE_SENSITIVE`; gateway-idempotent=true |
| GET | `/api/tenant/trade/v1/purchase-quotations/:documentId/render-jobs/:renderJobId` | `/trade/purchase-quotations/:documentId/render-jobs/:renderJobId` | `trade.purchase_quotations.read` | `BRANCH` | — | — | 200 | `AUTHENTICATED`; gateway-idempotent=true |
| POST | `/api/tenant/trade/v1/invoices/:documentId/render-pdf` | `/trade/invoices/:documentId/render-pdf` | `trade.invoices.read` | `BRANCH` | `body: RenderTradeBusinessPdfDto` | `X-Idempotency-Key` | 202 | `WRITE_SENSITIVE`; gateway-idempotent=true |
| GET | `/api/tenant/trade/v1/invoices/:documentId/render-jobs/:renderJobId` | `/trade/invoices/:documentId/render-jobs/:renderJobId` | `trade.invoices.read` | `BRANCH` | — | — | 200 | `AUTHENTICATED`; gateway-idempotent=true |
| POST | `/api/tenant/trade/v1/contracts/:documentId/render-pdf` | `/trade/contracts/:documentId/render-pdf` | `trade.contracts.read` | `BRANCH` | `body: RenderTradeBusinessPdfDto` | `X-Idempotency-Key` | 202 | `WRITE_SENSITIVE`; gateway-idempotent=true |
| GET | `/api/tenant/trade/v1/contracts/:documentId/render-jobs/:renderJobId` | `/trade/contracts/:documentId/render-jobs/:renderJobId` | `trade.contracts.read` | `BRANCH` | — | — | 200 | `AUTHENTICATED`; gateway-idempotent=true |

`gateway-idempotent` is Gateway transport metadata. `X-Idempotency-Key` in the header column is the independent Trade domain replay contract.

## Validation and enum wire values

The global validation pipe transforms primitive query values, whitelists declared fields, rejects unknown fields, accumulates validation failures, and returns `TRADE.VALIDATION_FAILED`. Exact property decorators are in [validation-reference.md](validation-reference.md).

- Document and render-job IDs use UUIDv7. Quotation render body uses `CUSTOMER_QUOTATION`; generic body document type accepts `SUPPLIER_QUOTATION`, `SALES_ORDER`, `PURCHASE_ORDER`, `INVOICE`, `CONTRACT`.
- Template/version/language fields are validated by the DTO and services; finalized-source eligibility and immutable snapshot compatibility are server checks.

- Quotation render type: `CUSTOMER_QUOTATION`. Generic render type: `SUPPLIER_QUOTATION`, `SALES_ORDER`, `PURCHASE_ORDER`, `INVOICE`, `CONTRACT`.
- Job status is a service response contract; clients must tolerate pending, completed and terminal failure values rather than inventing a request enum.

## Response, errors, security, idempotency and async behavior

- Normal non-204 success: `{ success: true, data, correlationId, timestamp }`. A versioned object also sets `ETag: "<version>"`; a domain replay sets `Idempotency-Replayed`. A 204 has no body.
- A required idempotency key is a UUIDv7. Reusing it with a different canonical request returns an idempotency mismatch; an in-flight duplicate conflicts. A required `If-Match` accepts a positive quoted integer ETag unless the route explicitly documents create sentinel `"0"`.
- Common failures: 400 validation/missing precondition; 401 absent, stale or invalidated tenant session; 403 missing seat/entitlement/feature/permission; 404 missing scoped resource; 409 stale aggregate or in-flight duplicate; 422 semantic/scope/idempotency mismatch; 503 entitlement or dependency unavailable. Gateway-originated failures use Problem Details. Trade-originated validation, guard, and domain errors remain raw Nest exception bodies and are passed through unchanged by the Gateway; successes use the envelope above.
- Domain error codes observed in the owning module: `TRADE.BUSINESS_DOCUMENT.PDF_ARTIFACT_UNAVAILABLE`, `TRADE.BUSINESS_DOCUMENT.PDF_BUNDLE_UNAVAILABLE`, `TRADE.BUSINESS_DOCUMENT.PDF_INPUT_EXPIRED`, `TRADE.BUSINESS_DOCUMENT.PDF_NOT_FOUND`, `TRADE.BUSINESS_DOCUMENT.PDF_RENDER_FAILED`, `TRADE.BUSINESS_DOCUMENT.PDF_RESULT_CONFLICT`, `TRADE.BUSINESS_DOCUMENT.PDF_SOURCE_NOT_ELIGIBLE`, `TRADE.BUSINESS_DOCUMENT.PDF_TEMPLATE_INCOMPATIBLE`, `TRADE.CONCURRENCY.STALE_VERSION`, `TRADE.DEPENDENCY.TIMEOUT`, `TRADE.DOCUMENT_PROFILE.PUBLICATION_UNAVAILABLE`, `TRADE.FINALIZED_DOCUMENT.SNAPSHOT_INCOMPLETE`, `TRADE.IDEMPOTENCY.KEY_REQUIRED`, `TRADE.IDEMPOTENCY.MISMATCH`, `TRADE.INVENTORY.NODE_INVALID`, `TRADE.POLICY.DECISION_UNAVAILABLE`, `TRADE.PRICE.BOOK_REQUIRED`, `TRADE.PRICE.LOCK_INVALID`, `TRADE.PRICE.MARGIN_GUARD`, `TRADE.PURCHASE_ORDER.SUPPLIER_INVALID`, `TRADE.QUOTE.COMMERCIAL_ACCOUNT_BLOCKED`, `TRADE.QUOTE.CUSTOMER_ELIGIBILITY_UNAVAILABLE`, `TRADE.QUOTE.CUSTOMER_INVALID`, `TRADE.QUOTE.CUSTOMER_NOT_ELIGIBLE`, `TRADE.QUOTE.EXPIRED`, `TRADE.QUOTE.LINE_INVALID`, `TRADE.QUOTE.PDF_ARTIFACT_UNAVAILABLE`, `TRADE.QUOTE.PDF_BUNDLE_UNAVAILABLE`, `TRADE.QUOTE.PDF_INPUT_EXPIRED`, `TRADE.QUOTE.PDF_NOT_FOUND`, `TRADE.QUOTE.PDF_RENDER_FAILED`, `TRADE.QUOTE.PDF_RESULT_CONFLICT`, `TRADE.QUOTE.PDF_REVISION_NOT_ELIGIBLE`, `TRADE.QUOTE.PDF_TEMPLATE_INCOMPATIBLE`, `TRADE.QUOTE.TRANSITION_NOT_ALLOWED`, `TRADE.QUOTE.VALIDITY_INVALID`, `TRADE.SALES_ORDER.CANCEL_NOT_ALLOWED`, `TRADE.SALES_ORDER.CONFIRMATION_RESULT_INVALID`, `TRADE.SALES_ORDER.CONFIRM_NOT_ALLOWED`, `TRADE.SALES_ORDER.CUSTOMER_BLOCKED`, `TRADE.SALES_ORDER.HOLD_TRANSITION_INVALID`, `TRADE.SALES_ORDER.SOURCE_INVALID`.

- Create returns 202 with canonical `Location` and `Retry-After`; poll only that job URL. Gateway rewrites upstream legacy Location values to `/api/tenant/trade/v1/...`.
- Create requires UUIDv7 idempotency. Gateway transport retry is `NEVER`; poll GET is safe on transport failure. The job is Worker-rendered; 202 is acceptance only.
- Completed responses may expose a time-limited private artifact URL. Do not log, persist, proxy-cache, or place it in analytics.

## Safe example

Use the tenant portal's authenticated same-origin API client; it owns the session/cookie behavior. This read example contains only browser-authorized scope headers:

```ts
const result = await tenantTradeApi.request(
  "/api/tenant/trade/v1/quotations/019f98a0-1234-7abc-8def-1234567890ab/render-jobs/019f98a0-1234-7abc-8def-1234567890ab",
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

- The generic controller DTO includes an explicit `documentType`; callers must send the value matching the route family. Service mismatch is rejected.
- Never infer writable fields from response entities. Use only the DTO named in the route table.
- Never call Trade directly from the browser and never call Worker. Use the canonical Gateway path.
- See [examples.md](examples.md) for safe request patterns and [route-coverage.md](route-coverage.md) for the complete 226-route assignment.
