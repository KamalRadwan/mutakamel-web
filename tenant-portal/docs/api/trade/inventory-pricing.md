# Trade Inventory and Pricing API Overview

> Contract status: compatibility index; authoritative contracts split by capability
> Verification date: 2026-07-25
> Backend owner: Trade
> Documentation: hand-written replacement for the former combined page
> Canonical browser prefix: `/api/tenant/trade/v1`
> Controller-relative prefixes: `/trade/inventory`, `/trade/price-books`, `/trade/price-book-versions`, `/trade/pricing`, `/trade/configuration/company-default-price-books`
> Tenant Portal status: replacement Inventory and Pricing features are not implemented; the legacy Trade frontend has inventory/pricing clients and operations UI.

Inventory and Pricing are related at document evaluation time but are separate authorization, scope, validation, concurrency, and lifecycle contracts.

## Authoritative pages

- [inventory.md](inventory.md): 26 routes for availability, nodes, balances, reservations, receipts, deliveries, reversals, periods, UOM conversions, serials, and decision snapshots.
- [pricing-price-books.md](pricing-price-books.md): 10 routes for price books, version lines, promotions, publication, evaluation, and company-default mapping.
- [catalog.md](catalog.md): item sell/purchase/inventory capability and default UOM/node profiles.
- [policy-studio.md](policy-studio.md): policy decisions that can affect eligibility, pricing, approval, inventory, and governance.
- [documents.md](documents.md), [purchasing.md](purchasing.md), and [purchase-quotations.md](purchase-quotations.md): document commands that pin evaluated price/inventory/legal evidence.

## Boundary

| Concern | Pricing contract | Inventory contract |
|---|---|---|
| Primary scope | company/operating context depending on route | predominantly branch with explicit company/branch headers |
| Quantities/money | decimal strings; price/currency/version evidence | decimal strings; item/UOM/node/source-version evidence |
| Mutable governance | price-book/version/promotion lifecycle and company-default ETag | node, period, UOM-conversion, reservation/movement lifecycles |
| Evaluation | `POST /pricing/evaluate` | `GET /inventory/availability` and recorded policy decision projections |
| Command replay | route-specific UUIDv7 idempotency key | route-specific UUIDv7 idempotency key plus operation/intent keys in several DTOs |
| Concurrency | ETag on mutable aggregates and company-default create sentinel `"0"` | ETag on governed mutable resources; movement semantics are service-authoritative |

Do not combine the two modules into one generated request schema or one permission check. A successful price evaluation is not an inventory reservation, and availability is not a durable price lock.

Sources:

- `../backend/mutakamel-apps/trade-app/src/modules/pricing/pricing.controller.ts`
- `../backend/mutakamel-apps/trade-app/src/modules/pricing/pricing-read.controller.ts`
- `../backend/mutakamel-apps/trade-app/src/modules/inventory/inventory.controller.ts`
- `../backend/mutakamel-apps/api-gateway-app/src/routing-proxy/route-contracts/trade.route-contracts.ts`
