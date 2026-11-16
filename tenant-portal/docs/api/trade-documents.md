# Trade — Commercial Documents

Quotation discounts source-verified **2026-11-15**: create and revision editors
choose `NONE` (the editor default), `PROMOTIONS`, or `DISCOUNT`. `NONE` uses
baseline prices without promotional savings or manual discounts. Existing API
callers that omit pricing continue to use promotions. Manual intent supports
per-line percent/amount or document percent/amount, plus an optional reason
(240 characters). Modes are exclusive;
changing a non-empty mode/scope asks for confirmation. Quantity changes retain
the intent and request a new calculation. Currency changes clear fixed amounts
for explicit re-entry and retain percentage intent. Actor/customer/context
changes quarantine old pricing. The editor and saved detail show a document
discount as a final negative amount, while the server retains its allocation
across the real item lines.

`POST /api/tenant/trade/v1/quotations/pricing-preview` is the authoritative,
read-only calculation. It accepts `partyId`, optional `crmCustomerProfileId`,
`currencyCode`, `lines` (`clientLineId`, `itemId`, `uomId`, `quantity`, optional
`discount: { type, value }`) and `pricing`. `pricing` is `{ mode: "NONE" }`,
`{ mode: "PROMOTIONS" }`, `{ mode: "DISCOUNT", scope: "LINE", reason? }`, or
`{ mode: "DISCOUNT", scope: "DOCUMENT", type: "PERCENT" | "AMOUNT", value, reason? }`.
All monetary inputs remain decimal strings. The response supplies per-line
`subtotal`, `discountTotal`, `lineTotal`, base/source/net unit prices, effective
maximum discount, safe price-decision details, document totals and a fingerprint.
The portal validates identities and totals and hides evidence immediately when
the complete request, actor, permission generation or scope changes. Manual
pricing waits for the actor's configured policy. The policy payload retains
`reasonRequired` for historic pricing evidence. A missing reason is accepted
for both item and quotation discounts.

`GET /quotations/discount-policy` returns `hasApplyPermission`, `canApply`,
`canManage`, `configured` and a nullable active `limit`. Existing owner permission
semantics apply, but owners also need an explicitly configured actor limit.
The limits dialog reads the real Core user directory (`users.user.read`) and
uses `GET/POST /quotations/discount-limits` and
`PATCH /quotations/discount-limits/:id`; mutation uses `If-Match` and idempotency.
It edits maximum percent, free-item allowance and active
status. No default owner limit is invented. Directory denials, policy denials,
loading, missing configuration, conflicts and retryable failures are distinct.
Conflicts require a fresh read while retaining the administrator's edited intent.

Revision writes carry `pricing` and `expectedPricingFingerprint` together with
the original line quantities and discount intent. `TRADE.QUOTE.PRICING_CHANGED`
quarantines the old calculation and requires explicit recalculation/review.
Server floor, maximum, precision and free-item refusals block the old
preview and show safe maximum values when supplied. Unknown writes retain the
same idempotency key/body and lock editing until resolved. A new revision of a
`SENT` offer additionally requires send authority and explicit confirmation that
the previous offer is withdrawn; the old issued revision remains immutable and
the successful new revision is a draft under the same official number.

Rollout order for `NONE`: publish the matching Trade Database and Core
provisioning catalogue packages, deploy Trade and the migration worker on that
catalogue, and apply Trade tenant release `0.0.18`. Its migration widens the
revision pricing-mode check while preserving stored amounts and snapshots.
Rebuild the portal after the target workspace has that release and Trade
accepts `NONE` in pricing previews and revision writes.

Saved revisions expose `subtotal`, `discountTotal`, `pricingMode` and
`discountSnapshot`; lines expose saved `discountTotal` and `discountSnapshot`.
Manual financial totals obey `subtotal - discountTotal = grandTotal`. Promotion
unit prices already include promotion savings, so financial `discountTotal` is
zero; separate `baseSubtotal` and `promotionSavings` explain the reduction without
deducting it again. Net unit price is advisory and never multiplied back into
the line total. Conversion carries the accepted revision's exact discount
allocation once and prevents user changes. Existing tax/charge evidence remains
separate; quotation UI does not invent unsupported VAT calculations. Migrated
empty snapshots show the stored financial totals without inventing historic
promotion details. Lead-owned production rebuild and Playwright verification
follow the source and automated-test reviews.

Quotation list filters reviewed **2026-10-31** (REVIEW-M-5): the live list calls
Trade's `GET /api/tenant/trade/v1/quotations` with `page` (1..1,000,000),
`limit` (1..100, portal 25), optional single `status` (string, max 32),
`partyId` (UUIDv7), `search` (string, max 120) and `currencyCode` (three uppercase
letters). The advanced status filter sends the selected lifecycle status,
including `REJECTED`, `CANCELLED` and `EXPIRED`. Search and complete currency codes are
server filters; changing a filter resets page one. Partial currency input is
not sent. Search matches document number, draft reference, document ID and the
first non-blank Party snapshot display name (`displayName`, `name`, `legalName`)
case-insensitively, treating `%`, `_` and `!` literally. Trade applies all
filters before pagination and counting, retaining `{ items, total, page, limit }`.
The Gateway has no pinned list-query schema. Existing `trade.sales`,
`trade.quotations.read`, branch/company headers and error handling are unchanged;
invalid filters use the existing validation error. All views show server rows,
including an Expired board column. Header statistics for Total, Draft, Sent,
Accepted, Rejected, Cancelled and Expired were removed **2026-11-03**;
advanced status filtering remains available.
Regression specs added; execution and the tenant rebuild await lead verification.

Quotation board money reviewed **2026-10-31** (AUDIT29X-TPT-2): each column
sums the displayed quotations in its first quotation's currency with exact
fixed-decimal string arithmetic. Other currencies are excluded from that
column total. The Money formatter uses the currency's default fraction digits,
including three for KWD, OMR and BHD. Highest-total sorting compares all eight
decimal places exactly, including amounts beyond JavaScript's safe integer
range. Regression specs cover exact sums, currency formatting and large totals;
execution and the tenant production rebuild are pending lead verification.

Quotation composer handoff reviewed **2026-10-30** (AUDIT29V-TP-4): opening
the standalone composer from Fast Add stores its header draft in this tab's
session storage under `trade:quotation:composer-handoff:<actorId>`, using the
authenticated user's ID. The standalone composer reads only that actor's entry,
validates the complete draft and customer object with strict Zod schemas, and
removes the entry after the hydration attempt. Invalid JSON, malformed objects,
and the former unscoped entry are discarded. No handoff is read or written
without an actor. Local auth cleanup removes all quotation handoff entries,
including the former unscoped key; unavailable storage falls back to an empty
draft. Submission still validates business values and the backend remains
authoritative for customer eligibility. Regression specs added; typecheck/lint
and the tenant production rebuild are pending lead verification.

Invoice/contract entitlement source reviewed **2026-10-29** (AUDIT29C-TRADE-1):
all 15 routes, including PDF render/status, require `trade.sales`. Navigation
requires the same feature plus the document read permission, including owners.
These are manual commercial pro-forma invoices and agreements, without statutory
issuance or recurring execution. Runtime verification and portal rebuild pending.

Error contract reviewed **2026-10-18** (SHARED-I18N-DEAD-001): Trade uses
common's error envelope without an extra `lang` field. HTTP statuses are
preserved while former mixed-status codes are split. Numbering refusals use
`TRADE.DEPENDENCY.NUMBERING_UNAVAILABLE` (422); `TRADE.DEPENDENCY.TIMEOUT`
remains 503. Missing quotations use `TRADE.QUOTE.NOT_FOUND` (404), missing
sales-order sources use `TRADE.SALES_ORDER.SOURCE_NOT_FOUND` (404), and
commit-time template changes use `TRADE.QUOTE.PDF_TEMPLATE_CHANGED` or
`TRADE.BUSINESS_DOCUMENT.PDF_TEMPLATE_CHANGED` (409). Portal error mappings
resolve these codes in the selected locale. Runtime verification is pending.

Quotation revision duration validation reviewed **2026-10-18**: delivery days
and warranty months accept complete non-negative integer strings up to
`Number.MAX_SAFE_INTEGER` (9007199254740991). Outer whitespace is trimmed;
blank/whitespace-only values explicitly default to 14 days and 12 months.
Zero is preserved. Malformed, fractional, negative and unsafe values stay in
the fields with bilingual inline errors and block both Save and direct hook
submission. The drawer explains the blank defaults. `CreateQuotationRevisionDto`
accepts an object for `terms` without field-specific duration bounds; the portal's
upper bound prevents numeric precision loss. Regression specs are included;
execution is pending lead verification.

Status: **verified**

Last source verification: **2026-10-18** (shared portal scope; route contracts last verified while building Phase 11 on 2026-08-31)

### Shared portal scope

Action admission reviewed **2026-10-24** (AUD24-FE-TENANT-04): document
actions check `permissionScopes` with `can()` against the company and branch
sent in request headers. A create grant limited to branch A no longer enables
Create after selecting branch B, even when read access covers both branches.
Missing scope projections or unresolved selections disable actions. Tenant
owners retain their bypass once the selection is resolved. These checks are
advisory; the server still enforces exact-target grants.

Scoped detail isolation reviewed **2026-10-18** (CXPORTAL-TRADE-112): commercial
document details are keyed by resource, route ID, resolved scope headers and
signed-in user. A context change hides the previous document immediately;
refreshes clear actionable details until the current read succeeds. Superseded
requests, including manual reloads, are aborted and cannot commit late data,
errors or loading completion. Failed reads leave no stale document. All six
detail screens render an authoritative 403 through the bilingual permission
boundary before details or mutation controls; 404 remains the not-found state.
Regression specs cover failed refreshes, context changes and reversed responses;
execution is pending lead verification.

Scoped list isolation reviewed **2026-10-18** (CXTRADE-OPS-121): commercial
document list results are keyed by resolved scope headers, signed-in user,
resource and query. Changing scope immediately hides previous rows, totals
and errors and resets the page. Superseded requests, including manual and
realtime refreshes, are aborted and cannot commit late results. Failed reads
clear rows. Purchase-order table, cards and board share loading, explicit
403 denial, retryable error and empty boundaries. Regression specs cover
scope failures and reversed responses; execution is pending lead verification.

The Trade layout displays labelled company, branch and channel selectors on
document list and detail deep links, including the scope-required state. With
empty storage and multiple accessible scopes, choose the company and branch
there to load the document screen in place. Documents, pricing, inventory and
other advanced Trade screens share the route-group provider and its persisted
selection. Changing company clears the previous branch and channel. Existing
advanced branch actions update that same selection.

Choices remain limited to the authenticated user's accessible IDs; membership
pairings narrow branch options where available. The server still validates
company/branch ownership and exact-scope authorization. Company-target requests
omit the branch header, and tenant-target requests omit all scope headers.
Quotation customer pickers continue to show all branch customers (D-038).

Order form pricing re-verified **2026-10-17** against the Gateway pricing route,
`PricingController`, `PricingEvaluateDto`, `DocumentsService.priceLines`, and
`PurchasingService`. Sales and purchase orders evaluate each line through
`POST /api/tenant/trade/v1/pricing/evaluate` with the document's company/branch
headers, party, SALES/PURCHASE purpose, currency, item, UOM and quantity. This
requires the existing `trade.pricing.read` permission and `trade.pricing`
feature. Returned decimal-string prices are read-only; only current prices
can produce the displayed and submitted order evidence. Incomplete, pending
or failed pricing blocks order creation and hides financial totals, with
localized awaiting/unavailable feedback (including permission failures).
Changing a pricing input or closing the form invalidates prices immediately;
aborted or late responses cannot restore old evidence. Sales quotation revision
and purchase quotation editors use the same pricing lifecycle for their
previews; their DTOs still carry no unit price. Invoice prices and contract
financial totals remain authored values supported by their existing DTOs.

Draft preview consistency reviewed **2026-10-17** (CXPORTAL-TRADE-109):
`useTradeLineDraft` shares `useTradeDocumentPricing`'s request fingerprint,
including stable client line IDs, item, UOM, quantity, currency, party, purpose
and company/branch headers. Removing or replacing lines invalidates the old
request, so neither its success nor its error can attach to a reused position.
Party, currency and scope changes hide prices and the running total immediately
until the new evaluation settles. The server remains authoritative on save.
Focused regression specs cover reversed responses and context changes;
execution is pending lead verification.

Quotation conversion re-verified **2026-10-17** against the Gateway conversion
route, `QuotationsController`, `ConvertQuotationDto`,
`assertQuotationConversionEvidence`, and `validateNewOrderFinancialEvidence`.

Invoice/contract draft editing re-verified **2026-10-17** against the Gateway
update routes, `TradeInvoicesController`, `TradeContractsController`, their
create/update DTOs and `FinancialDocumentsService`. The portal has separate
create and update serializers: only create sends `partyId` and `currencyCode`;
both identity fields are read-only in the edit drawers. Updates remain full
atomic replacements and retain the existing `If-Match` and idempotency headers.

Quotation/sales-order list context re-verified **2026-09-14** against Gateway
route metadata, `RouteContextMiddleware`, `UpstreamClientService`,
`QuotationsController.list`, `SalesOrdersController.list`, and `TradeScopeGuard`.
Both list handlers require `TradeScopeTarget.BRANCH`: send
`x-mutakamel-company-id` and `x-mutakamel-branch-id`. Their Gateway rows are
legacy rows with no `organizationScopeMode`; the Gateway forwards these
selectors for owning-app validation. This differs from explicit `NONE`, which
forbids them. A `partyId` query filter never replaces the required context.
The Lead related-count hook now sends the same resolved context on all three
Trade counts and skips those reads until the company/branch pair is known.
Lead Card View uses the three `counts-by-party` POST reads instead of one list
request per Lead; these Gateway rows are explicitly `BRANCH_REQUIRED` and the
POSTs are read-only/replay-safe.

Owning app: **trade-app**

Canonical prefixes: `/api/tenant/trade/v1/quotations`, `.../sales-orders`,
`.../purchase-orders`, `.../purchase-quotations`, `.../invoices`,
`.../contracts`

Upstream: `/api/v1/trade/*`

Portal status: **source-integrated invoice and contract draft editing.**
MASTER-PLAN Phase 11 ships every list, detail and lifecycle action, both PDF
flows and the purchase-quotation create and edit. Invoice and contract create
and edit drawers are source-integrated; their request serialization and edit
hydration were reviewed on **2026-10-17**, with authenticated runtime
verification pending. Sales-order and purchase-order creation still need
their own evidence integration review (Q32, Q85).
Nine statements on this page were corrected against source while
building it — see [Q84](../build/OPEN-QUESTIONS.md#q84--nine-corrections-to-trade-documentsmd-verified-from-source).

**63 routes.** Quotations 15 · Sales orders 13 · Purchase orders 12 ·
Purchase quotations 8 · Invoices 8 · Contracts 7.

Together with [trade-foundation.md](trade-foundation.md) (42) and
[trade-advanced.md](trade-advanced.md) (129) this accounts for all
**234** Trade routes exactly once. 42 + 63 + 129 = 234.

Source inspected:
`trade-app/src/modules/documents/documents.controller.ts`,
`trade-app/src/modules/documents/documents.service.ts`,
`trade-app/src/modules/documents/dto/documents.dto.ts`,
`trade-app/src/modules/documents/order-print-snapshot.service.ts`,
`trade-app/src/modules/documents/quotation-pdf/quotation-pdf.controller.ts`,
`trade-app/src/modules/documents/quotation-pdf/quotation-pdf.dto.ts`,
`trade-app/src/modules/documents/quotation-pdf/quotation-pdf.service.ts`,
`trade-app/src/modules/documents/quotation-pdf/quotation-pdf.repository.ts`,
`trade-app/src/modules/documents/quotation-pdf/trade-template-pin-recheck.ts`,
`trade-app/src/modules/documents/business-document-pdf/business-document-pdf.controller.ts`,
`trade-app/src/modules/documents/business-document-pdf/business-document-pdf.dto.ts`,
`trade-app/src/modules/documents/business-document-pdf/business-document-pdf.service.ts`,
`trade-app/src/modules/documents/business-document-pdf/business-document-pdf.repository.ts`,
`trade-app/src/modules/purchasing/purchasing.controller.ts`,
`trade-app/src/modules/purchasing/purchasing.service.ts`,
`trade-app/src/modules/purchasing/dto/purchasing.dto.ts`,
`trade-app/src/modules/purchase-quotations/purchase-quotations.controller.ts`,
`trade-app/src/modules/purchase-quotations/purchase-quotations.service.ts`,
`trade-app/src/modules/purchase-quotations/dto/purchase-quotation.dto.ts`,
`trade-app/src/modules/financial-documents/financial-documents.controller.ts`,
`trade-app/src/modules/financial-documents/financial-documents.service.ts`,
`trade-app/src/modules/financial-documents/dto/financial-documents.dto.ts`,
`trade-app/packages/database/src/entities/tenant/document.entities.ts`,
`trade-app/packages/common/src/enums/trade.enums.ts`,
`trade-app/packages/common/src/constants/error-codes.ts`,
`api-gateway-app/src/routing-proxy/routing-proxy.controller.ts`,
`api-gateway-app/src/routing-proxy/gateway-api-path.ts`,
`api-gateway-app/src/routing-proxy/route-contracts/trade.route-contracts.ts`.

---

## The envelope — Trade **is** wrapped

> **Every Trade response is wrapped in `data`.** Unwrap it the way you unwrap
> Core. Getting this wrong breaks every Trade screen at once.

`TradeResponseInterceptor` is a global `APP_INTERCEPTOR` in the `@Global()`
`CommonModule`. Shape, differences from Core's envelope, the `code` key
instead of `errorCode`, the guard order, entitlement refusals, the header-only
scope contract, the two idempotency layers, the single `If-Match` parser, the
decimal-string rules and the flat pagination shape are all documented once in
[trade-foundation.md — What applies to every route](trade-foundation.md#what-applies-to-every-route-on-this-page)
and apply unchanged here. This page documents only what is specific to the
commercial documents.

Three things from that page are worth repeating because they bite hardest on
this one:

- **`Idempotency-Replayed` is set on first execution too, as `"false"`.**
  Test `=== 'true'`.
- **`If-Match` is 400 when absent, never 428**, and accepts `W/"n"`, `"n"` and
  bare `n` alike. The ETag comes back as a strong `"n"`.
- **Money is a decimal string with trailing zeros stripped** — `"10.5"`, never
  `"10.50"`. Never `Number()` it.

### Portal write recovery

Quantity entry reviewed **2026-10-17** (CXPORTAL-TRADE-110). The shared
quotation line editor retains raw text while typing, including `1.` and
`0.0`, and canonicalizes parseable decimals on blur. Invalid text remains
available for correction. Sequential entry of `0.5`, `1.25` and `10.05`
preserves each decimal instead of removing its decimal point mid-entry.
Quantity-entry regression specs cover the controlled input, blur and the
resulting decimal-string submission value; execution is pending lead verification.

Recovery behavior reviewed **2026-10-17** (CXPORTAL-TRADE-113). A document
write with no HTTP response keeps its original request callback, payload,
scope/version headers and idempotency key. It fences every new write through
that hook, including calls made before React renders disabled controls.
The form disables normal Save and editing and guards closing/resetting the
draft. Its persistent recovery panel offers only same-key Retry; dismissing
the panel cannot discard an unresolved operation. Recovery stays accessible
outside the disabled fields.

Only confirmed success clears this fence. A rejected recovery request keeps
the original evidence and key because it does not prove the first write
failed. Ordinary HTTP rejections before any ambiguous outcome still allow
correction and a new submission. Both first execution and replayed success run
the form's same success callback to close/reset and refresh the list/detail.
Refresh failures after confirmed success are not classified as unknown writes.

Regression coverage: `useTradeWrite.test.ts` covers concurrent submissions,
same-key recovery, rejected recovery and success callbacks;
`InvoiceFormDrawer.recovery.test.tsx` covers a committed create whose response
is lost, disabled Save/editing, unchanged replay and close/refresh. These tests
were added but not executed in the implementer's sandbox.

---

## The one thing Phase 11 must know before anything else

> **The browser computes the financial totals. The server only checks the
> arithmetic.**

MASTER-PLAN task 11.20 says the running total is "computed **server-side**"
and "the browser never computes financial truth". **That is not what the code
does**, and building to it would produce a create form that cannot submit.

`CreateSalesOrderDto`, `CreatePurchaseOrderDto`, `ConvertQuotationDto`,
`CreateInvoiceDto` and `CreateContractDto` all require a complete `totals`
object **and** per-line financial evidence in the request body.
`validateNewOrderFinancialEvidence` in
`trade-app/src/modules/documents/order-print-snapshot.service.ts` then
recomputes every figure and rejects the request if any of them disagrees.

The identities the caller must satisfy, exactly, at 8-decimal fixed precision:

```text
lineSubtotal   = quantity × unitPrice                       (unitPrice is server-resolved)
lineTotal      = lineSubtotal − discountTotal + chargeTotal + taxTotal
totals.subtotal      = Σ lineSubtotal
totals.discountTotal = Σ line.discountTotal
totals.chargeTotal   = Σ line.chargeTotal
totals.taxTotal      = Σ line.taxTotal
totals.grandTotal    = Σ line.lineTotal + totals.roundingTotal
totals.amountDue     = totals.grandTotal − totals.amountPaid
```

Every `clientLineId` must be unique within the request, and every line's
`taxSnapshot` must be a **non-empty object**. Nothing in the DTO or the
validator says what belongs inside `taxSnapshot`; only that it must not be
`{}`. Recorded as **Q32**.

**The catch: `unitPrice` is not in the sales-order or purchase-order line
DTO.** `OrderCommercialLineInputDto` carries `clientLineId`, `itemId`,
`uomId`, `quantity`, an optional `priceBookId`, and `financial`. The service
resolves `unitPrice` from the pricing engine and uses **its own** value in the
identity check. So the portal must call
`POST /api/tenant/trade/v1/pricing/evaluate`
(see [trade-advanced.md](trade-advanced.md#pricing-evaluation--1-route)) for
every line, with the same `priceBookId`, before it can compute a `lineTotal`
the server will accept. A line editor that does not do that will fail on
submit with no indication of which figure was wrong.

Invoices are the exception — `InvoiceLineInputDto` **does** carry `unitPrice`,
supplied by the caller.

Every one of those failures throws the same thing:

| `code` | Status |
| --- | --- |
| `TRADE.FINALIZED_DOCUMENT.SNAPSHOT_INCOMPLETE` | **422** |

One code, one status, and — from `order-print-snapshot.service.ts` — no
`field` and no `details`, for at least fifteen distinct
conditions — a duplicate `clientLineId`, a malformed decimal, an empty
`taxSnapshot`, a line that does not add up, or any of the six totals
identities. **These failures are indistinguishable on the wire.** The portal
cannot point at the offending line. Recorded as **Q33**.

**`financial-documents.service.ts` is the exception.** Its `invalidSnapshot(name)`
throws the same code **with a `field`**, naming `termsSnapshot`,
`priceSnapshot`, `taxSnapshot` or `sourceEvidence`. Read `field` before falling
back to the whole-form message.

`parseTotals` also enforces a **seventh** identity the list above omits:
`totals.subtotal` may not be less than `totals.discountTotal`, checked on the
document as a whole rather than per line.

### Rounding differs between neighbouring document families

Portal financial-input validation reviewed **2026-10-17** (CXTRADE-SALES-116).
The shared evidence calculator returns field or calculation errors without
substitute amounts. Invalid/empty required decimals, non-positive quantities,
negative amounts, values outside numeric(24,8), and tax percentages outside
0–100 or integer basis-point precision block draft submission. A valid zero
price remains valid. Excessive discounts and invalid/overflowing calculated
totals also block submission. Inputs stay unchanged for correction; invalid
evidence hides totals and the verified badge. Inline Arabic/English field
errors use the existing accessible Field primitive. Order pricing readiness
and financial validation must both pass. Server validation remains authoritative.

| Family | `totals.roundingTotal` |
| --- | --- |
| Sales order, purchase order, quotation conversion | **signed** — `^-?(?:0\|[1-9]\d*)(?:\.\d{1,8})?$` |
| Invoice, contract | **non-negative** — a leading `-` is a 400 |

A negative rounding adjustment is legal on an order and rejected on the
invoice raised from it.

---

## Quotations — 17 routes

Feature gate: **`trade.sales`**. Every route targets **`BRANCH`**, so both
`x-mutakamel-company-id` and `x-mutakamel-branch-id` are required on all
quotation routes, including artifact streaming.

| Method | Canonical path | Permission | Body / query |
| --- | --- | --- | --- |
| GET | `/api/tenant/trade/v1/quotations` | `trade.quotations.read` | `DocumentListQueryDto` |
| POST | `/api/tenant/trade/v1/quotations/search` | `trade.quotations.read` | `DocumentListQueryDto` — **200** |
| POST | `/api/tenant/trade/v1/quotations/counts-by-party` | `trade.quotations.read` | `DocumentPartyCountsDto` — **200**, read-only bulk count |
| GET | `/api/tenant/trade/v1/quotations/customer-options` | **`trade.quotations.create`** | `QuotationCustomerOptionsQueryDto` |
| GET | `/api/tenant/trade/v1/quotations/contact-options` | **any of `trade.quotations.create`, `trade.quotations.update`** | `QuotationContactOptionsQueryDto` |
| GET | `/api/tenant/trade/v1/quotations/:id` | `trade.quotations.read` | — |
| POST | `/api/tenant/trade/v1/quotations` | `trade.quotations.create` | `CreateQuotationDto` |
| PATCH | `/api/tenant/trade/v1/quotations/:id` | `trade.quotations.update` | `UpdateQuotationDto` · `If-Match` |
| POST | `/api/tenant/trade/v1/quotations/:id/revisions` | `trade.quotations.update` | `CreateQuotationRevisionDto` · `If-Match` |
| POST | `/api/tenant/trade/v1/quotations/:id/send` | `trade.quotations.send` | **no body** · `If-Match` — **200** |
| POST | `/api/tenant/trade/v1/quotations/:id/accept` | `trade.quotations.accept` | **no body** · `If-Match` — **200** |
| POST | `/api/tenant/trade/v1/quotations/:id/reject` | `trade.quotations.reject` | `DocumentReasonDto` · `If-Match` — **200** |
| POST | `/api/tenant/trade/v1/quotations/:id/cancel` | `trade.quotations.cancel` | `DocumentReasonDto` · `If-Match` — **200** |
| POST | `/api/tenant/trade/v1/quotations/:id/convert-to-sales-order` | `trade.quotations.convert` **and** `trade.sales_orders.create` | `ConvertQuotationDto` · `If-Match` — **201** |
| POST | `/api/tenant/trade/v1/quotations/:quotationId/render-pdf` | `trade.quotations.read` | `RenderQuotationPdfDto` — **202** |
| GET | `/api/tenant/trade/v1/quotations/:quotationId/render-jobs/:renderJobId` | `trade.quotations.read` | — |
| GET | `/api/tenant/trade/v1/quotations/:quotationId/render-jobs/:renderJobId/artifact` | `trade.quotations.read` | raw, verified `application/pdf`, maximum 25 MiB |

> **`customer-options` is gated on `trade.quotations.create`, not `.read`.**
> A user who may read quotations but not create them gets a 403 from the
> customer picker. Do not fetch it on the detail screen.

Every mutating route needs `x-idempotency-key`. `send` and `accept` take
**no body at all** — the handler has no `@Body()`, so sending one is rejected
by `forbidUnknownValues`.

### Portal quotation conversion evidence

Conversion is live through the canonical POST action above with the existing
`trade.quotations.convert` and `trade.sales_orders.create` grants in the exact
source branch, branch/company headers, `If-Match` and `x-idempotency-key`.
Both grants are checked before conversion or durable replay; the quotation
must still resolve in that branch before a stored result is returned. The
portal shows conversion only when both advisory permission checks pass.
Authorization re-verified **2026-10-17**. Its dedicated serializer emits `lines`, `totals` and
`terms`. Each line contains **only `clientLineId` and `financial`**; `financial`
contains `discountTotal`, `chargeTotal`, `taxTotal`, `lineTotal` and
`taxSnapshot`. Item, UOM, quantity and pricing identities remain on the server.
The nested DTO whitelist remains strict.

The drawer requires a tax code, an explicitly selected STANDARD/ZERO/EXEMPT
treatment, and an explicit percentage for every line. STANDARD requires a
positive rate; ZERO and EXEMPT require zero. A code never implies its rate or
treatment. Rates support four decimal places; discounts and charges support
eight. Tax is calculated on `quantity × accepted unitPrice − discount + charge`
using exact fixed-decimal arithmetic, rounded half-up at eight decimals. The
snapshot records the chosen code/treatment/rate, taxable base, calculated tax
and currency. All line and document totals use the existing ORDER arithmetic;
rounding and paid amounts are explicitly zero, and due equals grand total.

The accepted revision must be the current revision exposed by `currentLines`.
Its priced subtotal must match the computed subtotal, and its non-empty terms
are copied exactly. Missing/stale source evidence blocks submission; no terms,
revision, rate or treatment is invented. Every input edit clears review.
Submission requires explicit review of the evidence, all eight totals and
terms. Existing write outcomes remain visible; pending/ambiguous writes lock
the evidence and prevent another conversion submission.

The response remains the wrapped created sales order (201); the backend owns
atomic creation and idempotent replay. Server refusals retain existing Trade
outcome handling, including 403 and 422
`TRADE.FINALIZED_DOCUMENT.SNAPSHOT_INCOMPLETE`. Local refusals are documented in
[errors.md](../reference/errors.md#quotation-conversion-client-validation).

Regression coverage: `quotation-conversion-contract.test.ts` checks nested
request keys, taxable/zero/exempt calculations, exact decimals, line identity
and accepted terms; the conversion hook tests cover review and submission.
Actual nested DTO validation and single-order creation/replay require the
lead's backend/integration verification; they were not executed in the
implementer's sandbox.

### The state machine

`lifecycleStatus` is a `varchar(24)` with **no enum, no `@IsIn` and no
database check constraint**. The value set below is the complete set of
literals assigned or compared in `documents.service.ts`; it is exhaustive with
respect to the code, not guaranteed by a schema.

| Status | Reached by |
| --- | --- |
| **`DRAFT`** | `POST /quotations` |
| **`SENT`** | `POST /:id/send` from `DRAFT` |
| **`ACCEPTED`** | `POST /:id/accept` from `SENT` |
| **`REJECTED`** | `POST /:id/reject` from `SENT` |
| **`CANCELLED`** | `POST /:id/cancel` from `DRAFT` **or** `SENT` |

Legal transitions, encoded in `DocumentsService.quotationAction`:

```text
DRAFT ──send──▶ SENT ──accept──▶ ACCEPTED ──convert-to-sales-order──▶ (sales order)
  │               ├──reject──▶ REJECTED
  └──cancel──┐    └──cancel──▶ CANCELLED
             └────────────────▶ CANCELLED
```

Preconditions the service enforces, each a **409
`TRADE.QUOTE.TRANSITION_NOT_ALLOWED`** unless stated:

- `accept` requires the quotation **and its current revision** both to be
  `SENT`. The revision carries its own status.
- `accept` on a revision whose `validUntil` is past is
  **409 `TRADE.QUOTE.EXPIRED`**, a distinct code. **`send` throws the same code
  on the same check** — both transitions refuse an expired revision.
- `POST /:id/revisions` requires the quotation to be **`DRAFT`**. A sent
  quotation cannot be revised; the only exits are accept, reject and cancel.
- `reject` and `cancel` require a non-empty `reasonCode` in the body. Omitting
  it is a transition failure, **not** a validation error — same 409, same
  code, so the portal must validate the reason locally to give a useful
  message.
- `convert-to-sales-order` requires `ACCEPTED` **and** a set
  `acceptedRevisionId`.

`TRADE.QUOTE.TRANSITION_NOT_ALLOWED` is also thrown as a **404** from a second
site when the document cannot be loaded in scope. Branch on the status.

The revision has its own status, written alongside the quotation's:
**`SENT`** · **`ACCEPTED`** · **`REJECTED`** · **`CANCELLED`**. A revision
created by `POST /:id/revisions` starts before any of these; the initial
literal is set by the entity default, not by an assignment in the service, and
was not confirmed — see [Not verified](#not-verified).

### Request bodies

| DTO | Fields |
| --- | --- |
| `CreateQuotationDto` | `partyId` **required**, `currencyCode` (`^[A-Z]{3}$`) **required**, `crmCustomerProfileId?`, `contactPartyId?` (nullable), `draftReference?` (≤ 80), `sourceCrmOpportunityId?`, `sourceCrmOpportunityVersion?` (int ≥ 1) — plus extension owner values |
| `UpdateQuotationDto` | `contactPartyId?` (nullable), `draftReference?` (nullable) — **and nothing else.** Party, currency and lines cannot be patched |
| `CreateQuotationRevisionDto` | `validUntil` (ISO 8601 strict) **required**, `lines[]` (1–1000 `CommercialLineInputDto`), `terms?` (**defaults to `{}`**) |
| `CommercialLineInputDto` | `clientLineId` (UUID v7), `itemId`, `uomId`, `quantity` (**positive** decimal string), `priceBookId?` |
| `DocumentReasonDto` | `reasonCode` (≤ 80) **required**, `evidenceRef?` (≤ 240) |
| `ConvertQuotationDto` | `lines[]` (1–1000 `{ clientLineId, financial }`), `totals` (`OrderTotalsEvidenceDto`), `terms` (**required, must exactly reproduce the accepted revision's terms**) |
| `DocumentListQueryDto` | `page`, `limit` (≤ 100, default 25), `status?` (free string ≤ 32), `partyId?`, `search?` (≤ 120), `currencyCode?` (`^[A-Z]{3}$`) |
| `DocumentPartyCountsDto` | `partyIds[]` — 1–100 unique UUIDv7 values; response has one `{ partyId, count }` row per requested id, including explicit zeroes |
| `QuotationCustomerOptionsQueryDto` | `search?` (≤ 120), `cursor?` (≤ 512), `limit` (≤ 100, default 25) |
| `QuotationContactOptionsQueryDto` | `partyId` (UUIDv7) **required**, `search?` (≤ 120), opaque base64url `cursor?` (≤ 2048), `limit` (1–100, default 25) |

Note that **the quotation's lines live on the revision, not the quotation.**
There is no line-editing route: a change of lines is a new revision.

Conversion has one additional check beyond the totals identities:
`totals.subtotal` must equal the accepted revision's `grandTotal` exactly.
The comment in the service is explicit that conversion may add tax and charges
but may not alter the agreed commercial subtotal.

### Quotation customer cursor

`GET /quotations/customer-options` and `/quotations/contact-options` use
opaque cursor paging. The customer endpoint has the following contract;
contact paging is described separately below.

```json
{ "success": true, "data": { "items": [ … ], "nextCursor": "eyJkaXNwbGF5…" }, … }
```

- `nextCursor` is **omitted entirely** on the last page — not `null`.
- There is **no** `total`, `page`, `hasNext` or `hasPrev`.
- The cursor is `base64url(JSON.stringify({ displayName, partyId, crmCustomerProfileId }))`.
  It is **not signed and not HMAC'd**, but it is still an opaque token as far
  as the portal is concerned: **pass it back verbatim.**
- An unparseable or tampered cursor is **silently ignored** and the first page
  is returned. There is no error. A paging bug will look like a loop, not a
  failure.

Each option carries `partyId`, `displayName`, **required** `partyType`
(`"PERSON"` or `"ORGANIZATION"`), `commercialAccountStatus`
(**`ACTIVE`** · **`BLOCKED`**), `eligibilitySource`
(`"ACTIVE_COMMERCIAL_ACCOUNT"`), `quotationSelectable` (boolean) and, when
blocked, `denialCode: "TRADE.QUOTE.COMMERCIAL_ACCOUNT_BLOCKED"`. Blocked
customers are **returned, not filtered out** — render them disabled with the
reason rather than hiding them.

The response sets `Cache-Control: no-store, private`.

### Quotation company contacts

`GET /quotations/contact-options` requires **any one** of
`trade.quotations.create` or `trade.quotations.update`, the `trade.sales`
feature and the exact **BRANCH** context. It resolves contacts for the
eligible customer identified by `partyId`; it is not a general party search.
The response data is `{ partyType, items, nextCursor? }`, without a total.
An eligible person customer returns `partyType: "PERSON"` and an empty list.

Each item has `partyId`, `displayName`, `relationshipType`
(`CONTACT_PERSON`, `BILLING_CONTACT` or `LEGAL_CONTACT`), nullable
`relationshipLabel`, `isPrimary`, and nullable `email`, `mobile` and `phone`.
Only active linked people in the current organization and branch are
returned, once per person. Results sort primary contacts first, then name
and person ID. Pass `nextCursor` back unchanged; it is omitted on the last
page. The response is `no-store, private`.

The portal shows this optional selector only for organization customers and
displays the returned name, relationship and available contact methods.
Changing the customer clears the selected contact. A quotation write sends
only `contactPartyId`; display metadata stays in local UI state. Create and
an explicit non-null header PATCH validate the selected active relationship
again. Omitting `contactPartyId` from PATCH preserves an existing reference;
`null` clears it. An invalid selection returns `400 TRADE.VALIDATION_FAILED`
on `contactPartyId`; an ineligible parent returns
`422 TRADE.QUOTE.CUSTOMER_NOT_ELIGIBLE`. The portal distinguishes a 403
permission boundary, a successful empty list, and a retryable dependency
failure such as `503 TRADE.DEPENDENCY.TIMEOUT`.

### Quotation currency selection

The portal uses active currencies configured in the workspace. With
`currencies.currency.read`, it reads the paged Core currency directory
`GET /api/tenant/core/v1/currencies` filtered to `ACTIVE`. Otherwise, when
authorized for `trade.pricing.read` and `trade.pricing`, it uses the active
currency projection from `GET /api/tenant/trade/v1/pricing/reference-data`
in **COMPANY** context. These are existing read contracts, not a quotation
currency endpoint.

Currency starts blank until the directory resolves. An untouched form takes
the returned default currency, or the first active option when no default
is marked. The picker accepts only returned active codes. Loading, denied,
failed or unavailable selections block a new header save and preserve local
entries for recovery; no hardcoded currency is substituted. A restored
handoff currency must still be available. Once a header is confirmed, its
saved currency is retained because quotation PATCH cannot change it.

### Errors

| `code` | Status | When |
| --- | --- | --- |
| `TRADE.QUOTE.TRANSITION_NOT_ALLOWED` | **409** | transition refused |
| `TRADE.QUOTE.NOT_FOUND` | **404** | quotation not found in scope |
| `TRADE.QUOTE.EXPIRED` | 409 | accepting past `validUntil` |
| `TRADE.QUOTE.LINE_INVALID` | 422 | a revision line references an unusable item or UOM |
| `TRADE.QUOTE.VALIDITY_INVALID` | 422 | `validUntil` in the past or malformed |
| `TRADE.QUOTE.COMMERCIAL_ACCOUNT_BLOCKED` | 422 | the party's commercial account is blocked |
| `TRADE.QUOTE.CUSTOMER_NOT_ELIGIBLE` | 422 | |
| `TRADE.QUOTE.CUSTOMER_ELIGIBILITY_UNAVAILABLE` | **503** | the eligibility source could not be reached — retry, do not treat as a refusal |
| `TRADE.PRICE.BOOK_REQUIRED` | 422 | a line gave no `priceBookId` and no company default resolves |
| `TRADE.PRICE.LOCK_INVALID` | **409** | the revision's price locks no longer apply |
| `TRADE.PRICE.LOCK_DATA_INVALID` | **422** | invalid price lock data |
| `TRADE.PRICE.LOCK_EXPIRED` | 409 | accept after the lock window |
| `TRADE.PRICE.LOCK_CONTEXT_MISMATCH` | 409 | |
| `TRADE.PRICE.MARGIN_GUARD` | 409 | a pricing policy refused the margin |
| `TRADE.POLICY.DECISION_UNAVAILABLE` | **503** | the policy engine could not answer |
| `TRADE.DOCUMENT_PROFILE.PUBLICATION_UNAVAILABLE` | **503** | no published document profile for this scope |
| `TRADE.FINALIZED_DOCUMENT.SNAPSHOT_INCOMPLETE` | 422 | conversion evidence failed — see above |
| `TRADE.CONCURRENCY.STALE_VERSION` | 409 | |

One more is thrown but easy to miss, because the code is chosen by a ternary
inside the exception rather than named on the throw line:

| `code` | Status | When |
| --- | --- | --- |
| `TRADE.QUOTE.CUSTOMER_INVALID` | 422 | `documents.service.ts:1928` — the party is not a usable quotation customer |

**Eight quotation codes in the catalogue have no throw site** anywhere in
`trade-app/src` and are listed under [Not verified](#not-verified):
`QUOTE_CUSTOMER_AMBIGUOUS`, `QUOTE_REVISION_IMMUTABLE`,
`QUOTE_SEND_NOT_ALLOWED`, `QUOTE_ACCEPTANCE_INVALID`,
`QUOTE_ACCEPT_NOT_ALLOWED`, `QUOTE_REVISION_SUPERSEDED`,
`QUOTE_ALREADY_ACCEPTED`, `QUOTE_ALREADY_CONVERTED`.

---

## Sales orders — 11 routes

Confirmation contract source-verified **2026-10-27** (AUD26-TRADE-04).

Feature gate: **`trade.sales`**. Every route targets **`BRANCH`**.

| Method | Canonical path | Permission | Body / query |
| --- | --- | --- | --- |
| GET | `/api/tenant/trade/v1/sales-orders` | `trade.sales_orders.read` | `DocumentListQueryDto` |
| POST | `/api/tenant/trade/v1/sales-orders/counts-by-party` | `trade.sales_orders.read` | `DocumentPartyCountsDto` — **200**, read-only bulk count |
| POST | `/api/tenant/trade/v1/sales-orders` | `trade.sales_orders.create` | `CreateSalesOrderDto` |
| GET | `/api/tenant/trade/v1/sales-orders/:id` | `trade.sales_orders.read` | — |
| PATCH | `/api/tenant/trade/v1/sales-orders/:id` | `trade.sales_orders.update` | `UpdateSalesOrderDto` · `If-Match` |
| POST | `/api/tenant/trade/v1/sales-orders/:id/confirm` | `trade.sales_orders.confirm` | `ConfirmSalesOrderDto` · `If-Match` — **200** |
| POST | `/api/tenant/trade/v1/sales-orders/:id/hold` | `trade.sales_orders.hold` | `DocumentReasonDto` · `If-Match` — **200** |
| POST | `/api/tenant/trade/v1/sales-orders/:id/release-hold` | **`trade.sales_orders.hold`** | `DocumentReasonDto` · `If-Match` — **200** |
| POST | `/api/tenant/trade/v1/sales-orders/:id/cancel` | `trade.sales_orders.cancel` | `DocumentReasonDto` · `If-Match` — **200** |
| POST | `/api/tenant/trade/v1/sales-orders/:documentId/render-pdf` | `trade.sales_orders.read` | `RenderTradeBusinessPdfDto` — **202** |
| GET | `/api/tenant/trade/v1/sales-orders/:documentId/render-jobs/:renderJobId` | `trade.sales_orders.read` | — |

`hold` and `release-hold` share **one** permission. There is no separate
release grant — a user who can hold can always release.
`trade.sales_orders.amend` exists in the permission catalogue and **gates no
route**.

### Four independent status axes

A sales order does **not** have one status. It has four, and the UI must show
them separately or it will misrepresent the order.

| Axis | Column | Values proven from source |
| --- | --- | --- |
| Lifecycle | `lifecycle_status` | **`DRAFT`** · **`CONFIRMED`** · **`CANCELLED`** |
| Confirmation | `confirmation_status` | **`NOT_STARTED`** · **`PENDING`** · **`READY_TO_FINALIZE`** · **`COMPLETED`** · **`REJECTED`** · **`FAILED`** · **`CANCELLED`** |
| Hold | `hold_status` | **`NONE`** · **`HELD`** |
| Fulfilment | `fulfillment_status` | the `FulfillmentStatus` enum below |
| Billing | `billing_status` | the `BillingStatus` enum below |

> **There is no settlement axis.** `SettlementStatus` is exported from
> `@mutakamel/trade-app-common` and has **no column anywhere in the schema**,
> no writer and no reader in `trade-app/src`. Rendering it would be inventing a
> field. `financial-documents.service.spec.ts` names the reason: Trade has no
> payment-settlement source at all, which is also why an invoice's `amountPaid`
> must be exactly `"0"`.

The confirmation axis uses the exported enum `ConfirmationOrchestrationStatus`.
The schema accepts its broader values, but the current synchronous service writes
`NOT_STARTED`, `COMPLETED` and `CANCELLED`; it creates no pending workflow.
The lifecycle axis is **not** `DocumentLifecycleStatus` — that exported enum
has four members (`DRAFT`, `CONFIRMED`, `CANCELLED`, `CLOSED`) and `CLOSED` is
never assigned to a sales order anywhere in `trade-app/src`. Render all four
anyway; a projection may set it.

```ts
FulfillmentStatus  NOT_APPLICABLE · UNPLANNED · PLANNED · PARTIALLY_FULFILLED · FULFILLED · BLOCKED
BillingStatus      NOT_APPLICABLE · NOT_BILLED · PARTIALLY_BILLED · BILLED · CREDIT_PENDING
SettlementStatus   UNKNOWN · UNPAID · PARTIALLY_PAID · PAID · REFUNDED
```

`SettlementStatus.UNKNOWN` is a real first-class value, not a null stand-in.

### Confirmation completes synchronously

`POST /sales-orders/:id/confirm` returns **200** after credit evaluation,
required inventory reservations and the order confirmation commit together.
The response contains `statusCode: 200`, `status: "COMPLETED"`, `orderId`
and `attemptId`. The completed attempt remains internal evidence. There are
no attempt read/cancel routes, polling headers or asynchronous continuation.
Stored profile content with `ASYNC` still uses this synchronous runtime.

The portal validates the completed receipt and refreshes the order. Failed
writes use the existing write-error surface; a lost response keeps the original
idempotency key for recovery. `If-Match` is the order version. The optional
`requestedDeadline` remains accepted and retained as evidence.

Hold/release and order cancellation lock the order directly, without consulting
pending attempts. Holding a cancelled or already-held order is refused. Order
cancellation still validates remaining quantities and releases active reservations.

### Request bodies

| DTO | Fields |
| --- | --- |
| `CreateSalesOrderDto` | `partyId`, `currencyCode`, `contactPartyId?`, `draftReference?`, `lines[]` (1–1000 `OrderCommercialLineInputDto`), `totals` (`OrderTotalsEvidenceDto`), `terms` (**required object**) |
| `OrderCommercialLineInputDto` | `CommercialLineInputDto` + `financial` (`OrderLineFinancialEvidenceDto`) — **no `unitPrice`** |
| `OrderLineFinancialEvidenceDto` | `discountTotal`, `chargeTotal`, `taxTotal`, `lineTotal` (non-negative decimal strings), `taxSnapshot` (**non-empty object**) |
| `OrderTotalsEvidenceDto` | `subtotal`, `discountTotal`, `chargeTotal`, `taxTotal`, `grandTotal`, `amountPaid`, `amountDue` (non-negative), `roundingTotal` (**signed**) |
| `UpdateSalesOrderDto` | `contactPartyId?`, `draftReference?` — **lines and totals are immutable after create** |
| `ConfirmSalesOrderDto` | `requestedDeadline?` (ISO 8601 strict) |

### Errors

| `code` | Status | When |
| --- | --- | --- |
| `TRADE.SALES_ORDER.CONFIRM_NOT_ALLOWED` | 409 | not `DRAFT`, or already confirming |
| `TRADE.SALES_ORDER.CONFIRMATION_RESULT_INVALID` | **404** | the attempt id does not resolve — **404, not 422** |
| `TRADE.SALES_ORDER.HOLD_TRANSITION_INVALID` | 409 | holding a held order, or releasing one that is not held |
| `TRADE.SALES_ORDER.CANCEL_NOT_ALLOWED` | 409 | already `CANCELLED`, or no `reasonCode` |
| `TRADE.SALES_ORDER.CUSTOMER_BLOCKED` | **409** | the customer became blocked — not 422 |
| `TRADE.SALES_ORDER.SOURCE_INVALID` | **422** | source quotation is unusable |
| `TRADE.SALES_ORDER.SOURCE_NOT_FOUND` | **404** | source quotation not found |
| `TRADE.SALES_ORDER.LINE_INVALID` | 422 | |
| `TRADE.INVENTORY.NODE_INVALID` | 422 | fulfilment node rejected during confirmation |
| `TRADE.FINALIZED_DOCUMENT.SNAPSHOT_INCOMPLETE` | 422 | totals evidence failed |
| `TRADE.DEPENDENCY.TIMEOUT` | **503** | |
| `TRADE.DEPENDENCY.NUMBERING_UNAVAILABLE` | **422** | Numbering sequence unavailable |
| `TRADE.POLICY.DECISION_UNAVAILABLE` | 503 | |

`TRADE.SALES_ORDER.ALREADY_CONVERTED` and
`TRADE.SALES_ORDER.CANCEL_QUANTITY_INVALID` are in the catalogue with no
throw site.

---

## Purchase orders — 13 routes

Supplier-delivery retry re-verified against the Gateway route contract and
`PurchaseDeliveryService.retry` on **2026-10-30** (AUDIT29P-TP-1). The detail
screen offers **Retry delivery** only with `trade.purchase_orders.confirm`,
when the order is `CONFIRMED` and its latest `delivery.status` is `FAILED`,
excluding `TRADE.PURCHASE_ORDER.DELIVERY_EMAIL_FAILED` because the provider may
already have accepted the email. Missing delivery evidence hides the action.
Each new retry sends a fresh UUIDv7 `x-idempotency-key`, the current strong
`If-Match` version, scope headers and an empty body. Pending or ambiguous writes
block the action; recovery after a lost response reuses the original key and
version. Success, including successful recovery, reloads the validated detail.
409 `TRADE.PURCHASE_ORDER.DELIVERY_RETRY_NOT_ALLOWED` and
`TRADE.CONCURRENCY.STALE_VERSION` show localized errors. A queued retry does
not prove email delivery; the refreshed dispatch evidence reports progress.

Delivery behavior verified against source on 2026-10-18 (CXTRADE-OPS-115): confirmation commits a durable supplier-delivery intent. Dispatch labels are localized: `NOT_REQUESTED` (not requested), `REQUESTED` (delivery pending), `SENT` (email sent), `FAILED` (delivery failed). Sent means provider acceptance, not proof of mailbox delivery. Detail responses include nullable `delivery` evidence with stage, attempt count, safe last error code and next attempt time. Delivery failures are shown independently of commercial status. No new portal route is introduced. The renderer pins the confirmed PDF revision and Worker attaches its verified bytes; duplicate result events cannot send a second email or reverse terminal status.

Approval readiness re-verified **2026-10-17**. Detail responses include the
server-derived boolean `approvalReady`. The portal requires it before offering
Confirm; a missing value is treated as false. `NOT_REQUIRED` alone does not
prove a waiver. Confirmation rechecks either a version-bound `ALLOW` receipt
with profile mode `NONE`, or the completed current workflow instance and its
independent checker, before allocating a number or writing confirmation evidence.
Withdrawal and draft edits invalidate readiness. A fresh submission is required
after edits, withdrawal, or an older waiver without submission-version evidence.

Feature gate: **`trade.purchasing`**. Every route targets **`BRANCH`**.

| Method | Canonical path | Permission | Body / query |
| --- | --- | --- | --- |
| GET | `/api/tenant/trade/v1/purchase-orders` | `trade.purchase_orders.read` | `DocumentListQueryDto` |
| POST | `/api/tenant/trade/v1/purchase-orders` | `trade.purchase_orders.create` | `CreatePurchaseOrderDto` |
| GET | `/api/tenant/trade/v1/purchase-orders/:id` | `trade.purchase_orders.read` | — |
| PATCH | `/api/tenant/trade/v1/purchase-orders/:id` | `trade.purchase_orders.update` | `UpdatePurchaseOrderDto` · `If-Match` |
| POST | `/api/tenant/trade/v1/purchase-orders/:id/submit` | `trade.purchase_orders.submit` | `PurchaseActionDto` · `If-Match` — **200** |
| POST | `/api/tenant/trade/v1/purchase-orders/:id/withdraw` | **`trade.purchase_orders.submit`** | `PurchaseActionDto` · `If-Match` — **200** |
| POST | `/api/tenant/trade/v1/purchase-orders/:id/approve` | `trade.purchase_orders.approve` | `PurchaseActionDto` · `If-Match` — **200** |
| POST | `/api/tenant/trade/v1/purchase-orders/:id/reject` | **`trade.purchase_orders.approve`** | `PurchaseActionDto` · `If-Match` — **200** |
| POST | `/api/tenant/trade/v1/purchase-orders/:id/confirm` | `trade.purchase_orders.confirm` | `PurchaseActionDto` · `If-Match` — **200** |
| POST | `/api/tenant/trade/v1/purchase-orders/:id/delivery/retry` | `trade.purchase_orders.confirm` | empty body · `If-Match` · fresh `x-idempotency-key` — **200** |
| POST | `/api/tenant/trade/v1/purchase-orders/:id/cancel` | `trade.purchase_orders.cancel` | `PurchaseActionDto` · `If-Match` — **200** |
| POST | `/api/tenant/trade/v1/purchase-orders/:documentId/render-pdf` | `trade.purchase_orders.read` | `RenderTradeBusinessPdfDto` — **202** |
| GET | `/api/tenant/trade/v1/purchase-orders/:documentId/render-jobs/:renderJobId` | `trade.purchase_orders.read` | — |

**Submit and withdraw share one permission; approve and reject share another.**
The approval ladder is therefore only two grants wide, not six.
`trade.purchasing.override` exists in the catalogue and **gates no route**.

### Three axes, not one

| Axis | Values proven from source |
| --- | --- |
| `lifecycle_status` | **`DRAFT`** · **`CONFIRMED`** · **`CANCELLED`** |
| `approval_status` | **`NOT_REQUIRED`** · **`PENDING`** · **`APPROVED`** · **`REJECTED`** |
| `dispatch_status` | **`NOT_REQUESTED`** — the column default, and the only literal anywhere. No enum, no check constraint, no writer |

The exported `ApprovalStatus` enum has **six** members —
`NOT_REQUIRED`, `PENDING`, `APPROVED`, `REJECTED`, `WITHDRAWN`, `EXPIRED`.
The purchase order itself is only ever set to the first four. `WITHDRAWN` and
`EXPIRED` appear on the **approval-instance and approval-step rows**, where a
database check constraint pins the six-value set
(`ck_trade_approval_instances_status`, `ck_trade_approval_steps_status`).
Render all six on a step timeline; expect only four on the order badge.

The ladder, from `PurchasingService`:

```text
DRAFT + NOT_REQUIRED ──submit──▶ DRAFT + PENDING
                                    │
                     withdraw ◀─────┤  (back to DRAFT + NOT_REQUIRED)
                       approve ─────┤──▶ DRAFT + APPROVED
                        reject ─────┘──▶ DRAFT + REJECTED

DRAFT + (APPROVED | NOT_REQUIRED) ──confirm──▶ CONFIRMED
any non-CANCELLED ──cancel (reasonCode required)──▶ CANCELLED
```

- `submit` requires `DRAFT` **and** `NOT_REQUIRED`, and does **not** always
  reach `PENDING`: when the document profile's `approvalMode` is `NONE` and the
  policy outcome is `ALLOW`, it leaves the order on `NOT_REQUIRED` with no
  approval instance created.
- `withdraw`, `approve` and `reject` all require `PENDING`.
- `withdraw` resets `approval_status` to **`NOT_REQUIRED`**, not `WITHDRAWN` —
  both withdrawn and never-submitted orders have `approvalReady: false`.
  The instance and step rows keep the history.
- `confirm` requires `DRAFT` and an approval status of `APPROVED` **or**
  `NOT_REQUIRED`, plus valid current approval evidence. A `REJECTED` order cannot
  be confirmed and cannot be re-submitted; the only exit is `cancel`.
- `cancel` requires a `reasonCode`.

### Request bodies

| DTO | Fields |
| --- | --- |
| `CreatePurchaseOrderDto` | `supplierPartyId`, `supplierAccountId`, `currencyCode`, `receivingNodeId` — **all four required** — `draftReference?`, `lines[]` (1–1000), `totals`, `terms` (required object) |
| `PurchaseLineDto` | `clientLineId`, `itemId`, `uomId`, `quantity` (positive decimal string), `priceBookId?`, `expectedDate?` (ISO 8601), `receivingNodeId?` (per-line override), `financial` (**required**) |
| `PurchaseLineFinancialEvidenceDto` | as the sales-order line evidence |
| `PurchaseOrderTotalsEvidenceDto` | as the sales-order totals, `roundingTotal` **signed** |
| `UpdatePurchaseOrderDto` | `receivingNodeId?`, `draftReference?` — **lines and totals immutable** |
| `PurchaseActionDto` | `reasonCode?` (≤ 80), `evidence?` (object) — **both optional in the DTO**; **`reject` and `cancel` both require `reasonCode` at the service**, each as a 409 |

### Errors

| `code` | Status | When |
| --- | --- | --- |
| `TRADE.PURCHASE_ORDER.APPROVAL_INVALID` | 409 | wrong approval state for the action |
| `TRADE.PURCHASE_ORDER.CONFIRM_NOT_ALLOWED` | 409 | |
| `TRADE.PURCHASE_ORDER.CANCEL_NOT_ALLOWED` | 409 | already cancelled, or no `reasonCode` |
| `TRADE.PURCHASE_ORDER.SUPPLIER_INVALID` | **422** | |
| `TRADE.PURCHASE_ORDER.SUPPLIER_NOT_FOUND` | **404** | |
| `TRADE.PURCHASE_ORDER.ITEM_NOT_PURCHASABLE` | 422 | the item's company profile has `canPurchase: false` |
| `TRADE.PURCHASE_ORDER.LINE_INVALID` | 422 | |
| `TRADE.PURCHASE_ORDER.PRICE_INVALID` | 422 | |
| `TRADE.PURCHASE_ORDER.RECEIVING_SCOPE_INVALID` | 422 | the receiving node is not reachable from this branch |
| `TRADE.APPROVAL.MAKER_CHECKER_REQUIRED` | 409 | the submitter may not approve their own order |
| `TRADE.APPROVAL.REJECTED` | 409 | |
| `TRADE.PRICE.MARGIN_GUARD` | 409 | |
| `TRADE.POLICY.DECISION_UNAVAILABLE` | **503** | |
| `TRADE.FINALIZED_DOCUMENT.SNAPSHOT_INCOMPLETE` | 422 | |

`TRADE.PURCHASE_ORDER.PROCUREMENT_REQUIRED` and
`TRADE.PURCHASE_ORDER.CANCEL_QUANTITY_INVALID` have no throw site.

---

## Purchase quotations — 9 routes

Supplier discovery source-reviewed **2026-10-29** (AUDIT29-TRADE-4):
`GET /purchase-quotations/supplier-options` accepts `search` (up to 200 characters)
and `limit` (default 25, maximum 50), returning `{ items: [{ partyId, displayName }] }`
inside the Trade envelope. Either purchase-quotation Create or Update permission
in the current Branch authorizes it; commercial-account read is not required.
The server searches names before limiting, and returns only active, undeleted
Company SUPPLIER accounts with an active Party/SUPPLIER role in the current Branch
or shared across branches. The portal displays names in a debounced remote
combobox, preserves the selected label across searches, and discards stale reads.
Create/Edit each require their scoped action grant and a successful current-scope
lookup. A failed lookup shows a permission boundary or retryable read error.

Gateway scope source-reviewed **2026-10-30** (AUDIT29X-TP-1): this supplier lookup
declares `BRANCH_REQUIRED`. Both Create and Edit pass the resolved company and
branch headers through `usePurchaseQuotationForm` to `usePurchaseQuotationSuppliers`
and `tradeGet`. The generated inventory includes it as the 214th scope-carrying
route; the organization-scope governance spec asserts its path and scope mode.

Numbering contract reviewed **2026-10-29**: new drafts return `documentNumber: null`; list/detail show the localized Draft label. Issue allocates the official company number and resets `businessDate` to the UTC issue day in the finalization transaction. Issued rows require a non-null number; existing numbered drafts keep their number. Invoice and contract numbering is unchanged.

Creation/issue persistence re-verified **2026-10-17**. Creation saves calculated
header totals after saving lines in the same transaction and returns that saved
version. Issue can repair the known all-zero header defect only on an unfinalized
`DRAFT`, under its existing version check and lock, after validating the persisted
line pricing receipts. Only the exact zero-total shape is repaired; other
mismatches fail validation. The normal audited issue save retains the correction,
without renumbering or changing finalized documents.

Feature gate: **`trade.purchasing`**. Every route targets **`BRANCH`**, and
**all nine are Gateway `BRANCH_REQUIRED`** — the header shape is validated
twice.

| Method | Canonical path | Permission | Body / query |
| --- | --- | --- | --- |
| GET | `/api/tenant/trade/v1/purchase-quotations` | `trade.purchase_quotations.read` | `DocumentListQueryDto` |
| POST | `/api/tenant/trade/v1/purchase-quotations/search` | `trade.purchase_quotations.read` | `DocumentListQueryDto` — **200** |
| GET | `/api/tenant/trade/v1/purchase-quotations/supplier-options` | `trade.purchase_quotations.create` OR `trade.purchase_quotations.update` | `PurchaseQuotationSupplierOptionsQueryDto` — bounded name search |
| GET | `/api/tenant/trade/v1/purchase-quotations/:id` | `trade.purchase_quotations.read` | — |
| POST | `/api/tenant/trade/v1/purchase-quotations` | `trade.purchase_quotations.create` | `CreatePurchaseQuotationDto` |
| PATCH | `/api/tenant/trade/v1/purchase-quotations/:id` | `trade.purchase_quotations.update` | `UpdatePurchaseQuotationDto` · `If-Match` |
| POST | `/api/tenant/trade/v1/purchase-quotations/:id/issue` | `trade.purchase_quotations.issue` | **no body** · `If-Match` — **200** |
| POST | `/api/tenant/trade/v1/purchase-quotations/:documentId/render-pdf` | `trade.purchase_quotations.read` | `RenderTradeBusinessPdfDto` — **202** |
| GET | `/api/tenant/trade/v1/purchase-quotations/:documentId/render-jobs/:renderJobId` | `trade.purchase_quotations.read` | — |

`POST /search` is `AUTHENTICATED`, not `READ_HEAVY`, and its Gateway
`idempotencyMode` is `NONE` — unlike the other `search` routes it does not
require an idempotency key.

### The state machine — two states, enforced by the database

```sql
ck_trade_purchase_quotations_final:
  (lifecycle_status = 'DRAFT'  AND finalized_at IS NULL)
  OR (lifecycle_status = 'ISSUED' AND finalized_at IS NOT NULL)
```

**`DRAFT`** · **`ISSUED`**, and no others are storable. `issue` is one-way;
there is no un-issue, no cancel and no reject route. `PATCH` requires `DRAFT`
and is refused with **409 `TRADE.PURCHASE_QUOTATION.DRAFT_NOT_MUTABLE`**
otherwise.

### Request bodies

| DTO | Fields |
| --- | --- |
| `CreatePurchaseQuotationDto` | `supplierPartyId`, `currencyCode`, `validUntil` (ISO 8601 strict) **required**; `reference?` (≤ 120), `notes?` (≤ 8000), `terms` (**defaults to `{}`**, `null` is a 400), `lines[]` (1–1000) |
| `PurchaseQuotationLineDto` | `clientLineId`, `itemId`, `uomId`, `quantity` (positive decimal string), `priceBookId?` — **no prices and no display labels**; the DTO comment says the issue transition freezes labels from the catalogue itself |
| `UpdatePurchaseQuotationDto` | every field optional, but each uses `@ValidateIf(value !== undefined)` so **`null` is a 400**. Supplying `lines` replaces the whole set (1–1000) |

Unlike sales and purchase orders, a purchase quotation carries **no financial
evidence in the request at all**. Amounts are derived from the selected price
book on issue.

### Errors

| `code` | Status | When |
| --- | --- | --- |
| `TRADE.PURCHASE_QUOTATION.NOT_FOUND` | 404 | |
| `TRADE.PURCHASE_QUOTATION.DRAFT_NOT_MUTABLE` | 409 | any mutation after `ISSUED` |
| `TRADE.PURCHASE_QUOTATION.SUPPLIER_INVALID` | 422 | |
| `TRADE.PURCHASE_QUOTATION.LINE_INVALID` | 422 | |
| `TRADE.PURCHASE_QUOTATION.VALIDITY_INVALID` | 422 | |
| `TRADE.PURCHASE_QUOTATION.REPRICING_REQUIRED` | 422 | the price evidence went stale before `issue` — the caller must re-`PATCH` the lines |
| `TRADE.FINALIZED_DOCUMENT.SNAPSHOT_INCOMPLETE` | 422 | |
| `TRADE.DEPENDENCY.TIMEOUT` | 503 | |

---

## Invoices — 8 routes

> **Feature gate: `trade.sales`.** `TradeInvoicesController` and
> `TradeInvoicePdfController` require Sales on all eight routes. Missing Sales
> returns 403 `TRADE.ENTITLEMENT.FEATURE_REQUIRED`. All routes target **`BRANCH`**
> and are Gateway `BRANCH_REQUIRED`.

| Method | Canonical path | Permission | Body / query |
| --- | --- | --- | --- |
| GET | `/api/tenant/trade/v1/invoices` | `trade.invoices.read` | `DocumentListQueryDto` |
| POST | `/api/tenant/trade/v1/invoices/counts-by-party` | `trade.invoices.read` | `DocumentPartyCountsDto` — **200**, read-only bulk count |
| POST | `/api/tenant/trade/v1/invoices` | `trade.invoices.create` | `CreateInvoiceDto` |
| GET | `/api/tenant/trade/v1/invoices/:id` | `trade.invoices.read` | — |
| PATCH | `/api/tenant/trade/v1/invoices/:id` | `trade.invoices.update` | `UpdateInvoiceDto` · `If-Match` |
| POST | `/api/tenant/trade/v1/invoices/:id/issue` | `trade.invoices.issue` | **no body** · `If-Match` — **200** |
| POST | `/api/tenant/trade/v1/invoices/:documentId/render-pdf` | `trade.invoices.read` | `RenderTradeBusinessPdfDto` — **202** |
| GET | `/api/tenant/trade/v1/invoices/:documentId/render-jobs/:renderJobId` | `trade.invoices.read` | — |

### The state machine

```sql
ck_trade_sales_invoices_final:
  (lifecycle_status = 'DRAFT'  AND finalized_at IS NULL)
  OR (lifecycle_status = 'ISSUED' AND finalized_at IS NOT NULL)
```

**`DRAFT`** · **`ISSUED`**. `issue` is one-way; there is no void, no credit
note and no cancel route. `PATCH` on an issued invoice is refused by
`assertDraft`.

### Request bodies — a full atomic replacement

The DTO comment is explicit: *"Draft mutation is an atomic full financial
replacement, never a patchwork."* `UpdateInvoiceDto` extends
`InvoiceDraftContentDto` with **no** optionality relaxation, so a `PATCH`
must carry the entire draft — `termsSnapshot`, `totalsSnapshot` and every
line — or it is a 400. There is no per-line edit.

| DTO | Fields |
| --- | --- |
| `CreateInvoiceDto` | `partyId`, `currencyCode`, plus all of `InvoiceDraftContentDto` |
| `InvoiceDraftContentDto` | `dueDate?`, `reference?` (≤ 120), `notes?` (≤ 8000), `termsSnapshot` (**required object**), `totalsSnapshot` (`FinancialTotalsDto`, **required**), `lines[]` (1–1000) |
| `InvoiceLineInputDto` | `clientLineId`, `itemId`, `uomId`, `quantity` (positive), **`unitPrice`** (non-negative), `discountTotal`, `chargeTotal`, `taxTotal`, `lineTotal`, `priceSnapshot` (**required object**), `taxSnapshot` (**required object**), `description?` (≤ 500) |
| `FinancialTotalsDto` | `subtotal`, `discountTotal`, `chargeTotal`, `taxTotal`, `roundingTotal`, `grandTotal`, `amountPaid`, `amountDue` — **all eight non-negative decimal strings** |
| `UpdateInvoiceDto` | identical to `InvoiceDraftContentDto` |

Create/update request separation re-verified against the DTO source on
**2026-10-17** (CXTRADE-SALES-113). The invoice drawer uses separate create
and update builders. Party and currency are read-only when editing; PATCH
explicitly selects only draft-content fields, excluding `partyId` and
`currencyCode` even from a create-shaped input. POST retains both required
identity fields. Strict backend whitelisting stays enabled.

**Invoices are the one family where the caller supplies `unitPrice`.** They
also require a second non-empty object per line, `priceSnapshot`, whose
contents are as unspecified as `taxSnapshot` (**Q32**).

The invoice editor reads the item ID from `printSnapshot.item.id`, rather than
using the line's `itemCompanyProfileId` as an item ID. It reads discounts,
charges, tax amounts and the opaque price/tax evidence from
`printSnapshot.financial`. Editing uses authored tax amounts rather than
inferring a percentage from an arbitrary evidence object. A notes-only update
preserves the original decimal strings, totals, payment terms and per-line
evidence. Changing amounts recalculates totals with decimal-string arithmetic;
untouched lines keep their original evidence and values. Missing identity or
financial evidence fails response validation instead of receiving defaults.

Lossless edit evidence re-verified **2026-10-17** (CXTRADE-SALES-114).
Unit price and line total are also read from `printSnapshot.financial`:
database numeric columns may pad those decimals, while the snapshot retains
their original text. Both snapshot amounts are required; the editor never
rebuilds missing financial evidence from display columns.

### Errors

| `code` | Status | When |
| --- | --- | --- |
| `TRADE.INVOICE.NOT_FOUND` | 404 | |
| `TRADE.INVOICE.CUSTOMER_INVALID` | 422 | |
| `TRADE.INVOICE.LINE_INVALID` | 422 | |
| `TRADE.INVOICE.FINANCIAL_EVIDENCE_INVALID` | 422 | |
| `TRADE.FINALIZED_DOCUMENT.SNAPSHOT_INCOMPLETE` | 422 | the arithmetic identities failed |
| `TRADE.FINALIZED_DOCUMENT.NUMBERING_UNAVAILABLE` | **422** | the document-number sequence could not be reserved. **Not a 503**, despite reading like a dependency failure — the portal should offer a retry rather than a validation message |
| `TRADE.CONTEXT.MISSING_COMPANY` | **422** | thrown from the service, not the guard — the same code the guard raises as a 400 |
| `TRADE.INVOICE.TRANSITION_NOT_ALLOWED` | **409** | `assertDraft` — `PATCH` or `issue` on an already-`ISSUED` invoice |

---

## Contracts — 7 routes

> **Feature gate: `trade.sales`.** `TradeContractsController` and
> `TradeContractPdfController` require Sales on all seven routes. Missing Sales
> returns 403 `TRADE.ENTITLEMENT.FEATURE_REQUIRED`. The unseeded future
> `trade.contracts_recurring` feature does not grant access to manual contracts.

| Method | Canonical path | Permission | Body / query |
| --- | --- | --- | --- |
| GET | `/api/tenant/trade/v1/contracts` | `trade.contracts.read` | `DocumentListQueryDto` |
| POST | `/api/tenant/trade/v1/contracts` | `trade.contracts.create` | `CreateContractDto` |
| GET | `/api/tenant/trade/v1/contracts/:id` | `trade.contracts.read` | — |
| PATCH | `/api/tenant/trade/v1/contracts/:id` | `trade.contracts.update` | `UpdateContractDto` · `If-Match` |
| POST | `/api/tenant/trade/v1/contracts/:id/activate` | `trade.contracts.activate` | **no body** · `If-Match` — **200** |
| POST | `/api/tenant/trade/v1/contracts/:documentId/render-pdf` | `trade.contracts.read` | `RenderTradeBusinessPdfDto` — **202** |
| GET | `/api/tenant/trade/v1/contracts/:documentId/render-jobs/:renderJobId` | `trade.contracts.read` | — |

### The state machine — three states, and only one is reachable

```sql
ck_trade_contracts_final:
  (lifecycle_status = 'DRAFT'  AND finalized_at IS NULL)
  OR (lifecycle_status IN ('ACTIVE','SIGNED') AND finalized_at IS NOT NULL)
```

The database allows **`DRAFT`** · **`ACTIVE`** · **`SIGNED`**. The API can
only produce two of them: `POST /contracts` writes `DRAFT` and
`POST /:id/activate` writes `ACTIVE`. **Nothing in `trade-app/src` ever writes
`SIGNED`.** Render it — a row can carry it, set by a projection or a
migration — but there is no route that produces it and no route that acts on
it. Recorded as **Q35**.

### Request bodies

Same full-replacement rule as invoices.

| DTO | Fields |
| --- | --- |
| `CreateContractDto` | `partyId`, `currencyCode`, plus all of `ContractDraftContentDto` |
| `ContractDraftContentDto` | `effectiveFrom?`, `effectiveTo?`, `reference?` (≤ 120), `notes?` (≤ 8000), `termsSnapshot` (**required object**), `financialTerms` (**required**), `clauses[]` (1–500) |
| `ContractFinancialTermsDto` | `mode` — `@IsIn(["FINANCIAL","NON_FINANCIAL"])`, an **inline list, not an exported enum** — `sourceEvidence` (required object), `totalsSnapshot` (`FinancialTotalsDto`) |
| `ContractClauseInputDto` | `clientClauseId` (UUID v7), `title` (≤ 500), `body` (**≤ 20 000 characters**) |
| `UpdateContractDto` | identical to `ContractDraftContentDto` |

Create/update request separation re-verified against the DTO source on
**2026-10-17** (CXTRADE-SALES-113). The contract drawer uses separate create
and update builders. Party and currency are read-only when editing; PATCH
explicitly selects only draft-content fields, excluding `partyId` and
`currencyCode` even from a create-shaped input. POST retains both required
identity fields. Strict backend whitelisting stays enabled.

A `NON_FINANCIAL` contract still requires a complete `totalsSnapshot`; the
mode does not make it optional.

Contract editing hydrates the actual eight stored totals, including tax and
rounding, and never synthesizes a priced line from the subtotal. The drawer
preserves `termsSnapshot`, including custom governing law, termination terms
and other negotiated keys, and extracts the original financial mode and
`sourceEvidence` from `termsSnapshot.financial`. A notes-only update sends
those values unchanged. Create defaults are used only for new contracts.
Restoring an edited amount, including a formatting-only change, restores the
original totals snapshot rather than recalculating its decimal strings or
payment values (CXTRADE-SALES-114, **2026-10-17**).
The existing update permission, DTO validation and error handling apply;
these paths are source-integrated, with runtime verification pending.

### Errors

| `code` | Status |
| --- | --- |
| `TRADE.CONTRACT.NOT_FOUND` | 404 |
| `TRADE.CONTRACT.EVIDENCE_INVALID` | 422 |
| `TRADE.FINALIZED_DOCUMENT.SNAPSHOT_INCOMPLETE` | 422 |
| `TRADE.FINALIZED_DOCUMENT.NUMBERING_UNAVAILABLE` | **422** |
| `TRADE.CONTRACT.TRANSITION_NOT_ALLOWED` | **409** — `assertDraft`, on `PATCH` or `activate` after the contract left `DRAFT` |

---

## PDF rendering and authorized quotation artifacts

PDF artifact URL validation reviewed **2026-10-30** (AUDIT29V-TP-2):
the portal parses `artifact.downloadUrl` as an absolute URL before exposing
the download action. HTTPS is accepted; HTTP is accepted only when the portal
itself is served over HTTP. Other schemes, relative URLs and malformed URLs
raise the existing invalid Trade response error. Accepted presigned URLs are
preserved exactly. Regression specs cover both portal protocols and missing
browser context; execution and the tenant rebuild are pending lead verification.

Six families each expose a `POST …/render-pdf` (**202**) and a
`GET …/render-jobs/:renderJobId`. All twelve are Gateway `BRANCH_REQUIRED`.
The six `POST`s pin a `fingerprintSchemaId` and a 128 KiB replay-body cap.
The six `GET`s set `Cache-Control: no-store, private`.

`RenderQuotationPdfDto` (quotations only):
`revisionId` **required**, `templateVersionId?`, `locale?`
(`^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$`, ≤ 35), `timeZone?` (IANA-shaped,
≤ 64), `purpose` — `@IsIn(["CUSTOMER_QUOTATION"])`, **the only accepted
value**.

`RenderTradeBusinessPdfDto` (the other five):
`sourceVersion` (**int ≥ 1, required** — the current document version read by the caller),
`templateVersionId?`, `locale?`, `timeZone?`, `purpose` —
`@IsIn(["SUPPLIER_QUOTATION","SALES_ORDER","PURCHASE_ORDER","INVOICE","CONTRACT"])`.
`purpose` must match the route's own family; it is not inferred.

Order PDF revision handling re-verified **2026-10-17** against
`TypeOrmTradeBusinessPdfRepository` and `useSalesOrderScreen`. Sales-order
requests continue to send `order.version` as the initial read precondition.
The server resolves the confirmed immutable snapshot, and the job's
`sourceVersion` identifies that snapshot's confirmation version, which may
be older than the request's operational version. Hold/release and fulfillment
updates preserve the same print source and checksums. The commit transaction
rechecks the exact prepared print revision and the current order's scope and
lifecycle; cancellation prevents a new render. Existing write `If-Match` and
idempotency requirements remain unchanged.

### Quotation workspace and binary preview

Source-reviewed **2026-11-04**: Gateway now validates the canonical
`/api/tenant/trade/v1/{segment}/{documentId}/render-jobs/` Location prefix.
The portal rebuilds poll paths from validated document/job UUIDs and does not
follow a response-supplied origin. The historical Q36 mismatch is no longer
the source contract.

`QuotationPdfWorkspace` is shared by the standalone create flow, Fast Add
receipt and existing quotation detail. Rendering requires a confirmed current
detail, quotation read authority and a current revision in `SENT`, `ACCEPTED`
or `REJECTED`; `DRAFT` remains blocked. The request pins revision, purpose,
locale, time zone and optional published `templateVersionId`.

Quotation detail can reopen a completed PDF at
`/trade/quotations/{quotationId}?pdfJobId={renderJobId}`. The workspace uses the
existing scoped status GET and requires a matching quotation, current revision,
job and completed artifact before enabling Preview and Download. Opening the
link sends no render POST. The job and any pending read are cleared on
navigation away from the job or a quotation, revision, scope or session change.
The completed PDF panel links to this same signed-in workspace in a new tab
using the validated render job ID.
Source verified **2026-11-14**.

The gallery independently requires Core template read authority and verifies
an ACTIVE QUOTATION/PRINT definition with the Trade quotation adapter plus a
PUBLISHED immutable version that supports PDF. Library denial does not remove
the branch-default render option. Optional design preview requires template
preview authority and uses a discovered synthetic fixture, visibly separated
from the customer's actual quotation PDF.

Unknown render responses preserve the exact request, immutable scope headers
and idempotency key for recovery. Bounded polling stops on terminal job state,
including failure inside HTTP 200, and can resume the same job. A completed
job's expired signed download link is renewed with GET of that job, never a
new render. Source-revision or scope changes hide the previous job immediately.

The quotation-only artifact GET reauthorizes tenant/company/branch and exact
quotation/job membership. It accepts no URL or storage key from the caller;
completed metadata, immutable storage ownership, byte size/checksum and PDF
signature are verified before streaming. It returns raw `application/pdf`,
`Content-Length`, a safe inline filename, `Cache-Control: no-store, private`
and `X-Content-Type-Options: nosniff`, with a 25 MiB limit.
The portal reads it through `axiosClient` using exact scope headers,
`responseType: "blob"`, no-store and the same byte bound. A MIME/signature
check precedes `URL.createObjectURL`; the viewer revokes object URLs on close,
context change or unmount. Signed download URLs are not used as iframe sources.

### PDF errors

Quotation renders use the `TRADE.QUOTE.PDF_*` family; the other five use
`TRADE.BUSINESS_DOCUMENT.PDF_*`. The shapes are parallel:

| `code` suffix | Status | When |
| --- | --- | --- |
| `PDF_NOT_FOUND` | 404 | unknown job or document |
| `PDF_REVISION_NOT_ELIGIBLE` / `PDF_SOURCE_NOT_ELIGIBLE` | 409 | the revision or `sourceVersion` is not printable |
| `PDF_TEMPLATE_INCOMPATIBLE` | **422** | |
| `PDF_TEMPLATE_CHANGED` | **409** | commit-time template recheck refused |
| `PDF_BUNDLE_UNAVAILABLE` | **503** | |
| `PDF_ARTIFACT_UNAVAILABLE` | **503** | rendered, but the artifact cannot be fetched |
| `PDF_INPUT_EXPIRED` | **none** | see below |
| `PDF_RENDER_FAILED` | **none** | see below |
| `PDF_RESULT_CONFLICT` | **none** | see below |
| `TRADE.STORAGE.UNAVAILABLE` | **503** | from `common/trade-storage-runtime.resolver.ts`; **not in `TRADE_ERROR_CODES`** |

> **Those three are never HTTP statuses.** `quotation-pdf-results.service.ts`
> and `business-document-pdf-results.service.ts` contain no
> `new …Exception` at all. They are written into the render-job record when
> the worker reports back — `INPUT_EXPIRED` and `RENDER_FAILED` via
> `safePdfFailureCode`, `RESULT_CONFLICT` onto the inbox row and onto a
> control-tower exception. The portal reads them **inside the 200 body of
> `GET …/render-jobs/:renderJobId`**, not from a failed request. A polling
> loop that only inspects HTTP status will spin forever on a failed render.

`TRADE.QUOTE.PDF_TEMPLATE_PIN_STALE` is thrown as a **plain `Error`**, not an
HTTP exception, and is caught by both PDF repositories and re-thrown as
`PDF_TEMPLATE_INCOMPATIBLE` (409). It never reaches the browser. It is also
not in `TRADE_ERROR_CODES`.

Three 503s in this family are **retryable, not refusals**. Rendering the
generic error state for them loses a user who only needed to press the button
again.

---

## The Gateway scope policy on this page

**28 of the 34** Trade routes that declare an `organizationScopeMode` are on
this page, and all 28 are **`BRANCH_REQUIRED`**: the six non-PDF
purchase-quotation routes, the five non-PDF invoice routes, the five non-PDF
contract routes, and all twelve PDF routes. On those, sending a branch header
without a company header, or a malformed UUID, is refused by the Gateway as
RFC 7807 `GW.REQUEST.INVALID` (**400**) before trade-app sees the request — a
different body shape from the app's own `TRADE.CONTEXT.*` errors for the same
mistake.

The other six are four on
[trade-foundation.md](trade-foundation.md#uom-master--4-routes) — `GET /uoms`
and `GET /uoms/:id` as `BRANCH_REQUIRED`, `POST /uoms` and `PATCH /uoms/:id`
as `NONE` — and two on
[trade-advanced.md](trade-advanced.md#the-two-gateway-scoped-import-routes) as
`OPTIONAL_COMPANY_BRANCH`.

Every other route on this page — all of quotations, sales orders and purchase
orders except their PDF routes — declares **no** Gateway mode, so their scope
headers are validated only by `TradeScopeGuard`, as
**400 `TRADE.CONTEXT.MISSING_COMPANY`** / **`MISSING_BRANCH`**.

**Two neighbouring routes therefore disagree about which layer refuses a
missing header**: `GET /invoices` answers a Gateway 400 with `code`, while
`GET /quotations` answers an app 400 with `code`. Normalize both.

---

## Feature keys that gate nothing

`TRADE_FEATURES` declares 15 keys. **Only 8 are referenced by any
`@RequireTradeFeature*` decorator** in `trade-app/src`:
`trade.catalog`, `trade.pricing`, `trade.sales`, `trade.purchasing`,
`trade.inventory`, `trade.policy_studio`, `trade.automation`,
`trade.analytics`.

These seven gate **no route at all**:

```text
trade.pos            trade.channels          trade.contracts_recurring
trade.intercompany   trade.extension_marketplace
trade.control_tower_advanced                 trade.intelligence
```

MASTER-PLAN task 10.2 asks for "the 15 features, the scope targets, and how
they compose". The honest answer is that eight compose and seven are inert.
Two plan tasks build on the inert ones: **11.18** (contracts gated on
`trade.contracts_recurring`) and **12.19** (control tower gated on
`trade.control_tower_advanced`). Both are wrong; the correct gates are
"`trade.sales`" and "`trade.analytics` plus one domain feature" respectively.

---

## What will bite you

1. **The browser must compute and submit every total.** Task 11.20's premise
   is inverted. Call `POST /pricing/evaluate` per line first — sales orders
   and purchase orders do not accept a `unitPrice`, and the server checks
   your arithmetic against its own resolved price.
2. **All fifteen evidence failures share one code and one status.** 422
   `TRADE.FINALIZED_DOCUMENT.SNAPSHOT_INCOMPLETE`, with no field. The portal
   cannot say which line was wrong (Q33).
3. **`roundingTotal` is signed on orders and non-negative on invoices.**
4. **Build poll URLs from validated IDs.** Confirmation-attempt Location has
   historical Q34 limitations; PDF Locations now use the canonical prefix.
5. **`POST /sales-orders/:id/confirm` returns 200 *or* 202.** There is no
   `@HttpCode`. Branch on the status, and read `data.statusCode` too.
6. **A sales order has four status axes.** One badge is a lie.
7. **`withdraw` sets a purchase order back to `NOT_REQUIRED`, not
   `WITHDRAWN`.** The order row loses the fact that it was ever submitted.
8. **`PATCH` on an invoice or contract is a full replacement**, including
   every line and both snapshots. There is no partial edit.
9. **Quotation `reject`/`cancel` without a `reasonCode` is a 409, not a 400.**
   Validate locally or the user sees a transition error for a missing field.
10. **`customer-options` needs `trade.quotations.create`.** Blocked customers
    come back in the list with a `denialCode` rather than being filtered out.
11. **The customer-options cursor is silently ignored when invalid** — a
    broken cursor looks like an infinite first page, not an error.
12. **Invoices and contracts require `trade.sales`**, including PDF routes and
    portal navigation. `trade.contracts_recurring` does not grant manual access.
13. **Eight quotation error codes in the catalogue have no throw site.** Do not
    build UI branches for them.
14. **A failed PDF render is a 200.** `PDF_INPUT_EXPIRED`,
    `PDF_RENDER_FAILED` and `PDF_RESULT_CONFLICT` are fields on the render-job
    record, never HTTP statuses. Poll on the job's own state, not on the
    response status.

---

## Not verified

- ~~The initial `status` literal of a quotation revision.~~ **Now verified:**
  `createQuotationRevision` assigns `status: "DRAFT"` explicitly, and
  `quotationAction`'s `send` branch refuses anything else. The five revision
  statuses are `DRAFT` · `SENT` · `ACCEPTED` · `REJECTED` · `CANCELLED`.
- **`DocumentLifecycleStatus.CLOSED`.** Exported, never assigned in
  `trade-app/src`. It may be written by a projection outside the HTTP path.
- **`SIGNED` on contracts** — allowed by the check constraint, produced by no
  route (Q35).
- **Codes in `TRADE_ERROR_CODES` with no reference anywhere in
  `trade-app/src`**, all on this page's families:
  `QUOTE_CUSTOMER_AMBIGUOUS`, `QUOTE_REVISION_IMMUTABLE`,
  `QUOTE_SEND_NOT_ALLOWED`, `QUOTE_ACCEPTANCE_INVALID`,
  `QUOTE_ACCEPT_NOT_ALLOWED`, `QUOTE_REVISION_SUPERSEDED`,
  `QUOTE_ALREADY_ACCEPTED`, `QUOTE_ALREADY_CONVERTED`,
  `SALES_ORDER_ALREADY_CONVERTED`, `SALES_ORDER_CANCEL_QUANTITY_INVALID`,
  `PURCHASE_ORDER_PROCUREMENT_REQUIRED`,
  `PURCHASE_ORDER_CANCEL_QUANTITY_INVALID`. Verified by grepping the constant
  name, not just `code:` lines — several codes elsewhere on this page are
  raised through a ternary or a helper factory and would be missed by the
  narrower search.
- **Response field lists.** Trade has no response DTO classes. This page
  documents request DTOs and the status/id fields that are demonstrably
  written by a service. The complete response body of a document `GET` was not
  enumerated field by field.
- **Historical Q36 deployment evidence.** Current source validates canonical
  PDF Locations; source alignment alone does not establish a successful live
  Worker render, storage artifact stream or browser preview.
- **`fulfillment_status` and `billing_status` transitions.** The enums are
  exhaustive; the code paths that advance them are in projections outside the
  HTTP surface and were not traced. `settlement_status` is not among them —
  there is no such column.
