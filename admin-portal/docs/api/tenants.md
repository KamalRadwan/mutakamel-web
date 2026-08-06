# Admin Tenants Frontend Contract

Verified against the current API Gateway route contracts, Core controllers,
DTOs, services, repositories, entities, subscription quoting, provisioning
contracts, error catalogue, and active Admin Portal screens on
**2026-08-05**.

This is the implementation contract for `/tenants`, `/tenants/new`, and the
tenant-detail shell. It covers identity validation, creation, list/detail,
profile updates, lifecycle, and FQDN management. Tenant users, provisioning
operations, subscriptions, wallets, and payments remain independently
permissioned nested resources.

## Ownership and route accounting

| Concern | Contract |
|:---|:---|
| Backend owner | `core-app` |
| Browser prefix | `/api/admin/core/v1` |
| Core upstream prefix | `/api/v1/admin` |
| Guard | `AdminGuard` |
| Entity identifiers | UUIDv7 |
| Active frontend routes | `/tenants`, `/tenants/new`, `/tenants/[id]` |
| Legacy frontend routes | `/tenant` and `/tenant/new` redirect to the plural family; `/tenant/[id]` currently loses the id and redirects to `/tenants` |
| Current integration | `/tenants/new` now uses the real identity-availability endpoint, one least-privilege tenant-create Application/readiness/tier snapshot, Application-aware database placement, Storage placement, provisioning preview, quote, and explicit UUIDv7 placement IDs. List/detail remain partial. |

The Gateway currently exposes exactly **69** routes whose browser paths start
with `/api/admin/core/v1/tenants`. They are divided as follows:

| Family | Count | Detailed reference |
|:---|---:|:---|
| Tenant creation, registry, lifecycle, and FQDNs | 19 | This document |
| Operation history and tenant-scoped provisioning | 15 | [Tenant Operations and Provisioning](tenant-operations.md) |
| Tenant users and access catalogues | 18 | [Tenant Users](tenant-users.md) |
| Subscription and billing summary | 4 | [Subscriptions](subscriptions.md), [Invoices](invoices.md) |
| Wallet, ledger, adjustments, and payments | 5 | [Wallet and Ledger](wallet.md) |
| Tenant Storage Server migrations | 8 | [Tenant Storage Server Migrations](tenant-storage-migrations.md) |

The creation wizard also needs two Core routes outside that 69-route prefix:
the FQDN preflight and subscription quote documented below.

Browser code must use the canonical Gateway paths. Controller-relative
`/admin/tenants/...` paths are not frontend URLs.

### Other nested tenant routes in the 69-route inventory

The nine billing/wallet routes below and the eight migration routes in the
dedicated migration document complete the accounting above. Their detailed
DTOs and response models live in the linked domain documents.

| Method and browser path | Permission | Success | Idempotency key | Detailed reference |
|:---|:---|:---:|:---:|:---|
| `GET /api/admin/core/v1/tenants/:tenantId/subscription` | `admin.subscriptions.read` | `200` | No | [Subscriptions](subscriptions.md) |
| `GET /api/admin/core/v1/tenants/:tenantId/subscription/items` | `admin.subscriptions.read` | `200` | No | [Subscriptions](subscriptions.md) |
| `GET /api/admin/core/v1/tenants/:tenantId/billing-summary` | `admin.invoices.read` | `200` | No | [Invoices](invoices.md) |
| `POST /api/admin/core/v1/tenants/:tenantId/subscription` | `admin.subscriptions.create` + `admin.subscriptions.critical` | `201` | Yes | [Subscriptions](subscriptions.md) |
| `GET /api/admin/core/v1/tenants/:tenantId/wallet` | `admin.wallet.read` | `200` | No | [Wallet and Ledger](wallet.md) |
| `GET /api/admin/core/v1/tenants/:tenantId/wallet/ledger` | `admin.wallet.read` | `200` | No | [Wallet and Ledger](wallet.md) |
| `POST /api/admin/core/v1/tenants/:tenantId/wallet/adjustments/preview` | `admin.wallet.manage` | `201` | Yes | [Wallet and Ledger](wallet.md) |
| `POST /api/admin/core/v1/tenants/:tenantId/wallet/adjustments` | `admin.wallet.manage` + `admin.wallet.critical` | `201` | Yes | [Wallet and Ledger](wallet.md) |
| `GET /api/admin/core/v1/tenants/:tenantId/payments` | `admin.wallet.read` | `200` | No | [Wallet and Ledger](wallet.md) |

## Tenant-shell endpoint summary

`Idempotency key` means an `x-idempotency-key` header containing a UUIDv7
generated for one mutation intent.

### Creation and directory

| Method and browser path | Permission | Success | Idempotency key | Purpose |
|:---|:---|:---:|:---:|:---|
| `POST /api/admin/core/v1/tenants/validate-identity` | `admin.tenants.create` | `200` | No | Check name and company-name availability |
| `GET /api/admin/core/v1/tenants/create-options` | `admin.tenants.create` | `200` | No | Load one consistent, bounded Application/readiness/active-tier projection |
| `GET /api/admin/core/v1/tenants/database-placement-options?applicationKeys=crm,trade` | `admin.tenants.create` | `200` | No | List servers ready for the exact selected Applications |
| `GET /api/admin/core/v1/tenants/storage-placement-options` | `admin.tenants.create` | `200` | No | List the safe, production-ready Storage Servers eligible for explicit placement |
| `POST /api/admin/core/v1/tenants/reverse-geocode` | `admin.tenants.create` | `200` | No | Convert coordinates to a canonical address suggestion |
| `POST /api/admin/core/v1/tenants/provisioning-plans` | `admin.tenants.create` | `200` | No | Preview the dependency-expanded provisioning DAG |
| `POST /api/admin/core/v1/tenants` | `admin.tenants.create` | `201` | Yes | Atomically register and enqueue tenant provisioning |
| `GET /api/admin/core/v1/tenants` | `admin.tenants.read` | `200` | No | Paginated tenant directory |

### Detail and lifecycle

| Method and browser path | Permission | Success | Idempotency key | Purpose |
|:---|:---|:---:|:---:|:---|
| `GET /api/admin/core/v1/tenants/:id` | `admin.tenants.read` | `200` | No | Load one tenant, including safe nested summaries |
| `PATCH /api/admin/core/v1/tenants/:id` | `admin.tenants.update` | `200` | Yes | Update mutable profile fields with optimistic concurrency |
| `POST /api/admin/core/v1/tenants/:id/suspend` | `admin.tenants.suspend` + `admin.tenants.critical` | `201` | Yes | Suspend an active tenant |
| `POST /api/admin/core/v1/tenants/:id/activate` | `admin.tenants.suspend` + `admin.tenants.critical` | `201` | Yes | Reactivate a suspended tenant |
| `POST /api/admin/core/v1/tenants/:id/reprovision` | `admin.tenants.reprovision` + `admin.tenants.critical` | `202` | Yes | Compatibility retry of the latest failed/cancelled operation |
| `POST /api/admin/core/v1/tenants/:id/provisioning/cancel` | `admin.tenants.reprovision` + `admin.tenants.critical` | `202` | Yes | Compatibility cancellation of the latest active operation |
| `DELETE /api/admin/core/v1/tenants/:id` | `admin.tenants.delete` + `admin.tenants.critical` | `204` | Yes | Soft-delete a tenant |
| `DELETE /api/admin/core/v1/tenants/:id/destroy` | `admin.tenants.destroy` + `admin.tenants.critical` | `204` | Yes | Permanently destroy an eligible soft-deleted tenant |

### FQDNs

| Method and browser path | Permission | Success | Idempotency key | Purpose |
|:---|:---|:---:|:---:|:---|
| `POST /api/admin/core/v1/tenant-fqdns/validate` | Either `admin.tenants.create` or `admin.tenants.manage_fqdns` | `200` | No | Validate availability, DNS, and routing before attachment |
| `POST /api/admin/core/v1/tenants/:id/fqdns` | `admin.tenants.manage_fqdns` + `admin.tenants.critical` | `201` | Yes | Attach a secondary domain |
| `DELETE /api/admin/core/v1/tenants/:id/fqdns/:fqdnId` | `admin.tenants.manage_fqdns` + `admin.tenants.critical` | `204` | Yes | Remove a secondary domain |
| `POST /api/admin/core/v1/tenants/:id/fqdns/:fqdnId/primary` | `admin.tenants.manage_fqdns` + `admin.tenants.critical` | `204` | Yes | Legacy-only primary-domain promotion |

The FQDN validator uses **ANY** permission semantics. Every tenant-prefixed
write above has a `WRITE_SENSITIVE`, `idempotent: true` Gateway contract,
including update, lifecycle, delete, and destroy routes.

Every protected browser request must use the shared authenticated client with
`credentials: "include"` and `x-auth-cookie-mode: 1`, preserving the
coordinated refresh retry. Browser code must not store or attach a legacy
access token and must not call Core directly.

## HTTP envelopes and errors

Core successes pass through the Gateway unchanged:

```ts
interface SuccessResponse<T> {
  success: true;
  data: T;
  meta?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  correlationId: string;
  timestamp: string;
}
```

Only paginated lists use `meta`. `DELETE` and primary-FQDN success responses
are HTTP `204` with no body.

The browser can receive both Core and Gateway error shapes:

```ts
interface CoreErrorResponse {
  success: false;
  statusCode: number;
  errorCode: string;
  errorCategory: string;
  message: string;
  details?: Record<string, string[]>;
  correlationId: string;
  timestamp: string;
  path: string;
}

interface GatewayProblemDetails {
  type: string;
  title: string;
  status: number;
  code: string;
  detail?: string;
  instance?: string;
  correlationId: string;
  errors?: Record<string, string[]>;
}
```

Normalize `errorCode` and `code` into one client error discriminator without
discarding `correlationId`.

## Idempotency

For every tenant-shell endpoint marked `Yes`:

1. Generate one UUIDv7 before the user submits the mutation.
2. Reuse that key only for an exact retry of the same method, path, query,
   actor scope, and body.
3. Generate a new key when any command intent changes.
4. Treat `GW.IDEM.IN_FLIGHT` as still processing and refetch before another
   command.
5. Treat `GW.IDEM.MISMATCH` or `IDEMPOTENCY_KEY_REUSED` as a client-command
   bug.

Tenant creation and provisioning commands also have durable Core replay
semantics. An exact tenant-create retry can return the originally created
tenant even after its single-use quote was consumed. `storageServerId` is part
of the durable create-command fingerprint. Changing the selected Storage
Server is a new intent and requires a new UUIDv7 idempotency key.

The create wizard locks every editable control and step transition as soon as
submission starts. It fingerprints the live draft, rechecks ownership after
the quote returns, and rechecks again immediately before the create POST. A
changed draft is never sent with the quote or command identity captured for an
older draft.

Immediately before the create POST, the browser stores only a tab-scoped
status-recovery marker: UUIDv7 key, immutable public tenant name, and save time.
It does not store the create DTO, company/owner/contact data, quote, Database or
Storage selection, or subscription lines. Failure to store that marker blocks
the POST. Success clears it. An ambiguous response keeps it and disables all
new tenant-create submissions in that tab. Recovery is read-only and requires
`admin.tenants.read`: the UI performs an exact-name check against the
authoritative tenant list, projects only `id`, `name`, and `status`, then clears
the marker and redirects when a row exists. No row, a forbidden read, or an
unavailable response keeps the marker and never triggers an automatic replay.
Because the DTO is intentionally not persisted, reload cannot reconstruct or
resend the original tenant-create command.

## Transport enums

```ts
enum TenantStatusEnum {
  PROVISIONING = "PROVISIONING",
  PROVISIONING_FAILED = "PROVISIONING_FAILED",
  ACTIVE = "ACTIVE",
  SUSPENDED = "SUSPENDED",
  DELETED = "DELETED",
}

enum TenantFqdnValidationStatus {
  PENDING = "PENDING",
  VALID = "VALID",
  INVALID = "INVALID",
}

enum BillingCycleEnum {
  MONTHLY = "MONTHLY",
  ANNUAL = "ANNUAL",
}
```

There is no `FAILED` tenant status, `VERIFIED` FQDN status, `YEARLY` billing
cycle, or `placementMode` request enum.

## Response models

Dates are serialized ISO timestamps. Money remains a decimal string.

```ts
interface TenantFqdnView {
  id: string;
  fqdn: string;
  isPrimary: boolean;
  validationStatus: TenantFqdnValidationStatus;
  verifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface TenantSubscriptionSummary {
  status: SubscriptionStatusEnum;
  effectiveAllowedUsers: number;
  billingCycle: string | null;
  currencyCode: string | null;
  totalPrice: string | null;
  startedAt: string;
  currentPeriodStart: string | null;
  currentPeriodEnd: string;
  trialDays: number;
  trialStartedAt: string | null;
  trialEndsAt: string | null;
  activationScheduledAt: string | null;
  activatedAt: string | null;
  cancelAt: string | null;
}

interface TenantDatabaseServerSummary {
  id: string;
  name: string;
  driver: "postgres";
  countryName?: string;
  countryIsoCode?: string;
  maxTenants?: number;
  currentTenants?: number;
  status: string;
}

interface TenantStorageServerSummary {
  id: string;
  name: string;
  provider: "GARAGE";
  region: string;
  status: string;
  availabilityClass: string;
}

interface TenantView {
  id: string;
  name: string;
  companyName: string;
  countryName: string;
  countryIsoCode: string;
  industry?: string | null;
  timezone?: string | null;
  phoneCountryCode?: string | null;
  phone?: string | null;
  address?: TenantAddress | null;
  taxNumber?: string | null;
  commercialRegistrationNumber?: string | null;
  ownerEmail?: string | null;
  ownerFirstName?: string | null;
  ownerLastName?: string | null;
  ownerPhoneCountryCode?: string | null;
  ownerPhone?: string | null;
  ownerJobTitle?: string | null;
  ownerLanguage?: string | null;
  ownerUsername?: string | null;
  ownerAccountLinked: boolean;
  databaseName: string;
  status: TenantStatusEnum;
  createdAt: string;
  updatedAt: string;
  fqdns: TenantFqdnView[];
  subscription?: TenantSubscriptionSummary;
  databaseServer?: TenantDatabaseServerSummary;
  storageServerId?: string | null;
  storageServer?: TenantStorageServerSummary;
}

interface TenantAddress {
  city?: string;
  state?: string;
  district?: string;
  street1?: string;
  street2?: string;
  buildingNo?: string;
  postalCode?: string;
  landmark?: string;
  formattedAddress?: string;
}
```

The view does **not** return:

- `code`, `primaryFqdn`, or `secondaryFqdnsCount`;
- a plan name, subscription id, subscription items, or seat label;
- a nested `owner` object;
- database credentials or connection configuration;
- Storage Server endpoints, buckets, credential references, access keys,
  topology-member evidence, or recovery evidence;
- a provisioning percentage or latest operation.

Derive the primary FQDN with `fqdns.find(item => item.isPrimary)`, derive the
secondary count from the remainder, and use
`subscription.effectiveAllowedUsers` for the current allowed-user value. Load
full subscription items and operations from their separately permissioned
endpoints. Use `storageServer` only as the safe placement summary. Do not call
the Storage Servers admin registry to enrich a tenant row with endpoints or
other operational configuration.

## Creation workflow

The wizard is a server-priced, asynchronous provisioning workflow:

```text
identity and company details
  -> load one no-store tenant-create Application/readiness/active-tier snapshot
  -> select Application/tier/seats and preview the server-derived plan
  -> load database placement with exact applicationKeys
  -> explicitly select returned Database and Storage UUIDv7 targets
  -> subscription quote
  -> POST tenant with quoteId + nested subscription + placement IDs + UUIDv7 command key
  -> tenant returned as PROVISIONING
  -> redirect to the returned tenant id and observe asynchronous provisioning
```

The preview is evidence for the UI only. Creation rebuilds and pins its own
transactional plan from the subscription’s module selection.

### 1. Validate tenant identity

`POST /api/admin/core/v1/tenants/validate-identity`

Permission: `admin.tenants.create`.

```ts
interface ValidateTenantIdentityDto {
  name: string;
  companyName: string;
}

interface TenantIdentityValidationResult {
  valid: boolean;
  fields: {
    name: {
      valid: boolean;
      available: boolean;
      reason?: "REQUIRED" | "TAKEN";
      message: string;
    };
    companyName: {
      valid: boolean;
      available: boolean;
      reason?: "REQUIRED" | "TAKEN";
      message: string;
    };
  };
  message: string;
}
```

Validation:

| Field | Rule |
|:---|:---|
| `name` | Required; trimmed and lowercased; 1–63 characters; `^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$` |
| `companyName` | Required; trimmed; max 160 characters |

Availability checks are case-insensitive and include soft-deleted tenants.
HTTP `200` is returned even when a value is unavailable; inspect `data.valid`
and each field. This endpoint does not guarantee that every possible secondary
FQDN is available.

The active wizard binds successful evidence to the normalized current
`name + companyName` fingerprint. Editing either field invalidates the evidence
and prevents leaving step 1 or creating the tenant until the real endpoint is
called again. Late validation responses are generation/identity fenced and
cannot validate changed input.

The tenant name is immutable after creation and generates the platform-owned
primary domain `<name>.mutakamel.ai`.

### 2. Validate secondary FQDNs

`POST /api/admin/core/v1/tenant-fqdns/validate`

Permission: either `admin.tenants.create` or
`admin.tenants.manage_fqdns`.

```ts
interface ValidateFqdnDto {
  fqdn: string;
}

interface FqdnAvailabilityResult {
  fqdn: string;
  valid: boolean;
  available: boolean;
  dnsResolved?: boolean;
  reachable?: boolean;
  reason?: "INVALID_FORMAT" | "TAKEN" | "DNS_NOT_FOUND" | "UNREACHABLE";
  message: string;
}
```

The DTO trims and lowercases the value, requires a real TLD, rejects
underscores, trailing dots, numeric TLDs, wildcards, Unicode U-labels, and
characters outside lowercase ASCII letters/digits/dot/hyphen, and caps length
at 253. Punycode `xn--` A-labels are allowed when otherwise valid.

The preflight checks:

1. syntax;
2. global uniqueness, including soft-deleted FQDN rows;
3. presence of an A, AAAA, or CNAME record;
4. whether the domain routes to this application and returns a one-time token.

It returns HTTP `200` for negative availability/probe results. Do not reproduce
DNS checks in the browser. A secondary FQDN may still be submitted during
creation before DNS propagation; it remains non-routable until scheduled Core
verification marks it `VALID`.

### 3. Load tenant-create Application options

`GET /api/admin/core/v1/tenants/create-options`

Permission: `admin.tenants.create`.

```ts
type TenantCreateSelectionBlocker =
  | "APPLICATION_LIFECYCLE_NOT_ACTIVE"
  | "APPLICATION_NOT_PUBLISHED"
  | "APPLICATION_NOT_PUBLIC"
  | "APPLICATION_NON_BILLABLE"
  | "TECHNICAL_READINESS_BLOCKED";

type TenantCreateReadinessReason =
  | "RUNTIME_TARGET_REQUIRED"
  | "COMPONENT_BINDING_REQUIRED"
  | "ACTIVE_COMPONENT_REQUIRED"
  | "PUBLISHED_RELEASE_REQUIRED"
  | "MINIMUM_RELEASE_NOT_SATISFIED"
  | "DATABASE_PERMISSION_MANIFEST_REQUIRED"
  | "DATABASE_PERMISSION_MANIFEST_INVALID";

interface TenantCreateOptionsView {
  contractVersion: 1;
  applications: Array<{
    applicationId: string; // UUIDv7
    key: string;           // immutable Application key
    name: string;
    description: string | null;
    rank: number;
    commercialMode: "INCLUDED" | "SUBSCRIPTION";
    technicalDefinitionRevision: string; // positive bigint; never Number(...)
    selectionAllowed: boolean;
    selectionBlockers: TenantCreateSelectionBlocker[];
    readinessReasons: TenantCreateReadinessReason[];
    catalogueReasons: Array<"ACTIVE_TIER_REQUIRED">;
    tiers: Array<{
      id: string; // UUIDv7
      key: string;
      name: string;
      rank: number;
    }>;
  }>;
}
```

The response is wrapped under `data`, carries
`Cache-Control: private, no-store`, and is read from one `REPEATABLE READ`
snapshot. Core returns only ACTIVE, PUBLISHED, PUBLIC Tenant Applications in
INCLUDED or SUBSCRIPTION commercial modes, caps the projection at 100, batches
active tiers, and fails closed when the cap or readiness identity is invalid.

Use only entries with `selectionAllowed: true`; show the returned blockers and
reasons for disabled entries. Treat an empty array as an authoritative empty
catalogue, but treat `403`, `5xx`, or a malformed/unknown contract as a blocking
error. Do not fall back to broad Application Catalogue, readiness, or tier APIs,
and do not derive Application or tier identities from display names.

### 4. Load Application-aware database placement options

`GET /api/admin/core/v1/tenants/database-placement-options?applicationKeys=crm,trade`

Permission: `admin.tenants.create`.

```ts
interface TenantCreateDatabasePlacementOptionsView {
  items: Array<{
    id: string;
    name: string;
    status: DatabaseServerStatusEnum;
    countryName?: string;
    countryIsoCode?: string;
    currentTenants: number;
    maxTenants: number;
  }>;
  total: number;
}
```

This is a bounded object under `data`, not a paginated response. Pass the exact
deduplicated selected Application keys. A returned server is active, has spare
capacity, has both fixed system principals ready, and has ready current
bindings for all mandatory and selected Applications. Refetch this list when
the Application-key set changes and clear any previous database selection.

The Admin Portal V1 requires an explicit returned UUIDv7 and sends it as
`databaseServerId`. It never sends `placementMode`, never displays the complete
Database Server registry, and never creates a local or fake server id.

### 5. Load and select Storage Server placement

`GET /api/admin/core/v1/tenants/storage-placement-options`

Permission: `admin.tenants.create`.

```ts
interface TenantCreateStoragePlacementOptionsView {
  items: Array<{
    id: string;            // UUIDv7
    code: string;
    name: string;
    region: string;
    status: "ACTIVE";
    assignedTenants: number;
    maxTenants: number | null;
  }>;
  total: number;
}
```

The response carries `Cache-Control: private, no-store` and is a bounded
object under `data`. Current source returns only active, non-deleted servers
with encrypted credentials, spare capacity, and a successful connection test
no older than 24 hours. Core locks and revalidates the selected row during
creation.

The projection intentionally omits the physical bucket and all endpoint or
credential data. The browser parser copies only the fields above and discards any unexpected
operational or secret-bearing properties. The administrator must explicitly
select one returned UUIDv7. There is no automatic Storage placement, hidden
default, fallback, or client-side substitution.


### 6. Reverse-geocode an optional map selection

`POST /api/admin/core/v1/tenants/reverse-geocode`

Permission: `admin.tenants.create`.

```ts
interface ReverseGeocodeTenantAddressDto {
  latitude: number;  // -90..90, max 7 decimals
  longitude: number; // -180..180, max 7 decimals
}

interface TenantReverseGeocodedAddress {
  countryName: string;
  countryIsoCode: string;
  state?: string;
  stateCode?: string;
  city?: string;
  cityId?: number;
  district?: string;
  street1?: string;
  buildingNo?: string;
  postalCode?: string;
  landmark?: string;
  formattedAddress?: string;
}
```

Treat this as an editable suggestion, not an irreversible selection. Core
caches coordinate results and serializes outbound provider calls. A missing or
incomplete address is `422`; provider failure is `502` or `503`.

### 7. Preview provisioning

`POST /api/admin/core/v1/tenants/provisioning-plans`

Permission: `admin.tenants.create`.

```ts
interface PreviewTenantProvisioningDto {
  moduleKeys: string[];
}

interface TenantProvisioningSelectionPreview {
  contractVersion: 1;
  selectedApplicationKeys: string[];
  selectionDigest: string;
  components: Array<{
    componentId: string;
    componentKey: string;
    ownerApp: string;
    selectionSource: "FOUNDATION" | "ENTITLEMENT" | "DEPENDENCY";
    dependsOnComponentKeys: string[];
    required: boolean;
    activationRequired: boolean;
    releaseId: string;
    releaseVersion: string;
    manifestVersion: number;
    manifestChecksum: string;
    schemaTarget: string;
    schemaChecksum?: string;
    seedPacks: Array<{ key: string; version: string; policy: string; checksum?: string }>;
  }>;
  steps: Array<{
    stepKey: string;
    componentKey?: string;
    kind: string;
    required: boolean;
    activationRequired: boolean;
    dependsOn: string[];
    targetVersion?: string;
    targetChecksum?: string;
  }>;
}
```

`moduleKeys` is normalized to lowercase, must contain 1–50 unique strings, and
each key must match `^[a-z][a-z0-9_-]{0,63}$`. The service also requires each
selected module to be active and have a valid published component/release
catalogue. Core and Worker foundations are never selected by the browser;
foundation and dependency components are expanded automatically by Core.

Render component and step arrays from the response. The current frontend’s
three-field `components: string[]`/`stepsCount` mock loses important dependency,
release, checksum, seed, and activation evidence.

### 8. Obtain the subscription quote

Tenant creation requires a short-lived quote from a route outside the tenant
prefix:

`POST /api/admin/core/v1/subscriptions/quote`

Permission: either `admin.catalog.read` or `admin.tenants.create` (`ANY`). This
route is an authenticated read-like POST and does not require an idempotency
header. The tenant-create wizard uses `admin.tenants.create`; standalone
catalogue/pricing surfaces may use `admin.catalog.read`.

```ts
interface QuoteSubscriptionDto {
  billingCycle?: BillingCycleEnum; // default MONTHLY
  currencyCode?: "USD";            // default/fixed USD
  items: Array<{
    moduleId: string; // UUIDv7
    tierId: string;   // UUIDv7
    seats: number;    // integer 1..100000
  }>;                 // 1..100
}

interface SubscriptionQuote {
  quoteId: string;
  requestHash: string;
  pricingRevision: string;
  billingCycle: BillingCycleEnum;
  currencyCode: "USD";
  total: string;
  totalUsd: string;
  items: Array<{
    moduleId: string;
    tierId: string;
    seats: number;
    lineTotal: string;
    lineTotalUsd: string;
  }>;
  expiresAt: string;
}
```

Each module may appear only once. Resolve UUIDs and immutable keys from the
catalogue contract; quote with IDs, then create with the corresponding
`moduleKey`/`tierKey`. The quote expires after 15 minutes, is bound to its
creating admin when an actor id is stored, and can be consumed once. Re-quote
after any module, tier, seat, cycle, or price change.

The complete creation page requires only `admin.tenants.create`. Its composite
create-options projection supplies Application identity, technical readiness,
and active tiers, while the quote route accepts the same permission. Missing
permission is a blocking forbidden state, never an empty catalogue.

### 9. Create the tenant

`POST /api/admin/core/v1/tenants`

Permission: `admin.tenants.create`.

Canonical Admin Portal V1 request shape:

```ts
interface CreateTenantDto {
  quoteId: string; // required UUIDv7
  name: string;
  secondaryFqdns?: string[];
  companyName: string;
  countryName: string;
  countryIsoCode: string;
  industry: string;
  timezone: string;
  phoneCountryCode: string;
  phone?: string;
  address: TenantAddress;
  taxNumber?: string;
  commercialRegistrationNumber?: string;
  databaseServerId: string;
  storageServerId: string;
  ownerEmail: string;
  ownerFirstName: string;
  ownerLastName: string;
  ownerPhoneCountryCode: string;
  ownerPhone: string;
  ownerJobTitle: string;
  ownerLanguage?: string;
  ownerUsername?: string;
  sendInvitation?: boolean;
  ownerActive?: boolean;
  locale?: string;
  subscription: {
    billingCycle: "MONTHLY" | "ANNUAL";
    currencyCode: "USD";
    trialDays?: number;
    items: Array<{
      moduleKey: string;
      tierKey: string;
      seats: number;
    }>;
  };
}
```

The Admin Portal sends only this nested subscription shape. It does not send
overlapping top-level billing fields, `modules`, `allowedUsers`, `addons`, or
`placementMode`. Quote uses Application/tier UUIDv7 IDs; create uses the exact
corresponding immutable keys retained in the same selection state.

Detailed validation:

| Field | Rule |
|:---|:---|
| `quoteId` | Required UUIDv7; exact unexpired quote must match cycle/modules/tiers/seats |
| `name` | Trim/lowercase; 1–63 DNS-label characters; immutable |
| `secondaryFqdns` | Optional array, max 50; normalized unique valid FQDNs; may not contain generated primary or any `mutakamel.ai` domain |
| `companyName` | Required trimmed string, 1–160 |
| `countryName` | Required trimmed string, 1–120; Core stores the canonical name resolved from `countryIsoCode` |
| `countryIsoCode` | Required two uppercase letters after normalization; must exist in country catalogue |
| `industry` | Required trimmed string, 1–160 |
| `timezone` | Required trimmed string, 1–100 |
| `phoneCountryCode` | Required, `^\+[1-9]\d{0,3}$` |
| `phone` | Optional, max 32, digits/parentheses/plus/hyphen/space/dot |
| `address` | Required nested object; each property optional and trimmed |
| `taxNumber`, `commercialRegistrationNumber` | Optional, max 64 |
| `databaseServerId` | Required by Admin Portal V1; UUIDv7 selected from the exact Application-aware options |
| `storageServerId` | Required UUIDv7 selected from the safe Storage Server placement options; no default/failover |
| `ownerEmail` | Email, max 255, trim/lowercase |
| `ownerFirstName`, `ownerLastName` | Required trimmed string, 1–80 |
| `ownerPhoneCountryCode` | Required country calling code pattern |
| `ownerPhone` | Required, max 32, same phone character family |
| `ownerJobTitle` | Required trimmed string, 1–120 |
| `ownerLanguage`, `locale` | Optional trimmed string, max 16 |
| `ownerUsername` | Optional trimmed string, max 120 |
| `sendInvitation`, `ownerActive` | Optional JSON booleans; both default to `true` |
| `billingCycle` | Required in the preferred shape: `MONTHLY` or `ANNUAL` |
| `currencyCode` | Optional but, when present, exactly `USD` after normalization |
| `trialDays` | Optional integer 1–365 |
| `modules` | Required in preferred shape; 1–50 lines |
| `moduleKey`, `tierKey` | Required non-empty strings, max 64 |
| `seats` | Integer 1–1,000,000 in create DTO, but use 1–100,000 because the required quote is stricter |

Representative create request:

```json
{
  "quoteId": "019f0000-0000-7000-8000-000000000020",
  "name": "acme-retail",
  "companyName": "Acme Retail LLC",
  "countryName": "Egypt",
  "countryIsoCode": "EG",
  "industry": "Retail",
  "timezone": "Africa/Cairo",
  "phoneCountryCode": "+20",
  "phone": "1001234567",
  "address": {
    "city": "Cairo",
    "street1": "Nile Street"
  },
  "databaseServerId": "019f0000-0000-7000-8000-000000000029",
  "storageServerId": "019f0000-0000-7000-8000-000000000030",
  "ownerEmail": "owner@example.com",
  "ownerFirstName": "Mona",
  "ownerLastName": "Ali",
  "ownerPhoneCountryCode": "+20",
  "ownerPhone": "1001234567",
  "ownerJobTitle": "Chief Executive Officer",
  "sendInvitation": true,
  "ownerActive": true,
  "billingCycle": "MONTHLY",
  "currencyCode": "USD",
  "trialDays": 14,
  "modules": [
    {
      "moduleKey": "core",
      "tierKey": "business",
      "seats": 25
    }
  ]
}
```

`TenantAddress` bounds:

| Property | Maximum |
|:---|---:|
| `city`, `state`, `district`, `buildingNo`, `postalCode`, `landmark` | 100 |
| `street1`, `street2` | 200 |
| `formattedAddress` | 500 |

The operation is transactional. Core:

- consumes the exact quote;
- selects and capacity-locks the database server, then locks the exact selected
  Storage Server in that fixed order;
- creates the tenant in `PROVISIONING`;
- persists the immutable initial Storage Server assignment, placement history,
  quota snapshot, and capacity reservation atomically with the tenant;
- generates a unique database name and immutable platform primary FQDN;
- stores secondary FQDNs as pending;
- creates the subscription, wallet, access-policy snapshot, operation, and
  provisioning attempt;
- publishes the immutable provisioning plan through the outbox.

Physical database creation, migrations, seeds, owner creation/invitation, and
the final transition to `ACTIVE` are asynchronous. Do not optimistically mark
the returned tenant active. Core creates no S3 folder marker: tenant storage
namespaces are virtual and are derived by the Storage runtime from the
persisted assignment.

## Tenant directory

`GET /api/admin/core/v1/tenants`

Permission: `admin.tenants.read`.

```ts
interface TenantQueryDto {
  page?: number;              // default 1
  limit?: number;             // default 20, max 100
  sortBy?: "name" | "status" | "createdAt";
  sortDir?: "ASC" | "DESC";  // default ASC
  search?: string;            // max 200
  status?: TenantStatusEnum;
  databaseServerId?: string;  // UUIDv7
}
```

Search spans `name`, `companyName`, `countryName`, `countryIsoCode`,
`databaseName`, and `ownerEmail`. An unsupported `sortBy` falls back to
`createdAt`; it is not rejected by this service.

Rows are `TenantView[]` under `data`; pagination is under `meta`.

Deleted tenants are excluded unless `status=DELETED`. Direct detail lookup
does include soft-deleted tenants. The API has no aggregate/facet endpoint for
the five list summary cards. To keep those cards accurate across pages, either:

- issue independent `limit=1` queries and use each status response’s
  `meta.total`; or
- remove/defer the cards.

Never count only the loaded page and label it as the global total.

List-field mapping:

| Current UI field | API mapping |
|:---|:---|
| `companyName` | Direct |
| tenant code badge | Use immutable `name`; there is no separate `code` |
| `primaryFqdn` | `fqdns.find(f => f.isPrimary)?.fqdn` |
| `secondaryFqdnsCount` | `fqdns.filter(f => !f.isPrimary).length` |
| hosting server | Optional `databaseServer` summary |
| storage placement | Optional safe `storageServer` summary; use `storageServerId` as its stable identity |
| subscription seats | Optional `subscription.effectiveAllowedUsers` |
| plan name | Not available from tenant list |
| owner email | Optional `ownerEmail` |

## Detail and profile update

### Load detail

`GET /api/admin/core/v1/tenants/:id`

Permission: `admin.tenants.read`.

The id is UUIDv7. The response is `SuccessResponse<TenantView>`. FQDNs are
loaded primary-first, then creation order. The subscription and database
server are optional. `storageServerId` can be `null` only for legacy or
incompletely migrated rows; the nested `storageServer` summary is absent when
the assignment cannot be safely resolved. Render those as explicit
unavailable/legacy placement states. Do not substitute the first Storage
Server from the catalogue.

Storage placement fragment in a normal detail response:

```json
{
  "storageServerId": "019f0000-0000-7000-8000-000000000030",
  "storageServer": {
    "id": "019f0000-0000-7000-8000-000000000030",
    "name": "Primary Garage Cluster",
    "provider": "GARAGE",
    "region": "garage",
    "status": "ACTIVE",
    "availabilityClass": "HA_PRODUCTION_READY"
  }
}
```

This fragment intentionally has no endpoint, bucket, credential, topology
member, or recovery fields. The current detail adapter reconstructs this
nested object from the six allowlisted fields and rejects an ID mismatch; it
does not retain unexpected endpoint, credential-reference, bucket, or other
operational properties in client state.

### Update profile

`PATCH /api/admin/core/v1/tenants/:id`

Permission: `admin.tenants.update`.

```ts
interface UpdateTenantDto {
  expectedUpdatedAt: string; // required strict ISO-8601 token
  companyName?: string;
  countryName?: string;
  countryIsoCode?: string;
  industry?: string | null;
  timezone?: string | null;
  phoneCountryCode?: string | null;
  phone?: string | null;
  address?: TenantAddress | null;
  taxNumber?: string | null;
  commercialRegistrationNumber?: string | null;
}
```

Example save request:

```json
{
  "expectedUpdatedAt": "2026-07-28T08:00:00.000Z",
  "companyName": "Acme Retail Group",
  "industry": "Retail and Distribution",
  "address": {
    "city": "Cairo",
    "street1": "Nile Street",
    "postalCode": "11511"
  }
}
```

The success response is `SuccessResponse<TenantView>` and includes the same
read-only `storageServerId` and safe `storageServer` summary returned by
detail. Replace the detail query cache with the returned view; do not merge the
request body into stale local state.

Use the exact `updatedAt` from the last detail response as
`expectedUpdatedAt`. A conflicting edit returns `TENANT_UPDATE_STALE`; reload
and let the admin review the new values. An exact transport replay is accepted
when every requested field is already stored.

Rules:

- `name`, owner identity/contact, database placement, status, FQDNs,
  subscription, database name, `storageServerId`, and storage placement are
  not mutable here;
- `companyName` remains non-empty, max 160;
- changing country requires `countryIsoCode`; sending `countryName` without it
  is `TENANT_COUNTRY_INVALID`;
- Core resolves and stores the canonical country name from the ISO code;
- optional string bounds/patterns match create;
- send `null` to clear a nullable optional field;
- empty strings normalize to omitted values and therefore do not clear them;
- `address: null` clears the whole address; a supplied address object replaces
  the stored JSON value rather than deep-merging it.

### Storage placement on view and edit

Tenant detail and edit mode must show the safe `storageServer` summary and
stable `storageServerId` as read-only placement evidence. The current
`UpdateTenantDto` does not accept `storageServerId`; ordinary profile save
cannot move storage.

Do not put a Storage Server selector in existing-tenant profile edit, do not
send `storageServerId` as an unknown field, and do not mutate the displayed
assignment optimistically.

The backend now has a separate eight-route, default-off migration authority
covering write fencing, copy/verification, cutover, rollback, finalization,
retry, and cancel. It is not a profile-update contract. The public Admin read
model still omits the revisions and operation discovery needed to initiate and
recover the workflow safely, and live operational release gates remain open.
The Admin Portal must therefore keep “Change storage” unavailable for now.

See [Tenant Storage Server Migrations](tenant-storage-migrations.md) for the
complete endpoint, DTO, permission, state, idempotency, readiness-blocker, and
future UI contract. A read-permitted admin may still follow
`storageServerId` to `/storage-servers/[storageServerId]`.

## Lifecycle

### Suspend and activate

Suspend accepts `ACTIVE`, is idempotent when already `SUSPENDED`, and otherwise
returns `TENANT_INVALID_STATE`. Activate accepts `SUSPENDED`, is idempotent
when already `ACTIVE`, and otherwise returns the same conflict. Both return the
updated `TenantView` and invalidate the tenant-host cache.

Suspension blocks normal tenant application access but does not mean the
tenant is deleted. Admin Portal access remains independently authorized.

### Retry and cancel provisioning

The two tenant-level compatibility routes return:

```ts
interface TenantProvisioningCommandResult {
  replayed: boolean;
  operation: TenantOperationDetailView;
}
```

Prefer operation-specific retry/cancel routes when the operation id is
available.

Retry creates a new immutable generation only for the latest operation in
`FAILED_RETRYABLE`, `MANUAL_RECOVERY_REQUIRED`, or `CANCELLED`. Initial
provisioning retries can move `PROVISIONING_FAILED` back to `PROVISIONING`.

Cancel applies only to the latest operation in `REQUESTED`, `PLANNING`,
`QUEUED`, `RUNNING`, or `WAITING_RETRY`; it changes the operation to
`CANCEL_REQUESTED`. Cancellation does not delete the tenant or immediately
release its placement.

### Soft delete

`DELETE /api/admin/core/v1/tenants/:id`

Permissions: `admin.tenants.delete` + `admin.tenants.critical`.

Soft delete:

- rejects an already-deleted tenant;
- blocks while collection, review, or refund reconciliation creates a billing
  hold;
- sets lifecycle to `DELETED` and soft-deletes the tenant;
- removes FQDN rows and host routing;
- cancels the subscription;
- decrements the database-server tenant count;
- schedules physical database teardown through retention processing.

It can be invoked from a non-deleted state; the UI should still make the
impact clear and require explicit confirmation. After `204`, remove the row
from normal lists. Deleted records remain available through direct detail and
`status=DELETED`.

### Permanent destroy

`DELETE /api/admin/core/v1/tenants/:id/destroy?destroySubscriptions=false`

Permissions: `admin.tenants.destroy` + `admin.tenants.critical`.

```ts
interface DestroyTenantQueryDto {
  destroySubscriptions?: boolean; // strict boolean, default false
}
```

There is no `confirm` query parameter. The tenant must already be soft-deleted.
With the default `false`, subscriptions are detached from the tenant. With
`true`, subscription headers, items, and add-ons are purged.

Permanent destruction is refused when legally/financially retained evidence
exists, including invoices, payments, protected plan-change previews,
non-zero wallet balances/reservations, or any wallet ledger history. The UI
must treat `TENANT_FINANCIAL_HISTORY_EXISTS` as a permanent retention
constraint, not as a retry prompt.

## FQDN management

### Add

`POST /api/admin/core/v1/tenants/:id/fqdns`

Permissions:
`admin.tenants.manage_fqdns` + `admin.tenants.critical`.

```ts
interface AddFqdnDto {
  fqdn: string;
}
```

The same validation rules as the preflight DTO apply. Core additionally:

- requires the tenant to be `ACTIVE`;
- rejects every `mutakamel.ai` domain as platform-reserved;
- returns an existing same-tenant row for an exact duplicate;
- rejects global ownership by another tenant;
- creates a new secondary row as `PENDING`;
- relies on scheduled Core verification before routing becomes valid.

### Remove

Removing a missing or foreign row returns `204` without revealing ownership.
The generated `<name>.mutakamel.ai` primary domain cannot be removed, and no
operation may leave a tenant without a primary.

### Promote to primary

Primary promotion exists only for legacy tenants that do not already have the
generated platform primary. The candidate must be `VALID` and have
`verifiedAt`. For normal newly created tenants the platform primary is locked,
so the UI should not show a “set primary” action.

## Permission-gated UI

| UI capability | Permission |
|:---|:---|
| Register wizard shell | `admin.tenants.create` |
| Load tenant-create Applications, readiness, and active tiers | `admin.tenants.create` |
| Load/select database and Storage Server placement options | `admin.tenants.create` |
| Obtain the tenant-create subscription quote | `admin.tenants.create` (`admin.catalog.read` is an alternate permission for catalogue consumers) |
| Read directory/detail/operations | `admin.tenants.read` |
| Edit profile | `admin.tenants.update` |
| Suspend/activate | `admin.tenants.suspend` + `admin.tenants.critical` |
| Retry/cancel provisioning | `admin.tenants.reprovision` + `admin.tenants.critical` |
| Read storage migration evidence | `admin.storage_migrations.read` |
| Create storage migration when release-gated on | `admin.storage_migrations.create` + `admin.storage_migrations.critical` |
| Retry/cancel storage migration when release-gated on | `admin.storage_migrations.manage` + `admin.storage_migrations.critical` |
| Roll back during the retained-source window when release-gated on | `admin.storage_migrations.rollback` + `admin.storage_migrations.critical` |
| Finalize retained source when release-gated on | `admin.storage_migrations.finalize` + `admin.storage_migrations.critical` |
| Retry/cancel a post-cutover operation when release-gated on | `admin.storage_migrations.post_cutover.retry` or `.cancel`, plus `admin.storage_migrations.critical` |
| Preflight FQDN | Either `admin.tenants.create` or `admin.tenants.manage_fqdns` |
| Add/remove/promote FQDN | `admin.tenants.manage_fqdns` + `admin.tenants.critical` |
| Soft delete | `admin.tenants.delete` + `admin.tenants.critical` |
| Permanent destroy | `admin.tenants.destroy` + `admin.tenants.critical` |

Nested tab permissions are independent. Having `admin.tenants.read` does not
grant tenant-user, subscription, invoice, wallet, payment, or advanced
provisioning permissions.

## Error catalogue

### Gateway errors

| Status | Problem Details `code` | UI handling |
|:---:|:---|:---|
| `400` | `GW.IDEM.MISSING` | Generate and attach a UUIDv7 key |
| `400` | `GW.IDEM.BAD_VALUE` | Fix the key generator |
| `409` | `GW.IDEM.IN_FLIGHT` | Show processing state, then refetch |
| `422` | `GW.IDEM.MISMATCH` | Never reuse a key after intent changes |
| `413` | `GW.BODY.TOO_LARGE` | Reduce the request body |

### Core tenant and creation errors

| Status | Core `errorCode` | Trigger/UI handling |
|:---:|:---|:---|
| `400` | Validation error | Map DTO, UUID, enum, bounds, and unknown-field details |
| `400` | `IDEMPOTENCY_KEY_REQUIRED` / `INVALID_IDEMPOTENCY_KEY` | Core defensive validation; fix header generation |
| `404` | `TENANT_NOT_FOUND` | Tenant is missing or inaccessible |
| `404` | `FQDN_NOT_FOUND` | Refetch FQDN state |
| `404` | `SUBSCRIPTION_QUOTE_NOT_FOUND` | Quote is missing or belongs to another admin |
| `409` | `FQDN_TAKEN` | Domain is globally reserved by another tenant |
| `409` | `FQDN_LAST_PRIMARY` | Keep another primary before removal |
| `409` | `FQDN_PRIMARY_CONFLICT` | Refetch after a concurrent promotion |
| `409` | `FQDN_PRIMARY_LOCKED` | Hide primary mutations for normal tenants |
| `409` | `FQDN_PLATFORM_RESERVED` | Do not submit `mutakamel.ai` secondary domains |
| `409` | `TENANT_INVALID_STATE` | Refresh lifecycle and recompute actions |
| `409` | `TENANT_UPDATE_STALE` | Reload and review the newer profile |
| `409` | `TENANT_BILLING_HOLD` | Wait for collection/refund reconciliation before soft delete |
| `409` | `TENANT_FINANCIAL_HISTORY_EXISTS` | Permanent destruction is forbidden |
| `409` | `NO_CAPACITY` | Refresh placement options or use automatic placement |
| `409` | `TENANT_CREATE_STORAGE_PLACEMENT_INCOMPLETE` | Storage catalogue exceeded its bounded safe projection; block creation and escalate |
| `409` | `SUBSCRIPTION_QUOTE_EXPIRED` | Re-quote |
| `409` | `SUBSCRIPTION_QUOTE_ALREADY_CONSUMED` | Refetch tenant for an exact create retry; otherwise re-quote |
| `409` | `SUBSCRIPTION_QUOTE_MISMATCH` | Re-quote the exact current plan |
| `409` | `IDEMPOTENCY_KEY_REUSED` | Client reused a durable key for another request |
| `422` | `TENANT_COUNTRY_INVALID` | Select a recognized country/ISO pair |
| `422` | `TENANT_STORAGE_PLACEMENT_INELIGIBLE` | Refresh Storage Server options and require a new explicit selection |
| `422` | `TENANT_STORAGE_ENTITLEMENT_INVALID` | Re-quote; the quote-derived storage quota/reservation is invalid |
| `422` | `SUBSCRIPTION_SEED_REQUIRED` | Supply cycle and non-empty module lines |
| `422` | `TENANT_PROVISIONING_MODULE_SELECTION_INVALID` | Refresh active module selection |
| `422` | `MODULE_NOT_FOUND` / `TIER_NOT_FOUND` | Selected catalogue row is inactive/missing |
| `422` | `DUPLICATE_MODULE` / `SEATS_INVALID` | Fix quote lines |
| `422` | `CORE.REVERSE_GEOCODING_NOT_FOUND` / `CORE.REVERSE_GEOCODING_INCOMPLETE` | Ask for manual address entry |
| `502` | `CORE.REVERSE_GEOCODING_FAILED` | Provider failure; manual entry remains available |
| `503` | `CORE.REVERSE_GEOCODING_UNAVAILABLE` | Provider/configuration unavailable |
| `503` | `TENANT_PROVISIONING_CONTROL_PLANE_UNAVAILABLE` | Provisioning catalogue is unavailable |
| `503` | `TENANT_PROVISIONING_CATALOG_INVALID` | Published provisioning catalogue is incomplete |
| `503` | `TENANT_STORAGE_PLACEMENT_UNAVAILABLE` | Keep the wizard draft and block creation until the catalogue is available |

The current shared error catalogue maps `FQDN_NOT_VERIFIED` to HTTP `503`
even though the FQDN service constructs a conflict. Handle the stable code and
disable promotion until the row is `VALID` with `verifiedAt`.

Operation-command errors are detailed in
[Tenant Operations and Provisioning](tenant-operations.md).

## Current frontend gaps

The `/tenants/new` authoritative catalogue and placement slice is
source-integrated:

- candidate Applications come from the ACTIVE, PUBLISHED, PUBLIC Tenant
  catalogue for INCLUDED and SUBSCRIPTION commercial modes;
- every candidate is fail-closed against its technical
  `selectionAllowed` projection and active tiers;
- Core/Worker foundations are shown only when returned by the provisioning
  preview;
- database placement refetches with the exact selected `applicationKeys`;
- Database and Storage selections accept only returned UUIDv7 values;
- quote sends UUIDv7 `items`, while create sends the matching keys in one
  nested `subscription` object;
- ambiguous create outcomes retain only a minimal status-recovery marker and
  block a new submit; no tenant DTO or PII is persisted for replay;
- success remains `PROVISIONING` and redirects with the returned tenant id.

Identity availability is now source-integrated through the canonical endpoint,
strict response parser, field-level evidence, and input-fingerprint fence.
Ambiguous tenant-create outcomes preserve only the UUIDv7 key, immutable public
tenant name, and save time in tab-scoped storage. The wizard uses read-only
exact-name status recovery and does not reconstruct or replay the create body
after reload. The primary FQDN is derived from the validated immutable tenant
name; secondary-FQDN validation remains its separate documented workflow.

The least-privilege composite create-options call and identity flow still need
authenticated runtime and browser proof against the migrated development
database.

The tenant directory and detail areas remain partial: their lifecycle, nested
access, FQDN, subscription, wallet, and operation behavior must be corrected
independently. Source integration is not authenticated runtime or deployment
proof.

## Recommended implementation sequence

1. Add exact envelopes, error normalization, tenant/FQDN models, and
   idempotency-key support.
2. Replace the directory with paginated server data and valid status/server
   filters.
3. Implement detail loading and derive only fields supported by `TenantView`.
4. Implement optimistic profile update and lifecycle permissions/states.
5. Rebuild the creation wizard around catalogue IDs/keys, database placement,
   required explicit Storage Server placement, plan preview, server quote, and
   one durable create command.
6. Poll/open the returned provisioning operation instead of marking the tenant
   active.
7. Implement FQDN preflight and add/remove; hide primary promotion for normal
   platform domains.
8. Integrate users, subscriptions, wallet, and operations as independently
   loaded and permissioned tabs.
9. Add soft-delete and permanent-destroy flows with their distinct retention
   constraints.
10. Remove mock datasets only after loading, empty, forbidden, conflict,
    retry/replay, stale, and terminal states exist.
11. Keep existing-tenant Storage Server placement read-only until the
    migration-specific safe target/revision/current-operation read model and
    live four-app, Worker, broker, Garage, monitoring, and operational release
    gates pass.

## Backend source map

Paths are relative to `C:\mutakamel.ai\frontend`:

- `../backend/mutakamel-apps/api-gateway-app/src/routing-proxy/route-contracts/core.route-contracts.ts`
- `../backend/mutakamel-apps/api-gateway-app/src/idempotency/gateway-idempotency.service.ts`
- `../backend/mutakamel-apps/core-app/src/admin/tenants/tenants.controller.ts`
- `../backend/mutakamel-apps/core-app/src/admin/tenants/tenants.service.ts`
- `../backend/mutakamel-apps/core-app/src/admin/tenants/tenant-storage-placement.service.ts`
- `../backend/mutakamel-apps/core-app/src/admin/tenants/dto/create-tenant.dto.ts`
- `../backend/mutakamel-apps/core-app/src/admin/tenants/dto/update-tenant.dto.ts`
- `../backend/mutakamel-apps/core-app/src/admin/tenants/tenant-identity-validation.service.ts`
- `../backend/mutakamel-apps/core-app/src/admin/tenants/tenant-address-geocoding.service.ts`
- `../backend/mutakamel-apps/core-app/src/admin/tenants/fqdn-validation.controller.ts`
- `../backend/mutakamel-apps/core-app/src/admin/tenants/fqdn-validation.service.ts`
- `../backend/mutakamel-apps/core-app/src/admin/tenants/fqdn-policy.ts`
- `../backend/mutakamel-apps/core-app/src/admin/tenants/dto/`
- `../backend/mutakamel-apps/core-app/src/admin/tenants/repo/`
- `../backend/mutakamel-apps/core-app/src/admin/subscriptions/subscription-v2.controller.ts`
- `../backend/mutakamel-apps/core-app/src/admin/subscriptions/subscription-items.service.ts`
- `../backend/mutakamel-apps/core-app/src/admin/subscriptions/dto/subscription-item.dto.ts`
- `../backend/mutakamel-apps/core-app/src/admin/database-servers/database-servers.service.ts`
- `../backend/mutakamel-apps/core-app/src/admin/tenants/provisioning/tenant-provisioning-plan.service.ts`
- `../backend/mutakamel-apps/core-app/packages/contracts/src/events/tenant-provisioning-v2.events.ts`
- `../backend/mutakamel-apps/core-app/packages/common/src/enums/tenant-status.enum.ts`
- `../backend/mutakamel-apps/core-app/packages/database/src/entities/control-plane/tenant.entity.ts`
- `../backend/mutakamel-apps/core-app/packages/database/src/entities/control-plane/tenant-fqdn.entity.ts`
- `../backend/mutakamel-apps/core-app/src/common/i18n/core-error-catalog.ts`
