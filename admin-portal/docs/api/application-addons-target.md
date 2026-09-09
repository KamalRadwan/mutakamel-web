# Application-owned Addons — Admin contract

Status: PARTIAL SOURCE INTEGRATION. Last source verification: 2026-09-09.

Current source supports Application-owned Addon catalogue/definition/pricing workflows, canonical subscription directory/detail, retained invoice detail, reviewed initial tenant creation and initial subscription seed. Existing-subscription aggregate preparation, priced review/apply, durable operation recovery and original receipt lookup are mounted in tenant billing. Source implementation does not establish runtime, schema adoption, publication or full acceptance.

The coordinated single-contract decision supersedes earlier negotiation documents. Backend owners and [the reviewed plan](../../../../backend/docs/plans/application-catalogue-addons-development-plan.md) remain authoritative. See [catalogue](./catalog.md), [subscriptions](./subscriptions.md), [invoices](./invoices.md) and [tenants](./tenants.md) for their route families.

## Transport and authority

Browser calls retain `/api/admin/core/v1`, the shared cookie/CSRF client and normalized errors/correlation. Commercial HTTP payloads carry no `contractVersion` or version header, and have no legacy fallback. Definition versions, catalogue revisions, ladder revisions and the separate technical provisioning contract remain genuine domain data.

Addon actions keep the verified Application permission family and ALL semantics where paired. Current actor, selected Application/Addon, version/cycle and exact command ownership fence requests and late responses. Read denial is an error, never an empty success. Do not choose runtime services from an Addon key or dispatch a purchase to Worker.

## Catalogue and dynamic pricing

Application detail mounts `ApplicationAddonsWorkspace`. Closed owner-bound adapters cover list/detail, draft creation, publication, metadata, compatibility, feature grants, component bindings, configuration-schema references, lifecycle, version history/revocation, audit and independent MONTHLY/ANNUAL ladders. SYSTEM and NON_BILLABLE Apps have no Addon write actions.

Core detail supplies required `ownerRegistrationAvailable:boolean`, derived from the same real static registry used by the writer. False disables publication, feature-grant replacement, component-binding replacement and configuration-schema replacement. Metadata, compatibility and prices remain available. True indicates registration only; every readiness/publication guard still applies. The registry is intentionally empty until a real reviewed business owner exists. No dummy owner, product choice or ready state was invented.

Keep `expectedCatalogueRevision`, `draftVersionId/expectedDefinitionRevision` and `expectedLadderRevision` distinct. Sealed definitions and price revisions are immutable. Edits create a genuine new draft. Operational revision is server evidence. A new definition publication does not adopt it into existing subscriptions or reprice retained invoices.

The compatibility allowlist displays active parent-tier names, keys and IDs using the existing `GET /api/admin/core/v1/applications/{applicationId}/tiers` only when the current actor has `admin.catalog.read`. Every returned tier must belong to the detail's actual parent Application UUID. Selected inactive, deleted or unknown IDs remain visible until explicitly removed; they are never silently dropped. Without that read permission, or after a failed lookup, the existing manual-ID entry remains available under the original compatibility command permissions. Loading, errors and retry are explicit; this does not add a permission requirement to the write. The reviewed draft and catalogue fences remain unchanged by tier reads.

Prices are database-managed graduated per-user ladders. All money stays decimal strings; the server owns calculation. Each marginal bracket applies only to its own inclusive seats. MONTHLY and ANNUAL are independently configured; there is no automatic annual multiplier, fixed price/default ladder or public sample-quote route.

The empty price head is server-issued revision"0" with null current price revision; missing price and a valid zero-price ladder are distinct. Unchanged replacements produce no new revision. Successful writes refetch the selected Addon and both cycles before enabling further editing.

Each pricing cycle retains its own rows, audited reason and reviewed ladder revision while this Addon workspace remains mounted, including tab changes and read failures. An accepted price receipt, including an exact retry receipt, clears only that receipt's cycle and retains its returned revision and brackets. A dirty sibling is never rebased onto a newer head. If a fresh read shows that its head changed, saving is disabled until the operator explicitly discards that cycle's edits and loads the latest cycle. Clean cycles follow newer heads automatically. Failed reads retain disabled last-known data and all drafts; the existing Refresh action must succeed before editing resumes. This is in-memory draft retention, not persistence across reload or a different actor/Application/Addon.

Pricing and definition errors focus their persistent summary after React commits. An ambiguous command blocks a different command. Same-session retries use the exact original body/key. After reload, only the original command kind may be re-entered and its digest must match; metadata alone cannot reconstruct a request. Current permissions and real owner availability still gate retry.

## Subscription and invoice evidence

The canonical directory and detail retain separate base and Addon selections, full accepted price revisions/brackets, base-only capacity and base/addon/combined totals. The directory includes required same-tenant identity and a bounded complete page. Detail/items reconcile scope, revision and both collections. No missing-price reconstruction, hidden child charge or positive legacy branch remains.

Accepted pricing is exactly `{billingCycle,currencyCode,recurringAmountUsd,priceRevision,breakdown}`. Revision and1–100 applied brackets are mandatory. Bounds are100base items,100aggregate children and seats1–100000 with child≤parent. No `evidenceStatus` is sent or accepted.

Invoices return `{invoice,lines}`. Complete Application/Addon source identity, accepted seats, pricing and period history are retained for all current purposes, including generated MANUAL and PRORATION. Mathematical line quantity1 is not one purchased seat. Only MANUAL may instead have entirely custom quantity/price lines with null attribution. The reader distinguishes complete versus custom line evidence; purpose alone does not discard retained prices. There is no legacy-evidence representation or current-catalogue repricing.

## Initial selection, quote and create

The single options projection is `{quoteRequired:true,applications:[...]}`, with published Application labels, active tiers, sealed Addon definition IDs, compatibility and closed diagnostics. It contains no price or `selectionAllowed/ready/canApply` field. It requires `admin.tenants.create`, status200 and a bounded1MiB envelope. At most100Apps,100tiers per App and100aggregate children are returned with stable source ordering and positive decimal revisions.

The registration wizard selects canonical UUID identities and unique UUIDv7 selection keys, including compatible child definitions and bounded child quantities. It displays a fresh server quote with full brackets, base/addon/combined amounts and15-minute expiry before final confirmation. Any draft/actor/permission change disowns the quote. The quote POST never refresh-replays and accepts no idempotency key.

The technical `POST tenants/provisioning-plans` remains a keys-only preview. Its domain `contractVersion:1`, empty `applications` and null installed-readiness component evidence are not commercial negotiation. It previews the Application component selection, while the quote/create owner validates full Addon closure. It is not installation proof.

Final tenant create sends `quoteId` and matching `subscription.applications` plus the existing identity/owner/geography/placement fields. It keeps50Application/100child bounds and status-only uncertain-create recovery. It does not expose a provisioning intent or fabricate activation.

The billing empty state mounts the same initial commercial selection/review components for INITIAL_SEED. The source-verified command uses quoteId, the same tenant/body and one UUIDv7 key; safe same-command refresh replay is retained. Its original14-field receipt is immutable TRIAL/revision1 evidence, not current subscription/readiness. The4MiB quote and256KiB receipt are strictly parsed. Lost in-memory requests after reload cannot be replaced while their minimal retained attempt remains unresolved.

## Remaining work and verification

Canonical existing-subscription commands now use the actual public owner and Gateway routes; the old scalar plan-change path is removed. Governed definition adoption remains unavailable pending its genuine producer. Whole-subscription cancellation retains its bodyless route and financial history semantics. See [subscriptions](./subscriptions.md) for exact command, read, retry and journal boundaries.

No real Addon business capability has been selected or registered. Runtime publication, installation, user assignment, Company/Branch activation, financial commit and operational usability are distinct acceptance gates.

Integration task13 owns serialized checks. Only existing cases that pinned the obsolete protocol or behavior are corrected; no new tests or infrastructure were authored. No app/dev server, Docker, database or monetary command was started. Historical fixtures and prior passing suites are not evidence for this source revision.

## Source anchors

- Core `catalog/addons/addons.controller.ts`, `addon.dto.ts`, `addons.service.ts`; `catalog/addon-pricing`.
- Gateway `core-addon.route-contracts.ts` and initial/directory routes in `core.route-contracts.ts`.
- Admin [Addon reader](../../src/features/admin/applications/lib/addon-contract.ts), [pricing editor](../../src/features/admin/applications/components/AddonPricingEditor.tsx).
- Admin [canonical pricing reader](../../src/shared/api/accepted-pricing.ts), [subscription reader](../../src/features/admin/tenant-workspace/billing/model/subscription-commercial.ts), [invoice reader](../../src/features/admin/invoices/model/invoice-commercial.ts).
- Admin [initial workspace](../../src/features/admin/subscriptions/initial-commercial/InitialCommercialWorkspace.tsx) and [registration hook](../../src/app/%28shell%29/tenants/new/hooks/useRegisterTenant.ts).
