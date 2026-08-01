# Trade Catalog, UOM and Channels API

> Contract status: source-verified backend contract; replacement frontend not implemented
> Verification date: 2026-07-25
> Backend owner: Trade
> Documentation: source-generated from verified Gateway routes, Trade controllers/DTOs/services/tests, and legacy frontend evidence
> Canonical browser prefix: `/api/tenant/trade/v1`
> Controller-relative prefixes: `/trade/items`, `/trade/catalog/uoms`, `/trade/channels`
> Tenant Portal status: `tenant-portal` replaces the legacy tenant Trade UI; Legacy `mutakamel-web-app` has live catalog management clients and screens. The replacement `tenant-portal` has no Trade client or screen yet.

## Capability

Tenant catalog masters, company and branch item profiles, channel listings, channel-to-branch assignments, and the routed UOM read catalogue.

- Controller feature requirement: none declared; Trade module entitlement, seat, permission, and scope still apply.
- Gateway routes assigned to this page: **19**.
- These are browser contracts. The Trade upstream remains `/api/v1/trade/...`; the browser must use the canonical prefix above.

## Source evidence

Backend source references below are relative to `C:\mutakamel.ai\frontend`.

- `../backend/mutakamel-apps/api-gateway-app/src/routing-proxy/route-contracts/trade.route-contracts.ts`
- `../backend/mutakamel-apps/trade-app/src/modules/catalog/catalog.controller.ts`
- `../backend/mutakamel-apps/trade-app/src/modules/catalog/catalog-read.controller.ts`
- `../backend/mutakamel-apps/trade-app/src/modules/catalog/dto/catalog.dto.ts`
- `../backend/mutakamel-apps/trade-app/src/modules/catalog/catalog.service.ts`
- `../backend/mutakamel-apps/trade-app/src/modules/catalog/catalog-read-projection.service.ts`
- `../backend/mutakamel-apps/trade-app/src/modules/catalog/catalog.service.spec.ts`
- `../backend/mutakamel-apps/mutakamel-web-app/src/features/tenant/trade/trade-management-api.ts`
- `../backend/mutakamel-apps/mutakamel-web-app/src/features/tenant/trade/catalog-management-section.tsx`

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
| GET | `/api/tenant/trade/v1/items` | `/trade/items` | `trade.items.read` | `OPERATING_CONTEXT` | `query: CatalogListQueryDto` | — | 200 | `AUTHENTICATED`; gateway-idempotent=true |
| POST | `/api/tenant/trade/v1/items/search` | `/trade/items/search` | `trade.items.read` | `OPERATING_CONTEXT` | `body: CatalogSearchDto` | — | 200 | `READ_HEAVY`; gateway-idempotent=true |
| GET | `/api/tenant/trade/v1/items/:id` | `/trade/items/:id` | `trade.items.read` | `OPERATING_CONTEXT` | — | — | 200 | `AUTHENTICATED`; gateway-idempotent=true |
| POST | `/api/tenant/trade/v1/items` | `/trade/items` | `trade.catalog_master.manage` | `TENANT` | `body: CreateItemDto` | `X-Idempotency-Key` | 201 | `WRITE_SENSITIVE`; gateway-idempotent=true |
| PATCH | `/api/tenant/trade/v1/items/:id` | `/trade/items/:id` | `trade.catalog_master.manage` | `TENANT` | `body: UpdateItemDto` | `X-Idempotency-Key`, `If-Match` | 200 | `WRITE_SENSITIVE`; gateway-idempotent=true |
| POST | `/api/tenant/trade/v1/items/:id/company-profile` | `/trade/items/:id/company-profile` | `trade.items.manage` | `COMPANY` | `body: UpsertItemCompanyProfileDto` | `X-Idempotency-Key` | 201 | `WRITE_SENSITIVE`; gateway-idempotent=true |
| PATCH | `/api/tenant/trade/v1/items/:id/company-profile` | `/trade/items/:id/company-profile` | `trade.items.manage` | `COMPANY` | `body: UpsertItemCompanyProfileDto` | `X-Idempotency-Key`, `If-Match` | 200 | `WRITE_SENSITIVE`; gateway-idempotent=true |
| POST | `/api/tenant/trade/v1/items/:id/branch-profile` | `/trade/items/:id/branch-profile` | `trade.items.manage` | `BRANCH` | `body: UpsertItemBranchProfileDto` | `X-Idempotency-Key` | 201 | `WRITE_SENSITIVE`; gateway-idempotent=true |
| PATCH | `/api/tenant/trade/v1/items/:id/branch-profile` | `/trade/items/:id/branch-profile` | `trade.items.manage` | `BRANCH` | `body: UpsertItemBranchProfileDto` | `X-Idempotency-Key`, `If-Match` | 200 | `WRITE_SENSITIVE`; gateway-idempotent=true |
| GET | `/api/tenant/trade/v1/items/:id/channel-listings` | `/trade/items/:id/channel-listings` | `trade.items.read` | `COMPANY_OR_BRANCH` | `query: ItemChannelListingListQueryDto` | — | 200 | `AUTHENTICATED`; gateway-idempotent=true |
| POST | `/api/tenant/trade/v1/items/:id/channel-listings` | `/trade/items/:id/channel-listings` | `trade.items.manage` | `COMPANY_OR_BRANCH` | `body: ItemChannelListingDto` | `X-Idempotency-Key` | 201 | `WRITE_SENSITIVE`; gateway-idempotent=true |
| PATCH | `/api/tenant/trade/v1/items/:id/channel-listings/:channelId` | `/trade/items/:id/channel-listings/:channelId` | `trade.items.manage` | `COMPANY_OR_BRANCH` | `body: UpdateItemChannelListingDto` | `X-Idempotency-Key`, `If-Match` | 200 | `WRITE_SENSITIVE`; gateway-idempotent=true |
| GET | `/api/tenant/trade/v1/catalog/uoms` | `/trade/catalog/uoms` | `trade.items.read` | `COMPANY_OR_BRANCH` | `query: UomCatalogueQueryDto` | — | 200 | `AUTHENTICATED`; gateway-idempotent=true |
| GET | `/api/tenant/trade/v1/channels` | `/trade/channels` | `trade.items.read` | `COMPANY` | — | — | 200 | `AUTHENTICATED`; gateway-idempotent=true |
| POST | `/api/tenant/trade/v1/channels` | `/trade/channels` | `trade.items.manage` | `COMPANY` | `body: CreateChannelDto` | `X-Idempotency-Key` | 201 | `WRITE_SENSITIVE`; gateway-idempotent=true |
| GET | `/api/tenant/trade/v1/channels/:id` | `/trade/channels/:id` | `trade.items.read` | `COMPANY` | — | — | 200 | `AUTHENTICATED`; gateway-idempotent=true |
| PATCH | `/api/tenant/trade/v1/channels/:id` | `/trade/channels/:id` | `trade.items.manage` | `COMPANY` | `body: UpdateChannelDto` | `X-Idempotency-Key`, `If-Match` | 200 | `WRITE_SENSITIVE`; gateway-idempotent=true |
| POST | `/api/tenant/trade/v1/channels/:id/branches` | `/trade/channels/:id/branches` | `trade.items.manage` | `BRANCH` | `body: ChannelBranchDto` | `X-Idempotency-Key` | 201 | `WRITE_SENSITIVE`; gateway-idempotent=true |
| PATCH | `/api/tenant/trade/v1/channels/:id/branches/:branchId` | `/trade/channels/:id/branches/:branchId` | `trade.items.manage` | `BRANCH` | `body: UpdateChannelBranchDto` | `X-Idempotency-Key`, `If-Match` | 200 | `WRITE_SENSITIVE`; gateway-idempotent=true |

`gateway-idempotent` is Gateway transport metadata. `X-Idempotency-Key` in the header column is the independent Trade domain replay contract.

## Validation and enum wire values

The global validation pipe transforms primitive query values, whitelists declared fields, rejects unknown fields, accumulates validation failures, and returns `TRADE.VALIDATION_FAILED`. Exact property decorators are in [validation-reference.md](validation-reference.md).

- All resource identifiers use the shared UUIDv7 pattern. Pagination defaults are encoded in the DTOs and list limits are capped at 100.
- `CreateItemDto.canonicalCode` is 1-80 characters; `baseUomId` is required; `localizedNames` is an object. Company and branch profile booleans are explicit.
- `CatalogSearchFilterDto.field` is a TypeScript union but is validated only with `IsString`; treat the narrower union as compile-time intent, not a guaranteed runtime rejection.
- `UpdateChannelDto.status` and listing `publicationStatus` are strings without an `IsIn` validator; do not manufacture a closed enum.

- `ItemKind`: `PRODUCT`, `SERVICE`.
- `ItemStatus`: `DRAFT`, `ACTIVE`, `INACTIVE`, `DISCONTINUED`.
- `ItemTrackingMode`: `NONE`, `LOT`, `SERIAL`.
- `ChannelType`: `INTERNAL_SALES`, `POS`, `ECOMMERCE`, `B2B_PORTAL`, `MARKETPLACE`, `FIELD_SALES`, `API`.
- UOM catalogue purpose: `ANY`, `SALES`, `PURCHASE`; controller-only UOM status: `ACTIVE`, `RETIRED`.

## Response, errors, security, idempotency and async behavior

- Normal non-204 success: `{ success: true, data, correlationId, timestamp }`. A versioned object also sets `ETag: "<version>"`; a domain replay sets `Idempotency-Replayed`. A 204 has no body.
- A required idempotency key is a UUIDv7. Reusing it with a different canonical request returns an idempotency mismatch; an in-flight duplicate conflicts. A required `If-Match` accepts a positive quoted integer ETag unless the route explicitly documents create sentinel `"0"`.
- Common failures: 400 validation/missing precondition; 401 absent, stale or invalidated tenant session; 403 missing seat/entitlement/feature/permission; 404 missing scoped resource; 409 stale aggregate or in-flight duplicate; 422 semantic/scope/idempotency mismatch; 503 entitlement or dependency unavailable. Gateway-originated failures use Problem Details. Trade-originated validation, guard, and domain errors remain raw Nest exception bodies and are passed through unchanged by the Gateway; successes use the envelope above.
- Domain error codes observed in the owning module: `TRADE.AUTH.TARGET_DENIED`, `TRADE.CATALOG.BRANCH_MISMATCH`, `TRADE.CATALOG.BRANCH_PROFILE_ALREADY_EXISTS`, `TRADE.CATALOG.CAPABILITY_INCOMPATIBLE`, `TRADE.CATALOG.CHANNEL_INVALID`, `TRADE.CATALOG.CHANNEL_LISTING_ALREADY_EXISTS`, `TRADE.CATALOG.CHANNEL_LISTING_INVALID`, `TRADE.CATALOG.CODE_TAKEN`, `TRADE.CATALOG.COMPANY_PROFILE_ALREADY_EXISTS`, `TRADE.CATALOG.COMPANY_PROFILE_INVALID`, `TRADE.CATALOG.ITEM_IDENTITY_INVALID`, `TRADE.CATALOG.ITEM_NOT_FOUND`, `TRADE.CATALOG.UOM_CODE_TAKEN`, `TRADE.CATALOG.UOM_INVALID`, `TRADE.CATALOG.UOM_RETIRE_REFERENCED`, `TRADE.CONCURRENCY.STALE_VERSION`, `TRADE.CONTEXT.BRANCH_COMPANY_MISMATCH`, `TRADE.IMPORT.MAPPING_INVALID`, `TRADE.IMPORT.SCOPE_MISMATCH`.

- Catalog mutations are synchronous domain commands and require a UUIDv7 idempotency key; updates additionally require an aggregate ETag in `If-Match`.
- Tenant-master item creation is tenant-scoped. Company profiles and channels are company-scoped. Branch profiles and channel branch assignments are branch-scoped. Listing reads/writes accept company or branch context.
- The four `/api/v1/trade/uoms` CRUD controller routes are not present in the Gateway contract and are not browser APIs. Only `GET /catalog/uoms` is routed.

## Safe example

Use the tenant portal's authenticated same-origin API client; it owns the session/cookie behavior. This read example contains only browser-authorized scope headers:

```ts
const result = await tenantTradeApi.request(
  "/api/tenant/trade/v1/items/019f98a0-1234-7abc-8def-1234567890ab",
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

- There is no Gateway path for direct UOM list/get/create/update. An AI must not call `/api/tenant/trade/v1/uoms` until a Gateway contract is added.
- Never infer writable fields from response entities. Use only the DTO named in the route table.
- Never call Trade directly from the browser and never call Worker. Use the canonical Gateway path.
- See [examples.md](examples.md) for safe request patterns and [route-coverage.md](route-coverage.md) for the complete 226-route assignment.
