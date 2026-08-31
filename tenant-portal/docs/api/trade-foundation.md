# Trade — Foundation

Status: **verified**

Last source verification: **2026-08-31**

Owning app: **trade-app**

Canonical prefixes: `/api/tenant/trade/v1/items`, `.../uoms`,
`.../catalog/uoms`, `.../channels`, `.../commercial-accounts`,
`.../configuration`

Upstream: `/api/v1/trade/*` (global prefix `api`, URI versioning, default `1` —
`trade-app/src/main.ts`)

Portal status: **built** — MASTER-PLAN Phase 10 landed on 2026-08-31. All 42
routes are called from `src/app/(tenant)/trade/{items,uoms,channels,commercial-accounts,configuration}`.
What building them turned up is in
[Corrections and additions from building Phase 10](#corrections-and-additions-from-building-phase-10--2026-08-31).

**42 routes.** Items 12 · UOM master 4 · UOM catalogue 1 · Channels 6 ·
Commercial accounts 10 · Configuration 9.

Together with [trade-documents.md](trade-documents.md) (60) and
[trade-advanced.md](trade-advanced.md) (129) this accounts for all
**231** Trade routes exactly once. 42 + 60 + 129 = 231.

Source inspected:
`trade-app/src/main.ts`,
`trade-app/src/common/common.module.ts`,
`trade-app/src/common/trade-response.interceptor.ts`,
`trade-app/src/common/trade-access.decorator.ts`,
`trade-app/src/common/http-preconditions.ts`,
`trade-app/src/common/domain-idempotency.service.ts`,
`trade-app/src/common/idempotency-header.middleware.ts`,
`trade-app/src/common/fixed-decimal.ts`,
`trade-app/src/common/guards/trade-scope.guard.ts`,
`trade-app/src/common/guards/trade-permissions.guard.ts`,
`trade-app/src/common/guards/subscription.guard.ts`,
`trade-app/src/modules/catalog/catalog.controller.ts`,
`trade-app/src/modules/catalog/catalog-read.controller.ts`,
`trade-app/src/modules/catalog/catalog.service.ts`,
`trade-app/src/modules/catalog/catalog.repository.ts`,
`trade-app/src/modules/catalog/catalog-uom.service.ts`,
`trade-app/src/modules/catalog/catalog-read-projection.service.ts`,
`trade-app/src/modules/catalog/dto/catalog.dto.ts`,
`trade-app/src/modules/commercial-accounts/commercial-accounts.controller.ts`,
`trade-app/src/modules/commercial-accounts/commercial-account-lookups.controller.ts`,
`trade-app/src/modules/commercial-accounts/commercial-accounts.service.ts`,
`trade-app/src/modules/commercial-accounts/dto/commercial-account.dto.ts`,
`trade-app/src/modules/configuration-scope/configuration-scope.controller.ts`,
`trade-app/src/modules/configuration-scope/dto/configuration.dto.ts`,
`trade-app/src/modules/pricing/pricing.controller.ts`,
`trade-app/src/modules/pricing/dto/pricing.dto.ts`,
`trade-app/packages/common/src/constants/permissions.ts`,
`trade-app/packages/common/src/constants/features.ts`,
`trade-app/packages/common/src/constants/error-codes.ts`,
`trade-app/packages/common/src/enums/trade.enums.ts`,
`api-gateway-app/src/routing-proxy/route-contracts/trade.route-contracts.ts`,
`api-gateway-app/src/routing-proxy/upstream-client.service.ts`,
`api-gateway-app/src/common/middleware/route-context.middleware.ts`,
`api-gateway-app/src/common/gateway-error.catalog.ts`.

---

## The envelope — Trade **is** wrapped

> **Every Trade response is wrapped in `data`.** Unwrap it the way you unwrap
> Core. Getting this wrong breaks every Trade screen at once.

Verified, not assumed: `TradeResponseInterceptor` is registered as a global
`APP_INTERCEPTOR` in `trade-app/src/common/common.module.ts`, and
`CommonModule` is `@Global()`. Every handler return value passes through it.

```json
{
  "success": true,
  "data": { },
  "correlationId": "…",
  "timestamp": "2026-08-31T09:41:02.118Z"
}
```

**It is not identical to Core's envelope.** Three differences that matter:

| | Core | Trade |
| --- | --- | --- |
| `meta` key | present | **absent** — there is no top-level `meta` |
| `correlationId` | string | string **or `null`** — the interceptor writes `null` when neither `request.correlationId` nor the trade context carries one |
| Pass-through | — | **an object that already has a `success` key is returned unwrapped**, verbatim |

That last rule is line 24 of the interceptor. No Trade handler currently
returns a `success` key, so today every response is wrapped — but a validator
that assumes `data` exists will break the first time one does. Validate the
envelope shape, do not assert it.

This also corrects [README.md](README.md), which said Trade "uses its Nest
exception bodies rather than the shared application error filter, so its error
shape differs from Core's." That is true of **failures** — there is no
exception filter in `trade-app`, so an error body is Nest's default
(`{ statusCode, message, error }`, with the thrown object's own keys merged
in, which is where `code` comes from). It is **not** true of successes, which
are enveloped exactly as described above.

### The `code` key, not `errorCode`

Trade failures carry **`code`**, not Core's `errorCode`. Every documented
failure below is `{ "code": "TRADE.…", … }` at the top level of the body,
alongside Nest's `statusCode` and `message`. Some throw sites add extra keys
(`field`, `reason`, `details`) — those are noted where they exist.

---

## What applies to every route on this page

### Guard order

`common.module.ts` registers six global guards, in this order, and the first
to refuse wins:

1. `JwtAuthGuard`
2. `TrustedGatewayTenantGuard`
3. `TradeTenantUserStateGuard`
4. `TradeSubscriptionGuard` — module entitlement and feature gating
5. `TradeScopeGuard` — resolves the operating context from headers
6. `TradePermissionsGuard` — resolves the permission **at the resolved scope**

`ThrottlerGuard` runs last (60 s window, 120 requests — `app.module.ts`).

### Entitlement refusals come before everything

`TradeSubscriptionGuard` runs on **all 231 routes**, feature-gated or not:

| Condition | Status | `code` |
| --- | --- | --- |
| Tenant has no Trade entitlement snapshot | **403** | `TRADE.MODULE.DISABLED` |
| Required feature missing | **403** | `TRADE.ENTITLEMENT.FEATURE_REQUIRED` — with `details.requiredAllOf` and `details.requiredAnyOf` |
| Tenant is mid-provisioning | **403** | `TRADE.PROVISIONING.MAINTENANCE_ACTIVE` |
| The entitlement lookup itself failed | **503** | `TRADE.DEPENDENCY.ENTITLEMENT_UNAVAILABLE` |

`TRADE.MODULE.DISABLED` and `TRADE.ENTITLEMENT.FEATURE_REQUIRED` are **string
literals in the guard and are not in `TRADE_ERROR_CODES`.** Do not build the
portal's code union from that constant alone — see
[Codes the catalogue does not contain](#codes-the-catalogue-does-not-contain).

Every route on this page is gated on **`trade.catalog`**, except:

- commercial accounts — `@RequireAnyTradeFeature(trade.sales, trade.purchasing)`
- `/configuration/definitions*`, `/configuration/versions/*` — `trade.policy_studio`
- `POST /configuration/resolve` — any one of the eight MVP features
- `/configuration/company-default-price-books/*` — `trade.pricing`

### Scope is carried in **headers**, never in the query

`TradeScopeGuard` reads exactly three request headers:

```text
x-mutakamel-company-id     UUID v7
x-mutakamel-branch-id      UUID v7
x-mutakamel-channel-id     UUID v7
```

There is no `companyId`/`branchId` query parameter anywhere in Trade, and
because the global pipe runs `forbidNonWhitelisted`, sending one is a **400**.

`x-mutakamel-channel-id` is Trade-only. The Gateway does not validate it and
does not strip it — it is passed straight through on every route
(`ORGANIZATION_SELECTOR_HEADERS` in `upstream-client.service.ts` contains only
the company and branch headers).

Each route declares a **scope target** through `@RequireTradeAccess(permission,
target)`. Four literal targets exist plus three resolved ones:

| Target | Headers you must send |
| --- | --- |
| `TENANT` | **neither** company nor branch is required |
| `COMPANY` | company **required**; branch rejected only by the Gateway policy, see below |
| `BRANCH` | company **and** branch, both required |
| `COMPANY_OR_BRANCH` | company required; sending branch narrows the target to `BRANCH` |
| `OPERATING_CONTEXT` | fully optional — branch ⇒ `BRANCH`, else company ⇒ `COMPANY`, else `TENANT` |
| `DASHBOARD_CONTEXT` | as `OPERATING_CONTEXT`; see [trade-advanced.md](trade-advanced.md) |

Shape failures, all from `TradeScopeGuard`:

| Condition | Status | `code` |
| --- | --- | --- |
| Target needs a company and none was sent | **400** | `TRADE.CONTEXT.MISSING_COMPANY` |
| Target is `BRANCH` and no branch was sent | **400** | `TRADE.CONTEXT.MISSING_BRANCH` |
| A channel header without a company header | **400** | `TRADE.CONTEXT.MISSING_COMPANY` |
| Any of the three is not a UUID v7 | **400** | `TRADE.CONTEXT.INVALID_ID` — with `field` |
| Branch does not belong to the company | **422** | `TRADE.CONTEXT.BRANCH_COMPANY_MISMATCH` |
| Company, branch or channel is not `ACTIVE`, or soft-deleted | **422** | `TRADE.CONTEXT.SCOPE_INACTIVE` |
| Channel belongs to another company, or is not mapped to the branch | **422** | `TRADE.CONTEXT.EXECUTION_TARGET_MISMATCH` — with `field: "channelId"` and `reason` = `CHANNEL_COMPANY_MISMATCH` or `CHANNEL_BRANCH_MISMATCH` |

### Permission is checked **at the resolved scope**, and only there

`TradePermissionsGuard` does two things, in order:

1. If the actor is the tenant owner (`tenant_users.is_tenant_owner` and status
   `ACTIVE`), it returns `true` — **the owner bypasses every Trade permission
   check.** The nav predicate for an owner-only view is `user.isTenantOwner`,
   the same shape Core's billing routes use.
2. Otherwise it looks for a grant whose `scope_target` **equals** the resolved
   target, with matching `company_id` and `branch_id`.

The consequence is the single most surprising thing about Trade authorization:
**a `TENANT`-scoped grant does not satisfy a `BRANCH`-target route.** There is
no widening. `crm`-style `.own`/`.team`/`.all` suffixes do not exist here; the
90 Trade permission strings are exact keys.

Legacy `tenant_user_branch_roles` rows are unioned in, but **only** when the
resolved target is `BRANCH`.

Refusal is **403 `TRADE.AUTH.TARGET_DENIED`**, with no `details.permissions`
list — unlike Core, the response does not say which permission was missing.

> **The Gateway enforces no Trade permissions.** All 231 Trade route contracts
> have `requiredPermissions` absent, verified by parsing
> `trade.route-contracts.ts`. Every permission decision happens inside
> trade-app. A 403 therefore always comes from the app, never from the edge.

### The Gateway's own scope policy — 34 routes, and two of them disagree

34 Trade route contracts declare `organizationScopeMode`. On those, the
Gateway validates the header shape **before** the request reaches trade-app
and answers RFC 7807 `GW.REQUEST.INVALID` (**400**) if it does not match; it
then strips and re-sets the two headers from the validated values. The other
197 routes declare no mode, so their headers pass through untouched and
`TradeScopeGuard` is the only validator.

Of the 34, **four** are on this page — the whole `/uoms` family — and they
contradict each other:

| Route | Gateway mode | Meaning |
| --- | --- | --- |
| `GET /api/tenant/trade/v1/uoms` | `BRANCH_REQUIRED` | company **and** branch must both be sent |
| `GET /api/tenant/trade/v1/uoms/:id` | `BRANCH_REQUIRED` | same |
| `POST /api/tenant/trade/v1/uoms` | `NONE` | **neither may be sent** — a company header is a 400 |
| `PATCH /api/tenant/trade/v1/uoms/:id` | `NONE` | same |

**Read and write on the same resource have opposite header policies.** The
UOM editor must drop the operating-context headers on submit and re-add them
to refresh the list. This is consistent with the controller targets
(`OPERATING_CONTEXT` for reads, `TENANT` for writes) but it is enforced twice,
by two different components, with two different error shapes. Nothing else on
this page declares a Gateway mode.

Those four are the only Gateway-scoped routes on this page. The other 30 are
28 `BRANCH_REQUIRED` on
[trade-documents.md](trade-documents.md#the-gateway-scope-policy-on-this-page)
and 2 `OPTIONAL_COMPANY_BRANCH` on
[trade-advanced.md](trade-advanced.md#the-two-gateway-scoped-import-routes).

### Idempotency

Two independent layers. Both apply.

**Gateway layer.** `GatewayIdempotencyService.reserve()` fires for every route
that is `WRITE_SENSITIVE` **and** `idempotent: true` — which is every
mutating route on this page.

| Condition | Status | `code` |
| --- | --- | --- |
| No `x-idempotency-key` | **400** | `GW.IDEM.MISSING` |
| Key is not UUID v7 | **400** | `GW.IDEM.BAD_VALUE` |
| Same key still in flight | **409** | `GW.IDEM.IN_FLIGHT` |
| Same key, different body | **422** | `GW.IDEM.MISMATCH` |
| Redis unavailable | **503** | `GW.IDEM.UNAVAILABLE` — **503, not 429** |

A Gateway replay returns the **stored status and body**, plus
`idempotency-replayed: true`.

The Gateway computes the fingerprint itself and forwards it as
`x-mutakamel-idempotency-fingerprint: v1:sha256:<hash>`. **The browser never
sends a fingerprint header.** 32 Trade routes additionally pin a
`fingerprintSchemaId` in the route contract; none of them is on this page.

**App layer.** `DomainIdempotencyService.execute()` runs inside the tenant
transaction behind a PostgreSQL advisory lock:

| Condition | Status | `code` |
| --- | --- | --- |
| Header absent at the controller | **400** | `TRADE.IDEMPOTENCY.KEY_REQUIRED` |
| Header present but not UUID v7 | **422** | `TRADE.IDEMPOTENCY.KEY_REQUIRED` |
| Stored record's fingerprint differs | **422** | `TRADE.IDEMPOTENCY.MISMATCH` |
| Stored record still `IN_PROGRESS` | **409** | `TRADE.IDEMPOTENCY.IN_FLIGHT` |
| Stored response status is corrupt | **503** | `TRADE.DEPENDENCY.TIMEOUT` — with `reason: "IDEMPOTENCY_RESPONSE_STATUS_INVALID"` |

**`TRADE.IDEMPOTENCY.KEY_REQUIRED` is 400 in one place and 422 in another.**
Branch on status, never on the code alone.

The app fingerprints **every** idempotent request automatically, from a stable
JSON hash of the operation's `request` object. There is no opt-in and no
subset — a "fingerprint-required" flag does not exist in Trade.

#### The replay header the browser actually sees

Both layers set the same header, and they disagree about its values:

| Source | Header | Values |
| --- | --- | --- |
| Gateway replay | `idempotency-replayed` | `"true"` — **only ever set on a replay** |
| `TradeResponseInterceptor` | `Idempotency-Replayed` | `"true"` **or `"false"`** — set on every idempotent handler result |

So on Trade, unlike Core, **the header is present on first execution too**.
Test `header === 'true'`, never `header != null`. Core's internal
`X-Idempotency-Replay` does not exist in trade-app and never reaches the
browser.

`x-idempotency-key` also has a middleware quirk: `normalizeIdempotencyHeader`
copies `x-idempotency-key` into `idempotency-key` if the latter is absent.
Controllers read `x-idempotency-key`. **Send `x-idempotency-key`.**

### Optimistic concurrency — Trade has **one** parser

Core has three strictnesses in one app. Trade has one, plus a single
documented exception. Every `If-Match` on every Trade controller resolves to
`parseExpectedVersion` in `trade-app/src/common/http-preconditions.ts`
(`commercial-accounts.controller.ts` and `documents.controller.ts` import it
under the alias `requireVersion`; it is the same function).

```ts
value?.trim().replace(/^W\//, "").replace(/^"|"$/g, "")
```

| Form | Accepted |
| --- | --- |
| `W/"7"` | yes |
| `"7"` | yes |
| `7` (bare) | yes |
| absent, empty, `*`, non-numeric | **no** |
| `0`, or ≥ 2^53 | **no** — must be a safe integer ≥ 1 |

A rejected or missing header is **400 `TRADE.CONCURRENCY.IF_MATCH_REQUIRED`**.
**It is never 428.** Core's `email-config` answers 428 when the header is
absent; nothing in Trade does.

A version that parses but does not match the row is **409
`TRADE.CONCURRENCY.STALE_VERSION`** — thrown from 16 services.

The one exception is `parseExpectedVersionOrCreate`, used on exactly one route
in the whole app: `POST /configuration/company-default-price-books/…/upsert`.
It additionally accepts **`"0"`**, meaning "I expect no mapping to exist yet".
See [Configuration](#configuration--9-routes).

**Where the ETag comes from.** `TradeResponseInterceptor` sets
`ETag: "<n>"` whenever the unwrapped payload has a numeric `version` property.
It is a **strong** ETag with the bare integer inside quotes. Echo it back
verbatim; the parser accepts it either way. A response whose payload has no
numeric `version` carries no ETag, and you must read `version` out of the body
instead.

### Money and quantity are **decimal strings**. Always.

No Trade endpoint returns a JavaScript number for money or quantity —
verified by sweeping every `Number(` call in `trade-app/src` (the only
numeric coercions are counts, versions and page metadata). **Never call
`Number()` on any field listed as a decimal string.**

The wire format is pinned by regex in the DTOs:

| Pattern | Regex | Used for |
| --- | --- | --- |
| Non-negative | `^(?:0\|[1-9]\d*)(?:\.\d{1,8})?$` | prices, totals, credit limits |
| Positive | same, but `0` and `0.0…` are rejected | quantities |
| Signed | `^-?(?:0\|[1-9]\d*)(?:\.\d{1,8})?$` | rounding only |

Scale is **at most 8 decimal places**. Leading zeros (`010`), a trailing dot
(`10.`), an empty string and a JSON number are all **400
`TRADE.VALIDATION_FAILED`**.

**Server output is not zero-padded.** `fixedDecimalText` in
`trade-app/src/common/fixed-decimal.ts` strips trailing fractional zeros, so a
stored `10.50` comes back as `"10.5"` and `10.00` as `"10"`. Format for
display; never compare a server decimal to a locally formatted string.

Fields on this page that are decimal strings:

- `CreateCommercialAccountDto.creditLimit`, `UpdateCommercialAccountDto.creditLimit` — bounded to 16 integer digits (`^(?:0|[1-9]\d{0,15})(?:\.\d{1,8})?$`)
- `CreditEvaluationDto.proposedAmount` — same bound

### Pagination — offset only, and flat

Trade list responses are **not** shaped like CRM's. There is no `meta` object
and no `totalPages`, `hasNext` or `hasPrev`:

```json
{ "success": true, "data": { "items": [ ], "total": 137, "page": 1, "limit": 25 }, … }
```

Compute the page count in the portal from `total` and `limit`. Every list on
this page takes `page` (≥ 1, default 1) and `limit` (1–100), and **nothing
else** — there is no `sortBy`, no `sortDir`, no `search` except where noted.
Ordering is fixed per endpoint and is not client-controllable.

Two exceptions on this page:

- **`GET /channels` is not paginated and does not return `items`.** It returns
  a **bare array** of channel rows for the company, ordered `createdAt DESC`
  (`CatalogService.listChannels`). `data` is the array itself.
- **`GET /commercial-accounts/lookups`** takes `search` and `limit` (1–100,
  default 50) and no `page`.

No Trade route on this page is cursor-paged. The only cursor in the whole app
is on `GET /quotations/customer-options` — see
[trade-documents.md](trade-documents.md#the-one-cursor-in-trade).

### Capabilities — Trade has none

CRM exposes `…/capabilities` per family; **Trade exposes no capabilities
endpoint at all.** Sweeping `trade-app/src` for the term finds only database
provisioning probes and the unrelated `capabilitySet` field on an item
company profile.

Standing requirement S6 ("action admission from `capabilities`") therefore
cannot be satisfied on any Trade screen. Recorded as
**Q30** in [../build/OPEN-QUESTIONS.md](../build/OPEN-QUESTIONS.md).

---

## Items — 12 routes

| Method | Canonical path | Permission | Scope target | Body / query |
| --- | --- | --- | --- | --- |
| GET | `/api/tenant/trade/v1/items` | `trade.items.read` | `OPERATING_CONTEXT` | `CatalogListQueryDto` |
| POST | `/api/tenant/trade/v1/items/search` | `trade.items.read` | `OPERATING_CONTEXT` | `CatalogSearchDto` — **200**, not 201 |
| GET | `/api/tenant/trade/v1/items/:id` | `trade.items.read` | `OPERATING_CONTEXT` | — |
| POST | `/api/tenant/trade/v1/items` | `trade.catalog_master.manage` | `TENANT` | `CreateItemDto` |
| PATCH | `/api/tenant/trade/v1/items/:id` | `trade.catalog_master.manage` | `TENANT` | `UpdateItemDto` · `If-Match` |
| POST | `/api/tenant/trade/v1/items/:id/company-profile` | `trade.items.manage` | `COMPANY` | `UpsertItemCompanyProfileDto` |
| PATCH | `/api/tenant/trade/v1/items/:id/company-profile` | `trade.items.manage` | `COMPANY` | `UpsertItemCompanyProfileDto` · `If-Match` |
| POST | `/api/tenant/trade/v1/items/:id/branch-profile` | `trade.items.manage` | `BRANCH` | `UpsertItemBranchProfileDto` |
| PATCH | `/api/tenant/trade/v1/items/:id/branch-profile` | `trade.items.manage` | `BRANCH` | `UpsertItemBranchProfileDto` · `If-Match` |
| GET | `/api/tenant/trade/v1/items/:id/channel-listings` | `trade.items.read` | `COMPANY_OR_BRANCH` | `ItemChannelListingListQueryDto` |
| POST | `/api/tenant/trade/v1/items/:id/channel-listings` | `trade.items.manage` | `COMPANY_OR_BRANCH` | `ItemChannelListingDto` |
| PATCH | `/api/tenant/trade/v1/items/:id/channel-listings/:channelId` | `trade.items.manage` | `COMPANY_OR_BRANCH` | `UpdateItemChannelListingDto` · `If-Match` |

All twelve are gated on the **`trade.catalog`** feature. Every mutating route
requires `x-idempotency-key`.

> **Three permissions and three scopes on one screen.** Creating the item is
> `trade.catalog_master.manage` at `TENANT`; giving it a company profile is
> `trade.items.manage` at `COMPANY`; giving it a branch profile is the same
> permission at `BRANCH`. A user can legitimately hold one and not the others,
> and the item wizard must degrade step by step rather than gate as a whole.

### Request bodies

| DTO | Fields |
| --- | --- |
| `CreateItemDto` | `canonicalCode` (1–80), `itemKind`, `localizedNames` (object, required), `baseUomId`, `categoryId?`, `variantIdentity?` (object) |
| `UpdateItemDto` | `localizedNames?`, `categoryId?` (nullable), `variantIdentity?` (nullable), `status?` |
| `UpsertItemCompanyProfileDto` | `canSell`, `canPurchase`, `trackInventory`, `trackingMode` — **all four required booleans/enum**; `taxClassificationKey?`, `defaultSalesUomId?`, `defaultPurchaseUomId?`, `accountingMappingKey?`, `capabilitySet?` (array ≤ 64, **defaults to `[]`**) |
| `UpsertItemBranchProfileDto` | `isAssorted` **required**; `defaultFulfillmentNodeId?`, `replenishmentPolicyKey?`, `restrictions?` (object, **defaults to `{}`**) |
| `ItemChannelListingDto` | `channelId` **required**, `publicationStatus?` (**defaults to `"DRAFT"`**), `saleConstraints?` (**defaults to `{}`**) |
| `UpdateItemChannelListingDto` | `publicationStatus?` (**defaults to `"DRAFT"`**), `saleConstraints?` (**defaults to `{}`**) |
| `CatalogListQueryDto` | `page`, `limit` (≤ 100, default 25), `itemKind?`, `status?` |
| `ItemChannelListingListQueryDto` | `page`, `limit` (≤ 100, **default 50**) |
| `CatalogSearchDto` | `CatalogListQueryDto` + `filters[]` — ≤ 50 entries, each `{ field, value }` where `field` is exactly `canonicalCode`, `status` or `itemKind` |

Both `company-profile` and `branch-profile` bodies are **full upserts, not
patches**, even on `PATCH`. Send the complete object; an omitted optional with
a default is written as the default. Omitting `capabilitySet` on a PATCH
**clears it to `[]`**, and omitting `restrictions` clears it to `{}`.

The same trap is worse on channel listings: `publicationStatus` and
`saleConstraints` are both `@IsOptional` **with defaults**, so a `PATCH` that
sends only `saleConstraints` silently resets `publicationStatus` to `"DRAFT"`.
Always send both.

### Enums

| Enum | Values |
| --- | --- |
| `ItemKind` | **`PRODUCT`** · **`SERVICE`** |
| `ItemStatus` | **`DRAFT`** · **`ACTIVE`** · **`INACTIVE`** · **`DISCONTINUED`** |
| `ItemTrackingMode` | **`NONE`** · **`LOT`** · **`SERIAL`** |

**`publicationStatus` is not an enum.** It is `@IsString() @MaxLength(32)`
with a `"DRAFT"` default. No enum, no `@IsIn`, and no database check
constraint pins the value set, so the wire can carry any ≤ 32-character
string and the portal cannot enumerate the states from source. Recorded as
**Q31**.

### Errors

| `code` | Status | When |
| --- | --- | --- |
| `TRADE.CATALOG.ITEM_NOT_FOUND` | **404**, also **422** | 404 from `get`; 422 from the read projection when the item is out of the company scope |
| `TRADE.CATALOG.CODE_TAKEN` | 409 | `canonicalCode` collides |
| `TRADE.CATALOG.ITEM_IDENTITY_INVALID` | 422 | `variantIdentity` is malformed |
| `TRADE.CATALOG.UOM_INVALID` | 422 | `baseUomId` / default UOM is not an active catalogue UOM |
| `TRADE.CATALOG.CAPABILITY_INCOMPATIBLE` | 422 | `capabilitySet` conflicts with `canSell`/`canPurchase` |
| `TRADE.CATALOG.TRACKING_LOCKED` | — | in the catalogue, **no throw site found** — see [Not verified](#not-verified) |
| `TRADE.CATALOG.COMPANY_PROFILE_INVALID` | **422**, also **404** | |
| `TRADE.CATALOG.COMPANY_PROFILE_ALREADY_EXISTS` | 409 | `POST` when a profile exists — use `PATCH` |
| `TRADE.CATALOG.BRANCH_PROFILE_ALREADY_EXISTS` | 409 | same, for branch |
| `TRADE.CATALOG.BRANCH_MISMATCH` | **404**, also **422** | branch is not under the company profile's company |
| `TRADE.CATALOG.CHANNEL_LISTING_INVALID` | **422**, also **404** | |
| `TRADE.CATALOG.CHANNEL_LISTING_ALREADY_EXISTS` | 409 | |
| `TRADE.EXTENSION.VALUE_INVALID` | 422 | item extension values fail the published profile |
| `TRADE.CONCURRENCY.STALE_VERSION` | 409 | `If-Match` parsed but did not match |

Five of these codes are emitted at **more than one status**. Where a table
cell lists two, the portal must branch on the pair, not the code.

---

## UOM master — 4 routes

| Method | Canonical path | Permission | Scope target | Body / query |
| --- | --- | --- | --- | --- |
| GET | `/api/tenant/trade/v1/uoms` | `trade.items.read` | `OPERATING_CONTEXT` | `UomListQueryDto` — **Gateway `BRANCH_REQUIRED`** |
| GET | `/api/tenant/trade/v1/uoms/:id` | `trade.items.read` | `OPERATING_CONTEXT` | — **Gateway `BRANCH_REQUIRED`** |
| POST | `/api/tenant/trade/v1/uoms` | `trade.catalog_master.manage` | `TENANT` | `CreateUomDto` — **Gateway `NONE`: send no scope headers** |
| PATCH | `/api/tenant/trade/v1/uoms/:id` | `trade.catalog_master.manage` | `TENANT` | `UpdateUomDto` · `If-Match` — **Gateway `NONE`** |

This is the disagreement described above. The two writes also pin a Gateway
fingerprint schema (`trade.uom.create.v1`, `trade.uom.update.v1`) and a
128 KiB replay-body cap.

| DTO | Fields |
| --- | --- |
| `CreateUomDto` | `code` (1–32, `^[A-Za-z][A-Za-z0-9._-]*$`), `displayName` (1–160), `localizedNames` (object, **required**), `sourceEvidence` (**required**) |
| `UomSourceEvidenceDto` | `sourceKind` (1–80, **required**), `reference?` (≤ 240), `note?` (≤ 500) |
| `UpdateUomDto` | `displayName?`, `localizedNames?`, `sourceEvidence?`, `status?` — every field uses `@ValidateIf(value !== undefined)`, so **`null` is a 400**, not a clear |
| `UomListQueryDto` | `page`, `limit` (≤ 100, default 50), `status?`, `search?` (≤ 32, `^[A-Za-z0-9._-]+$`, matched as a **prefix**) |

`UomStatus`: **`ACTIVE`** · **`RETIRED`**. A UOM is retired by `PATCH`ing
`status`; there is no dedicated retire route.

`GET /uoms` adds `source: "AUTHORIZED_TRADE_UOM_MASTER"` alongside
`items`/`total`/`page`/`limit`.

| `code` | Status | When |
| --- | --- | --- |
| `TRADE.CATALOG.UOM_CODE_TAKEN` | 409 | |
| `TRADE.CATALOG.UOM_INVALID` | 422 | |
| `TRADE.CATALOG.UOM_RETIRE_REFERENCED` | 409 | retiring a UOM still referenced by an item |

---

## UOM catalogue — 1 route

| Method | Canonical path | Permission | Scope target | Query |
| --- | --- | --- | --- | --- |
| GET | `/api/tenant/trade/v1/catalog/uoms` | `trade.items.read` | `COMPANY_OR_BRANCH` | `UomCatalogueQueryDto` |

Distinct from `/uoms`, and the controller comment says so: `/uoms` is the
tenant master list; `/catalog/uoms` is **the UOMs authorised for the current
operating context**, optionally narrowed to one item. It is the correct
source for a line-editor UOM picker.

`UomCatalogueQueryDto`: `page`, `limit` (≤ 100, default 50),
`purpose` (`ANY` · `SALES` · `PURCHASE`, default `ANY`), `itemId?`,
`search?` (≤ 36, `^[0-9a-fA-F-]+$` — **matches an id fragment, not a name**).

Each row carries `id`, `code`, `displayName`, `localizedNames`,
`sourceEvidence`, `version`, `isBaseUom`, `isDefaultSalesUom`,
`isDefaultPurchaseUom`, `canSell`, `canPurchase`, `sourceItemCount` (a JS
number — a count, not money) and a literal
`source: "AUTHORIZED_TRADE_UOM_MASTER"`.

A missing company header here is **403 `TRADE.AUTH.TARGET_DENIED`**, not the
guard's 400 — `requireCompany()` in the read projection throws
`ForbiddenException`. This is the third status that code appears at.

---

## Channels — 6 routes

| Method | Canonical path | Permission | Scope target | Body |
| --- | --- | --- | --- | --- |
| GET | `/api/tenant/trade/v1/channels` | `trade.items.read` | `COMPANY` | — **bare array** |
| POST | `/api/tenant/trade/v1/channels` | `trade.items.manage` | `COMPANY` | `CreateChannelDto` |
| GET | `/api/tenant/trade/v1/channels/:id` | `trade.items.read` | `COMPANY` | — |
| PATCH | `/api/tenant/trade/v1/channels/:id` | `trade.items.manage` | `COMPANY` | `UpdateChannelDto` · `If-Match` |
| POST | `/api/tenant/trade/v1/channels/:id/branches` | `trade.items.manage` | `BRANCH` | `ChannelBranchDto` |
| PATCH | `/api/tenant/trade/v1/channels/:id/branches/:branchId` | `trade.items.manage` | `BRANCH` | `UpdateChannelBranchDto` · `If-Match` |

| DTO | Fields |
| --- | --- |
| `CreateChannelDto` | `code` (1–80), `name` (1–160), `channelType` |
| `UpdateChannelDto` | `name?` (1–160), `status?` — **a free `@IsString() @MaxLength(32)`, not an enum** |
| `ChannelBranchDto` | `branchId` **required**, `isActive?` (**defaults to `true`**) |
| `UpdateChannelBranchDto` | `isActive` **required** |

`ChannelType`: **`INTERNAL_SALES`** · **`POS`** · **`ECOMMERCE`** ·
**`B2B_PORTAL`** · **`MARKETPLACE`** · **`FIELD_SALES`** · **`API`**.
It is set at create and **cannot be changed** — `UpdateChannelDto` has no
`channelType`.

Channel status has no enum. `TradeScopeGuard` compares it against the literal
`'ACTIVE'` when validating `x-mutakamel-channel-id`, so `ACTIVE` is certainly
a member; the rest of the set is not discoverable from source. Same finding as
`publicationStatus` — **Q31**.

`TRADE.CATALOG.CHANNEL_INVALID` is emitted at **404, 409 and 422** from three
sites in `catalog.service.ts`. Three distinct failures, one code.

---

## Commercial accounts — 10 routes

Feature gate: `@RequireAnyTradeFeature(trade.sales, trade.purchasing)` — the
tenant needs **either**.

| Method | Canonical path | Permission | Scope target | Body / query |
| --- | --- | --- | --- | --- |
| GET | `/api/tenant/trade/v1/commercial-accounts` | `trade.commercial_accounts.read` | `COMPANY_OR_BRANCH` | `CommercialAccountListQueryDto` |
| GET | `/api/tenant/trade/v1/commercial-accounts/lookups` | `trade.commercial_accounts.read` | `COMPANY_OR_BRANCH` | `CommercialAccountLookupQueryDto` |
| POST | `/api/tenant/trade/v1/commercial-accounts` | `trade.commercial_accounts.manage` | `COMPANY` | `CreateCommercialAccountDto` |
| GET | `/api/tenant/trade/v1/commercial-accounts/:id` | `trade.commercial_accounts.read` | `COMPANY_OR_BRANCH` | — |
| PATCH | `/api/tenant/trade/v1/commercial-accounts/:id` | `trade.commercial_accounts.manage` | `COMPANY` | `UpdateCommercialAccountDto` · `If-Match` |
| POST | `/api/tenant/trade/v1/commercial-accounts/:id/branch-rules` | `trade.commercial_accounts.manage` | `BRANCH` | `CreateAccountBranchRuleDto` |
| PATCH | `/api/tenant/trade/v1/commercial-accounts/:id/branch-rules/:branchId` | `trade.commercial_accounts.manage` | `BRANCH` | `UpdateAccountBranchRuleDto` · `If-Match` |
| POST | `/api/tenant/trade/v1/commercial-accounts/:id/evaluate-credit` | **`trade.credit.view`** | `COMPANY_OR_BRANCH` | `CreditEvaluationDto` — **200** |
| POST | `/api/tenant/trade/v1/commercial-accounts/:id/block` | `trade.commercial_accounts.manage` | `COMPANY` | `AccountTransitionDto` · `If-Match` — **200** |
| POST | `/api/tenant/trade/v1/commercial-accounts/:id/unblock` | `trade.commercial_accounts.manage` | `COMPANY` | `AccountTransitionDto` · `If-Match` — **200** |

`GET /lookups` is declared on a **separate controller** registered *before*
the main one, so it is not swallowed by `:id`. The Gateway resolves it by
exact path in any case.

> **`evaluate-credit` is a `READ_HEAVY` POST that mutates nothing** but still
> requires `x-idempotency-key` and still runs through the app idempotency
> table. It is gated on `trade.credit.view`, a permission no other route on
> this page uses; treat credit exposure as its own visibility boundary.
> `trade.credit.override` exists in the catalogue and is **used by no route**.

### Request bodies

| DTO | Fields |
| --- | --- |
| `CreateCommercialAccountDto` | `partyId` **required**, `accountRole` **required**, `paymentTermsId?`, `creditLimit?` (decimal string), `creditCurrencyCode?` (`^[A-Z]{3}$`), `priceBookId?`, `creditPolicyVersionId?`, `terms?` (**defaults to `{}`**) |
| `UpdateCommercialAccountDto` | the same, minus `partyId` and `accountRole`; `terms?` has **no default**, so omitting it leaves the stored value |
| `CreateAccountBranchRuleDto` | `branchId` **required**, `narrowingRules` (object, **required**) |
| `UpdateAccountBranchRuleDto` | `narrowingRules` **required**, `status?` |
| `CreditEvaluationDto` | `proposedAmount` (decimal string, **required**), `currencyCode` **required**, `sourceDocumentId?`, `sourceDocumentType?` (≤ 40) |
| `AccountTransitionDto` | `reasonCode` (≤ 80, **required**), `evidenceRef?` (≤ 240) |
| `CommercialAccountListQueryDto` | `page`, `limit` (≤ 100, default 25), `accountRole?`, `status?` (free string ≤ 32) |
| `CommercialAccountLookupQueryDto` | `search?` (≤ 80), `limit` (≤ 100, default 50) — **no `page`** |

`CommercialAccountRole`: **`CUSTOMER`** · **`SUPPLIER`**.

**Account status has no enum.** `block` writes the literal `"BLOCKED"` and
`unblock` writes `"ACTIVE"`; `documents.service.ts` reads only those two
values. The list filter accepts any string. Two states are proven; a third
cannot be ruled out. **Q31.**

`UpdateAccountBranchRuleDto.status` is typed in TypeScript as
`"ACTIVE" | "RETIRED"` but validated only as `@IsString() @MaxLength(16)`.
**The union is not enforced at runtime.** Do not treat the TS type as the
contract.

### Errors

| `code` | Status | When |
| --- | --- | --- |
| `TRADE.ACCOUNT.NOT_FOUND` | 404 | |
| `TRADE.ACCOUNT.ALREADY_EXISTS` | 409 | one account per party per role |
| `TRADE.ACCOUNT.PARTY_ROLE_INVALID` | 422 | the party does not hold that commercial role |
| `TRADE.ACCOUNT.TERM_INVALID` | 422 | `paymentTermsId` unusable |
| `TRADE.ACCOUNT.CREDIT_LIMIT_INVALID` | 422 | limit without a currency, or vice versa |
| `TRADE.ACCOUNT.BRANCH_RULE_ALREADY_EXISTS` | 409 | `POST` where a rule exists |
| `TRADE.ACCOUNT.BRANCH_RULE_NOT_FOUND` | 404 | |
| `TRADE.ACCOUNT.BRANCH_RULE_WEAKENS_POLICY` | 422 | a branch rule may only narrow the company rule |
| `TRADE.ACCOUNT.BLOCK_TRANSITION_INVALID` | 409 | blocking a blocked account, or unblocking an active one |
| `TRADE.ACCOUNT.BLOCKED` | — | in the catalogue; **no throw site found** — see [Not verified](#not-verified) |
| `TRADE.CREDIT.EXPOSURE_UNAVAILABLE` | **503** | the credit exposure projection is behind or unreachable. Not a 409 — the evaluation could not be made, not refused |
| `TRADE.CONTEXT.BRANCH_COMPANY_MISMATCH` | 422 | also thrown from the service, not only the guard |
| `TRADE.AUTH.TARGET_DENIED` | **403** | `/lookups` with no company header |

---

## Configuration — 9 routes

Nine routes share the `/configuration` prefix but split across two modules,
two features and two permission families. Read the table before assuming.

| Method | Canonical path | Permission | Scope target | Feature |
| --- | --- | --- | --- | --- |
| GET | `/api/tenant/trade/v1/configuration/definitions` | `trade.configuration.read` | `OPERATING_CONTEXT` | `trade.policy_studio` |
| POST | `/api/tenant/trade/v1/configuration/definitions` | `trade.configuration.manage` | `TENANT` | `trade.policy_studio` |
| POST | `/api/tenant/trade/v1/configuration/definitions/:id/versions` | `trade.configuration.manage` | `OPERATING_CONTEXT` | `trade.policy_studio` |
| POST | `/api/tenant/trade/v1/configuration/versions/:id/test` | `trade.configuration.manage` | `OPERATING_CONTEXT` | `trade.policy_studio` |
| POST | `/api/tenant/trade/v1/configuration/versions/:id/publish` | **`trade.policy.publish`** | `OPERATING_CONTEXT` | `trade.policy_studio` |
| POST | `/api/tenant/trade/v1/configuration/resolve` | `trade.configuration.read` | `OPERATING_CONTEXT` | any MVP feature |
| GET | `/api/tenant/trade/v1/configuration/company-default-price-books/:purpose/:currencyCode` | `trade.configuration.read` | `COMPANY` | **`trade.pricing`** |
| POST | `/api/tenant/trade/v1/configuration/company-default-price-books/:purpose/:currencyCode/upsert` | `trade.configuration.manage` | `COMPANY` | **`trade.pricing`** |
| DELETE | `/api/tenant/trade/v1/configuration/company-default-price-books/:purpose/:currencyCode` | `trade.configuration.manage` | `COMPANY` | **`trade.pricing`** |

**Judgement call.** The three `company-default-price-books` routes live on
`PricingController`, are gated on `trade.pricing`, and MASTER-PLAN names them
in task **12.12**, not Phase 10. They are documented here because they are
under the `/configuration` prefix and 10.19 counts nine routes for it —
a reader looking up a `/configuration` path will look here.
[trade-advanced.md](trade-advanced.md#price-books--7-routes) cross-links back.
This also resolves a plan inconsistency: 10.19's own list ("definitions,
versions, test, publish, resolve") enumerates only six of the nine.

`POST /versions/:id/publish` is the only route in Trade where a
**`trade.configuration.*`** resource is published with a
**`trade.policy.publish`** grant. A user with full configuration-manage rights
cannot publish a configuration version.

### Request bodies

| DTO | Fields |
| --- | --- |
| `ConfigurationDefinitionListDto` | `page`, `limit` (≤ 100, default 25) |
| `CreateConfigurationDefinitionDto` | `key` (`^trade\.[a-z0-9][a-z0-9_.-]{1,110}$`), `valueSchema` (object), `allowedScopes` (1–3 of `TENANT`/`COMPANY`/`BRANCH`), `mergeStrategy`, `riskClass`, `companyLockPolicy?` (**defaults to `{}`**) |
| `CreateConfigurationVersionDto` | `scopeTarget`, `value` (**`@Allow()` — any JSON, unvalidated at the pipe**), `effectiveFrom` (ISO 8601, strict), `effectiveTo?` (nullable) |
| `ResolveConfigurationDto` | `keys` (1–100, each matching the key pattern), `facts?` (**defaults to `{}`**) |
| `CompanyDefaultPriceBookPathDto` | path params: `purpose` (`SALES`/`PURCHASE`), `currencyCode` (`^[A-Z]{3}$`) |
| `UpsertCompanyDefaultPriceBookDto` | `priceBookId` **required** |

`ConfigurationMergeStrategy`: **`OVERRIDE`** · **`MIN`** · **`MAX`** ·
**`UNION`** · **`DENY_WINS`** · **`FIRST_MATCH`**.
`riskClass` is `@IsIn(["LOW","MEDIUM","HIGH","CRITICAL"])` — an inline list,
not an exported enum.
Version status is `GovernedVersionStatus` — see
[trade-advanced.md](trade-advanced.md#the-governed-version-ladder--policies-workflows-configuration-price-books).

### The one `If-Match: "0"` in the whole app

`POST /configuration/company-default-price-books/:purpose/:currencyCode/upsert`
is the only route parsed by `parseExpectedVersionOrCreate`. It accepts
`If-Match: "0"` (or `W/"0"`, or bare `0`) to mean **"I expect no mapping to
exist"**. Every other route in Trade rejects `0` as a 400. Send the current
version to replace an existing mapping, `0` to create the first one.

### Errors

| `code` | Status | When |
| --- | --- | --- |
| `TRADE.CONFIGURATION.DEFINITION_NOT_FOUND` | 404 | |
| `TRADE.CONFIGURATION.KEY_TAKEN` | 409 | |
| `TRADE.CONFIGURATION.DEFINITION_INVALID` | 422 | `valueSchema` rejected |
| `TRADE.CONFIGURATION.SCOPE_FORBIDDEN` | 422 | version's `scopeTarget` is outside the definition's `allowedScopes` |
| `TRADE.CONFIGURATION.VALUE_INVALID` | 422 | `value` fails the definition's `valueSchema` — **this is where an `@Allow()` body is finally checked** |
| `TRADE.CONFIGURATION.EFFECTIVE_OVERLAP` | 409 | effective window collides |
| `TRADE.CONFIGURATION.TEST_FAILED` | **409** | not 422 |
| `TRADE.CONFIGURATION.PUBLISH_NOT_ALLOWED` | 409 | |
| `TRADE.APPROVAL.MAKER_CHECKER_REQUIRED` | 409 | the actor who drafted may not publish |
| `TRADE.CONFIGURATION.DEFAULT_PRICE_BOOK_NOT_FOUND` | 404 | |
| `TRADE.CONFIGURATION.DEFAULT_PRICE_BOOK_INCOMPATIBLE` | 422 | price book's purpose or currency does not match the path |

---

## Codes the catalogue does not contain

`TRADE_ERROR_CODES` in
`trade-app/packages/common/src/constants/error-codes.ts` is **not exhaustive**.
Seven codes are emitted as string literals and are absent from it. Four are
reachable from routes on this page:

| `code` | Status | Source |
| --- | --- | --- |
| `TRADE.MODULE.DISABLED` | 403 | `common/guards/subscription.guard.ts` |
| `TRADE.ENTITLEMENT.FEATURE_REQUIRED` | 403 | `common/guards/subscription.guard.ts` |
| `TRADE.CONTEXT.INVALID_ID` | 400 | `common/guards/trade-scope.guard.ts` |
| `TRADE.VALIDATION_FAILED` | 400 | `main.ts` — the global `ValidationPipe` `exceptionFactory` |

The other three are documented on their own pages:
`TRADE.IMPORT.SOURCE_RELEASE_FORBIDDEN` and `TRADE.STORAGE.UNAVAILABLE` in
[trade-advanced.md](trade-advanced.md), `TRADE.QUOTE.PDF_TEMPLATE_PIN_STALE`
in [trade-documents.md](trade-documents.md).

`TRADE.VALIDATION_FAILED` is worth its own note: the body is
`{ code: "TRADE.VALIDATION_FAILED", message: ValidationError[] }` — `message`
is the **raw class-validator error array**, not a string.
`validationError: { target: false, value: false }` means the rejected value is
never echoed back, and `stopAtFirstError: false` means you will get **all**
field errors at once.

---

## What will bite you

1. **Money is a string with trailing zeros stripped.** `"10.5"`, not
   `"10.50"`. Format for display; never string-compare against your own
   formatting, and never `Number()` it.
2. **`Idempotency-Replayed` is present on first execution too**, with the
   value `"false"`. Test for `=== 'true'`.
3. **Read and write on `/uoms` require opposite headers.** Reads need company
   **and** branch; writes must send neither.
4. **A tenant-scoped role does not satisfy a branch-scoped route.** The
   permission guard matches `scope_target` exactly. Only the tenant owner
   bypasses.
5. **403 never says which permission was missing.** Unlike Core, there is no
   `details.permissions`. The portal must infer it from the route.
6. **`PATCH` on the profile and channel-listing routes is a full upsert.**
   Omitted optionals with defaults are written as defaults, silently clearing
   `capabilitySet`, `restrictions`, `saleConstraints` and resetting
   `publicationStatus` to `"DRAFT"`.
7. **`GET /channels` returns a bare array.** `data` is not `{ items }`.
   A generic list adapter will read `undefined`.
8. **List responses have no `totalPages`, `hasNext` or `hasPrev`**, and no
   `meta` object — `items`, `total`, `page`, `limit`, flat inside `data`.
9. **There are no capabilities endpoints.** Action gating has to fall back to
   permission strings plus the owner flag, which is exactly the situation S6
   was written to avoid (Q30).
10. **`trade.credit.override`, `trade.pricing.view_cost` and
    `trade.pricing.override` are in the permission catalogue and gate no
    route.** Do not build a control that assumes holding one grants anything.
11. **A missing company header is a 400 from the guard but a 403 from the
    read projection** (`/catalog/uoms`, `/commercial-accounts/lookups`). Two
    statuses, one code, for the same user mistake.

---

## Corrections and additions from building Phase 10 — 2026-08-31

Every item here was read from `trade-app` source while the screens were built,
because the page was silent or wrong about it.

### Response shapes the page did not state

| Route | What it actually returns |
| --- | --- |
| `POST /commercial-accounts/:id/evaluate-credit` | the saved **`TradeDecisionReceiptEntity`**, not the decision. The decision is under `result`: `{ outcome, reasonCode, commercialAccountId, accountVersion, branchRuleId, branchRuleVersion, effectiveLimit, exposureAmount, proposedAmount, remainingAmount, currencyCode, orderingHold, sourceVersion, asOf }`, with every money field a decimal string or `null`. The receipt also carries a numeric `version`, so the response has an `ETag` that means nothing to the caller |
| `GET /commercial-accounts/lookups` | **not a list of accounts.** `{ paymentTerms: [{ id, source }], creditPolicies: [{ id, versionNumber, status, effectiveFrom, effectiveTo, contentHash, definitionId, code, scopeTarget, companyId, branchId }], limitations: { paymentTerms: "REFERENCED_IDS_ONLY_NO_SCOPED_PAYMENT_TERMS_MASTER_ENTITY" } }` — a reference lookup for the two id fields on the account form |
| `GET /items/:id` | the item, spread with `companyProfile` and `branchProfile` **alongside** it, each `null` when the operating context does not reach one |
| `GET /items` | each row is the item entity; `eligibility` is added **only** when a company header is sent, and its `branchProfile*` members are `null` unless a branch is sent too |
| `GET /channels/:id` | the channel spread with `branches: TradeChannelBranchEntity[]` |
| `GET /configuration/definitions` | each item is the definition spread with `versions: []`, projected and **filtered to the resolved scope** — a definition can look version-less at one scope and populated at another |
| `POST /configuration/versions/:id/test` | `{ evidenceId, passed, diagnostics, mergeStrategy, contentHash, version }` — not the version |
| `POST /configuration/versions/:id/publish` | the version, spread with `configurationEpoch` |
| `DELETE /configuration/company-default-price-books/:purpose/:currencyCode` | `{ id, deleted: true }` — **no `version`, so no ETag** |

### `If-Match` on three routes the table did not mark

`POST /configuration/definitions/:id/versions`, `POST /configuration/versions/:id/test`
and `POST /configuration/versions/:id/publish` all call `parseExpectedVersion`
and therefore **all require `If-Match`**. The first one is the trap: its header
carries the **definition's** `version`, not the version's own.

### `GET /uoms/:id` answers 422 for a missing record, not 404

`CatalogUomService.get` throws `missingUom()`, which is an
`UnprocessableEntityException` carrying `TRADE.CATALOG.UOM_INVALID`. A screen
that branches on 404 alone offers a retry button for a record that is gone.

### A malformed code is a **500**, not a validation error

`CreateItemDto.canonicalCode` and `CreateChannelDto.code` are only
`@IsString() @MinLength(1) @MaxLength(80)`. Both services then call
`normalizeTradeCode`, which throws a bare **`TypeError`** — not a Nest
exception — for anything outside `^[A-Z0-9][A-Z0-9._-]{0,79}$`. A code
containing a space passes the pipe and crashes the handler. The portal
validates the pattern client-side for that reason. Recorded as **Q72**.

`CreateUomDto.code` is not affected: it pins the pattern at the DTO, and
`normalizeUomCode` throws a 422 rather than a `TypeError`.

### `localizedNames` has bounds the DTOs do not state

`@IsObject()` is the whole DTO rule, but `normalizeLocalizedNames` in
`catalog-uom.service.ts` additionally requires **1–20 entries**, each key
matching `^[a-z]{2}(?:-[A-Z]{2})?$` and each value 1–160 characters after
trimming. Violations are 422 `TRADE.CATALOG.UOM_INVALID`.

### The permission catalogue has 89 entries, not 90

`TRADE_PERMISSIONS` holds **89** strings; **80** appear on a
`@RequireTradeAccess` and nine do not. Four of the nine are dashboard
`fieldPermissions` rather than dead. Full table in
[../reference/permissions.md](../reference/permissions.md#trade-permissions).

### Channel branch mapping only ever acts on the current branch

`CatalogService.channelBranch` refuses any `branchId` that is not
`context.branchId`, with 422 `TRADE.CONTEXT.BRANCH_COMPANY_MISMATCH`. The same
rule holds for `POST /commercial-accounts/:id/branch-rules`. Neither route can
manage another branch's row, whatever the caller sends.

### There is no GET for one configuration definition or version

`findDefinition` and `findVersion` are private to `ConfigurationScopeService`.
A definition can only be read through the list. Recorded as **Q71**.

## Not verified

- **`TRADE.CATALOG.TRACKING_LOCKED`** and **`TRADE.ACCOUNT.BLOCKED`** are in
  `TRADE_ERROR_CODES` but no throw site was found in `trade-app/src`. They may
  be dead entries or may be raised by a path not reached from these routes.
  Treat them as possible but undocumented.
- **The full value set of `publicationStatus`, channel `status`, and
  commercial-account `status`.** Only `"DRAFT"` (default), `"ACTIVE"` and
  `"BLOCKED"` are proven from source; none is an enum and none has a database
  check constraint. Recorded as **Q31**.
- **Response field lists.** This page documents request DTOs, which are pinned
  by validators, and the response fields that are visible in a projection
  function. Trade has no response DTO classes, so the complete response shape
  of `GET /items/:id`, `GET /commercial-accounts/:id` and
  `GET /channels/:id` is whatever the entity projection emits and was not
  enumerated field by field.
- **Whether `TRADE.MODULE.DISABLED` or a feature refusal reaches the browser
  before or after a Gateway rate-limit refusal.** Both are 403/429 from
  different layers and the ordering was not exercised.
- **Live behaviour.** Nothing on this page was executed against a running
  Trade service. Every statement is read from source at the revision noted in
  [trade-reference.md](trade-reference.md).
