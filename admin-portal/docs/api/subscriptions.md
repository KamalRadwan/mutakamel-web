# Subscriptions API

Status: PARTIAL SOURCE INTEGRATION. Last source verification: 2026-09-09.
Owner: Core. No authenticated runtime, financial execution or package-adoption acceptance is claimed by this change.

## Routes

| Method and canonical browser path | Permissions | Current Admin use |
| --- | --- | --- |
| `GET /api/admin/core/v1/subscriptions` | `admin.subscriptions.read` | Canonical paginated directory |
| `GET /api/admin/core/v1/tenants/:tenantId/subscription` | `admin.subscriptions.read` | Canonical detail |
| `GET /api/admin/core/v1/tenants/:tenantId/subscription/items` | `admin.subscriptions.read` | Canonical selections |
| `GET /api/admin/core/v1/subscriptions/:id/plan-change-previews/:previewId/receipt` | `admin.subscriptions.read` | Original receipt recovery and explicit lookup |
| `GET /api/admin/core/v1/tenants/:tenantId/subscription/operations/:operationId` | `admin.subscriptions.read` | Durable operation progress and original receipt lookup |
| `POST /api/admin/core/v1/subscriptions/:id/preparations` | `admin.subscriptions.update` | Prepare complete Application/Addon changes;202 operation |
| `POST /api/admin/core/v1/subscriptions/:id/plan-change-previews` | `admin.subscriptions.update` | Price the retained preparation;201 preview |
| `POST /api/admin/core/v1/subscriptions/:id/plan-change-previews/:previewId/apply` | ALL `admin.subscriptions.update` + `admin.subscriptions.critical` | Reviewed settlement;200 original receipt |
| `POST /api/admin/core/v1/tenants/:tenantId/subscription/operations/:operationId/recovery` | ALL `admin.subscriptions.update` + `admin.subscriptions.critical` | Reconcile or request safe cancellation;202 operation |
| `POST /api/admin/core/v1/subscriptions/quote` | ANY `admin.catalog.read` or `admin.tenants.create` | Reviewed initial quote |
| `POST /api/admin/core/v1/tenants/:tenantId/subscription` | ALL `admin.subscriptions.create` + `admin.subscriptions.critical` | First subscription from a reviewed quote |
| `POST /api/admin/core/v1/subscriptions/:tenantId/cancel` | ALL `admin.subscriptions.cancel` + `admin.subscriptions.critical` | Whole-subscription cancellation |

Tenant billing now mounts the canonical aggregate workspace. The obsolete scalar plan form, API methods, hook state, DTOs and readers have been removed. Operators edit Application tiers/seats and Addon seats together, add published catalogue selections and remove selections while retaining at least one base Application. Child seats cannot exceed the parent. The complete intended change set is locked once preparation begins. Definition adoption is unavailable until its genuine governed owner is source-integrated; no ADOPT-to-CHANGE translation exists. The server retains WebPhone reduction/removal and readiness gates.

Preparation uses `expectedSubscriptionRevision,changes,reason?`; preview adds `preparationId`. Admin's editor sends no optional reason, prices or actor claims. The 13-field preview preserves22fields per change, complete before/after accepted prices and the owner's nine-field financial observation, including `canApply`. It retains a five-minute expiry and a separate `preparation:{preparationId}` binding. The reader checks the reviewed request's exact selections and retained arithmetic without calculating prices, proration or eligibility. The operator explicitly reviews all amounts before the exact empty-object apply request.

Apply's nine-field original receipt binds the reviewed preview, next subscription revision, actual created/existing selection mappings and wallet settlement. Its `projection.state:"PENDING"` is historical evidence. The13-field operation receipt uses real durable `operationRevision` and source-owned state/phase; READY is not current usable access. Operation GET accepts an original preparation ID or bound preview-operation alias; Admin checks a separately known preparation ID when available and does not assume the requested alias equals the returned ID. Reads require current read permission, no body/query/organization/idempotency and private uncached handling. Progress refresh is explicit, and a committed operation resolves its original receipt. A verified current receipt triggers the authoritative billing refresh once; unrelated historical lookup cannot unlock a pending intent.

Owner-verified retry semantics: the same preview key/body returns its original preview even after expiry. A fresh key may request a fresh five-minute preview from the same unresolved preparation, subject to current owner checks. Only one financial commit is allowed per preparation. Commands retain the exact UUIDv7 key/body through shared session refresh and reauthorize actor and scope. Gateway never retries these writes at the transport layer and does not replay edge receipts. Bodies require application/json, measured256KiB, exact UUIDv7 paths, no query or organization selectors and private/no-store handling.

The actor/tenant/subscription-scoped tab journal persists only exact replay selectors, seat quantities, expected revision and keys. It stores no financial snapshot, receipt, authentication data, actor digest or free-text reason. Ambiguous results retain the same key; definitive rejected commands allow a fresh intent. Recovery body is exactly `{expectedOperationRevision,action:"RECONCILE"|"CANCEL_PREPARATION",reason}` with trimmed1–256character reason. Its journal stores a reason hash; after reload an exact retry requires re-entering the original reason. Session/permission changes remount the workspace and disown late responses. A changed subscription revision prevents new pricing/apply against stale terms. No unattended financial command runs on mount.

The Application candidate list uses existing Application-read permission, with separate catalogue-read permission for tiers and Addons. Lists load bounded pages and preserve current ownership. New Addons require actual registered owner, active root and a nonrevoked published definition compatible with the chosen tier. Server preparation remains the authority for actual selection/readiness; catalogue visibility is not a readiness receipt.

The original receipt GET uses UUIDv7 subscription/preview selectors, current read permission, no body/query/organization selectors/idempotency key and private uncached reads. Its standalone validator requires the requested preview ID and checks the original preparation ID when known from operation status. It verifies closed fields, unique selection mappings, removed IDs, recurring totals and positive settlement amounts without fabricating a reviewed preview. The immediate-apply validator additionally binds the original reviewed prices and identities. This supports recovery after losing an apply key without reconstructing historical financial evidence from current totals.

The receipt owner bounds data JSON to64KiB. Admin independently limits the full success envelope to4MiB and the parsed receipt data to64KiB. These are distinct from Gateway's existing full-response buffer, whose default is16MiB; neither Core nor Gateway installs a dedicated66,560-byte wire limiter. Wrong HTTP success status, unknown fields, bad ownership or size failures remain correlated unavailable errors. A missing/unapplied/out-of-scope receipt is404; corrupt applied history409; auth and availability errors remain distinct.

Mounted AR/EN views render before/after accepted prices with full brackets, separate recurring/settlement amounts, original receipt selection IDs and independently supplied operation progress. Hooks own all HTTP/state; views use the portal design system, semantic theme colors and logical RTL layout. Prepared operation READY and completed projection READY have distinct labels; neither implies usable access. Their visual/runtime acceptance is unverified.

## One commercial representation

Browser paths keep `/api/admin/core/v1`. Commercial HTTP payloads carry no `contractVersion` and use no `x-commercial-contract-version` header. There is no legacy read branch or HTTP409 fallback. Closed readers reject unknown fields, missing evidence, mismatched ownership and inconsistent totals while preserving correlation.

Billing cycles are `MONTHLY|ANNUAL`; lifecycle values are `TRIAL|PENDING_ACTIVATION|ACTIVE|PAST_DUE|CANCELLED`. Money and bigint revisions remain decimal strings.

Detail is exactly `{subscription,subscriptionRevision,baseItems,addonSelections,baseAllowance,totals,projection}`. Items is exactly `{subscriptionId,subscriptionRevision,baseItems,addonSelections}`. The billing workspace compares the two reads' subscription/revision and complete collections before rendering either.

Each base item includes required `tierRank`, the actual integer rank from its joined catalogue tier, bounded to signed int32. Missing/corrupt rank is rejected; no default or price-direction inference is supplied.

Each accepted price contains `billingCycle,currencyCode,recurringAmountUsd,priceRevision,breakdown`. A non-null revision and 1–100 complete marginal brackets are required. No evidence-status field or inferred current-catalogue price is accepted.

Base selections alone determine allowed users and enabled Applications. Addon seats never increase this allowance. Money includes both collections through `baseRecurringUsd,addonRecurringUsd,combinedRecurringUsd`. Detail requires a nonempty base plan and positive allowance; the money owner rejects removal of the final Application before effects.

The cross-tenant directory returns each complete detail plus required `tenant:{id,name,companyName,status}`. Core reads one repeatable snapshot with authorization before/after, at most100 rows and a 4 MiB aggregate page limit including envelope reserve. Admin rejects null/foreign tenant identity, duplicate rows, inconsistent pagination and oversized envelopes; it shows base/addon/combined amounts and both selection collections. Directory rows are under `data`, pagination under `meta`.

## Initial quote and seed

Canonical terms are:

```ts
interface InitialTerms {
  billingCycle: "MONTHLY" | "ANNUAL";
  currencyCode: "USD";
  trialDays?: number;
  applications: Array<{
    selectionKey: string; applicationId: string; tierId: string; seats: number;
    addons: Array<{
      selectionKey: string; addonId: string; definitionVersionId: string; seats: number;
    }>;
  }>;
}
```

Quote adds `purpose:"TENANT_CREATION"`, or `purpose:"INITIAL_SEED",targetTenantId`. Seed adds `quoteId` to the terms and targets the same tenant path. Selection keys are unique UUIDv7 values; Application/tier IDs are UUIDs; Addon/definition IDs are UUIDv7. Seats are whole numbers1–100000, child seats cannot exceed their parent, and there are at most100 aggregate children. Creation allows50 Applications; initial seed100.

Quote returns201 with purpose, target (null for creation), resolved trial duration, created/expiry timestamps, nested accepted prices and separate totals. Expiry is15minutes. Private request hashes, provisioning intent and aggregate price revisions never cross this public boundary. Quote response cap is4MiB. Quote has no idempotency key and `replayAfterRefresh:false`; another operator request creates another quote.

Admin requires a current reviewed quote before create/seed. Editing the selection, actor/tenant/permission changes or expiry disown it. Pending quote requests block duplicate dispatch. Creation keeps its identity/placement validation and status-only uncertain-create recovery; see [tenants](./tenants.md).

The tenant billing empty state mounts the canonical initial commercial workspace. The options picker additionally requires the genuine `admin.tenants.create` options permission; it does not widen catalogue authority. Seed uses one UUIDv7 intent key and the exact reviewed body. Safe session-refresh replay keeps the same key, body, tenant and identity so Core reauthorizes and returns its original SQL receipt.

The14-field seed receipt represents original TRIAL/revision1 state and original identity mappings, totals and dates. It is not current subscription/payment/installation evidence. A confirmed seed triggers the billing wrapper's authoritative refresh once per receipt; the standalone component still displays original receipt evidence. Uncertain attempts retain only actor/tenant/route/intent hash metadata in session storage. A same-session retry uses the original in-memory request even after quote expiry; reload cannot invent a lost original request or replace the unresolved command.

## Cancellation and verification

Cancellation stays a bodyless keyed POST with ALL cancel+critical permissions, eligible-state checks, exact-intent retries and authoritative refresh. Its owner preserves child financial history.

Integration task 13 verified the mounted ordinary aggregate packet: full TypeScript, scoped billing/commercial ESLint, RTL guard (zero physical-direction utilities), documentation checks (282 routes, 80 Markdown files), and the production build passed. Next 16.3.3 compiled all 48 static pages and dynamic routes. Four existing billing suites passed in the initial focused run; the corrected panel plus evidence suites then passed 15/15 cases. The latest recovery context guard is included in the final compiler, lint and build checks. Existing cases were updated for the canonical owner without adding new test cases/files. No app server, database or financial command was executed; this is source/build evidence, not authenticated runtime acceptance.

## Source map

- Core `src/admin/subscriptions/subscriptions.controller.ts` and `subscription-commercial.controller.ts`.
- Core `src/admin/subscriptions/addons/subscription-directory-read.service.ts`, `subscription-read.contract.ts`, `subscription-commercial-read.openapi.ts`.
- Core `src/admin/subscriptions/subscription-initial-commercial.transport.ts`, `subscription-initial-quote.contract.ts`, `subscription-initial-seed.contract.ts`.
- Gateway `src/routing-proxy/route-contracts/core.route-contracts.ts`.
- Gateway `core-subscription-command.route-contracts.ts`, `core-subscription-operation.route-contracts.ts`, `core-subscription-receipt.route-contracts.ts` under the same route-contracts directory; Core `addons/subscription-commercial-write.transport.ts` and its registered bootstrap privacy/parser hooks.
- Admin [canonical read model](../../src/features/admin/tenant-workspace/billing/model/subscription-commercial.ts), [initial workspace](../../src/features/admin/subscriptions/initial-commercial/InitialCommercialWorkspace.tsx), [directory reader](../../src/features/admin/subscriptions/readers.ts).
- Admin [aggregate workspace](../../src/features/admin/subscriptions/commercial-change/CommercialChangeWorkspace.tsx), [command client](../../src/features/admin/subscriptions/commercial-change/commercial-change.api.ts), [operation and financial readers](../../src/features/admin/subscriptions/commercial-change/commercial-change-readers.ts).
