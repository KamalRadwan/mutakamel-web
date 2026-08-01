# Trade Purchase Orders API

> Contract status: source-verified backend contract; replacement frontend not implemented
> Verification date: 2026-07-25
> Backend owner: Trade
> Documentation: source-generated from verified Gateway routes, Trade controllers/DTOs/services/tests, and legacy frontend evidence
> Canonical browser prefix: `/api/tenant/trade/v1`
> Controller-relative prefixes: `/trade/purchase-orders`
> Tenant Portal status: `tenant-portal` replaces the legacy tenant Trade UI; Legacy `mutakamel-web-app` has live purchase-order clients and operations UI. The replacement `tenant-portal` is not implemented.

## Capability

Purchase-order drafts, approval lifecycle, confirmation/cancellation, and branch projections.

- Controller feature requirement: none declared; Trade module entitlement, seat, permission, and branch scope still apply.
- Gateway routes assigned to this page: **10**.
- These are browser contracts. The Trade upstream remains `/api/v1/trade/...`; the browser must use the canonical prefix above.

## Source evidence

Backend source references below are relative to `C:\mutakamel.ai\frontend`.

- `../backend/mutakamel-apps/api-gateway-app/src/routing-proxy/route-contracts/trade.route-contracts.ts`
- `../backend/mutakamel-apps/trade-app/src/modules/purchasing/purchasing.controller.ts`
- `../backend/mutakamel-apps/trade-app/src/modules/purchasing/dto/purchasing.dto.ts`
- `../backend/mutakamel-apps/trade-app/src/modules/purchasing/purchasing.service.ts`
- `../backend/mutakamel-apps/trade-app/src/modules/purchasing/purchasing.service.spec.ts`
- `../backend/mutakamel-apps/mutakamel-web-app/src/features/tenant/trade/trade-operations-api.ts`
- `../backend/mutakamel-apps/mutakamel-web-app/src/features/tenant/trade/purchase-orders-operations-section.tsx`

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
| GET | `/api/tenant/trade/v1/purchase-orders` | `/trade/purchase-orders` | `trade.purchase_orders.read` | `BRANCH` | `query: DocumentListQueryDto` | — | 200 | `AUTHENTICATED`; gateway-idempotent=true |
| POST | `/api/tenant/trade/v1/purchase-orders` | `/trade/purchase-orders` | `trade.purchase_orders.create` | `BRANCH` | `body: CreatePurchaseOrderDto` | `X-Idempotency-Key` | 201 | `WRITE_SENSITIVE`; gateway-idempotent=true |
| GET | `/api/tenant/trade/v1/purchase-orders/:id` | `/trade/purchase-orders/:id` | `trade.purchase_orders.read` | `BRANCH` | — | — | 200 | `AUTHENTICATED`; gateway-idempotent=true |
| PATCH | `/api/tenant/trade/v1/purchase-orders/:id` | `/trade/purchase-orders/:id` | `trade.purchase_orders.update` | `BRANCH` | `body: UpdatePurchaseOrderDto` | `X-Idempotency-Key`, `If-Match` | 200 | `WRITE_SENSITIVE`; gateway-idempotent=true |
| POST | `/api/tenant/trade/v1/purchase-orders/:id/submit` | `/trade/purchase-orders/:id/submit` | `trade.purchase_orders.submit` | `BRANCH` | `body: PurchaseActionDto` | `X-Idempotency-Key`, `If-Match` | 200 | `WRITE_SENSITIVE`; gateway-idempotent=true |
| POST | `/api/tenant/trade/v1/purchase-orders/:id/withdraw` | `/trade/purchase-orders/:id/withdraw` | `trade.purchase_orders.submit` | `BRANCH` | `body: PurchaseActionDto` | `X-Idempotency-Key`, `If-Match` | 200 | `WRITE_SENSITIVE`; gateway-idempotent=true |
| POST | `/api/tenant/trade/v1/purchase-orders/:id/approve` | `/trade/purchase-orders/:id/approve` | `trade.purchase_orders.approve` | `BRANCH` | `body: PurchaseActionDto` | `X-Idempotency-Key`, `If-Match` | 200 | `WRITE_SENSITIVE`; gateway-idempotent=true |
| POST | `/api/tenant/trade/v1/purchase-orders/:id/reject` | `/trade/purchase-orders/:id/reject` | `trade.purchase_orders.approve` | `BRANCH` | `body: PurchaseActionDto` | `X-Idempotency-Key`, `If-Match` | 200 | `WRITE_SENSITIVE`; gateway-idempotent=true |
| POST | `/api/tenant/trade/v1/purchase-orders/:id/confirm` | `/trade/purchase-orders/:id/confirm` | `trade.purchase_orders.confirm` | `BRANCH` | `body: PurchaseActionDto` | `X-Idempotency-Key`, `If-Match` | 200 | `WRITE_SENSITIVE`; gateway-idempotent=true |
| POST | `/api/tenant/trade/v1/purchase-orders/:id/cancel` | `/trade/purchase-orders/:id/cancel` | `trade.purchase_orders.cancel` | `BRANCH` | `body: PurchaseActionDto` | `X-Idempotency-Key`, `If-Match` | 200 | `WRITE_SENSITIVE`; gateway-idempotent=true |

`gateway-idempotent` is Gateway transport metadata. `X-Idempotency-Key` in the header column is the independent Trade domain replay contract.

## Validation and enum wire values

The global validation pipe transforms primitive query values, whitelists declared fields, rejects unknown fields, accumulates validation failures, and returns `TRADE.VALIDATION_FAILED`. Exact property decorators are in [validation-reference.md](validation-reference.md).

- Supplier, receiving-node, item, UOM and line IDs are UUIDv7. Currency is three uppercase letters. Quantities/prices/totals are decimal strings.
- Purchase lines are nested and bounded; financial evidence and totals are explicit. Action reason/evidence fields are bounded strings.
- List status is a free-form string at DTO validation; lifecycle services reject illegal actions.

- Approval and document lifecycle projections use the shared enums in `static-data.md`; no request enum closes the list status.

## Response, errors, security, idempotency and async behavior

- Normal non-204 success: `{ success: true, data, correlationId, timestamp }`. A versioned object also sets `ETag: "<version>"`; a domain replay sets `Idempotency-Replayed`. A 204 has no body.
- A required idempotency key is a UUIDv7. Reusing it with a different canonical request returns an idempotency mismatch; an in-flight duplicate conflicts. A required `If-Match` accepts a positive quoted integer ETag unless the route explicitly documents create sentinel `"0"`.
- Common failures: 400 validation/missing precondition; 401 absent, stale or invalidated tenant session; 403 missing seat/entitlement/feature/permission; 404 missing scoped resource; 409 stale aggregate or in-flight duplicate; 422 semantic/scope/idempotency mismatch; 503 entitlement or dependency unavailable. Gateway-originated failures use Problem Details. Trade-originated validation, guard, and domain errors remain raw Nest exception bodies and are passed through unchanged by the Gateway; successes use the envelope above.
- Domain error codes observed in the owning module: `TRADE.APPROVAL.MAKER_CHECKER_REQUIRED`, `TRADE.APPROVAL.REJECTED`, `TRADE.CONCURRENCY.STALE_VERSION`, `TRADE.DEPENDENCY.TIMEOUT`, `TRADE.FINALIZED_DOCUMENT.SNAPSHOT_INCOMPLETE`, `TRADE.POLICY.DECISION_UNAVAILABLE`, `TRADE.PRICE.MARGIN_GUARD`, `TRADE.PURCHASE_ORDER.APPROVAL_INVALID`, `TRADE.PURCHASE_ORDER.CANCEL_NOT_ALLOWED`, `TRADE.PURCHASE_ORDER.CONFIRM_NOT_ALLOWED`, `TRADE.PURCHASE_ORDER.ITEM_NOT_PURCHASABLE`, `TRADE.PURCHASE_ORDER.RECEIVING_SCOPE_INVALID`, `TRADE.PURCHASE_ORDER.SUPPLIER_INVALID`.

- All routes are branch-scoped. Every command requires idempotency and all mutations after create require `If-Match`.
- Submit/withdraw/approve/reject/confirm/cancel are synchronous owner transitions returning 200. PDF creation/polling is split into `pdf-render-jobs.md`.

## Safe example

Use the tenant portal's authenticated same-origin API client; it owns the session/cookie behavior. This read example contains only browser-authorized scope headers:

```ts
const result = await tenantTradeApi.request(
  "/api/tenant/trade/v1/purchase-orders/019f98a0-1234-7abc-8def-1234567890ab",
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

- Confirmation success does not imply physical receipt. Inventory receiving remains a separate inventory command.
- Never infer writable fields from response entities. Use only the DTO named in the route table.
- Never call Trade directly from the browser and never call Worker. Use the canonical Gateway path.
- See [examples.md](examples.md) for safe request patterns and [route-coverage.md](route-coverage.md) for the complete 226-route assignment.
