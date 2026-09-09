# Core — Application Addons Target Contract

Status: **target contract with partial implementation; not a live API inventory**

Current 2026-09-09 source status and canonical mapping are recorded in [canonical delivery](catalogue-canonical-delivery.md). Seat assignment/removal and all three scoped activation controls are mounted after exact Core/Gateway and retained-event source handoffs. Package adoption and runtime verification remain pending. Earlier verification dates below identify historical read slices, not current deployment acceptance.

Target contract alignment: **2026-09-08**. Last source verification for existing routes remains the date recorded in each linked current API page; this document does not reclassify planned routes as source-verified.

Last source verification: **2026-09-09** for seven [scoped reads](application-access.md), two exact-user reads and both [seat commands](addon-assignments.md), two [subscription reads](subscription-addons.md), the [published offer read](subscription-offers.md) and [retained invoice detail](core-billing.md#negotiated-invoice-detail--accepted-cutover). Other target entries require separate verified owner/module/Gateway handoffs.

Owning backend app: **core-app** for catalogue/commercial/scoped management; CRM/Trade retain domain admission and business ownership. Portal status: **partial implementation**. Seven [scoped reads](application-access.md) have strict adapters, scoped directory/navigation and bilingual detail/configuration UI. Two [subscription reads](subscription-addons.md) display accepted App/Addon pricing and independent allowance. Other target families remain planned until their actual controller/Gateway contracts are verified; target tables alone do not enable a call. Current task scope includes Backend/Admin Portal/Tenant Portal only, excluding Mobile and Partner implementation/tests.

Canonical browser base: `/api/tenant/core/v1`. Core upstream base: `/api/v1/tenant`; upstream/internal addresses are not browser endpoints. Never call Worker, an internal admission endpoint or an addon-derived service origin.

## 1. Authority and current baseline

Read the backend target contracts together:

- [LLD 41 — product and billing](../../../../backend/docs/LLD/01-core-app/10_MVP/41_application_addons.md).
- [LLD 42 — permissions, scopes and admission](../../../../backend/docs/LLD/01-core-app/10_MVP/42_application_addon_authorization.md).
- [LLD 43 — exact HTTP/DTO/event versions](../../../../backend/docs/LLD/01-core-app/10_MVP/43_application_addon_contracts.md). This is the authoritative proposed wire contract; do not create a second frontend DTO specification.
- [LLD 44 — schema and compatibility](../../../../backend/docs/LLD/01-core-app/10_MVP/44_application_addon_schema.md).

Current source baseline inspected for this work is recorded by the backend contracts, including `../backend/mutakamel-apps/core-app/src/tenant/subscription/subscription-self-serve.controller.ts`, `src/tenant/user-modules/user-modules.service.ts`, `src/common/tenant-access/tenant-permission-scope.service.ts`, and `packages/database/src/seeds/tenant/permissions.seed.ts`. Gateway registration, owning controller/DTO tests and installed package adoption must be verified again before any proposed frontend call is enabled.

| Current documented surface | Addon target, not a claim it exists today |
| --- | --- |
| [Subscription](core-billing.md#subscription--4-routes): owner-only, single-App preview/apply; portal seat-increase flow and missing tenant offer enumeration Q25 | Safe tenant App/Tier/Addon offers; versioned bounded changes; preparation and authoritative recovery. Q25 is not closed merely by writing this target. |
| [Users and organization](core-identity.md): base module assignments and scoped roles | Separate purchased-addon user assignments and Company/Branch activation/configuration; no replacement identity/RBAC engine. |
| [CRM catalogues/settings](crm-catalogues.md) | Keep CRM-owned stages, custom fields and configuration; buying an industry addon is a Core commercial action, not CRUD in CRM static data. |
| [Permissions](../reference/permissions.md) and owner capabilities | Addon use needs source-aware entitlement, counted seats and exact scope in addition to domain permissions. Client checks remain advisory. |
| [WebPhone](webphone.md) | Standalone Application hosted in Core remains standalone; do not convert its existing seats/subscription to CRM addon assignments. Inventory stays inside Trade. |

## 2. Required client behavior

An Application selects its Tier; its optional addons have independent managed graduated per-user prices. Company/Branch activation is not a separate subscription or price pool. One person is counted once per parent Application and once per assigned addon, even across companies. Only a subset of parent users needs each addon.

Show these independent facts separately: **purchased, assigned, installed, Company-enabled, Branch-permitted, usable**. Purchase or installation alone must not mark a feature usable. Operational disable does not cancel payment; a removal does not imply a cash refund or deleted history.

Ordinary shared features may remain usable through a valid base-Tier grant after an addon grant is removed. Explicit addon-owned operations always require that addon's complete gate. A tenant owner using an addon still needs explicit counted parent and addon seats; administrative purchasing/assignment authority is separate. Preserve CRM pipeline/own-team-all and Trade Company/Branch/Inventory Node restrictions.

No tenant-global `industry` or `country` flag selects every screen or authorizes access. Several compatible addons may coexist in one Company, and companies may differ. This foundation does not deliver Logistics, Accounting, HR/payroll or country-tax business workflows.

## 3. Canonical transport and money

The accepted single-contract decision removes `x-commercial-contract-version` and payload `contractVersion` from commercial/catalogue/invoice/scoped HTTP shapes. Keep the public `/v1` route segment and genuine schema/definition versions. There is no second business contract or negotiated fallback.

- Strictly validate the one canonical response and existing Core envelope before exposing data to the UI. Paid children are never discarded to make a validator pass.
- Preserve complete retained financial evidence and exact historical replay receipts rather than adding missing fields locally. Missing commercial evidence is unavailable, not a degraded base-only total.
- New reads are authenticated, non-keyed and private/no-store. New mutations are bounded `WRITE_SENSITIVE` routes with explicit UUIDv7 idempotency keys and expected revisions. Use a distinct stable key for preparation, preview, apply and an explicit recovery intent; no automatic new-key retry after auth refresh or ambiguous write outcome.
- Use the existing shared cookie-auth transport and UUIDv7 helper. Header/privacy/framing and exact original idempotency fingerprints remain backend release prerequisites, not client workarounds.
- Monetary amounts and new revisions remain exact strings. Render server bracket breakdowns/totals; never derive rates, proration, invoice totals, permissions or usable capacity in the browser. Monthly and annual ladders are independently configured. Missing pricing is unavailable, not free; explicit zero pricing is valid.
- Show base-user allowance separately from addon seats, while financial totals include both. Accepted prices require actual non-null revisions and complete saved brackets; do not reconstruct missing evidence from current offers. Genuine MANUAL null-source invoice lines retain their truthful original amount representation.
- Target limits: at most 100 base selections, 100 addon selections, 100 changes per preview, 200 commercial invoice selections and 100 brackets per cycle; each new purchased quantity is 1..100,000 and an addon cannot exceed its parent. Respect the server's collection/precision/body limits; never truncate accepted children or silently split a confirmed financial intent.

## 4. Proposed browser families and authority

The table below remains a target family map. Implemented reads and seat POST/DELETE are distinguished in [current delivery](catalogue-canonical-delivery.md); other public command controls require exact owner/module/Gateway handoff. LLD 43 owns route keys, classes, body/query/reply codecs, statuses, scope checks and errors. Existing routes keep their keys; new Core subscription keys use `core.tenant.subscription` and scoped-management keys use `core.tenant.application-access`.

| Planned operation | Canonical browser family | Authority / outcome |
| --- | --- | --- |
| GET offers; GET current selections | `/api/tenant/core/v1/subscription/catalogue`, `/api/tenant/core/v1/subscription`, `/api/tenant/core/v1/subscription/items` | Current tenant owner; safe published offers or retained canonical selections. |
| POST prepare; POST preview; POST apply | `/api/tenant/core/v1/subscription/preparations`, `/api/tenant/core/v1/subscription/plan-change-previews`, `/api/tenant/core/v1/subscription/plan-change-previews/:previewId/apply` | Owner for money changes; separate adoption authority for pure version adoption. 202 operation, 201 preview, 200 durable apply receipt respectively. |
| GET status/impact; POST recovery | `/api/tenant/core/v1/subscription/operations/:operationId`, `.../impact`, `.../recovery` | Current authority for that exact intent/target; recovery is restricted to supported `RECONCILE|CANCEL_PREPARATION` actions. |
| GET/POST assignments; DELETE one assignment | `/api/tenant/core/v1/users/:userId/addon-assignments`, `.../:assignmentId` | Tenant-wide addon seat-management scope, exact user privacy and parent/allowance revision fences; not a purchase. |
| GET/PATCH Company activation/configuration | `/api/tenant/core/v1/companies/:companyId/application-activations` and the exact Application/addon/configuration child routes in LLD 43 | Applicable Company/Tenant authority; purchased/ready compatible capability. Do not move these proposed routes under the current `/organization` prefix by guesswork. |
| GET/PATCH Branch override/configuration | `/api/tenant/core/v1/branches/:branchId/application-activations` and the exact addon/configuration child routes | Exact Branch authority; mode `INHERIT|DISABLED`, registered restrictive configuration only. |
| GET available definitions; stage/read/append configuration plan | `/api/tenant/core/v1/subscription/items/:itemId/addons/:selectionId/available-definitions`, `/api/tenant/core/v1/subscription/configuration-plans`, and its `/:planId` / `/:planId/fragments` children | Explicit adoption plus every affected Company's configuration authority; staging is not activation. |

For resource reads the target explicitly declares `ANY(resource.read, resource.manage)` on that same resource/scope; mutations require the exact key. These are new target keys, not claims that current `/auth/me` already returns them:

| Exact keys | Target scope |
| --- | --- |
| `applications.addon_seats.read`, `applications.addon_seats.manage` | TENANT only, with documented owner administrative exception. Sharing a Branch does not grant global allocation. |
| `applications.activation.read`, `applications.activation.manage` | Company/Tenant authority; Branch grant permits only that exact Branch's restrictive override. |
| `applications.configuration.read`, `applications.configuration.manage` | Same exact-scope rule for safe typed configuration. |
| `applications.addon_definitions.adopt` | TENANT plus configuration management for every impacted Company, and activation management wherever activation changes. |

A Company appearing in `/auth/me` or a discovery list does not prove Company-wide management authority. Do not apply CRM `.own/.team/.all` suffix matching to these Core keys. Pure `ADOPT_DEFINITION` must not be hidden solely because its authorized manager is not the billing owner; conversely it must not grant that manager invoice reads or monetary changes. Mixed financial/adoption envelopes require both authorities.

## 5. Preparation, confirmation and recovery

For an existing tenant: select server offers and quantities → prepare the exact target → read preparation/impact until ready → request a fresh price preview → explicit confirmation → authoritative receipt/readback. Do not keep a five-minute plan-change preview alive through installation. Initial tenant creation is a separate Admin-owned flow with a 15-minute initial quote and no tenant DB at quote time; this page does not add tenant-creation UI.

Use LLD 43's closed `Change` union. Addon ADD selects stable `addonId`, `targetDefinitionVersionId`, seats and exactly one parent selector. A new parent uses a same-envelope `parentSelectionKey`, not a fabricated persisted item ID. Version-only changes use `ADOPT_DEFINITION`; prices, actor IDs, tenant IDs, ready flags and reservation receipts are not browser-supplied authority.

Expected success example: an authorized owner prepares an addon for an existing parent, receives ready evidence, previews the current ladder, and applies once. The response can be `COMMITTED` with `projectionState=PENDING`; display paid-pending-usable and poll the same operation. Do not charge again or optimistic-grant a seat.

Expected failure example: another manager changes the parent assignment or an incompatible component update invalidates preparation before apply. Show the server's stale/conflict state, refresh authorized state and prepare/requote as directed. Do not replay under a new intent silently or fill the missing expected revision with a guessed value.

Required operation states are `PREPARING|BLOCKED|READY|CONFIRMING|COMMITTED|ABORTED|NEEDS_REVIEW`; projection state is separately `NOT_REQUIRED|PENDING|READY|BLOCKED`. Timeout is an uncertain client outcome, not a new server state or proof of failure. Query owner status before deciding recovery. Queue success, 202 and realtime progress are not completion or permission.

Preserve owner self-service add/increase/compatible-upgrade limits; reductions/removals stay with authorized admin/support. Pure adoption is price-neutral with no wallet settlement, but requires tenant `ACTIVE`, subscription `TRIAL|ACTIVE`, current collection/adoption authority and all Company fences. It is not a dunning/cancellation bypass. Definition/config revision changes never silently reprice seats.

Authorized absent activation/configuration/override reads may return server-issued revision `"0"`; use it only for the exact resource's allowed create-on-PATCH compare-and-swap. Never invent revision `"1"`, treat a missing purchased allowance as revision zero, or assume missing configuration is enabled.

## 6. Scope switching, implementation and release checks

- Clear/repartition queries and transient form/preview context on tenant, user, Company or Branch switch. Context from one scope cannot populate another before revalidation. Browser back/direct URLs and changed permissions must render denied/unavailable correctly.
- Capabilities/status can be safe display projections, never authority. LLD 42's zero stale positive authorization, five-second internal permits and transaction-safe local checks are server implementation requirements; do not implement browser permit storage, SQL calls or a timer pretending to revoke server access. Realtime is optional for freshness notifications; authoritative APIs remain required.
- Keep business state/hooks/runtime validation route-colocated under the existing [file architecture](../architecture/file-architecture.md), not a new `src/features` tree. Reuse the shared transport, exact Core unwrapping, design-system barrel, Arabic/English dictionaries, RTL/LTR, both themes and established loading/empty/denied/stale/recovering states.
- Before shipping calls, verify actual Gateway/controller/DTO/permission/package evidence and regenerate generated inventories with their scripts. This target page must not be used to hand-edit generated references or to label an unavailable endpoint live.
- Verification must cover version mismatch/old clients, current arbitrary ladders, exact parent/child IDs, stale preview/assignment revisions, lost apply response without duplicate settlement, paid-pending recovery, same user across two companies, Branch-vs-Company denial, an unassigned owner, source-aware features, direct URLs and scope/cache switching.
- Run targeted validators/hook tests and the portal's documented verification gates for implementation changes; then record real authenticated API/UI evidence separately. The [track receipt](../plans/application-catalogue-frontend-track.md) identifies implemented slices and tests without treating them as full-plan or live acceptance.

Current route/permission inventories below their historical verification dates remain current-source descriptions, not automatically upgraded by this target. Any unsupported backend behavior discovered during implementation is recorded in [OPEN-QUESTIONS](../build/OPEN-QUESTIONS.md); this frontend task never changes backend files to work around it.
