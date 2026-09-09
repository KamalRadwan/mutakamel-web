# Core — Published subscription offers

Status: **source-verified; read-only frontend implemented; no authenticated acceptance**.

Last source verification: **2026-09-09**. Owning backend app: **core-app**.

## Canonical read contract

`GET /api/tenant/core/v1/subscription/catalogue` is the exact Gateway row `core.tenant.subscriptions.catalogue.get`, with authenticated Core target, no idempotency/replay storage and organizationScopeMode NONE. The current Tenant owner is rechecked by Core; there is no substitutable permission string. Source order: Gateway `core-addon.route-contracts.ts`; Core `tenant/subscription/subscription-offers.controller.ts`, `CommercialRequestGuard` and transport; `subscription-offers.contract.ts`, `.openapi.ts`, `.service.ts`, `.query.ts`; the shared normalized price-ladder validator and publication UUID/revision codecs.

The client sends optional pagination/filter query through the existing cookie transport. No commercial version header, request body, organization selector or idempotency key is sent. Page defaults1(max1000000), limit20(max100); optional applicationKey uses the actual64-character key grammar. Optional parentTierId is a canonical publication UUID and requires applicationKey; the server verifies a current active Tier belongs to that Application. The shared request guard allows an empty Content-Length0 but rejects actual bodies/transfer encoding. Success is private/no-store with an installed envelope bounded to1MiB.

## Closed response and prices

The envelope has exactly success=true,data[],meta,correlationId,timestamp. Meta has page,limit,total,totalPages,hasNext,hasPrev. At most100flat offers are returned; pagination must match the request and item count. Each offer has sourceKind,application,ladders,status,safeReasonCode and exactly one of tier/addon, with no payload discriminator. No draft metadata, scope impact scan, purchase quote or installation readiness is returned.

- Application identity: id,key,name,publicationVersionId,definitionRevision. Application offers include tier{id,key,name,rank}; rank is the required actual signed int32 tier rank, with no default or price inference.
- Addon identity: id,key,name,definitionVersionId,definitionVersion,definitionRevision,operationalRevision,compatibility{mode,tierIds}. ALL_ACTIVE has an empty tier list; ALLOWLIST has1–100unique canonical Tier IDs. A qualified Addon key must belong to the returned Application.
- Exactly two independent ladders, ordered MONTHLY then ANNUAL. CONFIGURED has1–100canonical graduated brackets and null reason. UNCONFIGURED/PRICE_NOT_CONFIGURED and UNAVAILABLE/PRICE_UNAVAILABLE have empty brackets, never a zero-price substitution.
- A bracket has minUsers,maxUsers|null,unitPrice. Bounds are positive32-bit integers, start at1, remain contiguous without overlaps and end open. Unit prices are exact nonnegative numeric(18,4) strings. Explicit0.0000 is a configured price. The browser neither estimates a purchase total nor rewrites monetary strings.
- Status/reason pairs are PARENT_REQUIRED/PARENT_REQUIRED, INCOMPATIBLE/PARENT_TIER_INCOMPATIBLE, UNAVAILABLE/PRICE_UNAVAILABLE or PREPARATION_REQUIRED/PREPARATION_REQUIRED. None grants eligibility. A selected parent's compatibility is checked against the response when explicitly filtered; otherwise the server may have used the current subscription parent.

## Frontend boundary

The owner-gated explorer at `/core/subscription/catalogue`, linked from billing navigation and the Subscription page, displays actual source names, published brackets, per-cycle missing-price explanations and keyboard-native disclosures in Arabic/English. A verified Application/Tier row can filter to that actual parent and its Addons; no free-form identity input or invented product list is required. Selection resets pagination. Its change-subscription link opens the separate canonical `/core/subscription/change` editor. The explorer itself sends no purchase command.

Results are fenced by authenticated owner identity, session generation, selectors,page and refresh. Changed fences retire previous prices before new results arrive; returning to an earlier filter cannot revive its old observation while a fresh request is pending. Pending reads are aborted, late results ignored and actual403 shown as an ownership denial rather than an empty catalogue. Selecting a Tier is only allowed from the latest verified response. Existing subscription evidence remains in [subscription Addon reads](subscription-addons.md), not rebuilt from these current prices.

Earlier test totals in [the track receipt](../plans/application-catalogue-frontend-track.md) apply to their original source snapshots. The [current delivery record](catalogue-canonical-delivery.md) records the canonical cutover and scheduled verification. This is not deployed/browser acceptance; the coordinator owns shared deployment.
