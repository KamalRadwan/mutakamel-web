# Trade — Advanced and Analytics

Status: **verified**

Last source verification: **2026-08-31** (re-verified during the Phase 12
build: Q90, Q91 and Q92 below were found then and are corrected inline)

Owning app: **trade-app**

Canonical prefixes: `/api/tenant/trade/v1/inventory`, `.../price-books`,
`.../price-book-versions`, `.../pricing`, `.../policies`,
`.../policy-versions`, `.../workflows`, `.../workflow-versions`,
`.../decisions`, `.../document-profiles`, `.../document-profile-versions`,
`.../extensions`, `.../import-mappings`, `.../imports`, `.../webhooks`,
`.../control-tower`, `.../dashboards`, `.../widgets`

Upstream: `/api/v1/trade/*`

Portal status: **not built** — this page is the contract for MASTER-PLAN
Phase 12. No screen calls any of these routes yet.

**129 routes.** Inventory 26 · Dashboards 20 · Widgets 11 · Webhooks 11 ·
Policy versions 9 · Workflow versions 9 · Extensions 9 · Imports 7 ·
Import mappings 4 · Control tower 4 · Workflows 3 · Policies 3 ·
Price books 3 · Price-book versions 3 · Document profiles 3 ·
Document-profile versions 2 · Pricing evaluate 1 · Decisions 1.

Together with [trade-foundation.md](trade-foundation.md) (42) and
[trade-documents.md](trade-documents.md) (60) this accounts for all
**231** Trade routes exactly once. 42 + 60 + 129 = 231.

Source inspected:
`trade-app/src/modules/inventory/inventory.controller.ts`,
`trade-app/src/modules/inventory/inventory.service.ts`,
`trade-app/src/modules/inventory/inventory-governance.service.ts`,
`trade-app/src/modules/inventory/dto/inventory.dto.ts`,
`trade-app/src/modules/pricing/pricing.controller.ts`,
`trade-app/src/modules/pricing/pricing-read.controller.ts`,
`trade-app/src/modules/pricing/pricing.service.ts`,
`trade-app/src/modules/pricing/price-lock.service.ts`,
`trade-app/src/modules/pricing/dto/pricing.dto.ts`,
`trade-app/src/modules/policy-studio/policy-studio.controller.ts`,
`trade-app/src/modules/policy-studio/policy-studio.service.ts`,
`trade-app/src/modules/policy-studio/dto/policy-studio.dto.ts`,
`trade-app/src/modules/document-platform/document-profile.controller.ts`,
`trade-app/src/modules/document-platform/dto/document-profile.dto.ts`,
`trade-app/src/modules/extensions-automation/extensions-automation.controller.ts`,
`trade-app/src/modules/extensions-automation/dto/extensions-automation.dto.ts`,
`trade-app/src/modules/extensions-automation/dto/extension-owner-values.dto.ts`,
`trade-app/src/modules/extensions-automation/import-source.service.ts`,
`trade-app/src/modules/extensions-automation/webhook-subscriptions.service.ts`,
`trade-app/src/modules/control-tower/control-tower.controller.ts`,
`trade-app/src/modules/control-tower/control-tower.service.ts`,
`trade-app/src/modules/control-tower/dto/control-tower.dto.ts`,
`trade-app/src/modules/dashboards/dashboard.controller.ts`,
`trade-app/src/modules/dashboards/widget.controller.ts`,
`trade-app/src/modules/dashboards/dashboard-definition.service.ts`,
`trade-app/src/modules/dashboards/dashboard-metric-provider.service.ts`,
`trade-app/src/modules/dashboards/dashboard-catalog.ts`,
`trade-app/src/modules/dashboards/dto/dashboard.dto.ts`,
`trade-app/src/common/trade-import-source-security-policy.service.ts`,
`trade-app/packages/common/src/constants/limits.ts`,
`trade-app/packages/common/src/enums/trade.enums.ts`,
`api-gateway-app/src/routing-proxy/route-contracts/trade.route-contracts.ts`.

---

## The envelope — Trade **is** wrapped

> **Every Trade response is wrapped in `data`.** Unwrap it the way you unwrap
> Core. Getting this wrong breaks every Trade screen at once.

`TradeResponseInterceptor` is a global `APP_INTERCEPTOR` in the `@Global()`
`CommonModule`. The envelope shape, the `code` key instead of `errorCode`, the
guard order, entitlement refusals, the header-only scope contract, the two
idempotency layers, the single `If-Match` parser and the decimal-string rules
are documented once in
[trade-foundation.md — What applies to every route](trade-foundation.md#what-applies-to-every-route-on-this-page)
and apply unchanged here, **with two exceptions on this page**:

- **Dashboards and widgets do not use `version`, and their write responses are
  not unwrapped.** See [Dashboards and widgets are shaped differently](#dashboards-and-widgets-are-shaped-differently).
- **Pagination has three dialects on this page**, not one. See below.

---

## Pagination — three dialects, and some lists have none

| Dialect | Parameters | Where |
| --- | --- | --- |
| **Offset page** | `page` (≥ 1) + `limit` | policies, workflows, document profiles, extension profiles and versions, import mappings, import runs, import results, webhook subscriptions, webhook deliveries, control-tower exceptions |
| **Limit only** | `limit` only — **no `page`** | inventory periods, inventory UOM conversions, inventory serials, inventory decisions, share-targets |
| **Limit + offset** | `limit` + **`offset`** (≥ 0) | `GET /dashboards` |
| **None** | no query DTO at all | `GET /widgets`, `GET /dashboards/catalog` |

Sending `page` to a limit-only route is a **400**, because the global pipe runs
`forbidNonWhitelisted`. A single shared list hook will not work across this
page; the parameter set has to be per family.

Offset-paged responses are flat — `{ items, total, page, limit }` inside
`data`, with no `meta`, `totalPages`, `hasNext` or `hasPrev`. Limit-only
responses carry no `total` at all, so "is there more?" is not answerable; the
only signal is `items.length === limit`.

No route on this page is cursor-paged. The only cursor in Trade is on
`GET /quotations/customer-options` — see
[trade-documents.md](trade-documents.md#the-one-cursor-in-trade).

---

## Inventory — 26 routes

Feature gate: **`trade.inventory`** on every route.

| Method | Canonical path | Permission | Scope target |
| --- | --- | --- | --- |
| GET | `/api/tenant/trade/v1/inventory/availability` | `trade.inventory.read` | `BRANCH` |
| GET | `/api/tenant/trade/v1/inventory/nodes` | `trade.inventory.read` | `BRANCH` |
| GET | `/api/tenant/trade/v1/inventory/nodes/:id` | `trade.inventory.read` | `BRANCH` |
| POST | `/api/tenant/trade/v1/inventory/nodes` | `trade.inventory.nodes.manage` | `COMPANY` |
| PATCH | `/api/tenant/trade/v1/inventory/nodes/:id` | `trade.inventory.nodes.manage` | `COMPANY` · `If-Match` |
| GET | `/api/tenant/trade/v1/inventory/periods` | `trade.inventory.read` | `COMPANY` |
| POST | `/api/tenant/trade/v1/inventory/periods` | `trade.inventory.governance.manage` | `COMPANY` |
| POST | `/api/tenant/trade/v1/inventory/periods/:id/close` | `trade.inventory.governance.manage` | `COMPANY` · `If-Match` — **200** |
| POST | `/api/tenant/trade/v1/inventory/periods/:id/reopen` | `trade.inventory.governance.manage` | `COMPANY` · `If-Match` — **200** |
| GET | `/api/tenant/trade/v1/inventory/uom-conversions` | `trade.inventory.read` | `COMPANY` |
| POST | `/api/tenant/trade/v1/inventory/uom-conversions` | `trade.inventory.governance.manage` | `COMPANY` |
| POST | `/api/tenant/trade/v1/inventory/uom-conversions/:id/publish` | `trade.inventory.governance.manage` | `COMPANY` · `If-Match` — **200** |
| POST | `/api/tenant/trade/v1/inventory/uom-conversions/:id/retire` | `trade.inventory.governance.manage` | `COMPANY` · `If-Match` — **200** |
| GET | `/api/tenant/trade/v1/inventory/serials` | `trade.inventory.read` | `COMPANY` |
| GET | `/api/tenant/trade/v1/inventory/serials/:id` | `trade.inventory.read` | `COMPANY` |
| GET | `/api/tenant/trade/v1/inventory/decisions` | `trade.inventory.read` | `COMPANY` |
| GET | `/api/tenant/trade/v1/inventory/decisions/:id` | `trade.inventory.read` | `COMPANY` |
| POST | `/api/tenant/trade/v1/inventory/opening-balances` | `trade.inventory.opening_balance` | `BRANCH` |
| POST | `/api/tenant/trade/v1/inventory/reservations` | `trade.inventory.reserve` | `BRANCH` |
| POST | `/api/tenant/trade/v1/inventory/reservations/:id/release` | `trade.inventory.reserve` | `BRANCH` · `If-Match` — **200** |
| POST | `/api/tenant/trade/v1/inventory/receipts` | `trade.inventory.receive` | `BRANCH` |
| POST | `/api/tenant/trade/v1/inventory/receipts/:id/post` | `trade.inventory.receive` | `BRANCH` · `If-Match` — **200** |
| POST | `/api/tenant/trade/v1/inventory/receipts/:id/reverse` | **`trade.inventory.adjust`** | `BRANCH` · `If-Match` — **200** |
| POST | `/api/tenant/trade/v1/inventory/deliveries` | `trade.inventory.deliver` | `BRANCH` |
| POST | `/api/tenant/trade/v1/inventory/deliveries/:id/post` | `trade.inventory.deliver` | `BRANCH` · `If-Match` — **200** |
| POST | `/api/tenant/trade/v1/inventory/deliveries/:id/reverse` | **`trade.inventory.adjust`** | `BRANCH` · `If-Match` — **200** |

Every mutating route requires `x-idempotency-key`.

> **Scope is split down the middle.** Reads of nodes and availability are
> `BRANCH`; reads of periods, conversions, serials and decisions are
> `COMPANY`; node writes are `COMPANY` but every movement is `BRANCH`. A
> single "inventory context" selector will send the wrong headers on half the
> screen. Note also that **`GET /inventory/nodes` is `BRANCH` while
> `POST /inventory/nodes` is `COMPANY`** — the same neighbouring-route
> disagreement as `/uoms`, though here both layers are the app's, so both
> refusals are `TRADE.CONTEXT.*` 400s rather than a Gateway 400.

**Reversal is a different permission from the movement.** `receipts/:id/post`
needs `trade.inventory.receive` but `receipts/:id/reverse` needs
`trade.inventory.adjust`. The same split applies to deliveries. A user who can
post can not necessarily undo.

There are **no** `GET` routes for receipts, deliveries, reservations or
opening balances. They can be created, posted and reversed, but not listed or
fetched. MASTER-PLAN task 12.27 asks for detail pages for receipts and
deliveries; **there is no route behind them.** Recorded as **Q37**.

**`trade.inventory.view_cost` is in the permission catalogue and gates no
route.**

### Request bodies

| DTO | Fields |
| --- | --- |
| `AvailabilityQueryDto` | `nodeId` **required**, `itemId` **required**, `uomId?`, `lotKey?` (≤ 120), `serialKey?` (≤ 120) — **not a list; one item at one node per call** |
| `CreateNodeDto` | `code` (≤ 80), `name` (≤ 160), `nodeType` (`WAREHOUSE`/`STORE`/`VIRTUAL`), `timezone` (≤ 64), `branchIds[]` (1–100 UUID v7) |
| `UpdateNodeDto` | `name?`, `status?` (`ACTIVE`/`INACTIVE`), `timezone?`, `branchIds?` (1–100) |
| `OpeningBalanceDto` | `nodeId`, `itemId`, `uomId`, `quantity` (**positive** decimal string), `itemProfileVersion` (int ≥ 1), `businessEffectiveAt` (ISO 8601 strict), `operationKey` (UUID v7), `tracking?` (**defaults to `{}`**) |
| `CreateReservationDto` | `nodeId`, `itemId`, `uomId`, `quantity`, `sourceDocumentId`, `sourceLineId`, `sourceDocumentVersion` (int ≥ 1), `sourceLineVersion` (int ≥ 1), `intentKey` (UUID v7), `expiresAt?`, `tracking?` |
| `ReleaseReservationDto` | `quantity?` (positive; omit for a full release), `reasonCode?` (≤ 80) |
| `CreateReceiptDto` | `nodeId`, `purchaseOrderId`, `operationKey` (UUID v7), `sourceDocumentVersion` (int ≥ 1), `businessEffectiveAt`, `lines[]` (1–500) |
| `ReceiptLineDto` | `purchaseOrderLineId`, `sourceLineVersion`, `uomId`, `quantity`, `tracking?` |
| `CreateDeliveryDto` | `nodeId`, `salesOrderId`, `operationKey`, `sourceDocumentVersion`, `businessEffectiveAt`, `lines[]` (1–500) |
| `DeliveryLineDto` | `salesOrderLineId`, `reservationId?`, `sourceLineVersion`, `uomId`, `quantity`, `tracking?` |
| `ReverseMovementDto` | `reasonCode` (≤ 80) **required**, `businessEffectiveAt` **required**, `lines?` (1–500 `{ lineId, quantity }` — omit for a full reversal) |
| `CreateInventoryPeriodDto` | `code` (`^[A-Z][A-Z0-9_.-]{1,79}$`), `startsOn` / `endsOn` (`YYYY-MM-DD`, **not ISO date-time**), `maxBackdateDays` (0–366) |
| `InventoryPeriodTransitionDto` | `reasonCode` — must match the same `^[A-Z][A-Z0-9_.-]{1,79}$` code pattern, **not free text** |
| `CreateInventoryUomConversionDto` | `itemCompanyProfileId`, `fromUomId`, `toUomId`, `factorNumerator` / `factorDenominator` (**`^[1-9]\d{0,17}$` — positive integers as strings, not decimals**), `effectiveFrom` |
| `InventoryUomConversionActionDto` | `reasonCode` — same uppercase code pattern |

`operationKey` and `intentKey` are **caller-supplied UUID v7 idempotency
tokens inside the body**, in addition to the `x-idempotency-key` header. They
are the movement's business identity; reuse them on a retry.

### Statuses

| Thing | Values | Source |
| --- | --- | --- |
| Node `status` | **`ACTIVE`** · **`INACTIVE`** | `UpdateNodeDto` `@IsIn` |
| Node `nodeType` | **`WAREHOUSE`** · **`STORE`** · **`VIRTUAL`** | `CreateNodeDto` `@IsIn` |
| Period `status` | **`OPEN`** · **`CLOSED`** | list-query `@IsIn` |
| UOM conversion `status` | **`DRAFT`** · **`PUBLISHED`** · **`RETIRED`** | list-query `@IsIn` |
| Serial `state` | **`ON_HAND`** · **`RESERVED`** · **`DELIVERED`** · **`VOIDED`** | list-query `@IsIn` |
| Decision `policyKind` | **`INVENTORY_RESERVATION`** · **`INVENTORY_NEGATIVE`** · **`INVENTORY_OVER_RECEIPT`** | list-query `@IsIn` |

All six are inline `@IsIn` lists on query DTOs, **not exported enums**. There
is no separate receipt or delivery status enum anywhere in source.

**Periods and UOM conversions have no `GET` by id either.** Each has a
limit-only list and two transitions, and nothing that reads one row. MASTER-PLAN
12.27 names periods among the detail pages to build; there is no route behind
that one either. Recorded as **Q90**. Both rows do carry `version`, so the
`If-Match` a transition needs is available from the list without a second read.

### Errors

| `code` | Status | When |
| --- | --- | --- |
| `TRADE.INVENTORY.SCOPE_INVALID` | **422**, also **404** | node not reachable from the scope |
| `TRADE.INVENTORY.NODE_INVALID` | 422 | |
| `TRADE.INVENTORY.ITEM_NOT_STOCK_TRACKED` | 422 | the item's company profile has `trackInventory: false` |
| `TRADE.INVENTORY.QUANTITY_INVALID` | 422 | |
| `TRADE.INVENTORY.TRACKING_REQUIRED` | 422 | a `LOT`/`SERIAL` item was moved without `tracking` |
| `TRADE.INVENTORY.TRACKING_UNSUPPORTED` | 422 | `tracking` sent for a `NONE` item |
| `TRADE.INVENTORY.INSUFFICIENT_AVAILABILITY` | 422 | |
| `TRADE.INVENTORY.PERIOD_CLOSED` | **422**, also **409** | `businessEffectiveAt` falls in a closed period |
| `TRADE.INVENTORY.POLICY_REJECTED` | 422 | an inventory policy refused the movement |
| `TRADE.INVENTORY.UOM_CONVERSION_INVALID` | 422 | |
| `TRADE.INVENTORY.UOM_CONVERSION_UNAVAILABLE` | 422 | no published conversion for the pair |
| `TRADE.CONCURRENCY.STALE_VERSION` | 409 | |

Six more are raised through the module's own helper factories —
`inventoryConflict()` (`ConflictException`), `inventoryNotFound()`
(`NotFoundException`) and `assertUnique()`, which delegates to
`inventoryConflict` — so the code never appears on the same line as the
exception:

| `code` | Status | When |
| --- | --- | --- |
| `TRADE.INVENTORY.RECEIPT_NOT_ALLOWED` | **409** | duplicate `purchaseOrderLineId` in the request, and every refused receipt precondition |
| `TRADE.INVENTORY.DELIVERY_NOT_ALLOWED` | **409** | duplicate `salesOrderLineId` or duplicate `reservationId`, and every refused delivery precondition |
| `TRADE.INVENTORY.RELEASE_NOT_ALLOWED` | **409**, also **404** | 404 when the reservation is not found in the company scope, 409 for a refused release |
| `TRADE.INVENTORY.REVERSAL_NOT_ALLOWED` | **409** | more than the per-post line cap, duplicate `lineId`, or a refused reversal |
| `TRADE.INVENTORY.NODE_IN_USE` | **409** | deactivating a node that still carries stock or references |
| `TRADE.INVENTORY.SERIAL_CONFLICT` | **409** | three sites in `inventory.service.ts` |
| `TRADE.INVENTORY.RESERVATION_CONFLICT` | **409** | from `inventory.service.ts`; the same code is **also** used as a broker rejection reason in `inventory-reservation-intents.service.ts`, where it is data on the attempt row, not an HTTP status |

Note how much of that is a **409**: on inventory, "duplicate line in your own
request body" and "the warehouse refused the movement" come back
indistinguishably.

**Three catalogue codes have no reference anywhere in `trade-app/src`**:
`INVENTORY_OVER_RECEIPT`, `INVENTORY_OWNER_EVENT_INVALID`,
`INVENTORY_EXPIRY_COMMAND_INVALID`.

---

## Price books — 7 routes

Feature gate: **`trade.pricing`**. All target **`COMPANY`**.

| Method | Canonical path | Permission |
| --- | --- | --- |
| GET | `/api/tenant/trade/v1/price-books` | `trade.pricing.read` |
| POST | `/api/tenant/trade/v1/price-books` | `trade.pricing.manage` |
| POST | `/api/tenant/trade/v1/price-books/:id/versions` | `trade.pricing.manage` · `If-Match` |
| GET | `/api/tenant/trade/v1/price-book-versions/:id` | `trade.pricing.read` |
| POST | `/api/tenant/trade/v1/price-book-versions/:id/test` | `trade.pricing.manage` · `If-Match` — **200** |
| POST | `/api/tenant/trade/v1/price-book-versions/:id/publish` | **`trade.policy.publish`** · `If-Match` — **200** |
| POST | `/api/tenant/trade/v1/pricing/evaluate` | `trade.pricing.read` — `COMPANY_OR_BRANCH`, **200** |

> **Publishing a price-book version needs `trade.policy.publish`, not
> `trade.pricing.manage`.** The same cross-family grant governs
> `POST /configuration/versions/:id/publish`. Two of the three publish actions
> in Trade are behind a Policy Studio permission.

The three `/configuration/company-default-price-books/*` routes belong to this
family too, but are documented with the rest of the `/configuration` prefix in
[trade-foundation.md](trade-foundation.md#configuration--9-routes) — they are
MASTER-PLAN task 12.12, and the judgement call is explained there.

### Request bodies

| DTO | Fields |
| --- | --- |
| `PriceBookListQueryDto` | `page`, `limit` (≤ 100, default 25), `purpose?`, `status?` (free string ≤ 32) |
| `CreatePriceBookDto` | `code` (≤ 80), `purpose`, `currencyCode` (`^[A-Z]{3}$`) |
| `CreatePriceBookVersionDto` | `effectiveFrom` (ISO 8601 strict), `effectiveTo?`, `entries[]` (**1–10 000**), `promotions[]` (0–500, **defaults to `[]`**) |
| `PriceEntryDto` | `itemId`, `uomId`, `currencyCode`, `minimumQuantity` (decimal string), `maximumQuantity?` (positive, nullable), `unitPrice` (decimal string), `minimumAllowedPrice?` (nullable), `priority?` (int 0–10 000, **default 100**) |
| `PromotionRuleDto` | `code` (≤ 80, `^[A-Za-z0-9][A-Za-z0-9._-]*$`), `name` (≤ 160), `benefitType`, `discountValue` (**positive** decimal string) — plus optional `itemId`, `uomId`, `branchId`, `channelId`, `partyId`, `minimumQuantity` (**default `"0"`**), `maximumQuantity?`, `priority?` (default 100), `stackGroup?` (**default `"DEFAULT"`**), `exclusive?` (default `false`) |
| `PricingEvaluateDto` | `purpose`, `itemId`, `uomId`, `quantity` (**positive** decimal string), `currencyCode` — all required — plus `priceBookId?` and `partyId?` |

`PriceBookPurpose`: **`SALES`** · **`PURCHASE`**.
`PromotionBenefitType`: **`PERCENTAGE`** · **`FIXED_AMOUNT`**.
Price-book **version** status is `GovernedVersionStatus`, below. Price-book
`status` itself is a free string with no enum.

Decimal-string fields on this page: `minimumQuantity`, `maximumQuantity`,
`unitPrice`, `minimumAllowedPrice`, `discountValue`, `quantity`. **Never
`Number()` any of them.**

### Pricing evaluation — 1 route

`POST /pricing/evaluate` is a `READ_HEAVY` **200** POST. It takes **no
idempotency key** — the handler has no `@Headers("x-idempotency-key")` and the
Gateway route class is `READ_HEAVY`, not `WRITE_SENSITIVE`.

This is the route [trade-documents.md](trade-documents.md#the-one-thing-phase-11-must-know-before-anything-else)
depends on: a sales-order or purchase-order line editor must call it per line
to learn the `unitPrice` the server will use, because the line DTOs do not
accept one and the totals check runs against the server's own resolved price.

Failures that matter to the line editor:

| `code` | Status | Meaning for the UI |
| --- | --- | --- |
| `TRADE.PRICE.NO_ELIGIBLE_PRICE` | **404** | no price applies. **404, not 422** — do not render it as a not-found page |
| `TRADE.PRICE.AMBIGUOUS_RULES` | **422**, also **409** | two rules tie; a human must resolve it |
| `TRADE.PRICE.TIER_OVERLAP` | 422 | |
| `TRADE.PRICE.VERSION_OVERLAP` | 409 | |
| `TRADE.PRICE.BOOK_NOT_FOUND` | 404 | |
| `TRADE.PRICE.BOOK_INVALID` | 422 | |
| `TRADE.PRICE.ENTRY_INVALID` | 422 | |
| `TRADE.PRICE.RULE_INVALID` | 422 | |
| `TRADE.PRICE.TEST_NOT_ALLOWED` | 409 | |
| `TRADE.PRICE.TEST_FAILED` | **409** | not 422 |
| `TRADE.PRICE.PUBLISH_NOT_ALLOWED` | 409 | |
| `TRADE.PRICE.MARGIN_GUARD` | 409 | |
| `TRADE.PRICE.LOCK_INVALID` / `LOCK_EXPIRED` / `LOCK_CONTEXT_MISMATCH` | 409 | price locks, issued when a quotation is sent |

`TRADE.PRICE.BOOK_ALREADY_EXISTS` is **409** on create.
`TRADE.PRICE.COST_UNAVAILABLE`, `TRADE.PRICE.FX_UNAVAILABLE` and
`TRADE.PRICE.OVERRIDE_REJECTED` are in the catalogue with **no reference
anywhere in `trade-app/src`** — verified by grepping the constant name, not
just `code:` lines.

---

## The governed-version ladder — policies, workflows, configuration, price books

Four families share one lifecycle enum, `GovernedVersionStatus`:

```text
DRAFT · TESTED · APPROVAL_PENDING · SCHEDULED · PUBLISHED · SUPERSEDED · RETIRED
```

**Seven values.** MASTER-PLAN tasks 12.13 and 12.14 describe the ladder as
"validate, test, submit, approve, reject, publish, retire, rollback" — eight
verbs against seven states. `SCHEDULED` and `SUPERSEDED` have no verb: a
version becomes `SCHEDULED` because its `effectiveFrom` is in the future, and
`SUPERSEDED` because a later version published over it. **Both are reached
without a user action and both must render**, or the screen shows a raw
string.

### Policies — 12 routes

| Method | Canonical path | Permission |
| --- | --- | --- |
| GET | `/api/tenant/trade/v1/policies` | `trade.policy.read` |
| POST | `/api/tenant/trade/v1/policies` | `trade.policy.manage` |
| POST | `/api/tenant/trade/v1/policies/:id/versions` | `trade.policy.manage` · `If-Match` |
| PATCH | `/api/tenant/trade/v1/policy-versions/:id` | `trade.policy.manage` · `If-Match` |
| POST | `/api/tenant/trade/v1/policy-versions/:id/validate` | `trade.policy.test` · `If-Match` — **200** |
| POST | `/api/tenant/trade/v1/policy-versions/:id/test` | `trade.policy.test` · `If-Match` — **200** |
| POST | `/api/tenant/trade/v1/policy-versions/:id/submit` | `trade.policy.manage` · `If-Match` — **200** |
| POST | `/api/tenant/trade/v1/policy-versions/:id/approve` | `trade.policy.approve` · `If-Match` — **200** |
| POST | `/api/tenant/trade/v1/policy-versions/:id/reject` | **`trade.policy.approve`** · `If-Match` — **200** |
| POST | `/api/tenant/trade/v1/policy-versions/:id/publish` | `trade.policy.publish` · `If-Match` — **200** |
| POST | `/api/tenant/trade/v1/policy-versions/:id/retire` | **`trade.policy.publish`** · `If-Match` — **200** |
| POST | `/api/tenant/trade/v1/policy-versions/:id/rollback` | **`trade.policy.publish`** · `If-Match` — **201** |

### Workflows — 12 routes

Identical shape, identical permissions, on `/workflows` and
`/workflow-versions`:

| Method | Canonical path | Permission |
| --- | --- | --- |
| GET | `/api/tenant/trade/v1/workflows` | `trade.policy.read` |
| POST | `/api/tenant/trade/v1/workflows` | `trade.policy.manage` |
| POST | `/api/tenant/trade/v1/workflows/:id/versions` | `trade.policy.manage` · `If-Match` |
| PATCH | `/api/tenant/trade/v1/workflow-versions/:id` | `trade.policy.manage` · `If-Match` |
| POST | `/api/tenant/trade/v1/workflow-versions/:id/validate` | `trade.policy.test` · `If-Match` — **200** |
| POST | `/api/tenant/trade/v1/workflow-versions/:id/test` | `trade.policy.test` · `If-Match` — **200** |
| POST | `/api/tenant/trade/v1/workflow-versions/:id/submit` | `trade.policy.manage` · `If-Match` — **200** |
| POST | `/api/tenant/trade/v1/workflow-versions/:id/approve` | `trade.policy.approve` · `If-Match` — **200** |
| POST | `/api/tenant/trade/v1/workflow-versions/:id/reject` | `trade.policy.approve` · `If-Match` — **200** |
| POST | `/api/tenant/trade/v1/workflow-versions/:id/publish` | `trade.policy.publish` · `If-Match` — **200** |
| POST | `/api/tenant/trade/v1/workflow-versions/:id/retire` | `trade.policy.publish` · `If-Match` — **200** |
| POST | `/api/tenant/trade/v1/workflow-versions/:id/rollback` | `trade.policy.publish` · `If-Match` — **201** |

Both families are gated on **`trade.policy_studio`** and target
`OPERATING_CONTEXT`. Both use **`trade.policy.*`** permissions — there is no
`trade.workflow.*` permission anywhere. A user granted policy authoring
automatically gets workflow authoring; the portal cannot separate them.

`rollback` is the only action in either ladder without `@HttpCode`, so it
returns **201**. Every other action returns 200.

> **Neither family has a `GET` for a version.** Twelve routes each, and not one
> of them reads a version by id: there is a `PATCH /…-versions/:id` and eight
> action POSTs, and nothing else. The only way to see a version is the
> `versions[]` array `listDefinitions` embeds through `projectGovernedVersion`,
> which carries the identity and lifecycle fields but **not `content` and not
> `testCases`** — so a version editor cannot reload what it is editing. The
> ladder therefore has to run from the definition list. Recorded as **Q91**.

### Decisions — 1 route

| Method | Canonical path | Permission | Scope target |
| --- | --- | --- | --- |
| GET | `/api/tenant/trade/v1/decisions/:id` | `trade.policy.read` | `OPERATING_CONTEXT` |

A single decision receipt by id, on `PolicyStudioController`, gated on
`trade.policy_studio`. `DecisionType`:

```text
CONFIGURATION · ELIGIBILITY · SALES_PRICE · PURCHASE_PRICE · CREDIT
APPROVAL · FISCAL_CONTEXT · PROMISE · SOURCING · REPLENISHMENT
```

`PolicyOutputKind`: **`ALLOW_DENY`** · **`REQUIRE_APPROVAL`** · **`SELECT`** ·
**`SCORE`** · **`VALIDATE`** · **`PRICE_ADJUSTMENT`**.

There is **no list route for `/decisions`** — only by id. To reach a decision
receipt the portal must already hold its id from another response.
`GET /inventory/decisions` is a separate, inventory-only list.

### Request bodies

| DTO | Fields |
| --- | --- |
| `GovernanceListQueryDto` | `page`, `limit` (≤ 100, default 25), `kind?` (≤ 40), `status?` — `@IsIn(["ACTIVE","INACTIVE"])`, **the definition's status, not the version's** |
| `CreatePolicyDefinitionDto` | `code` (`^[A-Z][A-Z0-9_.-]{1,99}$`), `policyKind` — `@IsIn` of **`CREDIT`, `PRICING_GUARD`, `ORDER_CONFIRMATION`, `PURCHASE_APPROVAL`, `INVENTORY_NEGATIVE`, `INVENTORY_RESERVATION`, `INVENTORY_OVER_RECEIPT`** — `scopeTarget` |
| `CreateWorkflowDefinitionDto` | `code`, `workflowKind` — `@IsIn` of **`QUOTATION`, `SALES_ORDER`, `PURCHASE_ORDER`, `PRICE_PUBLICATION`, `CONFIGURATION_PUBLICATION`** — `scopeTarget` |
| `CreateGovernedVersionDto` | `content` (object), `testCases[]` (**1–100, required and non-empty**), `effectiveFrom`, `effectiveTo?` |
| `UpdateGovernedVersionDto` | all four optional; `testCases` still 1–100 when present |
| `GovernanceActionDto` | `reason?` (≤ 240), `evidence?` (object) — **both optional**, on all nine actions |

**A version cannot be created without at least one test case.** The Policy
Studio editor must collect them before the first save, not after.

`TRADE_LIMITS.MAX_POLICY_RULES_PER_VERSION` is 2 000 and
`MAX_POLICY_EVALUATION_MS` is 100 — those bound `content`, which is an
unvalidated `@IsObject()` at the pipe and is checked by
`policy-registry.ts` instead.

### Errors

| `code` | Status |
| --- | --- |
| `TRADE.POLICY.DEFINITION_NOT_FOUND` | 404 |
| `TRADE.POLICY.CODE_TAKEN` | 409 |
| `TRADE.POLICY.DEFINITION_INVALID` | 422 |
| `TRADE.POLICY.EXPRESSION_INVALID` | 422 |
| `TRADE.POLICY.OUTPUT_INVALID` | 422 |
| `TRADE.POLICY.TEST_FAILED` | **422**, also **409** |
| `TRADE.POLICY.PUBLISH_NOT_ALLOWED` | 409 |
| `TRADE.POLICY.EFFECTIVE_OVERLAP` | 409 |
| `TRADE.POLICY.DECISION_UNAVAILABLE` | **503** |
| `TRADE.WORKFLOW.DEFINITION_INVALID` | 422 |
| `TRADE.APPROVAL.MAKER_CHECKER_REQUIRED` | 409 |
| `TRADE.AUTH.TARGET_DENIED` | **422** here — `policy-studio.service.ts` throws `UnprocessableEntityException` when the request's resolved target does not equal the definition's `scopeTarget`. The same code is a 403 from the guard |

`TRADE.POLICY.VIEW_SENSITIVE_FACTS` is a permission
(`trade.policy.view_sensitive_facts`) that **gates no route**.

---

## Document profiles — 5 routes

Feature gate: `@RequireAnyTradeFeature(trade.sales, trade.purchasing)`.
All target `OPERATING_CONTEXT`.

| Method | Canonical path | Permission |
| --- | --- | --- |
| GET | `/api/tenant/trade/v1/document-profiles` | `trade.document_profiles.read` |
| POST | `/api/tenant/trade/v1/document-profiles` | `trade.document_profiles.manage` |
| POST | `/api/tenant/trade/v1/document-profiles/:id/versions` | `trade.document_profiles.manage` · `If-Match` |
| POST | `/api/tenant/trade/v1/document-profile-versions/:id/validate` | `trade.document_profiles.validate` · `If-Match` — **200** |
| POST | `/api/tenant/trade/v1/document-profile-versions/:id/publish` | `trade.document_profiles.publish` · `If-Match` — **200** |

There is **no `GET /document-profiles/:id`** and **no
`GET /document-profile-versions/:id`**. A profile can be created and published
but not fetched individually; the list is the only read. Detail screens must
be built from the list row. Recorded as **Q38**.

| DTO | Fields |
| --- | --- |
| `DocumentProfileListQueryDto` | `page`, `limit` (≤ 100, default 25), `documentType?`, `versionStatus?` (free string ≤ 24) |
| `CreateDocumentProfileDto` | `code` (`^[A-Z][A-Z0-9_.-]{1,99}$`), `documentType` — **`@IsIn` of only `QUOTATION`, `SALES_ORDER`, `PURCHASE_ORDER`** — `scopeTarget` |
| `CreateDocumentProfileVersionDto` | `content` (object), `requiredCases?` (≤ 20, **defaults to `[]`**), `effectiveFrom`, `effectiveTo?`, `restoredFromVersionId?`, `restorationReason?` (≤ 240) |
| `PublishDocumentProfileVersionDto` | `expectedActivePointerVersion` (**int ≥ 0, required**) — a second optimistic-concurrency token in the body, on top of `If-Match` |

> **`TradeDocumentFamily` has six members** — `QUOTATION`, `SALES_ORDER`,
> `PURCHASE_ORDER`, `SALES_RETURN`, `PURCHASE_RETURN`, `POS_SALE` — but
> `CreateDocumentProfileDto` accepts only the first three. The list filter
> `documentType` uses `@IsEnum(TradeDocumentFamily)` and therefore accepts all
> six. **A profile can be filtered for but never created for
> `SALES_RETURN`, `PURCHASE_RETURN` or `POS_SALE`.** There are no return
> routes anywhere in Trade — the 231-route inventory contains no
> `/returns`, no `/credit-notes` and no `/payments`.

`POST /document-profile-versions/:id/publish` is the only Trade route that
requires **two** concurrency tokens in one request: the `If-Match` header for
the version and `expectedActivePointerVersion` in the body for the active
pointer. Both must be current or the call fails.

| `code` | Status |
| --- | --- |
| `TRADE.DOCUMENT_PROFILE.NOT_FOUND` | 404 |
| `TRADE.DOCUMENT_PROFILE.IDENTITY_TAKEN` | 409 |
| `TRADE.DOCUMENT_PROFILE.SCHEMA_INVALID` | 422 |
| `TRADE.DOCUMENT_PROFILE.SCOPE_NOT_ALLOWED` | 422 |
| `TRADE.DOCUMENT_PROFILE.COMPATIBILITY_FAILED` | **422**, also **409** |
| `TRADE.DOCUMENT_PROFILE.REQUIRED_CASES_FAILED` | 422 |
| `TRADE.DOCUMENT_PROFILE.VALIDATION_LIMIT_EXCEEDED` | 422 |
| `TRADE.DOCUMENT_PROFILE.PUBLISH_NOT_READY` | 409 |
| `TRADE.DOCUMENT_PROFILE.PUBLICATION_UNAVAILABLE` | **503** |

---

## Extensions — 9 routes

Feature gate: `allOf: [trade.automation]`, `anyOf: [trade.catalog,
trade.sales, trade.purchasing, trade.inventory]` — the tenant needs
`trade.automation` **and** at least one domain feature. All target
`OPERATING_CONTEXT`.

| Method | Canonical path | Permission |
| --- | --- | --- |
| GET | `/api/tenant/trade/v1/extensions/targets` | `trade.extensions.read` |
| GET | `/api/tenant/trade/v1/extensions/profiles` | `trade.extensions.read` |
| POST | `/api/tenant/trade/v1/extensions/profiles` | `trade.extensions.manage` |
| GET | `/api/tenant/trade/v1/extensions/profiles/:id` | `trade.extensions.read` |
| PATCH | `/api/tenant/trade/v1/extensions/profiles/:id` | `trade.extensions.manage` · `If-Match` |
| GET | `/api/tenant/trade/v1/extensions/profiles/:id/versions` | `trade.extensions.read` |
| GET | `/api/tenant/trade/v1/extensions/profiles/:id/versions/:versionId` | `trade.extensions.read` |
| POST | `/api/tenant/trade/v1/extensions/profiles/:id/validate` | **`trade.extensions.manage`** · `If-Match` — **200** |
| POST | `/api/tenant/trade/v1/extensions/profiles/:id/publish` | `trade.extensions.publish` · `If-Match` — **200** |

| DTO | Fields |
| --- | --- |
| `CreateExtensionProfileDto` | `code`, `targetCode` — `@IsIn(["CATALOG_ITEM","QUOTATION","SALES_ORDER","PURCHASE_ORDER"])` — `scopeTarget` — `@IsIn(["TENANT","COMPANY"])`, **`BRANCH` is not allowed** — `fields[]` (1–100) |
| `UpdateExtensionProfileDto` | `fields[]` (1–100) — **required; there is no partial update** |
| `ExtensionFieldDto` | `fieldKey`, `valueKind` (`SCALAR`/`OBJECT`/`COLLECTION`), `scalarType?` (`STRING`/`BOOLEAN`/`DECIMAL`/`DATE`/`UUID`/`ENUM`), `schemaCode?`, `schemaVersion?`, `isRequired?` (default `false`), `isSearchable?` (default `false`), `visibilityCode` (`INTERNAL`/`USER`/`EXTERNAL_SAFE`), `maxLength?` (1–4096), `maxItems?` (1–100), `decimalScale?` (**0–8**), `minimumDecimal?` / `maximumDecimal?` (decimal strings), `defaultStrategy?` (`NONE`/`LITERAL`/`OWNER_DERIVED`), `defaultValue?` (unvalidated), `constraintPayload?` (**defaults to `{}`**) |
| `ExtensionProfileListQueryDto` | `page`, `limit` (≤ 100, default 25), `targetCode?`, `status?` — `@IsIn(["DRAFT","ACTIVE","RETIRED"])` |
| `ExtensionProfileVersionListQueryDto` | `page`, `limit`, `status?` — `@IsIn(["DRAFT","TESTED","PUBLISHED","SUPERSEDED","RETIRED"])` |

The version status list is a **five-value subset** of the seven-value
`GovernedVersionStatus` — `APPROVAL_PENDING` and `SCHEDULED` are not
filterable here, though the enum contains them.

An extension **value** written on a document or item goes through
`ExtensionOwnerValuesDto`, which every `Create*`/`Update*` DTO on
[trade-foundation.md](trade-foundation.md) and
[trade-documents.md](trade-documents.md) extends. A value that fails the
published profile is **422 `TRADE.EXTENSION.VALUE_INVALID`**, raised from the
owning document's route, not from an extensions route.
`TRADE_LIMITS.MAX_EXTENSION_VALUE_BYTES` is 16 KiB.

| `code` | Status |
| --- | --- |
| `TRADE.EXTENSION.DEFINITION_INVALID` | **404**, **409** and **422** — three distinct failures, one code |
| `TRADE.EXTENSION.PROFILE_INCOMPATIBLE` | **422**, also **409** |
| `TRADE.EXTENSION.VALUE_INVALID` | 422 |
| `TRADE.EXTENSION.RESERVED_FIELD` | **422** — `extension-profiles.service.ts` catches a `RangeError` from field validation and maps it to this code; anything else becomes `DEFINITION_INVALID`. The two are the same 422 and differ only in the code |

---

## Imports — 11 routes

Feature gate: `allOf: [trade.automation, trade.catalog]` on all eleven,
**except** `POST /imports/sources`, which is
`allOf: [trade.automation]` + `anyOf: [catalog, sales, purchasing, inventory]`.
All target `OPERATING_CONTEXT`.

| Method | Canonical path | Permission |
| --- | --- | --- |
| GET | `/api/tenant/trade/v1/import-mappings` | `trade.import.manage` |
| POST | `/api/tenant/trade/v1/import-mappings` | `trade.import.manage` |
| GET | `/api/tenant/trade/v1/import-mappings/:id` | `trade.import.manage` |
| PATCH | `/api/tenant/trade/v1/import-mappings/:id` | `trade.import.manage` · `If-Match` |
| POST | `/api/tenant/trade/v1/imports/sources` | `trade.import.execute` — **multipart, `OPTIONAL_COMPANY_BRANCH`** |
| POST | `/api/tenant/trade/v1/imports/sources/:id/release` | `trade.import.manage` — **202, `OPTIONAL_COMPANY_BRANCH`** |
| POST | `/api/tenant/trade/v1/imports/preview` | `trade.import.execute` — **202** |
| POST | `/api/tenant/trade/v1/imports/:runId/execute` | `trade.import.execute` · `If-Match` — **202** |
| GET | `/api/tenant/trade/v1/imports` | `trade.import.execute` |
| GET | `/api/tenant/trade/v1/imports/:runId` | `trade.import.execute` |
| GET | `/api/tenant/trade/v1/imports/:runId/results` | `trade.import.execute` |

> **The import list and detail reads require `trade.import.execute`, not
> `trade.import.manage`.** A user who may configure mappings cannot see the
> runs. There is no read-only import permission.

### The two Gateway-scoped import routes

`POST /imports/sources` and `POST /imports/sources/:id/release` are the only
two Trade routes with `organizationScopeMode: OPTIONAL_COMPANY_BRANCH`. The
Gateway allows neither header, or company alone, or both — **but a branch
header without a company header is a 400 `GW.REQUEST.INVALID`**, refused at
the edge before trade-app sees it.

`POST /imports/sources` is also the only **multipart** route in Trade:

- `@ApiConsumes("multipart/form-data")`, one field named exactly **`file`**
- `limits: { files: 1, fields: 0, parts: 1 }` — **no other form field may be
  sent**, not even a name
- `fileSize`: `TRADE_IMPORT_SOURCE_MAX_BYTES` = **50 MiB**
- an `x-idempotency-key` is still required
- its Gateway `fingerprintSchemaId` is `TRADE_IMPORT_SOURCE_MULTIPART` and its
  replay-body cap is **16 KiB**, not the 128 KiB used elsewhere
- a missing or empty file is **400 `TRADE.IMPORT.FILE_UNSAFE`** with
  `reason: "IMPORT_SOURCE_FILE_REQUIRED"`

### Request bodies

| DTO | Fields |
| --- | --- |
| `CreateImportMappingDto` | `code`, **`targetCode`** — `@IsIn(["CATALOG_COMPANY_PROFILE","CATALOG_BRANCH_ASSIGNMENT"])` — `scopeTarget` (`COMPANY`/`BRANCH`), `branchId?`, `executionMode` — `@IsIn(["PER_ROW"])`, **the only value** — `fields[]` (1–200). This page said `mappingKind` until 2026-08-31; source declares `targetCode`, `projectMapping` returns `targetCode`, and `forbidNonWhitelisted` makes the other spelling a 400 (Q92) |
| `UpdateImportMappingDto` | `executionMode` (**required, `PER_ROW`**), `fields[]` (1–200, **required**) — a full replacement |
| `ImportMappingFieldDto` | `sourceColumnCode`, `sourceOrdinal` (int 0–999), `targetFieldCode`, a transform `@IsIn`, `lookupCode?`, `isRequired?` (default `false`) |
| `PreviewImportDto` | `mappingId`, `sourceId` **required**; `predecessorRunId?` |
| `ImportMappingListQueryDto` | `page`, `limit` (≤ 100, default 50), `status?` (`DRAFT`/`ACTIVE`), `mappingKind?` |
| `ImportRunListQueryDto` | `page`, `limit` (default 50), `status?`, `mappingId?` |
| `ImportResultListQueryDto` | `page`, `limit` (default 50), `status?` |

### Statuses — the partial-success contract

| Thing | Values |
| --- | --- |
| Run `status` | **`PENDING`** · **`PREVIEWING`** · **`PREVIEWED`** · **`EXECUTING`** · **`COMPLETED`** · **`COMPLETED_WITH_ERRORS`** · **`FAILED`** |
| Result row `status` | **`VALID`** · **`INVALID`** · **`SUCCEEDED`** · **`FAILED`** · **`SKIPPED`** |

`COMPLETED_WITH_ERRORS` is the partial success MASTER-PLAN task 12.28 asks
for. The five row statuses split across two phases: a **preview** produces
`VALID`/`INVALID` rows, an **execute** produces `SUCCEEDED`/`FAILED`/`SKIPPED`
rows. The plan's "succeeded / failed / skipped" covers the execute phase only;
render all five.

The 202s from `preview`, `execute` and `release` are **not completion**. Poll
`GET /imports/:runId` and read `status`. No `Location` header is set on any of
them, and there is no separate operation resource — the run id is in the
response body.

**There is no download route for import results.** 12.28 says the result page
should be "downloadable"; `GET /imports/:runId/results` is a paginated JSON
list and nothing else. Recorded as **Q39**.

### Errors

| `code` | Status | Note |
| --- | --- | --- |
| `TRADE.IMPORT.FILE_UNSAFE` | **400**, **409**, **413**, **415** and **422** | **five statuses on one code**, from six throw sites. The only way to tell "too big" from "wrong type" from "virus-scan pending" is the HTTP status |
| `TRADE.IMPORT.MAPPING_INVALID` | **422**, also **404** | |
| `TRADE.IMPORT.SCOPE_MISMATCH` | 422 | the mapping's scope does not match the request context |
| `TRADE.IMPORT.SOURCE_RELEASE_FORBIDDEN` | **403** | **not in `TRADE_ERROR_CODES`** |
| `TRADE.STORAGE.UNAVAILABLE` | **503** | **not in `TRADE_ERROR_CODES`** |
| `TRADE.AUTH.TARGET_DENIED` | — | also used as a **row failure code inside an import result**, where it is data, not an HTTP status |

---

## Webhooks — 11 routes

Feature gate: `allOf: [trade.automation]` + `anyOf: [catalog, sales,
purchasing, inventory]`. All target `OPERATING_CONTEXT`.

| Method | Canonical path | Permission |
| --- | --- | --- |
| GET | `/api/tenant/trade/v1/webhooks/events` | `trade.webhooks.manage` |
| GET | `/api/tenant/trade/v1/webhooks/subscriptions` | `trade.webhooks.manage` |
| POST | `/api/tenant/trade/v1/webhooks/subscriptions` | `trade.webhooks.manage` |
| GET | `/api/tenant/trade/v1/webhooks/subscriptions/:id` | `trade.webhooks.manage` |
| PATCH | `/api/tenant/trade/v1/webhooks/subscriptions/:id` | `trade.webhooks.manage` · `If-Match` |
| POST | `/api/tenant/trade/v1/webhooks/subscriptions/:id/rotate-secret` | `trade.webhooks.manage` · `If-Match` — **202** |
| POST | `/api/tenant/trade/v1/webhooks/subscriptions/:id/revoke-secret` | `trade.webhooks.manage` · `If-Match` — **202** |
| POST | `/api/tenant/trade/v1/webhooks/subscriptions/:id/test` | `trade.webhooks.manage` — **202** |
| GET | `/api/tenant/trade/v1/webhooks/deliveries` | `trade.webhooks.manage` |
| GET | `/api/tenant/trade/v1/webhooks/deliveries/:id` | `trade.webhooks.manage` |
| POST | `/api/tenant/trade/v1/webhooks/deliveries/:id/retry` | **`trade.webhooks.replay`** · `If-Match` — **202** |

Ten of the eleven share one permission. Only `retry` is separate. **Reading
the delivery log requires `trade.webhooks.manage`** — there is no read-only
webhook grant.

| DTO | Fields |
| --- | --- |
| `CreateWebhookSubscriptionDto` | `code`, `scopeTarget` (`TENANT`/`COMPANY` — **not `BRANCH`**), `endpointUri` (≤ 2048), `retryPolicyCode` (`EXPONENTIAL_STANDARD`/`EXPONENTIAL_CONSERVATIVE`), `maxAttempts` (**int 1–10**), `branchIds?` (≤ 100, **defaults to `[]`**), `events[]` (1–30) |
| `WebhookEventDto` | `eventType` (≤ 160), `eventVersion` (int 1–10), `fields[]` (1–40 strings, each ≤ 100) |
| `UpdateWebhookSubscriptionDto` | all optional; `status?` — `@IsIn(["ACTIVE","DISABLED"])` |
| `RotateWebhookSecretDto` | `overlapHours` (**int 0–168, default 24**) |
| `WebhookSubscriptionListQueryDto` | `page`, `limit` (default 50), `status?` — `@IsIn(["DRAFT","ACTIVE","DISABLED"])` |
| `WebhookDeliveryListQueryDto` | `page`, `limit` (default 50), `status?` |
| `RetryWebhookDeliveryDto` | `reasonCode` **required**, matching a safe-reason-code pattern |

Subscription status: **`DRAFT`** · **`ACTIVE`** · **`DISABLED`** on the list
filter, but `UpdateWebhookSubscriptionDto` can only set **`ACTIVE`** or
**`DISABLED`**. `DRAFT` is the create-time state and cannot be returned to.

Delivery status: **`PENDING`** · **`RETRY_PENDING`** · **`DELIVERED`** ·
**`FAILED`** · **`EXHAUSTED`** · **`DISABLED`**. `EXHAUSTED` (attempts spent)
and `DISABLED` (subscription turned off) are distinct terminal states and both
must render.

`rotate-secret`, `revoke-secret`, `test` and `retry` all return **202** and
set **no `Location`**. There is no operation resource; re-read the
subscription or the delivery.

**The webhook signing secret is never returned by any route.** `rotate-secret`
returns 202 and nothing else. If the portal needs to show the caller the new
secret, the API cannot supply it.

| `code` | Status |
| --- | --- |
| `TRADE.WEBHOOK.ENDPOINT_FORBIDDEN` | 422 — the endpoint failed the SSRF/host policy |
| `TRADE.WEBHOOK.PAYLOAD_FORBIDDEN` | **404**, also **422** |
| `TRADE.WEBHOOK.SECRET_VERSION_INVALID` | 409 |
| `TRADE.WEBHOOK.DELIVERY_NOT_RETRYABLE` | 409 |
| `TRADE.DEPENDENCY.TIMEOUT` | 503 |

---

## Control tower — 4 routes

> **Not gated on `trade.control_tower_advanced`.** MASTER-PLAN task 12.19 says
> it is. The controller declares
> `allOf: [trade.analytics]`, `anyOf: [catalog, pricing, sales, purchasing,
> inventory, policy_studio, automation]`. `trade.control_tower_advanced` is
> referenced **nowhere** in `trade-app/src`. See
> [trade-documents.md](trade-documents.md#feature-keys-that-gate-nothing).

All four target `OPERATING_CONTEXT`.

| Method | Canonical path | Permission |
| --- | --- | --- |
| GET | `/api/tenant/trade/v1/control-tower/exceptions` | `trade.control_tower.read` |
| GET | `/api/tenant/trade/v1/control-tower/exceptions/:id` | `trade.control_tower.read` |
| POST | `/api/tenant/trade/v1/control-tower/exceptions/:id/retry` | `trade.control_tower.retry` · `If-Match` — **202** |
| POST | `/api/tenant/trade/v1/control-tower/exceptions/:id/resolve` | `trade.control_tower.resolve` · `If-Match` — **200** |

| DTO | Fields |
| --- | --- |
| `ExceptionListQueryDto` | `page`, `limit` (≤ 100, default 25), `status?`, `severity?`, `category?` (≤ 64) |
| `RetryExceptionDto` | `reason?` (≤ 240) |
| `ResolveExceptionDto` | `resolutionCode` — `@IsIn(["SOURCE_CORRECTED","OWNER_RESULT_APPLIED"])` — `reason` (≤ 240, **required**), `evidence` (object, **required**) |

Exception `status`: **`OPEN`** · **`ACKNOWLEDGED`** · **`ACTION_PENDING`** ·
**`RECONCILIATION_PENDING`** · **`RESOLVED`** · **`QUARANTINED`**.

> **The severity filter and the severity enum do not agree.** The query DTO
> accepts `@IsIn(["LOW","MEDIUM","HIGH","CRITICAL"])`. The exported
> `ExceptionSeverity` enum is **`INFO` · `WARNING` · `HIGH` · `CRITICAL`**.
> Filtering by `INFO` or `WARNING` is a **400**; filtering by `LOW` or
> `MEDIUM` is accepted and will match nothing if rows carry enum values.
> Do not build the filter chips from the enum. Recorded under
> [Not verified](#not-verified).

`IntegrationStatus` — **`NOT_REQUIRED`** · **`PENDING`** · **`IN_PROGRESS`** ·
**`SUCCEEDED`** · **`RETRYING`** · **`FAILED`** ·
**`RECONCILIATION_REQUIRED`** — is an exported enum that appears on exception
rows.

> **`RetryClass` is worse than the severity mismatch: the enum and the writers
> barely overlap.** The exported enum is `NEVER` · `SAME_REQUEST` ·
> `AFTER_REFRESH` · `AFTER_DEPENDENCY_RECOVERY` · `MANUAL_RECONCILIATION`.
> Sweeping every `retryClass: "…"` literal actually written in
> `trade-app/src` yields only **four** values, and **three of them are not in
> the enum**:
>
> | Written value | In `RetryClass`? | Written by |
> | --- | --- | --- |
> | `TRANSIENT` | **no** | `integration-attempt-tracker.ts`, `control-tower-integration-state.service.ts` (×2) |
> | `NO_RETRY` | **no** | both PDF results services |
> | `PERMANENT_SOURCE_CORRECTION` | **no** | `document-profile-activation.service.ts` |
> | `AFTER_REFRESH` | yes | `sales-order-confirmation-results.service.ts` |
>
> A fifth path (`webhook-results.service.ts`) copies `retryClass` straight
> from the worker payload, or `null`, so an unknown sixth value is possible.
>
> `retryClass` is what tells the UI whether a retry button should exist at
> all, and the value set cannot be closed from source. Build the retry
> affordance from an allow-list of values known to be retryable
> (`TRANSIENT`, `AFTER_REFRESH`) and hide it for everything else, including
> `null`. Recorded under [Not verified](#not-verified).

| `code` | Status |
| --- | --- |
| `TRADE.CONTROL_TOWER.NOT_FOUND` | 404 |
| `TRADE.CONTROL_TOWER.SCOPE_DENIED` | **403** |
| `TRADE.CONTROL_TOWER.RETRY_NOT_ALLOWED` | 409 |
| `TRADE.CONTROL_TOWER.RETRY_IN_PROGRESS` | 409 |
| `TRADE.CONTROL_TOWER.TARGET_STALE` | 409 |
| `TRADE.CONTROL_TOWER.RESOLUTION_INVALID` | **409**, also **422** |
| `TRADE.CONTROL_TOWER.PROJECTION_UNAVAILABLE` | **503** |
| `TRADE.CONTROL_TOWER.OWNER_UNAVAILABLE` | **503** |
| `TRADE.CONTROL_TOWER.QUERY_INVALID` | — no throw site found |

`trade.control_tower.view_sensitive` is a permission that **gates no route**.

---

## Dashboards — 20 routes

Feature gate: **`trade.analytics`**. Every route targets
**`DASHBOARD_CONTEXT`**.

| Method | Canonical path | Permission |
| --- | --- | --- |
| GET | `/api/tenant/trade/v1/dashboards/catalog` | `trade.dashboards.read` |
| GET | `/api/tenant/trade/v1/dashboards/navigation` | `trade.dashboards.read` |
| GET | `/api/tenant/trade/v1/dashboards/default` | `trade.dashboards.read` |
| GET | `/api/tenant/trade/v1/dashboards/share-targets` | **`trade.dashboards.share`** |
| GET | `/api/tenant/trade/v1/dashboards` | `trade.dashboards.read` |
| POST | `/api/tenant/trade/v1/dashboards` | `trade.dashboards.create` |
| POST | `/api/tenant/trade/v1/dashboards/from-template/:templateKey` | `trade.dashboards.create` |
| GET | `/api/tenant/trade/v1/dashboards/:id` | `trade.dashboards.read` |
| PATCH | `/api/tenant/trade/v1/dashboards/:id` | `trade.dashboards.update` · `If-Match` |
| DELETE | `/api/tenant/trade/v1/dashboards/:id` | `trade.dashboards.delete` · `If-Match` — **204** |
| POST | `/api/tenant/trade/v1/dashboards/:id/duplicate` | `trade.dashboards.create` |
| POST | `/api/tenant/trade/v1/dashboards/:id/set-default` | **`trade.dashboards.read`** — **200** |
| POST | `/api/tenant/trade/v1/dashboards/:id/set-favorite` | **`trade.dashboards.read`** — **200** |
| PATCH | `/api/tenant/trade/v1/dashboards/:id/layout` | `trade.dashboards.update` · `If-Match` |
| POST | `/api/tenant/trade/v1/dashboards/:id/run` | `trade.dashboards.read` — **200** |
| POST | `/api/tenant/trade/v1/dashboards/:id/placements` | `trade.dashboards.update` |
| DELETE | `/api/tenant/trade/v1/dashboards/:id/placements/:placementId` | `trade.dashboards.update` · `If-Match` — **204** |
| GET | `/api/tenant/trade/v1/dashboards/:id/shares` | `trade.dashboards.share` |
| POST | `/api/tenant/trade/v1/dashboards/:id/shares/bulk-upsert` | `trade.dashboards.share` — **200** |
| DELETE | `/api/tenant/trade/v1/dashboards/:id/shares/:shareId` | `trade.dashboards.share` · `If-Match` — **204** |

`set-default` and `set-favorite` are **personal preferences**, so they need
only `trade.dashboards.read`, not `.update`.

> **`DASHBOARD_CONTEXT` bypasses `TradePermissionsGuard` entirely.**
> `TradePermissionsGuard.canActivate` returns `true` immediately for this
> target — the permission strings above are declared but **not enforced by the
> guard**. Authorization happens inside the dashboard application service,
> which authorizes every resolved company target individually. The comment in
> the guard explains why: a single TENANT/COMPANY grant check would either
> block valid branch-only viewers or over-broaden authority.
>
> The practical consequence for the portal: **a 403 from a dashboard route is
> a service-level refusal with a `TRADE.DASHBOARD.*` code, never
> `TRADE.AUTH.TARGET_DENIED`.**

`TradeScopeGuard` still runs, so the headers are still resolved — but with
`DASHBOARD_CONTEXT`, sending nothing resolves to `TENANT` and is legal.

### Dashboards and widgets are shaped differently

Three departures from every other Trade family:

1. **Concurrency uses `revision`, not `version`.** The controllers set
   `ETag: "<revision>"` explicitly via `quoteRevision()`. The interceptor's
   automatic ETag (which keys on a numeric `version`) does not fire, because
   dashboard payloads have no `version`. The concurrency failure code is
   **409 `TRADE.DASHBOARD.REVISION_CONFLICT`**, not
   `TRADE.CONCURRENCY.STALE_VERSION`. The `If-Match` **parser is the same** —
   `parseExpectedVersion`, accepting `W/"n"`, `"n"` and bare `n`, 400 when
   absent.
2. **Write responses are not unwrapped.** The services return
   `{ created, replayed, dashboard }` (or `{ …value, replayed }`), which fails
   the interceptor's `value`+`replayed` test, so it passes through verbatim.
   `data.dashboard` is the record, `data.replayed` is a boolean **in the
   body**, and `data.created` distinguishes a fresh create from a replay of
   one. Every other Trade family returns the record directly under `data`.
3. **`Idempotency-Replayed` is set by the controller**, not the interceptor —
   same header, same `"true"`/`"false"` values.
4. **The Gateway does not protect these writes.** All 18 dashboard and widget
   `WRITE_SENSITIVE` routes carry `idempotent: false` in the route contract —
   they are the **only** 18 Trade routes that do. `GatewayIdempotencyService`
   therefore never reserves, never requires a key and never replays them: the
   `GW.IDEM.*` failures cannot occur here, and a transport retry reaches the
   app twice.
   **The app still requires a key on ten of them.** These POSTs call
   `requireIdempotencyKey` and answer **400
   `TRADE.IDEMPOTENCY.KEY_REQUIRED`** without one:
   `POST /dashboards`, `/dashboards/from-template/:templateKey`,
   `/dashboards/:id/duplicate`, `/dashboards/:id/set-default`,
   `/dashboards/:id/set-favorite`, `/dashboards/:id/placements`,
   `/dashboards/:id/shares/bulk-upsert`, `POST /widgets`,
   `/widgets/:id/clone`, `/widgets/:id/shares/bulk-upsert`.
   The four `PATCH`es and four `DELETE`s take **no** key and rely on
   `If-Match` alone — a retried `PATCH` is applied twice unless the now-stale
   `If-Match` stops it.

### Request bodies

| DTO | Fields |
| --- | --- |
| `DashboardListQueryDto` | **`limit`** (1–100, default 50) + **`offset`** (≥ 0, default 0) + `context?` — **`page` is a 400 here** |
| `DashboardPreferenceQueryDto` | `kind?` (`TradeDashboardPreferenceContextKind`), `companyId?` |
| `ShareTargetsQueryDto` | `search?` (≤ 80, trimmed), `limit` (1–100, default 50) |
| `RunDashboardDto` | `requestId` (UUID v7, **required**), `scope?`, `filters?` |

`POST /dashboards/:id/run` takes **no idempotency key** — it is `READ_HEAVY`
and the `requestId` in the body is its own de-duplication token.

### The dashboard enums — all of them

Every one of these is rendered somewhere and needs a `t.status.*` label:

```text
TradeDashboardScopeCoverage        SINGLE_COMPANY · MULTI_COMPANY_AUTHORIZED_UNION
TradeDashboardScopeMode            CURRENT_CONTEXT · SAVED_TARGETS · SELECTED_SCOPES · ALL_ACCESSIBLE
TradeDashboardAccessLevel          OWNER · EDIT · VIEW
TradeDashboardShareSubjectType     USER · TEAM
TradeDashboardPreferenceContextKind COMPANY · CONSOLIDATED
TradeDashboardResponsiveLayout     DESKTOP_12 · TABLET_6 · MOBILE_1
TradeDashboardDataShape            SCALAR · TIME_SERIES · CATEGORY · XY · INTERVAL · GRAPH · ROWS
TradeDashboardMetricUnit           COUNT · MONEY · PERCENT · QUANTITY · DURATION · SCORE
TradeDashboardDatePreset           TODAY · CURRENT_WEEK · CURRENT_MONTH · CURRENT_QUARTER · CURRENT_YEAR · LAST_30_DAYS · CUSTOM
TradeDashboardPeriodComparisonMode NONE · PREVIOUS_PERIOD · PREVIOUS_YEAR
TradeDashboardWidgetComparisonMode NONE · PREVIOUS_PERIOD · PREVIOUS_YEAR · TARGET
TradeDashboardTimeGrain            DAY · WEEK · MONTH · QUARTER · YEAR
TradeDashboardAggregation          COUNT · SUM · AVERAGE · MIN · MAX · PERCENT
TradeDashboardSeriesAxis           LEFT · RIGHT
TradeDashboardRunStatus            COMPLETE · PARTIAL
TradeWidgetExecutionStatus         READY · EMPTY · LIMITED · STALE · UNAVAILABLE · FAILED
TradeDashboardUnavailablePlacementReason
                                   WIDGET_DELETED · WIDGET_ACCESS_REVOKED ·
                                   WIDGET_PERMISSION_REQUIRED · METRIC_RETIRED_OR_INCOMPATIBLE
TradeDashboardVisualizationType    METRIC_CARD · LINE · AREA · LINE_AREA · COLUMN · BAR ·
                                   STACKED_BAR · PIE · DONUT · SCATTER · BUBBLE · GANTT ·
                                   FLOWCHART · SEMI_CIRCLE_GAUGE · THREE_QUARTER_GAUGE ·
                                   CIRCULAR_PROGRESS_GAUGE · DETAILED_SPEEDOMETER ·
                                   TABLE · FUNNEL · HEATMAP
```

**Twenty visualization types.** A widget editor that offers fewer silently
drops metrics whose only compatible visualization is missing.

`TradeWidgetExecutionStatus` and `TradeDashboardUnavailablePlacementReason`
are the per-tile degraded states: a dashboard run can come back `PARTIAL` with
individual tiles `STALE`, `UNAVAILABLE` or `FAILED`, and a placement can be
present but unrenderable. A dashboard grid that only handles "loaded" and
"error" will misreport six of these.

### Money in the analytics payload is a **union**

`scalarResult()` in `dashboard-metric-provider.service.ts`:

```ts
scalar: metric.unit === TradeDashboardMetricUnit.COUNT ? safeCount(value) : decimal(value)
```

- `unit === COUNT` ⇒ `scalar` is a **JavaScript number** (a safe integer ≥ 0)
- every other unit — including **`MONEY`** — ⇒ `scalar` is a **decimal string**

**The type of `scalar` is discriminated by `unit`.** A validator that types it
as `number` will reject every money tile; one that types it as `string` will
reject every count tile. `PERCENT` values come from `decimalRatio`, which
returns up to four decimal places with trailing zeros trimmed.

`decimal()` silently returns `"0"` for anything it cannot parse, so a broken
metric renders as zero rather than failing. Do not treat `"0"` as certainly
real.

Money metrics carry `currencyBehavior: "PARTITION_BY_COMPANY_AND_CURRENCY"` —
they are **never summed across currencies**. Attempting a cross-currency merge
is **422 `TRADE.DASHBOARD.CURRENCY_MERGE_FORBIDDEN`**; attempting a
cross-company aggregation on a non-additive metric is **422
`TRADE.DASHBOARD.MULTI_COMPANY_AGGREGATION_FORBIDDEN`**.

### Limits

From `TRADE_DASHBOARD_LIMITS`: name ≤ 120 characters, description ≤ 500,
grid 12 columns, **≤ 20 placements per dashboard**, ≤ 4 series and ≤ 1 000
points per widget, ≤ 100 dashboards and ≤ 500 widgets per owner, ≤ 25 explicit
company scopes, ≤ 100 share targets, ≤ 24-month sync range, widget height
≤ 24, layout `y` ≤ 10 000. Exceeding any is **422
`TRADE.DASHBOARD.LIMIT_EXCEEDED`**.

### Errors

| `code` | Status |
| --- | --- |
| `TRADE.DASHBOARD.NOT_FOUND` | 404 |
| `TRADE.DASHBOARD.SCOPE_DENIED` | **403**, also **422** |
| `TRADE.DASHBOARD.SOURCE_PERMISSION_REQUIRED` | **403** |
| `TRADE.DASHBOARD.WIDGET_UNAVAILABLE` | **403**, **404** and **422** — three statuses, one code |
| `TRADE.DASHBOARD.REVISION_CONFLICT` | 409 |
| `TRADE.DASHBOARD.NAME_CONFLICT` | 409 |
| `TRADE.DASHBOARD.LAYOUT_OVERLAP` | 409 |
| `TRADE.DASHBOARD.WIDGET_ALREADY_PLACED` | 409 |
| `TRADE.DASHBOARD.SCOPE_EMPTY` | 422 |
| `TRADE.DASHBOARD.COMPANY_BRANCH_MISMATCH` | 422 |
| `TRADE.DASHBOARD.FILTER_INVALID` | 422 |
| `TRADE.DASHBOARD.DEFINITION_INVALID` | 422 |
| `TRADE.DASHBOARD.LAYOUT_INVALID` | 422 |
| `TRADE.DASHBOARD.LIMIT_EXCEEDED` | 422 |
| `TRADE.DASHBOARD.METRIC_NOT_REGISTERED` | 422 |
| `TRADE.DASHBOARD.METRIC_PERMISSION_REQUIRED` | **422** — a permission failure returned as a validation error |
| `TRADE.DASHBOARD.METRIC_INCOMPATIBLE` | 422 |
| `TRADE.DASHBOARD.VISUALIZATION_INCOMPATIBLE` | 422 |
| `TRADE.DASHBOARD.EXECUTION_BUDGET_EXCEEDED` | 422 |
| `TRADE.DASHBOARD.SHARE_TARGET_INVALID` | 422 |
| `TRADE.DASHBOARD.SHARE_ACCESS_INVALID` | 422 |
| `TRADE.DASHBOARD.CURRENCY_MERGE_FORBIDDEN` | 422 |
| `TRADE.DASHBOARD.MULTI_COMPANY_AGGREGATION_FORBIDDEN` | 422 |
| `TRADE.DASHBOARD.SOURCE_UNAVAILABLE` | **503** |
| `TRADE.DASHBOARD.TRANSITIVE_SHARE_FORBIDDEN` | **403** — `dashboard-access.service.ts`, chosen by a ternary inside the `ForbiddenException` |
| `TRADE.DASHBOARD.EXECUTION_FAILED` | **none** — it is the `errorCode` field on a widget result whose `status` is `TradeWidgetExecutionStatus.FAILED`, inside a **200** run response |
| `TRADE.DASHBOARD.CATALOG_INCOMPATIBLE` | — no reference outside the i18n table |
| `TRADE.DASHBOARD.SOURCE_STALE` | — no reference outside the i18n table |
| `TRADE.DASHBOARD.DRILL_TARGET_INVALID` | — no reference outside the i18n table |

> Those last three have **translations but no producer**. They are in
> `common/i18n/trade-translations.ts` and nowhere else, so they are intended
> but not yet raised. `TRADE.DASHBOARD.EXECUTION_FAILED` is the more important
> case: a dashboard run that fails comes back **200 with a `FAILED` tile**, not
> as an HTTP error, so a grid that keys only on request status will render a
> broken widget as loaded.

Note the pattern: **almost every dashboard refusal is a 422**, including two
that are really authorization failures
(`METRIC_PERMISSION_REQUIRED`, and `SCOPE_DENIED` on one of its two paths).
Standing requirement S7 ("403 renders `PermissionGate`") will not fire for
them; the portal must treat those two 422 codes as permission states.

---

## Widgets — 11 routes

Feature gate: **`trade.analytics`**. All target `DASHBOARD_CONTEXT`, with the
same guard bypass and the same `revision`-based concurrency as dashboards.

| Method | Canonical path | Permission |
| --- | --- | --- |
| POST | `/api/tenant/trade/v1/widgets/preview` | **`trade.dashboards.read`** — **200** |
| GET | `/api/tenant/trade/v1/widgets/share-targets` | `trade.widgets.share` |
| GET | `/api/tenant/trade/v1/widgets` | `trade.widgets.read` |
| POST | `/api/tenant/trade/v1/widgets` | `trade.widgets.create` |
| GET | `/api/tenant/trade/v1/widgets/:id` | `trade.widgets.read` |
| PATCH | `/api/tenant/trade/v1/widgets/:id` | `trade.widgets.update` · `If-Match` |
| DELETE | `/api/tenant/trade/v1/widgets/:id` | `trade.widgets.delete` · `If-Match` — **204** |
| POST | `/api/tenant/trade/v1/widgets/:id/clone` | **`trade.widgets.create`** |
| GET | `/api/tenant/trade/v1/widgets/:id/shares` | `trade.widgets.share` |
| POST | `/api/tenant/trade/v1/widgets/:id/shares/bulk-upsert` | `trade.widgets.share` — **200** |
| DELETE | `/api/tenant/trade/v1/widgets/:id/shares/:shareId` | `trade.widgets.share` · `If-Match` — **204** |

> **`POST /widgets/preview` is gated on `trade.dashboards.read`, not
> `trade.widgets.*`.** The widget builder's live preview needs a dashboard
> permission.

**`GET /widgets` takes no query parameters at all** — the handler has no
`@Query()`. There is no pagination, no filter and no search, and because the
pipe runs `forbidNonWhitelisted`, adding `?limit=50` is a **400**. The whole
widget set comes back in one response, bounded only by the 500-per-owner
limit.

| DTO | Fields |
| --- | --- |
| `CreateWidgetDto` | `name` (1–120, trimmed, plain-text pattern), `visualizationType`, `querySpec` (`DashboardWidgetQuerySpecDto`), `displaySpec` (`DashboardDisplaySpecDto`) — **all four required** |
| `UpdateWidgetDto` | the same four, all optional |
| `CloneWidgetDto` | `name?` |
| `PreviewWidgetDto` | **extends `CreateWidgetDto`** — a preview needs the complete widget definition, not a fragment |

Widget errors are the `TRADE.DASHBOARD.*` set above; there is no separate
widget code family.

---

## What will bite you

1. **Three pagination dialects on one page.** `page`+`limit`, `limit` only,
   and `limit`+`offset` for dashboards. `GET /widgets` takes nothing. Sending
   the wrong parameter is a 400, not an ignore.
2. **`scalar` is `number` for `COUNT` metrics and a decimal string for
   everything else, including `MONEY`.** One validator cannot type both
   without a discriminated union on `unit`.
3. **`DASHBOARD_CONTEXT` skips the permission guard.** Dashboard 403s carry
   `TRADE.DASHBOARD.*` codes, and two real permission failures arrive as
   **422** (`METRIC_PERMISSION_REQUIRED`, `SCOPE_DENIED`). S7's
   403-to-`PermissionGate` rule misses them.
4. **Dashboards and widgets use `revision`, not `version`**, and their write
   responses keep `{ created, replayed, dashboard }` at the top of `data`
   instead of the record.
5. **`TRADE.IMPORT.FILE_UNSAFE` is emitted at five different HTTP statuses.**
   Only the status distinguishes "too large" from "wrong type" from "unsafe".
6. **Reversal is a different permission from the movement.** `receive` can
   post, only `adjust` can reverse.
7. **Receipts, deliveries, reservations and opening balances have no GET.**
   Task 12.27's detail pages have no route behind them (Q37).
8. **The governed ladder has seven states and eight verbs.** `SCHEDULED` and
   `SUPERSEDED` arrive without a user action.
9. **Workflows use `trade.policy.*` permissions.** There is no separate
   workflow grant; the two studios cannot be authorized apart.
10. **Two control-tower enums contradict the code that writes them.** The
    severity filter accepts `LOW`/`MEDIUM`/`HIGH`/`CRITICAL` while
    `ExceptionSeverity` defines `INFO`/`WARNING`/`HIGH`/`CRITICAL`, and only
    `HIGH` is ever written. Three of the four `retryClass` values written
    anywhere in `trade-app/src` are absent from the `RetryClass` enum. Do not
    build either control from its enum.
11. **The webhook secret is never returned.** `rotate-secret` is a 202 with
    nothing to show the user.
12. **Import list and detail reads need `trade.import.execute`.** There is no
    read-only import permission, and no download route for results (Q39).
13. **`POST /imports/sources` allows exactly one multipart part named `file`**
    (`fields: 0, parts: 1`), up to 50 MiB, and still needs an idempotency key.
14. **Document profiles cannot be fetched by id** (Q38), and can only be
    created for three of the six `TradeDocumentFamily` values.
15. **No returns, credit notes or payments exist anywhere in the 231 routes.**
    If a screen needs one, the API does not have it.

---

## Not verified

- **The `severity` values actually stored on control-tower exception rows.**
  The filter accepts `LOW`/`MEDIUM`/`HIGH`/`CRITICAL`; `ExceptionSeverity` is
  `INFO`/`WARNING`/`HIGH`/`CRITICAL`. The only literal written anywhere in
  `trade-app/src` is `"HIGH"`; no database check constraint pins the column.
  Whether a projection outside the HTTP path writes the others was not
  determined. The portal should render any of the six defensively.
- **The complete `retryClass` value set.** Four literals are written, three of
  which are not in the `RetryClass` enum, and `webhook-results.service.ts`
  copies the value from a worker payload without validating it. The set is
  open.
- **The response bodies of `POST /dashboards/:id/run` and
  `POST /widgets/preview`.** The enums that appear in them are exhaustive
  above, but the full envelope of a run result (per-placement structure,
  freshness metadata, drill-through payload) was not enumerated field by
  field.
- **`DashboardWidgetQuerySpecDto` and `DashboardDisplaySpecDto` field lists.**
  They are large nested DTOs in `dto/dashboard.dto.ts` (658 lines) and were
  read only far enough to confirm they are required and validated. The widget
  editor will need a dedicated pass over them.
- **The `GET /decisions/:id` response shape.** `DecisionType` and
  `PolicyOutputKind` are exhaustive; the receipt body was not read.
- **Codes in `TRADE_ERROR_CODES` with no reference anywhere in
  `trade-app/src`**, on this page's families: `INVENTORY_OVER_RECEIPT`,
  `INVENTORY_OWNER_EVENT_INVALID`, `INVENTORY_EXPIRY_COMMAND_INVALID`,
  `TRADE.CONTROL_TOWER.QUERY_INVALID`, `TRADE.PRICE.COST_UNAVAILABLE`,
  `TRADE.PRICE.FX_UNAVAILABLE`, `TRADE.PRICE.OVERRIDE_REJECTED`. Three more —
  `DASHBOARD_CATALOG_INCOMPATIBLE`, `DASHBOARD_SOURCE_STALE`,
  `DASHBOARD_DRILL_TARGET_INVALID` — appear only in the i18n table.
  Verified by grepping the constant name, not just `code:` lines: this page
  documents seven inventory codes, one extension code and two dashboard codes
  that a narrower search reports as unreferenced because they are raised
  through a helper factory or a ternary.
- **Live behaviour.** Nothing on this page was executed against a running
  Trade service. Every statement is read from source at the revision noted in
  [trade-reference.md](trade-reference.md).
