# Admin Modules and Catalogue Frontend Contract

Verified against the current API Gateway route contracts, Core controller,
DTOs, services, repositories, entities, error catalogue, idempotency layers,
and active Admin Portal screens on **2026-07-24**.

This is the implementation contract for the Admin Portal’s `/modules` feature:
modules, tiers, features, tier-feature grants, graduated price ladders, and
managed billing currency rates.

## Ownership and route prefixes

| Concern | Contract |
|:---|:---|
| Backend owner | `core-app` |
| Browser module prefix | `/api/admin/core/v1/modules` |
| Other browser prefixes | `/api/admin/core/v1/tiers`, `/api/admin/core/v1/features`, `/api/admin/core/v1/billing/currency-rates` |
| Core upstream prefix | `/api/v1/admin/...` |
| Guard | `AdminGuard` |
| Entity identifiers | UUIDv7; the currency-rate path instead uses a normalized three-letter code |
| Frontend routes | `/modules`, `/modules/[id]`; `/module` only redirects to `/modules` |
| Current frontend status | Fully mocked local state and simulated saves; no catalogue request is implemented |

Browser code must use the canonical API Gateway paths below. The shorter
`/admin/...` forms are Nest controller-relative paths only.

## Endpoint summary

`Idempotency key` means an `x-idempotency-key` header containing a newly
generated UUIDv7 for the user’s mutation intent.

### Modules

| Method and browser path | Permission | Success | Idempotency key | Purpose |
|:---|:---|:---:|:---:|:---|
| `POST /api/admin/core/v1/modules` | `admin.catalog.manage` | `201` | No | Create and append a module |
| `GET /api/admin/core/v1/modules` | `admin.catalog.read` | `200` | No | Paginated ranked module list |
| `GET /api/admin/core/v1/modules/:id` | `admin.catalog.read` | `200` | No | Get one module by UUIDv7 |
| `PATCH /api/admin/core/v1/modules/:id/rank` | `admin.catalog.manage` | `200` | Yes | Move one module to another module’s position |
| `PATCH /api/admin/core/v1/modules/:id` | `admin.catalog.manage` | `200` | Yes | Update mutable module fields |
| `DELETE /api/admin/core/v1/modules/:id` | `admin.catalog.destroy` | `204` | Yes | Soft-delete an unused module |

### Tiers and features

| Method and browser path | Permission | Success | Idempotency key | Purpose |
|:---|:---|:---:|:---:|:---|
| `POST /api/admin/core/v1/modules/:moduleId/tiers` | `admin.catalog.manage` | `201` | No | Append a tier |
| `GET /api/admin/core/v1/modules/:moduleId/tiers` | `admin.catalog.read` | `200` | No | Complete tier list, rank order |
| `PATCH /api/admin/core/v1/tiers/:id` | `admin.catalog.manage` | `200` | Yes | Update a tier |
| `DELETE /api/admin/core/v1/tiers/:id` | `admin.catalog.manage` | `204` | Yes | Soft-delete an unused tier |
| `POST /api/admin/core/v1/modules/:moduleId/features` | `admin.catalog.manage` | `201` | No | Append/create a feature |
| `GET /api/admin/core/v1/modules/:moduleId/features` | `admin.catalog.read` | `200` | No | Complete feature list, rank order |
| `PATCH /api/admin/core/v1/features/:id` | `admin.catalog.manage` | `200` | Yes | Update a feature |
| `DELETE /api/admin/core/v1/features/:id` | `admin.catalog.manage` | `204` | Yes | Soft-delete a feature |

### Grants, pricing, and currency rates

| Method and browser path | Permission | Success | Idempotency key | Purpose |
|:---|:---|:---:|:---:|:---|
| `GET /api/admin/core/v1/tiers/:tierId/features` | `admin.catalog.read` | `200` | No | List one tier’s grants |
| `PATCH /api/admin/core/v1/tiers/:tierId/features` | `admin.catalog.manage` | `200` | Yes | Replace one tier’s complete grant set |
| `GET /api/admin/core/v1/tiers/:tierId/price-tiers` | `admin.catalog.read` | `200` | No | List one or both billing-cycle ladders |
| `PATCH /api/admin/core/v1/tiers/:tierId/price-tiers` | `admin.catalog.manage` | `200` | Yes | Replace one complete price ladder |
| `GET /api/admin/core/v1/billing/currency-rates` | `admin.catalog.read` | `200` | No | List managed non-USD rates |
| `PATCH /api/admin/core/v1/billing/currency-rates` | `admin.billing.currency.manage` | `200` | Yes | Upsert a non-empty batch of rates |
| `PATCH /api/admin/core/v1/billing/currency-rates/:currencyCode` | `admin.billing.currency.manage` | `200` | Yes | Upsert one managed rate |

There are exactly **21** browser-visible catalogue routes.

## HTTP response and error envelopes

Core success responses pass through the Gateway unchanged:

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

Only the module list has pagination `meta`. All other catalogue GET lists and
replacement results are arrays under `data` without `meta`. Successful
`DELETE` responses are HTTP `204` with no body.

The browser can receive two error shapes:

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

Core domain/DTO errors use `errorCode`. Gateway rejections—such as a missing
idempotency key—use RFC-style Problem Details with `code`. The shared client
should normalize both without discarding `correlationId`.

```ts
function apiErrorCode(error: CoreErrorResponse | GatewayProblemDetails) {
  return "errorCode" in error ? error.errorCode : error.code;
}
```

## Idempotency rules

The Gateway requires `x-idempotency-key: <UUIDv7>` for every catalogue route
shown as `Yes` in the endpoint tables. This includes ordinary update, reorder,
and delete routes because their Gateway contracts are `WRITE_SENSITIVE` and
`idempotent: true`.

For one user intent:

1. Generate one UUIDv7 before sending.
2. Reuse the same key only when retrying the exact same method, path, query,
   actor scope, and body.
3. Generate a new key after any payload/resource change.
4. Treat `GW.IDEM.IN_FLIGHT` as still processing; do not generate a second
   mutation automatically.
5. Treat `GW.IDEM.MISMATCH` or `IDEMPOTENCY_KEY_REUSED` as a client-command
   bug, not a retryable field error.

The tier-feature, price-ladder, and both currency-rate mutation endpoints also
persist durable Core command records. Exact retries can replay their stored
result after the Gateway’s shorter replay window has expired.

The three create routes are intentionally not Gateway-idempotent and do not
require the header. Disable duplicate submits. If their response is lost,
refetch by the unique key before offering a retry.

## Transport enums and booleans

```ts
enum BillingCycleEnum {
  MONTHLY = "MONTHLY",
  ANNUAL = "ANNUAL",
}
```

There is no module-status, feature-value-type, or feature-default-value enum in
this API. Modules, tiers, features, and currency rates use `isActive: boolean`.

Strict boolean DTO fields accept `true`, `false`, `"true"`, `"false"`, `"1"`,
and `"0"`. Send JSON booleans from frontend bodies and query booleans as
`true`/`false`.

## Response models

Dates below are serialized ISO timestamps.

```ts
interface ModuleView {
  id: string;
  key: string;
  name: string;
  description: string | null;
  avatarDataUrl: string | null;
  rank: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface TierView {
  id: string;
  moduleId: string;
  key: string;
  name: string;
  rank: number;
  color: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface FeatureView {
  id: string;
  moduleId: string;
  key: string;
  name: string;
  description: string | null;
  rank: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface TierFeatureGrantView {
  id: string;
  tierId: string;
  featureId: string;
  config: Record<string, unknown> | null;
  configRevision: number;
  createdAt: string;
  updatedAt: string;
}

interface PriceTierView {
  id: string;
  tierId: string;
  billingCycle: BillingCycleEnum;
  minUsers: number;
  maxUsers: number | null;
  unitPrice: string;
  createdAt: string;
  updatedAt: string;
}

interface CurrencyRateView {
  currencyCode: string;
  currencyUnitsPerUsd: string;
  isActive: boolean;
}
```

The API does **not** return:

- module `status` values such as `ACTIVE`, `BETA`, or `DEPRECATED`;
- module `category`;
- `tiersCount` or `featuresCount` in `ModuleView`;
- feature `valueType` or `defaultValue`;
- grant `isEnabled` or `value`;
- price `YEARLY`, `unitPriceUsd`, or a numeric price;
- currency revision IDs, provider metadata, or rate history.

Adapt labels at the frontend boundary:

```ts
const moduleRow = {
  id: module.id,
  moduleKey: module.key,
  moduleName: module.name,
  description: module.description ?? "",
  rank: module.rank,
  isActive: module.isActive,
};

const priceRow = {
  ...priceTier,
  unitPriceUsd: priceTier.unitPrice, // display alias only; keep as string
};
```

Do not recreate fake transport fields simply to preserve the current mock
interfaces.

## Modules

### List modules

`GET /api/admin/core/v1/modules`

```ts
interface ModuleQueryDto {
  page?: number; // integer >= 1; default 1
  limit?: number; // integer 1..100; default 20
  sortBy?: string; // max 100, but ignored by this service
  sortDir?: "ASC" | "DESC"; // accepted, but ignored
  search?: string; // max 200
  isActive?: boolean;
}

type ModuleListResponse = SuccessResponse<ModuleView[]> & {
  meta: NonNullable<SuccessResponse<ModuleView[]>["meta"]>;
};
```

Search covers `key` and `name`, not description. The service always sorts by
`rank ASC`, then `key ASC`; inherited `sortBy` and `sortDir` inputs do not
change that order.

The response has no tier or feature counts. Do not issue hidden per-row N+1
requests merely to preserve the mock badges. Either omit those badges, load
counts only after opening a module, or add a dedicated aggregate backend
projection in a separate backend task.

The summary bar’s active-currency count requires the independent currency-rate
GET and is not part of the module list.

### Create a module

`POST /api/admin/core/v1/modules`

```ts
interface CreateModuleDto {
  key: string;
  name: string;
  description?: string;
  avatarDataUrl?: string;
  isActive?: boolean;
}
```

| Field | Validation/behavior |
|:---|:---|
| `key` | Trimmed, max `64`, globally unique, immutable, pattern `^[a-z][a-z0-9_]*$` |
| `name` | Required non-empty string, max `128`; backend does not trim it |
| `description` | Optional string, max `512`; defaults to `null` |
| `avatarDataUrl` | Optional PNG base64 data URL only, max `2,000,000` characters |
| `isActive` | Optional strict boolean; default `true` |
| `rank` | Not accepted; server appends at current highest rank + 1 |

Example:

```json
{
  "key": "analytics",
  "name": "Analytics",
  "description": "Reporting and analytics capabilities.",
  "isActive": true
}
```

Trim `name`/`description` in the UI and reject a whitespace-only name even
though only `key` is backend-trimmed.

The Gateway’s default request limit is configured by `MAX_BODY_BYTES`
(default `1,048,576` bytes), which is lower than the DTO’s two-million
character avatar ceiling. Keep the complete JSON request below the deployed
Gateway limit; oversized requests return HTTP `413` with
`GW.BODY.TOO_LARGE`.

### Get and route to one module

`GET /api/admin/core/v1/modules/:id`

`:id` is the module UUIDv7, not `key`. The list must link to:

```tsx
<Link href={`/modules/${module.id}`}>...</Link>
```

The active mock currently links to `/modules/${module.moduleKey}` and therefore
cannot call the real detail endpoint.

There is no single “complete module detail” endpoint. After loading the module,
fetch tiers and features by its `id`; fetch grants/prices only for the visible
tier or tab.

### Update a module

`PATCH /api/admin/core/v1/modules/:id`

```ts
interface UpdateModuleDto {
  name?: string; // max 128
  description?: string; // max 512
  avatarDataUrl?: string | null; // null clears it
  isActive?: boolean;
}
```

`key` and `rank` are immutable here. Use the rank command for module order.
The current update DTO permits an empty `name`; frontend validation should
continue to require a trimmed non-empty value. `description: null` is rejected;
send an empty string if the product chooses that as its clear representation.

Changing `isActive` rebuilds affected tenants’ access-policy projections and
expires their access-policy cache. Show an impact warning before deactivation;
the mutation is not presentation-only.

### Reorder modules

`PATCH /api/admin/core/v1/modules/:id/rank`

```ts
interface ReorderModuleDto {
  targetId: string; // UUIDv7
}
```

The source is moved to the target’s original list position and every module is
renumbered to contiguous ranks starting at `1`. Sending the same source and
target is a no-op. The response contains only the moved `ModuleView`; refetch
the paginated list after success because every row’s rank may have changed.

Do not compute and PATCH a numeric module rank—the API does not accept one.

### Delete a module

`DELETE /api/admin/core/v1/modules/:id`

Deletion is soft-delete and succeeds only when no non-deleted subscription
item references the module. `MODULE_IN_USE` means the operator must deactivate
the module instead. On `204`, remove/refetch the row and leave no fake
`DELETED` status.

## Tiers

### List tiers

`GET /api/admin/core/v1/modules/:moduleId/tiers`

Returns `SuccessResponse<TierView[]>` ordered by `rank ASC`. This is a bounded,
complete list rather than a paginated endpoint:

- maximum supported rows: `100`;
- no query parameters;
- no pagination `meta`;
- a valid but missing `moduleId` currently returns an empty list instead of
  `MODULE_NOT_FOUND`.

There is no `GET /tiers/:id` route. Resolve a tier from the module’s complete
tier list.

### Create a tier

`POST /api/admin/core/v1/modules/:moduleId/tiers`

```ts
interface CreateTierDto {
  key: string;
  name: string;
  color?: string;
  isActive?: boolean;
}
```

| Field | Validation/behavior |
|:---|:---|
| `key` | Trimmed, max `64`, unique within its module, immutable, pattern `^[a-z][a-z0-9_]*$` |
| `name` | Required non-empty string, max `128`; not trimmed by backend |
| `color` | Optional, trimmed, exact six-digit hex such as `#0b6ff4`; default `#3b82f6` |
| `isActive` | Optional strict boolean; default `true` |
| `rank` | Unknown/rejected on create; server appends after the last tier |

### Update a tier

`PATCH /api/admin/core/v1/tiers/:id`

```ts
interface UpdateTierDto {
  name?: string; // max 128
  rank?: number; // integer >= 0
  color?: string; // six-digit hex
  isActive?: boolean;
}
```

`key` and `moduleId` are immutable. The update DTO permits an empty `name`, so
the UI should enforce a trimmed non-empty name.

There is no atomic tier-reorder endpoint. `rank` writes one numeric value
directly, while `(moduleId, rank)` is unique. Swapping two occupied contiguous
ranks with independent updates will conflict and can partially apply. Do not
wire the current tier up/down controls as a multi-request swap; hide them until
the backend provides an atomic reorder command, or obtain a separate backend
design for sparse ranks.

Changing `isActive` rebuilds affected tenant policies and invalidates their
access-policy cache.

### Delete a tier

`DELETE /api/admin/core/v1/tiers/:id`

Soft-delete is blocked by any non-deleted subscription item referencing the
tier (`TIER_IN_USE`). There is no separate `admin.catalog.destroy` requirement;
the route uses `admin.catalog.manage`.

## Features

### List features

`GET /api/admin/core/v1/modules/:moduleId/features`

Returns `SuccessResponse<FeatureView[]>`, ordered by `rank ASC` then `key ASC`.
It is a complete bounded list:

- maximum supported rows: `200` per module;
- no query parameters or pagination `meta`;
- a valid but missing `moduleId` currently returns an empty list.

There is no `GET /features/:id` route.

### Create a feature

`POST /api/admin/core/v1/modules/:moduleId/features`

```ts
interface CreateFeatureDto {
  key: string;
  name: string;
  description?: string;
  rank?: number;
  isActive?: boolean;
}
```

| Field | Validation/behavior |
|:---|:---|
| `key` | Trimmed, globally unique, immutable, max `96`, dot-scoped lowercase pattern `^[a-z][a-z0-9_]*(\.[a-z0-9_]+)+$` |
| `name` | Required non-empty string, max `128`; backend does not trim |
| `description` | Optional string, max `512`; defaults to `null` |
| `rank` | Optional integer `>= 0`; defaults after current highest feature rank, with the first default rank `0` |
| `isActive` | Optional strict boolean; default `true` |

The service does not enforce that the first key segment matches the parent
module’s key. The UI should prefill and validate that product convention, but
must not describe it as a backend constraint.

`valueType` and `defaultValue` are not accepted. Feature-specific limits and
settings belong in a tier grant’s `config`.

### Update and delete features

```ts
interface UpdateFeatureDto {
  name?: string; // max 128
  description?: string; // max 512
  rank?: number; // integer >= 0
  isActive?: boolean;
}
```

- Update: `PATCH /api/admin/core/v1/features/:id`
- Delete: `DELETE /api/admin/core/v1/features/:id`

`key` and `moduleId` are immutable. Feature ranks do not have a uniqueness
constraint; ties are resolved by key in list reads.

Changing `isActive` or deleting a feature rebuilds affected tenant access
policies. Feature deletion is a soft-delete and currently does not explicitly
delete existing tier-feature rows. After deletion, refetch both features and
grants, tolerate a grant whose feature is no longer in the visible catalogue,
and replace affected tier grant sets to revoke stale entries.

There is no bulk feature-import API. Client-side JSON export is possible from
the fetched list. Importing by sequential create calls is not atomic and can
partially succeed; the production UI must show per-row results and must not
label the operation a single transactional import.

## Tier-feature grants

### Read grants

`GET /api/admin/core/v1/tiers/:tierId/features`

Returns `SuccessResponse<TierFeatureGrantView[]>`, up to `500` complete grants.
The response does not join feature names or keys; combine it with the
module-feature list by `featureId`.

Grant presence means enabled:

```ts
const grantByFeatureId = new Map(
  grants.map((grant) => [grant.featureId, grant]),
);

const isEnabled = grantByFeatureId.has(feature.id);
```

### Replace grants

`PATCH /api/admin/core/v1/tiers/:tierId/features`

```ts
interface TierFeatureGrantDto {
  featureId: string; // UUIDv7
  config?: Record<string, unknown>;
}

interface SetTierFeaturesDto {
  features: TierFeatureGrantDto[]; // 0..500
}
```

This is a **complete replacement**, not an incremental toggle:

- send every grant that must remain for that one tier;
- `features: []` revokes every grant;
- duplicate `featureId` values are rejected;
- every feature must exist and belong to the tier’s module;
- omitted `config` persists as `null`;
- the response is the complete replacement snapshot, sorted by `featureId`;
- a new grant starts at `configRevision: 1`;
- changing canonical config increments `configRevision`;
- resending identical config preserves the existing row and revision.

The current matrix edits multiple tiers in one local state collection. Save it
as one independent full-replacement command per changed tier, each with its own
idempotency key. Do not send one global matrix body.

### Special CRM outbound-email config

For the feature key `crm.outbound_email`, `config` is closed and must contain
exactly:

```ts
interface CrmOutboundEmailFeaturePolicyV1 {
  dailyQuota: number; // integer 1..1,000,000
  rateLimitPerMin: number; // integer 1..10,000
}
```

Missing keys, additional keys, floats, and unlimited/null values return
`CRM_OUTBOUND_EMAIL_POLICY_INVALID`.

All successful grant replacements rebuild affected tenant access policies and
expire their policy cache.

## Graduated price ladders

### Read price ladders

`GET /api/admin/core/v1/tiers/:tierId/price-tiers`

Optional query:

```ts
type BillingCycleQuery = "MONTHLY" | "ANNUAL";
```

Examples:

```text
GET /api/admin/core/v1/tiers/<tier-uuid>/price-tiers
GET /api/admin/core/v1/tiers/<tier-uuid>/price-tiers?billingCycle=MONTHLY
GET /api/admin/core/v1/tiers/<tier-uuid>/price-tiers?billingCycle=ANNUAL
```

The response is `SuccessResponse<PriceTierView[]>`, never paginated. A
cycle-filtered read supports up to `100` brackets; an all-cycle read supports
up to `200`.

The controller currently reads `billingCycle` as an undecorated query string,
so an invalid value can produce an empty filtered result instead of HTTP
`400`. The UI must constrain it to `MONTHLY | ANNUAL`; do not use that backend
gap as an extension point.

### Replace one price ladder

`PATCH /api/admin/core/v1/tiers/:tierId/price-tiers`

```ts
interface PriceBracketDto {
  minUsers: number;
  maxUsers?: number | null;
  unitPrice: string;
}

interface SetPriceTiersDto {
  billingCycle: BillingCycleEnum;
  brackets: PriceBracketDto[];
}
```

DTO rules:

| Field | Rule |
|:---|:---|
| `billingCycle` | Exactly `MONTHLY` or `ANNUAL` |
| `brackets` | Required non-empty array, maximum `100` |
| `minUsers` | Integer `1..2,147,483,647` |
| `maxUsers` | `null`/omitted for infinity, otherwise integer `1..2,147,483,647` |
| `unitPrice` | Required decimal **string**, non-negative, max 14 whole digits and 4 fractional digits |

Whole-ladder rules:

1. First bracket starts at `minUsers: 1`.
2. Each finite `maxUsers` may equal its `minUsers`; a one-user bracket is
   valid.
3. The next `minUsers` must equal the previous `maxUsers + 1`.
4. No gaps or overlaps.
5. Only the final bracket may be open-ended.
6. The final bracket must use `maxUsers: null`/omitted.

Example:

```json
{
  "billingCycle": "MONTHLY",
  "brackets": [
    {
      "minUsers": 1,
      "maxUsers": 10,
      "unitPrice": "15.00"
    },
    {
      "minUsers": 11,
      "maxUsers": null,
      "unitPrice": "12.5000"
    }
  ]
}
```

The server sorts brackets and normalizes prices to four decimals (`"15.00"`
becomes `"15.0000"`). Keep money as a string; do not pass through
`parseFloat`, JavaScript number state, or locale-formatted input when building
the request.

The command replaces the complete ladder for one tier and one billing cycle.
An identical canonical ladder is a no-op and preserves IDs/timestamps. A real
change soft-deletes every old bracket and creates new IDs. Replace local state
from the response.

There is no single-bracket create/delete endpoint and an empty ladder cannot
be saved. The current local add/delete buttons must edit a draft array; only
the full valid array is sent on save.

The active frontend must replace every `YEARLY` transport value with `ANNUAL`.

## Managed currency rates

The platform base currency is fixed to `USD`. USD is not a managed-rate row and
is intentionally omitted from these endpoints.

### List currency rates

`GET /api/admin/core/v1/billing/currency-rates`

Returns `SuccessResponse<CurrencyRateView[]>`:

- sorted by `currencyCode ASC`;
- maximum `99` managed currencies;
- active and inactive rows are both returned;
- `currencyUnitsPerUsd` means quote-currency units equal to exactly USD 1;
- values are normalized to 12 fractional digits.

Derive the mock summary metric with:

```ts
const activeCurrencies =
  rates.filter((rate) => rate.isActive).length + 1; // include fixed USD
```

Make the “include USD” label explicit if this metric is displayed.

### Upsert one currency rate

`PATCH /api/admin/core/v1/billing/currency-rates/:currencyCode`

```ts
interface UpsertCurrencyRateDto {
  currencyUnitsPerUsd: string;
  isActive?: boolean;
}
```

The path code is trimmed/uppercased and must match exactly three ASCII letters.
`USD` returns `BASE_CURRENCY_FIXED`.

`currencyUnitsPerUsd`:

- must be a string, not a JSON number;
- must be greater than zero;
- permits up to 12 whole digits and 12 fractional digits;
- is returned with exactly 12 fractional digits.

If `isActive` is omitted, an existing row keeps its value and a new row
defaults to `true`.

Every successful upsert appends a new immutable internal rate revision, even
when a caller submits the same rate. Revision IDs/history are not exposed by
this admin API.

### Upsert a batch

`PATCH /api/admin/core/v1/billing/currency-rates`

```ts
interface CurrencyRateEntryDto extends UpsertCurrencyRateDto {
  currencyCode: string;
}

interface SetCurrencyRatesDto {
  rates: CurrencyRateEntryDto[]; // 1..99, unique normalized codes
}
```

Despite the method name `setMany`, this is a batch **upsert**, not a complete
catalogue replacement. Existing currencies omitted from `rates` remain
unchanged. To disable a currency, include it with `isActive: false`; there is
no delete endpoint.

The batch is transactional. The response contains the supplied rows’ updated
views sorted by normalized currency code, not the complete currency
catalogue. Refetch the list after success if the screen needs all rows.

Each updated row appends an immutable revision attributed to the acting admin.

## Permission-gated UI

| Capability | Permission |
|:---|:---|
| View modules, tiers, features, grants, pricing, and currency rates | `admin.catalog.read` |
| Create/update/reorder modules; manage tiers, features, grants, and price ladders | `admin.catalog.manage` |
| Delete a whole module | `admin.catalog.destroy` |
| Upsert currency rates | `admin.billing.currency.manage` |

`admin.catalog.manage` does not imply module deletion or currency-rate
mutation. Keep those actions independently gated.

## Error catalogue

### Gateway errors

| Status | Problem Details `code` | UI handling |
|:---:|:---|:---|
| `400` | `GW.IDEM.MISSING` | Generate and attach a UUIDv7 key |
| `400` | `GW.IDEM.BAD_VALUE` | Fix the key generator; do not retry unchanged |
| `409` | `GW.IDEM.IN_FLIGHT` | Show processing state, then refetch |
| `422` | `GW.IDEM.MISMATCH` | Never reuse a key after command intent changes |
| `413` | `GW.BODY.TOO_LARGE` | Reduce avatar/request size |

### Core catalogue errors

| Status | Core `errorCode` | Trigger/UI handling |
|:---:|:---|:---|
| `400` | Validation error | Use `details` for DTO/UUID/unknown-field errors |
| `409` | `MODULE_KEY_TAKEN` | Mark module key as already used |
| `409` | `TIER_KEY_TAKEN` | Mark tier key as already used in this module |
| `409` | `TIER_RANK_TAKEN` | Refetch; do not perform client-side rank swaps |
| `409` | `FEATURE_KEY_TAKEN` | Mark globally duplicated feature key |
| `409` | `MODULE_IN_USE` | Offer deactivation instead of delete |
| `409` | `TIER_IN_USE` | Offer tier deactivation instead of delete |
| `409` | `TIER_CATALOG_INCOMPLETE` | Operational catalogue-size problem |
| `409` | `FEATURE_CATALOG_INCOMPLETE` | Operational catalogue-size problem |
| `409` | `TIER_FEATURE_CATALOG_INCOMPLETE` | Operational catalogue-size problem |
| `409` | `IDEMPOTENCY_KEY_REUSED` | Client reused a durable-command key incorrectly |
| `409` | `TIER_FEATURE_COMMAND_INCOMPLETE` | Prior durable grant command lacks a result |
| `409` | `PRICE_TIER_COMMAND_INCOMPLETE` | Prior durable pricing command lacks a result |
| `409` | `CURRENCY_RATE_COMMAND_INCOMPLETE` | Prior durable currency command lacks a result |
| `409` | `CURRENCY_RATE_LIMIT_REACHED` | Maximum 99 managed currencies reached |
| `409` | `CURRENCY_RATE_CATALOG_INCOMPLETE` | Operational bounded-read problem |
| `409` | `BASE_CURRENCY_FIXED` | Do not edit USD |
| `422` | `MODULE_NOT_FOUND` | Current shared catalogue maps this code to 422; treat as unavailable/missing |
| `422` | `TIER_NOT_FOUND` | Current shared catalogue maps this code to 422; treat as unavailable/missing |
| `404` | `FEATURE_NOT_FOUND` | Refetch feature/grant state |
| `422` | `DUPLICATE_FEATURE` | De-duplicate the full grant payload |
| `422` | `FEATURE_MODULE_MISMATCH` | Only grant features from the tier’s module |
| `422` | `CRM_OUTBOUND_EMAIL_POLICY_INVALID` | Fix the closed quota config |
| `422` | `PRICE_LADDER_INVALID` | Show the returned ladder rule near the draft |
| `422` | `PRICE_LADDER_INCOMPLETE` | Operational persisted-ladder problem |
| `422` | `DUPLICATE_CURRENCY_RATE` | De-duplicate normalized currency codes |

The `MODULE_NOT_FOUND` and `TIER_NOT_FOUND` statuses are not assumptions:
although catalogue services construct not-found exceptions, the current Core
error catalogue overrides these shared codes to HTTP `422`.

## Current frontend gaps

The active implementation under `src/app/modules/` is a prototype:

1. No hook performs a catalogue API request.
2. List search, filtering, creation, and rank changes mutate local mock state.
3. Module links use keys (`crm`) where the backend requires UUIDv7 IDs.
4. `ModuleRecord` invents `status`, `tiersCount`, and `featuresCount`.
5. The detail header invents module `category` and status values.
6. Module edit uses `moduleKey/moduleName` instead of immutable `key` and
   mutable `name`.
7. Tier up/down controls imply an atomic reorder endpoint that does not exist.
8. Feature state invents `valueType` and `defaultValue`.
9. Feature import has no backend bulk endpoint and currently succeeds only
   locally.
10. Grant state invents `isEnabled`/`value`; the API models enabled state by
    grant presence and settings in `config`.
11. The matrix save is simulated; the API replaces one tier at a time.
12. Pricing uses invalid `YEARLY` instead of `ANNUAL`.
13. Pricing converts decimal strings through `parseFloat`, risking precision
    loss.
14. Local price validation rejects `maxUsers === minUsers`, although the
    backend permits a single-user bracket.
15. Price add/delete controls act like per-row endpoints; only full-ladder
    replacement exists.
16. No mutation supplies the required UUIDv7 idempotency header.
17. The “active currencies” metric is hard-coded and has no currency-rate UI.
18. Loading, empty, forbidden, validation, conflict, in-flight, replay, and
    partial-import states are absent.

## Recommended implementation sequence

1. Add exact envelope, error, module, tier, feature, grant, price, and currency
   TypeScript types.
2. Implement paginated module list using UUID detail links and `isActive`.
3. Implement module create/update/delete and atomic module reorder with
   idempotency-key support.
4. Load detail as module + bounded tier/feature lists; remove invented fields.
5. Implement tier create/update/delete, leaving reorder disabled.
6. Implement feature CRUD and a client-only export; defer or clearly design
   non-atomic import.
7. Implement per-tier full grant replacement, including typed editors for
   known configs such as `crm.outbound_email`.
8. Implement per-tier/per-cycle price drafts and full-ladder replacement using
   decimal strings and `ANNUAL`.
9. Add currency-rate list and individual/batch upsert behind its independent
   permission.
10. Remove mock datasets only after every tab has loading, empty, forbidden,
    validation, conflict, retry, and stale-state behavior.

## Backend source map

Paths are relative to `C:\mutakamel.ai\frontend`:

- `../backend/mutakamel-apps/api-gateway-app/src/routing-proxy/route-contracts/core.route-contracts.ts`
- `../backend/mutakamel-apps/api-gateway-app/src/idempotency/gateway-idempotency.service.ts`
- `../backend/mutakamel-apps/api-gateway-app/src/common/gateway.types.ts`
- `../backend/mutakamel-apps/api-gateway-app/src/common/gateway-error.catalog.ts`
- `../backend/mutakamel-apps/core-app/src/admin/catalog/catalog.controller.ts`
- `../backend/mutakamel-apps/core-app/src/admin/catalog/catalog.service.ts`
- `../backend/mutakamel-apps/core-app/src/admin/catalog/price-tiers.service.ts`
- `../backend/mutakamel-apps/core-app/src/admin/catalog/currency-rates.service.ts`
- `../backend/mutakamel-apps/core-app/src/admin/catalog/price-ladder.ts`
- `../backend/mutakamel-apps/core-app/src/admin/catalog/dto/`
- `../backend/mutakamel-apps/core-app/src/admin/catalog/repo/`
- `../backend/mutakamel-apps/core-app/packages/database/src/entities/control-plane/module.entity.ts`
- `../backend/mutakamel-apps/core-app/packages/database/src/entities/control-plane/module-tier.entity.ts`
- `../backend/mutakamel-apps/core-app/packages/database/src/entities/control-plane/feature.entity.ts`
- `../backend/mutakamel-apps/core-app/packages/database/src/entities/control-plane/tier-feature.entity.ts`
- `../backend/mutakamel-apps/core-app/packages/database/src/entities/control-plane/price-tier.entity.ts`
- `../backend/mutakamel-apps/core-app/packages/database/src/entities/control-plane/billing-currency-rate.entity.ts`
- `../backend/mutakamel-apps/shared-libs/packages/email/src/feature-policy/crm-outbound-email-feature-policy.ts`
- `../backend/mutakamel-apps/shared-libs/packages/common/src/interceptors/response-envelope.interceptor.ts`
- `../backend/mutakamel-apps/shared-libs/packages/common/src/filters/all-exceptions.filter.ts`
