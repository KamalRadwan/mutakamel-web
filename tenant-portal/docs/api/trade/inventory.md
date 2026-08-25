# Trade Inventory API

> Contract status: source-verified backend contract; replacement frontend not implemented
> Verification date: 2026-07-25
> Backend owner: Trade
> Documentation: source-generated from verified Gateway routes, Trade controllers/DTOs/services/tests, and dated historical frontend evidence
> Canonical browser prefix: `/api/tenant/trade/v1`
> Controller-relative prefixes: `/trade/inventory`
> Tenant Portal status: The standalone `tenant-portal` replacement is not implemented. The consolidated `mutakamel-web-app` references below are dated 2026-07-25 historical evidence; that workspace is absent from the current checkout and does not prove a live frontend.

## Capability

Availability, fulfillment nodes, opening balances, reservations, receipts, deliveries, inventory periods, UOM conversions, serial projections, and policy decisions.

- Controller feature requirement: none declared; Trade module entitlement, seat, permission, and branch scope still apply.
- Gateway routes assigned to this page: **26**.
- These are browser contracts. The Trade upstream remains `/api/v1/trade/...`; the browser must use the canonical prefix above.

## Source evidence

Current backend source references below are relative to
`C:\mutakamel.ai\frontend`. Consolidated frontend paths are explicitly dated
historical references; their absent workspace is not current runtime evidence.

- `../backend/mutakamel-apps/api-gateway-app/src/routing-proxy/route-contracts/trade.route-contracts.ts`
- `../backend/mutakamel-apps/trade-app/src/modules/inventory/inventory.controller.ts`
- `../backend/mutakamel-apps/trade-app/src/modules/inventory/dto/inventory.dto.ts`
- `../backend/mutakamel-apps/trade-app/src/modules/inventory/inventory.service.ts`
- `../backend/mutakamel-apps/trade-app/src/modules/inventory/inventory-governance.service.ts`
- `../backend/mutakamel-apps/trade-app/src/modules/inventory/inventory-policy-decision.service.ts`
- `../backend/mutakamel-apps/trade-app/src/modules/inventory/inventory.controller.spec.ts`
- `../backend/mutakamel-apps/worker-app/src/modules/trade-reservation-expiry/trade-reservation-expiry.consumer.ts`
- `../backend/mutakamel-apps/mutakamel-web-app/src/features/tenant/trade/trade-operations-api.ts`
- `../backend/mutakamel-apps/mutakamel-web-app/src/features/tenant/trade/inventory-operations-section.tsx`

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
| GET | `/api/tenant/trade/v1/inventory/availability` | `/trade/inventory/availability` | `trade.inventory.read` | `BRANCH` | `query: AvailabilityQueryDto` | — | 200 | `AUTHENTICATED`; gateway-idempotent=true |
| GET | `/api/tenant/trade/v1/inventory/nodes` | `/trade/inventory/nodes` | `trade.inventory.read` | `BRANCH` | — | — | 200 | `AUTHENTICATED`; gateway-idempotent=true |
| GET | `/api/tenant/trade/v1/inventory/nodes/:id` | `/trade/inventory/nodes/:id` | `trade.inventory.read` | `BRANCH` | — | — | 200 | `AUTHENTICATED`; gateway-idempotent=true |
| POST | `/api/tenant/trade/v1/inventory/nodes` | `/trade/inventory/nodes` | `trade.inventory.nodes.manage` | `COMPANY` | `body: CreateNodeDto` | `X-Idempotency-Key` | 201 | `WRITE_SENSITIVE`; gateway-idempotent=true |
| PATCH | `/api/tenant/trade/v1/inventory/nodes/:id` | `/trade/inventory/nodes/:id` | `trade.inventory.nodes.manage` | `COMPANY` | `body: UpdateNodeDto` | `X-Idempotency-Key`, `If-Match` | 200 | `WRITE_SENSITIVE`; gateway-idempotent=true |
| POST | `/api/tenant/trade/v1/inventory/opening-balances` | `/trade/inventory/opening-balances` | `trade.inventory.opening_balance` | `BRANCH` | `body: OpeningBalanceDto` | `X-Idempotency-Key` | 201 | `WRITE_SENSITIVE`; gateway-idempotent=true |
| POST | `/api/tenant/trade/v1/inventory/reservations` | `/trade/inventory/reservations` | `trade.inventory.reserve` | `BRANCH` | `body: CreateReservationDto` | `X-Idempotency-Key` | 201 | `WRITE_SENSITIVE`; gateway-idempotent=true |
| POST | `/api/tenant/trade/v1/inventory/reservations/:id/release` | `/trade/inventory/reservations/:id/release` | `trade.inventory.reserve` | `BRANCH` | `body: ReleaseReservationDto` | `X-Idempotency-Key`, `If-Match` | 200 | `WRITE_SENSITIVE`; gateway-idempotent=true |
| POST | `/api/tenant/trade/v1/inventory/receipts` | `/trade/inventory/receipts` | `trade.inventory.receive` | `BRANCH` | `body: CreateReceiptDto` | `X-Idempotency-Key` | 201 | `WRITE_SENSITIVE`; gateway-idempotent=true |
| POST | `/api/tenant/trade/v1/inventory/receipts/:id/post` | `/trade/inventory/receipts/:id/post` | `trade.inventory.receive` | `BRANCH` | — | `X-Idempotency-Key`, `If-Match` | 200 | `WRITE_SENSITIVE`; gateway-idempotent=true |
| POST | `/api/tenant/trade/v1/inventory/receipts/:id/reverse` | `/trade/inventory/receipts/:id/reverse` | `trade.inventory.adjust` | `BRANCH` | `body: ReverseMovementDto` | `X-Idempotency-Key`, `If-Match` | 200 | `WRITE_SENSITIVE`; gateway-idempotent=true |
| POST | `/api/tenant/trade/v1/inventory/deliveries` | `/trade/inventory/deliveries` | `trade.inventory.deliver` | `BRANCH` | `body: CreateDeliveryDto` | `X-Idempotency-Key` | 201 | `WRITE_SENSITIVE`; gateway-idempotent=true |
| POST | `/api/tenant/trade/v1/inventory/deliveries/:id/post` | `/trade/inventory/deliveries/:id/post` | `trade.inventory.deliver` | `BRANCH` | — | `X-Idempotency-Key`, `If-Match` | 200 | `WRITE_SENSITIVE`; gateway-idempotent=true |
| POST | `/api/tenant/trade/v1/inventory/deliveries/:id/reverse` | `/trade/inventory/deliveries/:id/reverse` | `trade.inventory.adjust` | `BRANCH` | `body: ReverseMovementDto` | `X-Idempotency-Key`, `If-Match` | 200 | `WRITE_SENSITIVE`; gateway-idempotent=true |
| GET | `/api/tenant/trade/v1/inventory/periods` | `/trade/inventory/periods` | `trade.inventory.read` | `COMPANY` | `query: InventoryPeriodListQueryDto` | — | 200 | `AUTHENTICATED`; gateway-idempotent=true |
| POST | `/api/tenant/trade/v1/inventory/periods` | `/trade/inventory/periods` | `trade.inventory.governance.manage` | `COMPANY` | `body: CreateInventoryPeriodDto` | `X-Idempotency-Key` | 201 | `WRITE_SENSITIVE`; gateway-idempotent=true |
| POST | `/api/tenant/trade/v1/inventory/periods/:id/close` | `/trade/inventory/periods/:id/close` | `trade.inventory.governance.manage` | `COMPANY` | `body: InventoryPeriodTransitionDto` | `X-Idempotency-Key`, `If-Match` | 200 | `WRITE_SENSITIVE`; gateway-idempotent=true |
| POST | `/api/tenant/trade/v1/inventory/periods/:id/reopen` | `/trade/inventory/periods/:id/reopen` | `trade.inventory.governance.manage` | `COMPANY` | `body: InventoryPeriodTransitionDto` | `X-Idempotency-Key`, `If-Match` | 200 | `WRITE_SENSITIVE`; gateway-idempotent=true |
| GET | `/api/tenant/trade/v1/inventory/uom-conversions` | `/trade/inventory/uom-conversions` | `trade.inventory.read` | `COMPANY` | `query: InventoryUomConversionListQueryDto` | — | 200 | `AUTHENTICATED`; gateway-idempotent=true |
| POST | `/api/tenant/trade/v1/inventory/uom-conversions` | `/trade/inventory/uom-conversions` | `trade.inventory.governance.manage` | `COMPANY` | `body: CreateInventoryUomConversionDto` | `X-Idempotency-Key` | 201 | `WRITE_SENSITIVE`; gateway-idempotent=true |
| POST | `/api/tenant/trade/v1/inventory/uom-conversions/:id/publish` | `/trade/inventory/uom-conversions/:id/publish` | `trade.inventory.governance.manage` | `COMPANY` | `body: InventoryUomConversionActionDto` | `X-Idempotency-Key`, `If-Match` | 200 | `WRITE_SENSITIVE`; gateway-idempotent=true |
| POST | `/api/tenant/trade/v1/inventory/uom-conversions/:id/retire` | `/trade/inventory/uom-conversions/:id/retire` | `trade.inventory.governance.manage` | `COMPANY` | `body: InventoryUomConversionActionDto` | `X-Idempotency-Key`, `If-Match` | 200 | `WRITE_SENSITIVE`; gateway-idempotent=true |
| GET | `/api/tenant/trade/v1/inventory/serials` | `/trade/inventory/serials` | `trade.inventory.read` | `COMPANY` | `query: InventorySerialListQueryDto` | — | 200 | `AUTHENTICATED`; gateway-idempotent=true |
| GET | `/api/tenant/trade/v1/inventory/serials/:id` | `/trade/inventory/serials/:id` | `trade.inventory.read` | `COMPANY` | — | — | 200 | `AUTHENTICATED`; gateway-idempotent=true |
| GET | `/api/tenant/trade/v1/inventory/decisions` | `/trade/inventory/decisions` | `trade.inventory.read` | `COMPANY` | `query: InventoryDecisionListQueryDto` | — | 200 | `AUTHENTICATED`; gateway-idempotent=true |
| GET | `/api/tenant/trade/v1/inventory/decisions/:id` | `/trade/inventory/decisions/:id` | `trade.inventory.read` | `COMPANY` | — | — | 200 | `AUTHENTICATED`; gateway-idempotent=true |

`gateway-idempotent` is Gateway transport metadata. `X-Idempotency-Key` in the header column is the independent Trade domain replay contract.

## Validation and enum wire values

The global validation pipe transforms primitive query values, whitelists declared fields, rejects unknown fields, accumulates validation failures, and returns `TRADE.VALIDATION_FAILED`. Exact property decorators are in [validation-reference.md](validation-reference.md).

- IDs and operation/intent keys use UUIDv7. Quantities are positive decimal strings with up to 8 fractional digits; conversion factors are positive integer decimal strings.
- Receipt/delivery lines are 1-500. Node branches are 1-100. Period dates use `YYYY-MM-DD`; business/effective instants use strict ISO-8601.
- Tracking payloads are objects but lot/serial semantic rules are checked against item tracking configuration in the service.

- Node type: `WAREHOUSE`, `STORE`, `VIRTUAL`; node status: `ACTIVE`, `INACTIVE`.
- Period status: `OPEN`, `CLOSED`; conversion status: `DRAFT`, `PUBLISHED`, `RETIRED`; serial state: `ON_HAND`, `RESERVED`, `DELIVERED`, `VOIDED`.
- Decision policy kind: `INVENTORY_RESERVATION`, `INVENTORY_NEGATIVE`, `INVENTORY_OVER_RECEIPT`.

## Response, errors, security, idempotency and async behavior

- Normal non-204 success: `{ success: true, data, correlationId, timestamp }`. A versioned object also sets `ETag: "<version>"`; a domain replay sets `Idempotency-Replayed`. A 204 has no body.
- A required idempotency key is a UUIDv7. Reusing it with a different canonical request returns an idempotency mismatch; an in-flight duplicate conflicts. A required `If-Match` accepts a positive quoted integer ETag unless the route explicitly documents create sentinel `"0"`.
- Common failures: 400 validation/missing precondition; 401 absent, stale or invalidated tenant session; 403 missing seat/entitlement/feature/permission; 404 missing scoped resource; 409 stale aggregate or in-flight duplicate; 422 semantic/scope/idempotency mismatch; 503 entitlement or dependency unavailable. Gateway-originated failures use Problem Details. Trade-originated validation, guard, and domain errors remain raw Nest exception bodies and are passed through unchanged by the Gateway; successes use the envelope above.
- Domain error codes observed in the owning module: `TRADE.CONCURRENCY.STALE_VERSION`, `TRADE.INVENTORY.DELIVERY_NOT_ALLOWED`, `TRADE.INVENTORY.INSUFFICIENT_AVAILABILITY`, `TRADE.INVENTORY.ITEM_NOT_STOCK_TRACKED`, `TRADE.INVENTORY.NODE_INVALID`, `TRADE.INVENTORY.NODE_IN_USE`, `TRADE.INVENTORY.PERIOD_CLOSED`, `TRADE.INVENTORY.POLICY_REJECTED`, `TRADE.INVENTORY.QUANTITY_INVALID`, `TRADE.INVENTORY.RECEIPT_NOT_ALLOWED`, `TRADE.INVENTORY.RELEASE_NOT_ALLOWED`, `TRADE.INVENTORY.RESERVATION_CONFLICT`, `TRADE.INVENTORY.REVERSAL_NOT_ALLOWED`, `TRADE.INVENTORY.SCOPE_INVALID`, `TRADE.INVENTORY.SERIAL_CONFLICT`, `TRADE.INVENTORY.TRACKING_REQUIRED`, `TRADE.INVENTORY.TRACKING_UNSUPPORTED`, `TRADE.INVENTORY.UOM_CONVERSION_INVALID`, `TRADE.INVENTORY.UOM_CONVERSION_UNAVAILABLE`.

- Availability, nodes and movement commands are branch-scoped; period, conversion, serial and decision projections are company-scoped. Node management is company-scoped.
- All mutations require UUIDv7 idempotency. Updates/transitions/post/reverse/release require `If-Match` where shown. Movement commands are synchronous owner writes, but downstream outbox effects and reservation expiry are asynchronous.
- Reversal is additive and may be partial when `lines` is present; never edit or delete the original movement.

## Safe example

Use the tenant portal's authenticated same-origin API client; it owns the session/cookie behavior. This read example contains only browser-authorized scope headers:

```ts
const result = await tenantTradeApi.request(
  "/api/tenant/trade/v1/inventory/nodes",
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

- The worker expiry flow is not a browser API. Poll Trade projections; do not call Worker directly.
- Never infer writable fields from response entities. Use only the DTO named in the route table.
- Never call Trade directly from the browser and never call Worker. Use the canonical Gateway path.
- See [examples.md](examples.md) for safe request patterns and [route-coverage.md](route-coverage.md) for the complete 226-route assignment.
