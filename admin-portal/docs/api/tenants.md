# Admin Tenants Frontend Contract

Verified against the current API Gateway route contracts, Core controllers,
DTOs, services, repositories, entities, subscription quoting, provisioning
contracts, error catalogue, and active Admin Portal screens on
**2026-07-29**.

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
| Current integration | Partial reads with contract-breaking mock/simulated mutations; creation remains fully simulated |

The Gateway currently exposes exactly **61** routes whose browser paths start
with `/api/admin/core/v1/tenants`. They are divided as follows:

| Family | Count | Detailed reference |
|:---|---:|:---|
| Tenant creation, registry, lifecycle, and FQDNs | 18 | This document |
| Operation history and tenant-scoped provisioning | 16 | [Tenant Operations and Provisioning](tenant-operations.md) |
| Tenant users and access catalogues | 18 | [Tenant Users](tenant-users.md) |
| Subscription and billing summary | 4 | [Subscriptions](subscriptions.md), [Invoices](invoices.md) |
| Wallet, ledger, adjustments, and payments | 5 | [Wallet and Ledger](wallet.md) |

The creation wizard also needs two Core routes outside that 61-route prefix:
the FQDN preflight and subscription quote documented below.

Browser code must use the canonical Gateway paths. Controller-relative
`/admin/tenants/...` paths are not frontend URLs.

### Other nested tenant routes in the 61-route inventory

These nine routes complete the accounting above. Their detailed DTOs and
response models live in the linked domain documents.

| Method and browser path | Permission | Success | Idempotency key | Detailed reference |
|:---|:---|:---:|:---:|:---|
| `GET /api/admin/core/v1/tenants/:tenantId/subscription` | `admin.subscriptions.read` | `200` | No | [Subscriptions](subscriptions.md) |
| `GET /api/admin/core/v1/tenants/:tenantId/subscription/items` | `admin.subscriptions.read` | `200` | No | [Subscriptions](subscriptions.md) |
| `GET /api/admin/core/v1/tenants/:tenantId/billing-summary` | `admin.invoices.read` | `200` | No | [Invoices](invoices.md) |
| `POST /api/admin/core/v1/tenants/:tenantId/subscription` | `admin.subscriptions.create` | `201` | Yes | [Subscriptions](subscriptions.md) |
| `GET /api/admin/core/v1/tenants/:tenantId/wallet` | `admin.wallet.read` | `200` | No | [Wallet and Ledger](wallet.md) |
| `GET /api/admin/core/v1/tenants/:tenantId/wallet/ledger` | `admin.wallet.read` | `200` | No | [Wallet and Ledger](wallet.md) |
| `POST /api/admin/core/v1/tenants/:tenantId/wallet/adjustments/preview` | `admin.wallet.manage` | `201` | Yes | [Wallet and Ledger](wallet.md) |
| `POST /api/admin/core/v1/tenants/:tenantId/wallet/adjustments` | `admin.wallet.manage` | `201` | Yes | [Wallet and Ledger](wallet.md) |
| `GET /api/admin/core/v1/tenants/:tenantId/payments` | `admin.wallet.read` | `200` | No | [Wallet and Ledger](wallet.md) |

## Tenant-shell endpoint summary

`Idempotency key` means an `x-idempotency-key` header containing a UUIDv7
generated for one mutation intent.

### Creation and directory

| Method and browser path | Permission | Success | Idempotency key | Purpose |
|:---|:---|:---:|:---:|:---|
| `POST /api/admin/core/v1/tenants/validate-identity` | `admin.tenants.create` | `200` | No | Check name and company-name availability |
| `GET /api/admin/core/v1/tenants/database-placement-options` | `admin.tenants.create` | `200` | No | List currently eligible manual-placement servers |
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
| `POST /api/admin/core/v1/tenants/:id/suspend` | `admin.tenants.suspend` | `201` | Yes | Suspend an active tenant |
| `POST /api/admin/core/v1/tenants/:id/activate` | `admin.tenants.suspend` | `201` | Yes | Reactivate a suspended tenant |
| `POST /api/admin/core/v1/tenants/:id/reprovision` | `admin.tenants.reprovision` | `202` | Yes | Compatibility retry of the latest failed/cancelled operation |
| `POST /api/admin/core/v1/tenants/:id/provisioning/cancel` | `admin.tenants.reprovision` | `202` | Yes | Compatibility cancellation of the latest active operation |
| `DELETE /api/admin/core/v1/tenants/:id` | `admin.tenants.delete` | `204` | Yes | Soft-delete a tenant |
| `DELETE /api/admin/core/v1/tenants/:id/destroy` | `admin.tenants.destroy` | `204` | Yes | Permanently destroy an eligible soft-deleted tenant |

### FQDNs

| Method and browser path | Permission | Success | Idempotency key | Purpose |
|:---|:---|:---:|:---:|:---|
| `POST /api/admin/core/v1/tenant-fqdns/validate` | Either `admin.tenants.create` or `admin.tenants.manage_fqdns` | `200` | No | Validate availability, DNS, and routing before attachment |
| `POST /api/admin/core/v1/tenants/:id/fqdns` | `admin.tenants.manage_fqdns` | `201` | Yes | Attach a secondary domain |
| `DELETE /api/admin/core/v1/tenants/:id/fqdns/:fqdnId` | `admin.tenants.manage_fqdns` | `204` | Yes | Remove a secondary domain |
| `POST /api/admin/core/v1/tenants/:id/fqdns/:fqdnId/primary` | `admin.tenants.manage_fqdns` | `204` | Yes | Legacy-only primary-domain promotion |

The FQDN validator uses **ANY** permission semantics. Every tenant-prefixed
write above has a `WRITE_SENSITIVE`, `idempotent: true` Gateway contract,
including update, lifecycle, delete, and destroy routes.

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
catalogue selections
  -> identity/FQDN/database-placement checks
  -> explicit Storage Server selection
  -> provisioning-plan preview
  -> subscription quote
  -> POST tenant with quoteId + storageServerId + UUIDv7 command key
  -> tenant returned as PROVISIONING
  -> poll operation/detail until terminal state
```

The preview is evidence for the UI only. Creation rebuilds and pins its own
transactional plan from the subscription’s module selection.

### 1. Validate tenant identity

`POST /api/admin/core/v1/tenants/validate-identity`

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

The tenant name is immutable after creation and generates the platform-owned
primary domain `<name>.mutakamel.ai`.

### 2. Validate secondary FQDNs

`POST /api/admin/core/v1/tenant-fqdns/validate`

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

### 3. Load manual database placement options

`GET /api/admin/core/v1/tenants/database-placement-options`

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

This is a bounded object under `data`, not a paginated response. It contains
only active servers that have spare capacity and every required provisioning
and runtime credential. Items are sorted by name.

For automatic placement, omit `databaseServerId`. Core selects an eligible
server in the chosen country with the most spare capacity. For manual
placement, send the selected UUIDv7. Do not send `placementMode`.

### 4. Load and select Storage Server placement

`GET /api/admin/core/v1/tenants/storage-placement-options`

Permission: `admin.tenants.create`.

```ts
interface TenantCreateStoragePlacementOptionsView {
  items: Array<{
    id: string;
    name: string;
    provider: "GARAGE";
    region: string;
    status: "ACTIVE";
    availabilityClass: "HA_PRODUCTION_READY";
    currentTenants: number;
    retainedTenants: number;
    reservedTenants: number;
    maxTenants: number;
    capacityPercent: number;
    allocatableCapacityBytes: string;
    availableReservationBytes: string;
  }>;
  total: number;
}
```

The response carries `Cache-Control: private, no-store` and is a bounded object
under `data`, not a paginated envelope. It
contains at most 200 eligible rows sorted by name. It deliberately omits:

- internal and public endpoints;
- bucket names and class bindings;
- credential references and credential material;
- topology-member and encrypted-volume details;
- recovery-destination details.

Every returned row is currently `ACTIVE`, `GENERAL`,
`HA_PRODUCTION_READY`, healthy, below the critical capacity threshold, and
backed by current topology, encrypted-volume, bucket,
principal-verification, and recovery evidence. Capacity observations and
topology snapshots must be no older than 15 minutes, and the independent
isolated-restore evidence must be no older than 180 days. Core re-locks and
revalidates the selected row during creation, so a listed row can still become
ineligible before submission.

The admin must explicitly select exactly one item and submit its UUIDv7 as
`storageServerId`. There is no automatic Storage Server placement, hidden
default, fallback, or client-side substitution. An empty list is a blocking
state: keep the form draft, explain that no production-ready storage target is
available, and do not enable tenant creation.

Byte counters are decimal strings and require `BigInt`-safe formatting. The
numeric `capacityPercent` is display evidence only; do not use it to re-create
Core's eligibility rules.

Example response:

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "019f0000-0000-7000-8000-000000000030",
        "name": "Primary Garage Cluster",
        "provider": "GARAGE",
        "region": "garage",
        "status": "ACTIVE",
        "availabilityClass": "HA_PRODUCTION_READY",
        "currentTenants": 12,
        "retainedTenants": 1,
        "reservedTenants": 0,
        "maxTenants": 100,
        "capacityPercent": 28.5,
        "allocatableCapacityBytes": "1099511627776",
        "availableReservationBytes": "824633720832"
      }
    ],
    "total": 1
  },
  "correlationId": "019f0000-0000-7000-8000-000000000090",
  "timestamp": "2026-07-28T08:00:00.000Z"
}
```

### 5. Reverse-geocode an optional map selection

`POST /api/admin/core/v1/tenants/reverse-geocode`

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

### 6. Preview provisioning

`POST /api/admin/core/v1/tenants/provisioning-plans`

```ts
interface PreviewTenantProvisioningDto {
  moduleKeys: string[];
}

interface TenantProvisioningSelectionPreviewV2 {
  contractVersion: 2;
  selectedModuleKeys: string[];
  selectionDigest: string;
  components: TenantProvisioningComponentPlanV2[];
  steps: TenantProvisioningStepPlanV2[];
  prerequisites?: TenantProvisioningPrerequisitePlanV2[];
}
```

`moduleKeys` is normalized to lowercase, must contain 1–50 unique strings, and
each key must match `^[a-z][a-z0-9_-]{0,63}$`. The service also requires each
selected module to be active and have a valid published component/release
catalogue. Foundation and dependency components are expanded automatically.

Render component and step arrays from the response. The current frontend’s
three-field `components: string[]`/`stepsCount` mock loses important dependency,
release, checksum, seed, and activation evidence.

### 7. Obtain the subscription quote

Tenant creation requires a short-lived quote from a route outside the tenant
prefix:

`POST /api/admin/core/v1/subscriptions/quote`

Permission: `admin.catalog.read`. This route is an authenticated read-like
POST and does not require an idempotency header.

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

The creation page therefore needs both `admin.tenants.create` and
`admin.catalog.read`. A user lacking catalogue read cannot complete the
server-priced wizard.

### 8. Create the tenant

`POST /api/admin/core/v1/tenants`

Preferred request shape:

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
  databaseServerId?: string;
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
  billingCycle: BillingCycleEnum;
  currencyCode?: "USD";
  trialDays?: number;
  modules: Array<{
    moduleKey: string;
    tierKey: string;
    seats: number;
  }>;
}
```

The DTO also accepts a legacy nested `subscription` object and legacy
`allowedUsers`/`addons` fields. New frontend code should use one canonical
shape and must not send `allowedUsers` or `addons`: provisioning derives seats
and module access from the priced module lines.

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
| `databaseServerId` | Optional UUIDv7; omission means automatic placement |
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
- publishes the immutable V2 plan through the outbox.

Physical database creation, migrations, seeds, owner creation/invitation, and
the final transition to `ACTIVE` are asynchronous. Do not optimistically mark
the returned tenant active. Core creates no S3 folder marker: tenant storage
namespaces are virtual and are derived by the Storage V2 runtime from the
persisted assignment.

## Tenant directory

`GET /api/admin/core/v1/tenants`

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
member, or recovery fields.

### Update profile

`PATCH /api/admin/core/v1/tenants/:id`

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
`PATCH /tenants/:id` DTO does not accept `storageServerId`, and there is no
Admin Gateway route for a direct storage move.

Do not put a Storage Server selector in existing-tenant profile edit, do not
send `storageServerId` as an unknown field, and do not mutate the displayed
assignment optimistically. A future move requires a dedicated, fenced Storage
V2 migration workflow with retained historical assignment and rollback
evidence. Until that contract exists, the UI may link read-permitted admins to
`/storage-servers/[storageServerId]`, but must not offer a “change storage”
action.

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
| Load/select database and Storage Server placement options | `admin.tenants.create` |
| Read selectable modules/tiers and obtain quote | `admin.catalog.read` |
| Read directory/detail/operations | `admin.tenants.read` |
| Edit profile | `admin.tenants.update` |
| Suspend/activate | `admin.tenants.suspend` |
| Retry/cancel provisioning | `admin.tenants.reprovision` |
| Add/remove/preflight FQDNs | `admin.tenants.manage_fqdns` (create permission also permits preflight) |
| Soft delete | `admin.tenants.delete` |
| Permanent destroy | `admin.tenants.destroy` |

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

The active implementation under `src/app/tenants/` is a partial,
contract-breaking prototype:

1. The directory and detail hooks perform some real requests, but they use
   loose/invented response types, suppress errors to the console, and do not
   implement permission, forbidden, conflict, or independent error states.
2. List lifecycle, retry, and delete issue incorrect or incomplete operations
   and still apply optimistic local assumptions.
3. The list type uses invalid `FAILED`; the transport value is
   `PROVISIONING_FAILED`.
4. The list invents `code`, `primaryFqdn`, `planName`, and direct `seats`
   fields.
5. Summary cards count local mock/page rows; no tenant aggregate endpoint
   exists.
6. Mock database-server ids such as `srv-eg-01` fail UUIDv7 validation.
7. The creation wizard has no `quoteId`, subscription quote call,
   `storageServerId`, or Storage Server placement-options call.
8. It sends flattened address fields instead of required nested `address`.
9. It invents `placementMode`, `selectedModules`, and `YEARLY`.
10. It selects currency `EGP`, although subscription pricing/settlement is
    fixed to `USD`.
11. It sends aggregate `allowedUsers`; real access comes from per-module
    `tierKey` and `seats`.
12. Identity and plan preview handlers are delays with fabricated success.
13. The mocked plan loses release, dependency, checksum, seed, prerequisite,
    and activation evidence.
14. Detail reads are partial, while profile/lifecycle/destruction actions are
    simulated or use wrong methods. Profile save currently sends `PUT` instead
    of `PATCH` and omits `expectedUpdatedAt`.
15. FQDN rows use invented `domain`, `type`, and `VERIFIED` fields instead of
    `fqdn`, `isPrimary`, and `validationStatus`.
16. The detail page offers primary changes that are locked for normal generated
    platform domains.
17. Operations use invalid types/statuses such as `TENANT_PROVISIONING`,
    `MODULE_ENABLEMENT`, and `COMPLETED`.
18. Subscription cancellation writes invalid `CANCELED` instead of
    `CANCELLED`.
19. Wallet amounts and rates are JavaScript numbers with hard-coded FX
    arithmetic rather than server decimal strings and preview/commit evidence.
20. No mutation supplies the required UUIDv7 idempotency header.
21. Loading, empty, independent forbidden-tab, validation, stale-update,
    conflict, in-flight, replay, and terminal provisioning states are absent.
22. List and detail types omit the safe `storageServerId` and `storageServer`
    placement summary.
23. Existing-tenant edit has no read-only storage placement treatment and must
    not invent a direct selector/move API.

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
11. Keep existing-tenant Storage Server placement read-only until a dedicated
    fenced migration API exists.

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
