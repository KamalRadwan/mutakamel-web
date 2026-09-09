# Core — Subscription and Addon reads

Status: **source-verified, implemented; no authenticated acceptance**

Last source verification: **2026-09-09**. Owning backend app: **core-app**.

## Implemented reads

| Method | Canonical path | Authority |
| --- | --- | --- |
| GET | `/api/tenant/core/v1/subscription` | Current tenant owner/session, not a permission grant |
| GET | `/api/tenant/core/v1/subscription/items` | Current tenant owner/session, not a permission grant |

Both routes use the single canonical contract without a commercial version header or payload discriminator. Gateway's exact Tenant route keys remain `core.tenant.subscriptions.get` and `.items.list`; Core uses `TenantSubscriptionReadService` with current owner authorization around the CP snapshot. See the [current delivery record](catalogue-canonical-delivery.md) for the 2026-09-09 source cutover and verification limits.

Both responses are closed Core success envelopes `{success,data,correlationId,timestamp}`, with private/no-store policy and no idempotency key on reads. Detail is the exact `SubscriptionView` in Core `admin/subscriptions/addons/subscription-read.contract.ts`; items is the distinct four-field `{subscriptionId,subscriptionRevision,baseItems,addonSelections}`. Body reads are bounded to4MiB before JSON parsing. UUIDs and positive signed-bigint revisions remain exact strings.

## Prices and allowance

The required factual `baseItems[].tierRank` and Application offer `tier.rank` now follow the actual current catalogue tier's signed int32 rank. Missing/corrupt rank fails the canonical reader; there is no synthetic zero. Tenant upgrade discovery compares this ordering, never price direction. Equal-rank different-tier requests remain subject to the real owner's current eligibility/readiness/apply checks. The two existing complete read/offer fixtures were updated for the required field without adding cases.

Base items and Addon selections stay separate. Each Addon references a returned parent item and has no more seats than that parent. Base-user allowance comes from `baseAllowance`, never from adding Addon seats. The UI renders `totals.baseRecurringUsd`, `addonRecurringUsd` and `combinedRecurringUsd` as accepted server amounts, including explicit zero. At most100base items and100Addon selections are accepted; no truncation or partial rendering.

`acceptedPricing` carries canonical USD, MONTHLY/ANNUAL cycle, confirmed recurring amount, a non-null price revision and 1–100 complete saved brackets. Evidence includes the original bounds, charged users, saved unit price and saved amount; Application price revision is a64hex hash, Addon price revision uses the owner's canonical UUID grammar. The parser checks exact integer/string identities, parent relationships and mathematical consistency using bigint units, but **never replaces or generates displayed financial truth**. Missing retained evidence fails validation. UI monetary formatting preserves up to4fractional places, including sub-cent unit rates.

Lifecycle/definition facts are display-only. A retained disabled/revoked Addon is not discarded from confirmed charges. `projection.observation=NOT_OBSERVED` and `operationalUse=NOT_EVALUATED` explicitly do not claim installation, a user seat or permission to use the Addon.

## UI and session safety

`/core/subscription` joins detail/items only when subscription identity/revision and both collections match. A failure or mismatched concurrent snapshot renders retry/unavailable, never the old base-only degraded fallback. Refresh, session/user changes and loss of ownership retire earlier financial facts immediately; returning to a prior context requires a fresh observation. Pending reads are aborted and late results are ignored. The plan workspace remounts across session generations. Actual403 overrides advisory owner state through `OwnerGate.denied`.

The canonical editor at `/core/subscription/change` replaces the old flat seat-only adapter. It supports Application and Addon ADD, existing seat increases and nondecreasing Application tier rank, including subscriptions with retained Addons. New requests require a coherent TRIAL/ACTIVE view without a collection hold. Published offers supply actual selectors and compatibility; they never supply an accepted purchase total. The flow uses preparation, a complete server quote, explicit apply, saved operation reads and the immutable receipt. See [the exact commands and recovery rules](catalogue-canonical-delivery.md#mounted-ordinary-purchase-editor). Adoption, decrease and removal are not offered. Scope activation/configuration lives in [Application access](application-access.md).

## Saved operation and financial receipt reads

Source verified **2026-09-09** after actual Core and Gateway handoff:

| Method | Canonical path | Authority |
| --- | --- | --- |
| GET | `/api/tenant/core/v1/subscription/operations/:operationId` | Current tenant owner/session |
| GET | `/api/tenant/core/v1/subscription/plan-change-previews/:previewId/receipt` | Current tenant owner/session |

The deep-link pages `/core/subscription/operations/:operationId` and `/core/subscription/receipts/:previewId` mount these reads. Neither sends a body, query, organization selector or idempotency key. Operation GET reads durable history and never advances progress. Its returned canonical operation ID is the preparation ID even when the selector is a bound preview-operation alias. A COMMITTED status supplies its verified preview reference and preparation ID to the original-receipt read. No original preview or apply key is required, and no expected pricing is reconstructed.

Both reads use the 4 MiB outer financial response budget. Receipt data separately has a 65,536-byte bound and the strict original nine-field shape. Original totals/settlement are rendered exactly; the receipt's saved PENDING projection is historical, separate from current saved operation progress. Current read authority, target/session retirement and actual owner denial remain enforced. Task 13 passed full TypeScript and scoped lint for these reads. The later purchase editor requires its own verification; no runtime acceptance is claimed. See [canonical delivery](catalogue-canonical-delivery.md#purchase-retry-and-receipt-semantics).

## Verification

Earlier packet test totals in [the track receipt](../plans/application-catalogue-frontend-track.md) apply to their original source snapshots. Existing fixtures/assertions now follow the canonical complete-evidence contract, and task 13 owns the scheduled subscription/billing rerun. No themed responsive browser or real authenticated Tenant verification is claimed.
