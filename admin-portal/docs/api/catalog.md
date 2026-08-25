# Application Catalogue V1 Frontend Contract

Status: **[Verified]**

Last source verification: **2026-08-25**

This is the Admin Portal implementation contract for the Application Catalogue:
Application identity, independent publication and lifecycle, immutable runtime
target evidence, technical readiness, database policy and safe manifest
evidence, tiers, features, tier-feature grants, graduated USD price ladders,
managed billing currency rates, and immutable catalogue audit.

The public/domain root is **Application**, not Module. The physical PostgreSQL
tables still include names such as `modules`, `module_tiers`, and `module_id`.
Those names are storage and current-wire legacy details. There is no supported
`/api/admin/core/v1/modules` alias and frontend code must not recreate one.

## Ownership and browser rules

| Concern | Contract |
|:---|:---|
| Backend owner | `core-app` |
| Browser root | `/api/admin/core/v1` |
| Primary resource | `/api/admin/core/v1/applications` |
| Guard | `AdminGuard` |
| Authentication | Shared cookie client with `credentials: "include"`; server-inferred browser channel |
| Identifiers | Application routes use immutable lowercase `applicationKey`; nested commercial routes use UUIDv7 `applicationId`, `tierId`, or `id` |
| Unknown DTO fields | Rejected because Core uses whitelist plus `forbidNonWhitelisted` |
| Permission pairs | ALL semantics |
| Cache | Application identity reads and writes are `Cache-Control: no-store` |

The controller-relative `/api/v1/admin/...` paths and Gateway registry paths
such as `/api/v1/core/admin/...` are not browser paths.

## Canonical success and error envelopes

HTTP status is carried by HTTP. Successful Core JSON does **not** contain a
`status`, `statusCode`, or `code` field.

```ts
interface CoreSuccessResponse<T> {
  success: true;
  data: T | null;
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

Application list responses are flattened into `data` plus `meta`. Other list
responses are arrays in `data`. The audit service currently returns a
pagination object without `hasNext`/`hasPrev`, so audit pagination remains
inside `data` and has no envelope `meta`.

Core/upstream failures:

```json
{
  "success": false,
  "statusCode": 409,
  "errorCode": "APPLICATION_CATALOGUE_REVISION_STALE",
  "errorCategory": "CONFLICT",
  "message": "The supplied revision is stale.",
  "correlationId": "019f0000-0000-7000-8000-000000009001",
  "timestamp": "2026-08-02T12:00:00.000Z",
  "path": "/api/v1/admin/applications/crm"
}
```

Gateway-native failures use Problem Details:

```json
{
  "type": "https://errors.mutakamel.ai/gw/idem/missing",
  "title": "Missing idempotency key",
  "status": 400,
  "code": "GW.IDEM.MISSING",
  "instance": "/api/admin/core/v1/applications",
  "correlationId": "019f0000-0000-7000-8000-000000009001"
}
```

The shared client must normalize both shapes without discarding
`correlationId`. Core error categories are `VALIDATION`, `AUTH`,
`AUTHORIZATION`, `NOT_FOUND`, `CONFLICT`, `RATE_LIMIT`, and `SERVER_ERROR`.

## Idempotency

Every route marked **Yes** below requires
`x-idempotency-key: <UUIDv7>`. Generate one key for one exact user intent and
reuse it only when retrying the same method, path, query, actor, and body.

- `GW.IDEM.IN_FLIGHT`: the original command is still processing; reconcile by
  refetching, not by generating another key.
- `GW.IDEM.MISMATCH` or Core `IDEMPOTENCY_KEY_REUSED`: the key was reused for a
  different intent.
- Application writes, including atomic onboarding, tier-feature replacement,
  price replacement, and currency writes have durable Core command evidence.
- Tier/feature update and delete require Gateway idempotency, but do not have
  equivalent durable Core command rows.
- Tier and feature creation are intentionally non-idempotent. Their client
  explicitly disables automatic idempotency headers and coordinated `401`
  replay. It stores only `{applicationId, kind, resourceKey}` attempt evidence,
  blocks another create after an ambiguous `401`/network/`5xx`, and reconciles
  through an authoritative tier/feature refetch by immutable key. The portal
  never resubmits that create automatically.

## Seeded catalogue

Source installs four Application roots:

| Key | Runtime target | Name | Rank | Type | Commercial mode | Visibility | Database principal |
|:---|:---|:---|---:|:---|:---|:---|:---|
| `core` | `core-app` | Core Workspace | 1 | `SYSTEM` | `INCLUDED` | `PUBLIC` | `mutakamel_core_app` |
| `crm` | `crm-app` | CRM | 2 | `TENANT` | `SUBSCRIPTION` | `PUBLIC` | `mutakamel_crm_app` |
| `trade` | `trade-app` | Trade | 3 | `TENANT` | `SUBSCRIPTION` | `PUBLIC` | `mutakamel_trade_app` |
| `worker` | `worker-app` | Worker | 4 | `SYSTEM` | `NON_BILLABLE` | `INTERNAL` | `mutakamel_worker_app` |

The root seed creates missing rows as `DRAFT` and `UNPUBLISHED`. Those seed
defaults are not live-state evidence. Publication remains an explicit,
administrator-attributed command.

Seeded features:

- Core: `core.template_designer`
- CRM: `crm.settings`, `crm.static_data`, `crm.custom_fields`,
  `crm.lead_stages`, `crm.acquisition_sources`, `crm.pipelines`,
  `crm.customer_profiles`, `crm.leads`, `crm.opportunities`, `crm.activities`,
  `crm.notes_attachments`, `crm.dashboards`, `crm.outbound_email`
- Trade: `trade.catalog`, `trade.pricing`, `trade.sales`, `trade.purchasing`,
  `trade.inventory`, `trade.policy_studio`, `trade.automation`,
  `trade.analytics`
- Worker: no commercial features are seeded

Seeded managed rates are EUR `0.920000000000`, EGP `48.000000000000`, AED
`3.670000000000`, and SAR `3.750000000000`. USD is fixed at `1.0` and is not a
managed-rate row.

**Tiers, tier-feature grants, and price ladders are not seeded. They are
administrator-authored.**

## Enums and static unions

```ts
type ApplicationType = "SYSTEM" | "TENANT";
type ApplicationCommercialMode =
  | "NON_BILLABLE"
  | "INCLUDED"
  | "SUBSCRIPTION";
type ApplicationCatalogueVisibility = "PUBLIC" | "INTERNAL";
type ApplicationLifecycleStatus =
  | "DRAFT"
  | "ACTIVE"
  | "DEPRECATED"
  | "DISABLED";
type ApplicationPublicationStatus = "UNPUBLISHED" | "PUBLISHED";
type ApplicationDatabaseAccessMode = "NONE" | "TENANT_DATABASE";
type ApplicationDatabaseDeployment =
  | "NONE"
  | "ON_DEMAND"
  | "PREWARM"
  | "REQUIRED";
type ApplicationManifestPublicationSource = "MIGRATION" | "SIGNED_API";
type BillingCycle = "MONTHLY" | "ANNUAL";
type FxRateSource = "ADMIN" | "PROVIDER" | "SYSTEM";
type ApplicationComponentKind = "FOUNDATION" | "MODULE";
type ApplicationComponentStatus = "ACTIVE" | "RETIRED";
```

Application command operations are `CREATE`, `UPDATE`,
`ADOPT_TECHNICAL_PACKAGE`, `PUBLISH`, `DELETE`, `UPDATE_DATABASE_POLICY`,
`ACTIVATE`, `DEPRECATE`, and `DISABLE`.

Database deployment is the closed operator-facing profile; the older access,
policy, and required flags remain compatibility projections derived from it:

| Deployment | Database principal | Automatic fleet enrollment | Application activation coverage gate |
|:---|:---:|:---:|:---:|
| `NONE` | No | No | No |
| `ON_DEMAND` | Yes | No; bind explicitly when needed | No |
| `PREWARM` | Yes | Yes | No |
| `REQUIRED` | Yes | Yes | Yes, exact READY coverage is required |

TENANT Applications cannot use `NONE` in the current V1 provisioning contract.
For rolling-schema compatibility Core derives the effective profile from legacy
rows when the new column is not yet authoritative; frontend code consumes only
the returned `databaseDeployment` value.

Audit entity types are `MODULE`, `MODULE_ORDER`, `APPLICATION`, `TIER`,
`FEATURE`, `TIER_FEATURE_GRANTS`, `PRICE_LADDER`, and
`TIER_STORAGE_ENTITLEMENT`. The first two and storage entitlement values remain
in the shared audit union for historical/adjacent evidence; they do not add a
public Modules CRUD API to this contract.

## Response views

```ts
interface ApplicationManifestEvidenceView {
  id: string;
  version: number;
  checksum: string;
  schemaVersion: number;
  contractPackage: string;
  contractVersion: string;
  publicationSource: ApplicationManifestPublicationSource;
  publishedAt: string;
  publishedBy: string;
  active: boolean;
}

interface ApplicationDatabasePolicyView {
  enableOnNewServers: boolean;
  rotationEnabled: boolean;
  rotationIntervalHours: number;
  maintenanceWindowStartUtc: number;
  maintenanceWindowHours: number;
  policyRevision: string;
  updatedAt: string;
}

type ApplicationTechnicalReadinessReason =
  | "RUNTIME_TARGET_REQUIRED"
  | "COMPONENT_BINDING_REQUIRED"
  | "ACTIVE_COMPONENT_REQUIRED"
  | "PUBLISHED_RELEASE_REQUIRED"
  | "MINIMUM_RELEASE_NOT_SATISFIED"
  | "DATABASE_PERMISSION_MANIFEST_REQUIRED"
  | "DATABASE_PERMISSION_MANIFEST_INVALID";

type ApplicationSelectionBlocker =
  | "APPLICATION_LIFECYCLE_NOT_ACTIVE"
  | "APPLICATION_NOT_PUBLISHED"
  | "APPLICATION_NOT_PUBLIC"
  | "APPLICATION_NON_BILLABLE"
  | "TECHNICAL_READINESS_BLOCKED";

interface ApplicationTechnicalReadinessView {
  contractVersion: 1;
  applicationId: string;
  applicationKey: string;
  runtimeTarget: string | null;
  commercialMode: ApplicationCommercialMode;
  catalogueVisibility: ApplicationCatalogueVisibility;
  lifecycleStatus: ApplicationLifecycleStatus;
  publicationStatus: ApplicationPublicationStatus;
  technicalDefinitionRevision: string;
  status: "READY" | "NOT_REQUIRED" | "BLOCKED";
  activationAllowed: boolean;
  selectionAllowed: boolean;
  selectionBlockers: ApplicationSelectionBlocker[];
  reasons: ApplicationTechnicalReadinessReason[];
  checks: {
    runtimeTarget: boolean;
    componentBinding: boolean;
    activeComponents: boolean;
    publishedReleases: boolean;
    minimumReleases: boolean;
    databasePermissionManifest: boolean;
  };
  components: Array<{
    id: string;
    key: string;
    ownerApp: string;
    workerTarget: string | null;
    kind: "FOUNDATION" | "MODULE";
    status: "ACTIVE" | "RETIRED";
    contractVersion: number;
    required: boolean;
    activationRequired: boolean;
    minimumRelease: string | null;
    latestPublishedRelease: {
      id: string;
      releaseVersion: string;
      manifestVersion: number;
      manifestChecksum: string;
      publishedAt: string;
    } | null;
  }>;
}

interface ApplicationView {
  contractVersion: 1;
  id: string;
  key: string;
  name: string;
  description: string | null;
  avatarDataUrl: string | null;
  rank: number;
  applicationType: ApplicationType;
  commercialMode: ApplicationCommercialMode;
  catalogueVisibility: ApplicationCatalogueVisibility;
  lifecycleStatus: ApplicationLifecycleStatus;
  runtimeTarget: string | null;
  publicationStatus: ApplicationPublicationStatus;
  publicationRevision: string;
  publishedAt: string | null;
  publishedBy: string | null;
  databaseAccessMode: ApplicationDatabaseAccessMode;
  databaseDeployment: ApplicationDatabaseDeployment;
  databasePrincipal: string | null;
  requiredOnDatabaseServer: boolean;
  technicalDefinitionRevision: string;
  catalogueRevision: string;
  activeManifest: ApplicationManifestEvidenceView | null;
  databasePolicy: ApplicationDatabasePolicyView;
  serverSummary: {
    available: true;
    rolloutRequired: boolean;
    eligible: number;
    ready: number;
    pending: number;
    degraded: number;
    coveragePercent: number;
  };
  createdAt: string;
  updatedAt: string;
}

interface ApplicationMutationReceipt {
  contractVersion: 1;
  operation:
    | "CREATE"
    | "UPDATE"
    | "ADOPT_TECHNICAL_PACKAGE"
    | "PUBLISH"
    | "UPDATE_DATABASE_POLICY"
    | "ACTIVATE"
    | "DEPRECATE"
    | "DISABLE"
    | "DELETE";
  applicationId: string;
  applicationKey: string;
  lifecycleStatus: ApplicationLifecycleStatus;
  runtimeTarget: string | null;
  databaseAccessMode: ApplicationDatabaseAccessMode;
  databaseDeployment: ApplicationDatabaseDeployment;
  databasePrincipal: string | null;
  technicalDefinitionRevision: string;
  publicationStatus: ApplicationPublicationStatus;
  publicationRevision: string;
  catalogueRevision: string;
  policyRevision: string;
  deleted: boolean;
  onboarded?: true;
  technicalIdentity?: {
    runtimeTarget: string;
    databasePrincipal: string | null;
    databaseDeployment: ApplicationDatabaseDeployment;
    primaryComponentKey: string;
    contractVersion: 1;
  };
  technicalProvisioning?: {
    componentId: string;
    componentKey: string;
    ownerApp: string;
    workerTarget: string;
    contractVersion: 1;
  };
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
  deletedAt: string | null;
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
  deletedAt: string | null;
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
  billingCycle: BillingCycle;
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

`moduleId` in `TierView`, `FeatureView`, and audit responses is the current
wire field. It contains the parent Application UUID. Frontend adapters may
expose an internal alias such as `applicationId`, but requests, stored payloads,
tests, and transport examples must not pretend the wire field was renamed.

`serverSummary` is always available in the current V1 projection. For
`PREWARM` and `REQUIRED`, `eligible` counts operational Database Servers and
the remaining fields report exact binding readiness against the current
principal, manifest, and policy revision. For `NONE` and `ON_DEMAND`, fleet
rollout is not automatic, so `rolloutRequired=false`, all fleet counts are
zero, and coverage is `100`. This projection is the only Application-level
fleet authority; the frontend does not rebuild it from list-page data.

## DTO validation

### Applications

```ts
interface ApplicationListQueryDto {
  page?: number; // integer >= 1; default 1
  limit?: number; // integer 1..100; default 20
  sortBy?: string; // max 100; currently ignored
  sortDir?: "ASC" | "DESC"; // currently ignored
  search?: string; // max 200; searches key and name
  applicationType?: ApplicationType;
  commercialMode?: ApplicationCommercialMode;
  catalogueVisibility?: ApplicationCatalogueVisibility;
  lifecycleStatus?: ApplicationLifecycleStatus;
  publicationStatus?: ApplicationPublicationStatus;
  databaseAccessMode?: ApplicationDatabaseAccessMode;
  databaseDeployment?: ApplicationDatabaseDeployment;
}

interface CreateApplicationDto {
  key: string; // trimmed, /^[a-z][a-z0-9_]{0,31}$/; fits owner_app FK
  name: string; // trimmed, non-empty, max 128
  description?: string; // trimmed, max 512
  avatarDataUrl?: string; // PNG data URL, max 2,000,000
  applicationType: ApplicationType;
  commercialMode: ApplicationCommercialMode;
  catalogueVisibility: ApplicationCatalogueVisibility;
}

interface OnboardApplicationDto extends CreateApplicationDto {
  databaseDeployment: ApplicationDatabaseDeployment;
  reason: string; // trimmed, non-empty, max 256
}

interface UpdateApplicationDto {
  expectedCatalogueRevision: string; // positive integer string
  name?: string; // trimmed, non-empty, max 128
  description?: string | null; // max 512; null clears
  avatarDataUrl?: string | null; // null clears
  commercialMode?: ApplicationCommercialMode;
  catalogueVisibility?: ApplicationCatalogueVisibility;
}

interface ApplicationLifecycleCommandDto {
  expectedCatalogueRevision: string;
  reason: string; // trimmed, non-empty, max 256
}

interface PublishApplicationDto {
  expectedCatalogueRevision: string;
  expectedPublicationRevision: string;
  reason: string; // trimmed, non-empty, max 256
}

interface UpdateApplicationDatabasePolicyDto {
  expectedPolicyRevision: string;
  enableOnNewServers?: boolean;
  rotationEnabled?: boolean;
  rotationIntervalHours?: number; // integer 24..8760
  maintenanceWindowStartUtc?: number; // integer 0..23
  maintenanceWindowHours?: number; // integer 1..24
  reason: string; // trimmed, non-empty, max 256
}

interface AdoptApplicationTechnicalPackageDto {
  expectedTechnicalDefinitionRevision: string; // positive integer string
  databaseDeployment?: ApplicationDatabaseDeployment; // default REQUIRED
  reason: string; // trimmed, non-empty, max 256
}

interface CreateApplicationProvisioningBindingDto {
  expectedTechnicalDefinitionRevision: string;
  reason: string; // trimmed, non-empty, max 256
}
```

Application update and policy update require at least one actual writable
field. Delete carries `expectedCatalogueRevision` and `reason` in the query.
Publishing is independently fenced by the exact current catalogue and
publication revisions. A metadata update to a published Application changes it
to `UNPUBLISHED`, advances the publication revision, and clears
`publishedAt`/`publishedBy`; it never auto-publishes the new revision.

### Tiers and features

```ts
interface CreateTierDto {
  key: string; // /^[a-z][a-z0-9_]*$/, max 64
  name: string; // required, max 128
  color?: string; // exact #RRGGBB; default #3b82f6
  isActive?: boolean; // default true
}

interface UpdateTierDto {
  name?: string; // max 128
  rank?: number; // integer >= 0
  color?: string; // #RRGGBB
  isActive?: boolean;
}

interface CreateFeatureDto {
  key: string; // dot-scoped lowercase, max 96
  name: string; // required, max 128
  description?: string; // max 512
  rank?: number; // integer >= 0
  isActive?: boolean;
}

interface UpdateFeatureDto {
  name?: string; // max 128
  description?: string; // max 512
  rank?: number; // integer >= 0
  isActive?: boolean;
}
```

Tier key is unique within its Application; feature key is globally unique.
Tier and feature keys are immutable. Public tier/feature mutations require a
`PUBLIC` parent Application. The list routes currently return an empty array
for a valid but unknown Application UUID rather than `404`.

### Grants, pricing, and currencies

```ts
interface SetTierFeaturesDto {
  features: Array<{
    featureId: string; // UUIDv7
    config?: Record<string, unknown>;
  }>; // 0..500, complete replacement, no duplicates
}

interface SetPriceTiersDto {
  billingCycle: BillingCycle;
  brackets: Array<{
    minUsers: number; // integer 1..2,147,483,647
    maxUsers?: number | null; // same bound; null means infinity
    unitPrice: string; // non-negative numeric(18,4) decimal string
  }>; // 1..100, complete replacement
}

interface UpsertCurrencyRateDto {
  currencyUnitsPerUsd: string; // positive; <=12 whole and <=12 decimal digits
  isActive?: boolean;
}

interface SetCurrencyRatesDto {
  rates: Array<UpsertCurrencyRateDto & {
    currencyCode: string; // normalized uppercase /^[A-Z]{3}$/
  }>; // 1..99 unique codes; batch upsert, not full replacement
}
```

A price ladder starts at user 1, is contiguous, has no gaps/overlaps, and has
exactly one open-ended final bracket. Prices remain decimal strings and are
returned with four fractional digits.

`crm.outbound_email` grant config must contain exactly:

```ts
{
  dailyQuota: number; // integer 1..1,000,000
  rateLimitPerMin: number; // integer 1..10,000
}
```

## Exact endpoint matrix

| Method and browser path | Permission | HTTP success | Idempotency |
|:---|:---|:---:|:---:|
| `GET /applications` | `admin.applications.read` | 200 | No |
| `GET /applications/:applicationKey` | `admin.applications.read` | 200 | No |
| `GET /applications/:applicationKey/database-manifests` | `admin.applications.read` | 200 | No |
| `GET /applications/:applicationKey/technical-provisioning` | `admin.applications.read` | 200 | No |
| `POST /applications/:applicationKey/technical-provisioning/adopt` | `admin.applications.update` + `admin.applications.critical` | 201 | Yes |
| `POST /applications/:applicationKey/technical-provisioning/primary-component` | `admin.applications.update` + `admin.applications.critical` | 201 | Yes |
| `POST /applications/onboarding` | `admin.applications.create` + `admin.applications.update` + `admin.applications.critical` | 201 | Yes |
| `POST /applications` | `admin.applications.create` | 201 | Yes |
| `PATCH /applications/:applicationKey` | `admin.applications.update` | 200 | Yes |
| `DELETE /applications/:applicationKey` | `admin.applications.delete` + `admin.applications.critical` | 204 | Yes |
| `PATCH /applications/:applicationKey/database-policy` | `admin.applications.update` + `admin.applications.critical` | 200 | Yes |
| `POST /applications/:applicationKey/publish` | `admin.applications.update` + `admin.applications.critical` | 201 | Yes |
| `POST /applications/:applicationKey/activate` | `admin.applications.update` + `admin.applications.critical` | 201 | Yes |
| `POST /applications/:applicationKey/deprecate` | `admin.applications.update` + `admin.applications.critical` | 201 | Yes |
| `POST /applications/:applicationKey/disable` | `admin.applications.update` + `admin.applications.critical` | 201 | Yes |
| `GET /catalog/audit` | `admin.catalog.read` | 200 | No |
| `GET /applications/:applicationId/audit` | `admin.catalog.read` | 200 | No |
| `POST /applications/:applicationId/tiers` | `admin.catalog.manage` | 201 | No |
| `GET /applications/:applicationId/tiers` | `admin.catalog.read` | 200 | No |
| `PATCH /tiers/:id` | `admin.catalog.manage` + `admin.catalog.critical` | 200 | Yes |
| `DELETE /tiers/:id` | `admin.catalog.manage` + `admin.catalog.critical` | 204 | Yes |
| `POST /applications/:applicationId/features` | `admin.catalog.manage` | 201 | No |
| `GET /applications/:applicationId/features` | `admin.catalog.read` | 200 | No |
| `PATCH /features/:id` | `admin.catalog.manage` + `admin.catalog.critical` | 200 | Yes |
| `DELETE /features/:id` | `admin.catalog.manage` + `admin.catalog.critical` | 204 | Yes |
| `GET /tiers/:tierId/features` | `admin.catalog.read` | 200 | No |
| `PATCH /tiers/:tierId/features` | `admin.catalog.manage` + `admin.catalog.critical` | 200 | Yes |
| `GET /tiers/:tierId/price-tiers` | `admin.catalog.read` | 200 | No |
| `PATCH /tiers/:tierId/price-tiers` | `admin.catalog.manage` + `admin.catalog.critical` | 200 | Yes |
| `GET /billing/currency-rates` | `admin.catalog.read` | 200 | No |
| `PATCH /billing/currency-rates` | `admin.billing.currency.manage` + `admin.catalog.critical` | 200 | Yes |
| `PATCH /billing/currency-rates/:currencyCode` | `admin.billing.currency.manage` + `admin.catalog.critical` | 200 | Yes |

Every abbreviated path in the table is relative to `/api/admin/core/v1`.

### Atomic onboarding and permission fallback

`POST /applications/onboarding` is the normal full-authority registration
path. It is Gateway `WRITE_SENSITIVE`, idempotent, has transport retry disabled,
and requires ALL three permissions: `admin.applications.create`,
`admin.applications.update`, and `admin.applications.critical`. One
caller-owned UUIDv7 key identifies the entire unchanged onboarding intent.

Core validates the commercial shape and closed database-deployment profile,
then creates the catalogue DRAFT, immutable runtime/database identity, initial
database policy, and deterministic TENANT primary component in one database
transaction. The receipt uses operation `CREATE`, includes the effective
database fields, and adds `onboarded: true`, `technicalIdentity`, and, for a
TENANT Application, `technicalProvisioning`. The Application remains
`DRAFT`/`UNPUBLISHED`; onboarding does not publish or activate it.

The narrower `POST /applications` contract remains supported for an actor who
has only `admin.applications.create`. The Admin Portal sends that single legacy
request and labels the result as a catalogue-only DRAFT. It does not simulate
atomic onboarding by chaining adoption or component-binding calls in the
browser. When that create-only actor lacks `admin.applications.read`, the
`/applications-catalogue` route renders a narrow registration-only page before
the catalogue/list hook mounts. The page uses the mutation-only registration
hook and does not issue `GET /applications` or any commercial-catalogue list
read. Actors with the complete create+update+critical permission set use
onboarding directly; partial subsets do not satisfy the ALL gate.

Example onboarding body:

```json
{
  "key": "hr",
  "name": "Human Resources",
  "description": "People operations and workforce management.",
  "applicationType": "TENANT",
  "commercialMode": "SUBSCRIPTION",
  "catalogueVisibility": "PUBLIC",
  "databaseDeployment": "REQUIRED",
  "reason": "Add the reviewed HR product to the control plane."
}
```

The 201 receipt remains secret-free and includes, in addition to the normal
`CREATE` revisions, the authoritative profile:

```json
{
  "operation": "CREATE",
  "applicationKey": "hr",
  "lifecycleStatus": "DRAFT",
  "runtimeTarget": "hr-app",
  "databaseAccessMode": "TENANT_DATABASE",
  "databaseDeployment": "REQUIRED",
  "databasePrincipal": "mutakamel_hr_app",
  "technicalDefinitionRevision": "1",
  "publicationStatus": "UNPUBLISHED",
  "onboarded": true,
  "technicalIdentity": {
    "runtimeTarget": "hr-app",
    "primaryComponentKey": "app.hr",
    "databasePrincipal": "mutakamel_hr_app",
    "databaseDeployment": "REQUIRED",
    "contractVersion": 1
  }
}
```

`databaseDeployment=NONE` for a TENANT Application fails with
`TENANT_RUNTIME_ONLY_PROVISIONING_NOT_SUPPORTED`. An exact ambiguous or
in-flight retry retains the same UUIDv7 key; a changed body is a new intent.

### Release authority UI contract

Lifecycle, publication, deployment, and technical readiness are independent
evidence. The Application list must expose separate lifecycle, publication,
and database-deployment columns plus their filters. The detail view must show
`runtimeTarget`, the authoritative `databaseDeployment`, publication
status/revision, and attributable `publishedAt`/`publishedBy`.

- `PUBLISH` is an explicit critical action. It uses both current revision
  fences, requires a reason, and never changes lifecycle state. Re-publishing
  an already-`ACTIVE` `REQUIRED` Application also rechecks exact fleet
  coverage before establishing release authority.
- `ACTIVATE` is available only when an attributable publication exists and
  technical `activationAllowed` is true. `activationAllowed` alone is not a
  publication check. A `REQUIRED` database deployment additionally needs exact
  READY coverage on every operational Database Server; Core returns
  `APPLICATION_REQUIRED_DATABASE_COVERAGE_INCOMPLETE` with safe summary counts
  when that fleet gate is incomplete.
- Metadata editing a published Application must warn that the current release
  authority will be invalidated. The returned/refetched `UNPUBLISHED` state is
  authoritative; the browser must never publish automatically.
- New commercial selection requires `selectionAllowed=true`, which represents
  `ACTIVE`, `PUBLISHED`, `PUBLIC`, commercial eligibility, and technical
  readiness. Existing installed runtime may retain a `PUBLISHED` Application
  whose lifecycle is `ACTIVE` or `DEPRECATED`.
- “Release authority” or “deployable” must never be inferred from lifecycle,
  an active manifest, or a published component release alone.

### Technical provisioning examples

The projection is derived from existing component bindings, active components,
latest published immutable releases, and the active database permission
manifest. It contains no password, encrypted secret, SQL, or migration body.

```http
GET /api/admin/core/v1/applications/hr/technical-provisioning HTTP/1.1
```

```json
{
  "success": true,
  "data": {
    "contractVersion": 1,
    "applicationId": "019f0000-0000-7000-8000-000000000010",
    "applicationKey": "hr",
    "runtimeTarget": "hr-app",
    "commercialMode": "SUBSCRIPTION",
    "catalogueVisibility": "PUBLIC",
    "lifecycleStatus": "DRAFT",
    "publicationStatus": "UNPUBLISHED",
    "technicalDefinitionRevision": "2",
    "status": "BLOCKED",
    "activationAllowed": false,
    "selectionAllowed": false,
    "selectionBlockers": [
      "APPLICATION_LIFECYCLE_NOT_ACTIVE",
      "APPLICATION_NOT_PUBLISHED",
      "TECHNICAL_READINESS_BLOCKED"
    ],
    "reasons": ["PUBLISHED_RELEASE_REQUIRED"],
    "checks": {
      "runtimeTarget": true,
      "componentBinding": true,
      "activeComponents": true,
      "publishedReleases": false,
      "minimumReleases": true,
      "databasePermissionManifest": true
    },
    "components": [
      {
        "id": "019f0000-0000-7000-8000-000000000020",
        "key": "app.hr",
        "ownerApp": "hr",
        "workerTarget": "hr-app",
        "kind": "MODULE",
        "status": "ACTIVE",
        "contractVersion": 1,
        "required": true,
        "activationRequired": true,
        "minimumRelease": null,
        "latestPublishedRelease": null
      }
    ]
  },
  "correlationId": "019f0000-0000-7000-8000-000000000001",
  "timestamp": "2026-08-02T12:00:00.000Z"
}
```

When `runtimeTarget` is null, the detail UI first offers the DRAFT-only
technical-adoption command. The browser may preview the deterministic identity,
but the Core receipt and refetched readiness projection are authoritative.

```http
POST /api/admin/core/v1/applications/hr/technical-provisioning/adopt HTTP/1.1
Cookie: __Host-mutakamel-admin-access=<redacted>; __Host-mutakamel-admin-session=<redacted>; __Host-mutakamel-admin-csrf=<csrf-proof>
X-CSRF-Token: <csrf-proof>
x-idempotency-key: 019f0000-0000-7000-8000-000000000002
Content-Type: application/json

{
  "expectedTechnicalDefinitionRevision": "1",
  "reason": "Adopt the reviewed HR technical identity"
}
```

Core derives `hr-app`, `mutakamel_hr_app`, `app.hr`, and contract version `1`.
The request may select only the closed `databaseDeployment` profile and
defaults to `REQUIRED` when it is omitted. It cannot select a runtime target,
database principal, component key, credential, SQL, or migration content.
Exact-intent retries reuse the same UUIDv7 key; ambiguous or in-flight outcomes
are reconciled by refetching the readiness projection before the UI offers
another intent.

```json
{
  "success": true,
  "data": {
    "contractVersion": 1,
    "operation": "ADOPT_TECHNICAL_PACKAGE",
    "applicationId": "019f0000-0000-7000-8000-000000000010",
    "applicationKey": "hr",
    "lifecycleStatus": "DRAFT",
    "runtimeTarget": "hr-app",
    "publicationStatus": "UNPUBLISHED",
    "publicationRevision": "1",
    "catalogueRevision": "2",
    "policyRevision": "1",
    "deleted": false,
      "technicalIdentity": {
        "runtimeTarget": "hr-app",
        "databasePrincipal": "mutakamel_hr_app",
        "databaseDeployment": "REQUIRED",
        "primaryComponentKey": "app.hr",
      "contractVersion": 1
    }
  },
  "correlationId": "019f0000-0000-7000-8000-000000000001",
  "timestamp": "2026-08-05T12:00:00.000Z"
}
```

After adoption, the separate DRAFT-only binding command applies only when the
authoritative readiness projection reports `COMPONENT_BINDING_REQUIRED`. Core
binds the already-derived primary component and reads Worker routing from the
stored immutable `runtimeTarget`; execution must not reconstruct that target
from the display name or another mutable value. An unbound `SYSTEM`
Application such as Worker intentionally owns no tenant schema or migration
component, so the UI must not offer this command and Core rejects a direct or
stale submission with `409 APPLICATION_COMPONENT_BINDING_NOT_REQUIRED`.

```http
POST /api/admin/core/v1/applications/hr/technical-provisioning/primary-component HTTP/1.1
Cookie: __Host-mutakamel-admin-access=<redacted>; __Host-mutakamel-admin-session=<redacted>; __Host-mutakamel-admin-csrf=<csrf-proof>
X-CSRF-Token: <csrf-proof>
x-idempotency-key: 019f0000-0000-7000-8000-000000000002
Content-Type: application/json

{
  "expectedTechnicalDefinitionRevision": "2",
  "reason": "Link the HR runtime component"
}
```

```json
{
  "success": true,
  "data": {
    "contractVersion": 1,
    "operation": "UPDATE",
    "applicationId": "019f0000-0000-7000-8000-000000000010",
    "applicationKey": "hr",
    "lifecycleStatus": "DRAFT",
    "runtimeTarget": "hr-app",
    "publicationStatus": "UNPUBLISHED",
    "publicationRevision": "1",
    "catalogueRevision": "1",
    "policyRevision": "1",
    "deleted": false,
    "technicalProvisioning": {
      "componentId": "019f0000-0000-7000-8000-000000000020",
      "componentKey": "app.hr",
      "ownerApp": "hr",
      "workerTarget": "hr-app",
      "contractVersion": 1
    }
  },
  "correlationId": "019f0000-0000-7000-8000-000000000001",
  "timestamp": "2026-08-02T12:00:00.000Z"
}
```

Relevant conflicts are `APPLICATION_TECHNICAL_PROVISIONING_NOT_READY`,
`APPLICATION_RUNTIME_TARGET_REQUIRED`,
`APPLICATION_TECHNICAL_DEFINITION_REVISION_STALE`,
`APPLICATION_TECHNICAL_ADOPTION_REQUIRES_DRAFT`,
`APPLICATION_TECHNICAL_IDENTITY_ALREADY_ADOPTED`,
`APPLICATION_TECHNICAL_IDENTITY_TAKEN`,
`APPLICATION_TECHNICAL_BINDING_REQUIRES_DRAFT`,
`APPLICATION_COMPONENT_ALREADY_BOUND`, and
`APPLICATION_COMPONENT_KEY_TAKEN`. The UI must refetch the projection after a
successful command or any ambiguous/in-flight outcome. Activation remains
disabled unless the Application has an attributable `PUBLISHED` revision and
the projection is available with `activationAllowed=true`; Core independently
enforces both gates.

## Route contracts and full examples

Example identifiers are illustrative UUIDv7 values. Each response shows the
complete Core success envelope actually expected by the browser.

### 1. List Applications

Request:

```http
GET /api/admin/core/v1/applications?page=1&limit=20&search=crm&applicationType=TENANT HTTP/1.1
Body: none
```

Response — HTTP `200`:

```json
{
  "success": true,
  "data": [{
    "contractVersion": 1,
    "id": "019f0000-0000-7000-8000-000000000002",
    "key": "crm",
    "name": "CRM",
    "description": "Customer relationships, leads, opportunities, activities, and CRM analytics.",
    "avatarDataUrl": null,
    "rank": 2,
    "applicationType": "TENANT",
    "commercialMode": "SUBSCRIPTION",
    "catalogueVisibility": "PUBLIC",
    "lifecycleStatus": "ACTIVE",
    "runtimeTarget": "crm-app",
    "publicationStatus": "PUBLISHED",
    "publicationRevision": "2",
    "publishedAt": "2026-08-02T10:30:00.000Z",
    "publishedBy": "019f0000-0000-7000-8000-000000000099",
    "databaseAccessMode": "TENANT_DATABASE",
    "databaseDeployment": "REQUIRED",
    "databasePrincipal": "mutakamel_crm_app",
    "requiredOnDatabaseServer": true,
    "technicalDefinitionRevision": "1",
    "catalogueRevision": "2",
    "activeManifest": {
      "id": "019f0000-0000-7000-8000-000000000501",
      "version": 1,
      "checksum": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "schemaVersion": 1,
      "contractPackage": "@mutakamel/crm-app-contracts",
      "contractVersion": "0.0.7",
      "publicationSource": "MIGRATION",
      "publishedAt": "2026-08-02T10:00:00.000Z",
      "publishedBy": "migration",
      "active": true
    },
    "databasePolicy": {
      "enableOnNewServers": true,
      "rotationEnabled": false,
      "rotationIntervalHours": 720,
      "maintenanceWindowStartUtc": 0,
      "maintenanceWindowHours": 1,
      "policyRevision": "1",
      "updatedAt": "2026-08-02T10:00:00.000Z"
    },
    "serverSummary": {
      "available": true,
      "rolloutRequired": true,
      "eligible": 3,
      "ready": 3,
      "pending": 0,
      "degraded": 0,
      "coveragePercent": 100
    },
    "createdAt": "2026-08-02T10:00:00.000Z",
    "updatedAt": "2026-08-02T10:00:00.000Z"
  }],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "totalPages": 1,
    "hasNext": false,
    "hasPrev": false
  },
  "correlationId": "019f0000-0000-7000-8000-000000009001",
  "timestamp": "2026-08-02T12:00:00.000Z"
}
```

The service always orders by `rank ASC, key ASC`; accepted `sortBy` and
`sortDir` do not currently alter that order.

### 2. Get one Application

Request:

```http
GET /api/admin/core/v1/applications/crm HTTP/1.1
Body: none
```

Response — HTTP `200`:

```json
{
  "success": true,
  "data": {
    "contractVersion": 1,
    "id": "019f0000-0000-7000-8000-000000000002",
    "key": "crm",
    "name": "CRM",
    "description": "Customer relationships and sales pipeline.",
    "avatarDataUrl": null,
    "rank": 2,
    "applicationType": "TENANT",
    "commercialMode": "SUBSCRIPTION",
    "catalogueVisibility": "PUBLIC",
    "lifecycleStatus": "ACTIVE",
    "runtimeTarget": "crm-app",
    "publicationStatus": "PUBLISHED",
    "publicationRevision": "2",
    "publishedAt": "2026-08-02T10:30:00.000Z",
    "publishedBy": "019f0000-0000-7000-8000-000000000099",
    "databaseAccessMode": "TENANT_DATABASE",
    "databaseDeployment": "REQUIRED",
    "databasePrincipal": "mutakamel_crm_app",
    "requiredOnDatabaseServer": true,
    "technicalDefinitionRevision": "1",
    "catalogueRevision": "2",
    "activeManifest": {
      "id": "019f0000-0000-7000-8000-000000000501",
      "version": 1,
      "checksum": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "schemaVersion": 1,
      "contractPackage": "@mutakamel/crm-app-contracts",
      "contractVersion": "0.0.7",
      "publicationSource": "MIGRATION",
      "publishedAt": "2026-08-02T10:00:00.000Z",
      "publishedBy": "migration",
      "active": true
    },
    "databasePolicy": {
      "enableOnNewServers": true,
      "rotationEnabled": false,
      "rotationIntervalHours": 720,
      "maintenanceWindowStartUtc": 0,
      "maintenanceWindowHours": 1,
      "policyRevision": "1",
      "updatedAt": "2026-08-02T10:00:00.000Z"
    },
    "serverSummary": {
      "available": true,
      "rolloutRequired": true,
      "eligible": 3,
      "ready": 2,
      "pending": 1,
      "degraded": 0,
      "coveragePercent": 66.66
    },
    "createdAt": "2026-08-02T10:00:00.000Z",
    "updatedAt": "2026-08-02T10:00:00.000Z"
  },
  "correlationId": "019f0000-0000-7000-8000-000000009001",
  "timestamp": "2026-08-02T12:00:00.000Z"
}
```

### 3. List safe database manifests

Request:

```http
GET /api/admin/core/v1/applications/crm/database-manifests HTTP/1.1
Body: none
```

Response — HTTP `200`:

```json
{
  "success": true,
  "data": [{
    "id": "019f0000-0000-7000-8000-000000000501",
    "version": 1,
    "checksum": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "schemaVersion": 1,
    "contractPackage": "@mutakamel/crm-app-contracts",
    "contractVersion": "0.0.7",
    "publicationSource": "MIGRATION",
    "publishedAt": "2026-08-02T10:00:00.000Z",
    "publishedBy": "migration",
    "active": true
  }],
  "correlationId": "019f0000-0000-7000-8000-000000009001",
  "timestamp": "2026-08-02T12:00:00.000Z"
}
```

The manifest JSON, SQL permissions, and credentials are not returned.

### 4. Create a catalogue-only Application draft

Request:

```http
POST /api/admin/core/v1/applications HTTP/1.1
Cookie: __Host-mutakamel-admin-access=<redacted>; __Host-mutakamel-admin-session=<redacted>; __Host-mutakamel-admin-csrf=<csrf-proof>
X-CSRF-Token: <csrf-proof>
x-idempotency-key: 019f0000-0000-7000-8000-00000000a001
Content-Type: application/json

{
  "key": "hr",
  "name": "Human Resources",
  "description": "People operations and workforce management.",
  "applicationType": "TENANT",
  "commercialMode": "SUBSCRIPTION",
  "catalogueVisibility": "PUBLIC"
}
```

Response — HTTP `201`:

```json
{
  "success": true,
  "data": {
    "contractVersion": 1,
    "operation": "CREATE",
    "applicationId": "019f0000-0000-7000-8000-000000000005",
    "applicationKey": "hr",
    "lifecycleStatus": "DRAFT",
    "runtimeTarget": null,
    "databaseAccessMode": "NONE",
    "databaseDeployment": "NONE",
    "databasePrincipal": null,
    "technicalDefinitionRevision": "1",
    "publicationStatus": "UNPUBLISHED",
    "publicationRevision": "1",
    "catalogueRevision": "1",
    "policyRevision": "1",
    "deleted": false
  },
  "correlationId": "019f0000-0000-7000-8000-000000009001",
  "timestamp": "2026-08-02T12:00:00.000Z"
}
```

Create cannot accept a `runtimeTarget`, principal, or manifest. The draft starts with
`databaseAccessMode=NONE`, `databaseDeployment=NONE`, and disabled
new-server/rotation policy. This is the Admin Portal fallback for an actor with
create permission but without the complete onboarding permission set; the
browser does not follow it with hidden technical-provisioning mutations.

### 5. Update Application metadata

Request:

```http
PATCH /api/admin/core/v1/applications/hr HTTP/1.1
Cookie: __Host-mutakamel-admin-access=<redacted>; __Host-mutakamel-admin-session=<redacted>; __Host-mutakamel-admin-csrf=<csrf-proof>
X-CSRF-Token: <csrf-proof>
x-idempotency-key: 019f0000-0000-7000-8000-00000000a002
Content-Type: application/json

{
  "expectedCatalogueRevision": "1",
  "name": "HR",
  "description": "Human resources and workforce operations."
}
```

Response — HTTP `200`:

```json
{
  "success": true,
  "data": {
    "contractVersion": 1,
    "operation": "UPDATE",
    "applicationId": "019f0000-0000-7000-8000-000000000005",
    "applicationKey": "hr",
    "lifecycleStatus": "DRAFT",
    "runtimeTarget": null,
    "publicationStatus": "UNPUBLISHED",
    "publicationRevision": "1",
    "catalogueRevision": "2",
    "policyRevision": "1",
    "deleted": false
  },
  "correlationId": "019f0000-0000-7000-8000-000000009001",
  "timestamp": "2026-08-02T12:00:00.000Z"
}
```

If the edited Application was `PUBLISHED`, the same transaction changes it to
`UNPUBLISHED`, advances `publicationRevision`, clears
`publishedAt`/`publishedBy`, and advances `catalogueRevision`. The UI must warn
before this invalidation, then render the returned/refetched state and require a
separate publish command.

### 6. Delete an unused catalogue-only draft

Request:

```http
DELETE /api/admin/core/v1/applications/hr?expectedCatalogueRevision=2&reason=Draft%20created%20in%20error HTTP/1.1
Cookie: __Host-mutakamel-admin-access=<redacted>; __Host-mutakamel-admin-session=<redacted>; __Host-mutakamel-admin-csrf=<csrf-proof>
X-CSRF-Token: <csrf-proof>
x-idempotency-key: 019f0000-0000-7000-8000-00000000a003
Body: none
```

Response — HTTP `204`: **no response body**.

Only an unreferenced `DRAFT` with `databaseAccessMode=NONE`, no principal, and
no manifest can be deleted.

### 7. Update an Application database policy

Request:

```http
PATCH /api/admin/core/v1/applications/crm/database-policy HTTP/1.1
Cookie: __Host-mutakamel-admin-access=<redacted>; __Host-mutakamel-admin-session=<redacted>; __Host-mutakamel-admin-csrf=<csrf-proof>
X-CSRF-Token: <csrf-proof>
x-idempotency-key: 019f0000-0000-7000-8000-00000000a004
Content-Type: application/json

{
  "expectedPolicyRevision": "1",
  "rotationEnabled": true,
  "rotationIntervalHours": 720,
  "maintenanceWindowStartUtc": 1,
  "maintenanceWindowHours": 2,
  "reason": "Enable managed monthly rotation."
}
```

Response — HTTP `200`:

```json
{
  "success": true,
  "data": {
    "contractVersion": 1,
    "operation": "UPDATE_DATABASE_POLICY",
    "applicationId": "019f0000-0000-7000-8000-000000000002",
    "applicationKey": "crm",
    "lifecycleStatus": "ACTIVE",
    "runtimeTarget": "crm-app",
    "publicationStatus": "PUBLISHED",
    "publicationRevision": "2",
    "catalogueRevision": "2",
    "policyRevision": "2",
    "deleted": false
  },
  "correlationId": "019f0000-0000-7000-8000-000000009001",
  "timestamp": "2026-08-02T12:00:00.000Z"
}
```

Rotation or new-server enablement requires an active database Application with
an active manifest.

### 8. Publish an Application revision

Publication establishes independent, attributable release authority. It does
not activate the Application and does not replace technical readiness checks.

```http
POST /api/admin/core/v1/applications/hr/publish HTTP/1.1
Cookie: __Host-mutakamel-admin-access=<redacted>; __Host-mutakamel-admin-session=<redacted>; __Host-mutakamel-admin-csrf=<csrf-proof>
X-CSRF-Token: <csrf-proof>
x-idempotency-key: 019f0000-0000-7000-8000-00000000a005
Content-Type: application/json

{
  "expectedCatalogueRevision": "2",
  "expectedPublicationRevision": "1",
  "reason": "Commercial and technical review approved."
}
```

Response — HTTP `201`:

```json
{
  "success": true,
  "data": {
    "contractVersion": 1,
    "operation": "PUBLISH",
    "applicationId": "019f0000-0000-7000-8000-000000000005",
    "applicationKey": "hr",
    "lifecycleStatus": "DRAFT",
    "runtimeTarget": "hr-app",
    "publicationStatus": "PUBLISHED",
    "publicationRevision": "2",
    "catalogueRevision": "3",
    "policyRevision": "1",
    "deleted": false
  },
  "correlationId": "019f0000-0000-7000-8000-000000009001",
  "timestamp": "2026-08-05T12:00:00.000Z"
}
```

Core rejects either stale revision, a `DISABLED` Application, and an already
published current revision. Refetch the Application after success to obtain
database-owned `publishedAt` and authenticated `publishedBy` evidence.

### 9. Activate an Application

Request:

```http
POST /api/admin/core/v1/applications/hr/activate HTTP/1.1
Cookie: __Host-mutakamel-admin-access=<redacted>; __Host-mutakamel-admin-session=<redacted>; __Host-mutakamel-admin-csrf=<csrf-proof>
X-CSRF-Token: <csrf-proof>
x-idempotency-key: 019f0000-0000-7000-8000-00000000a006
Content-Type: application/json

{
  "expectedCatalogueRevision": "3",
  "reason": "Technical release and manifest validation completed."
}
```

Response — HTTP `201`:

```json
{
  "success": true,
  "data": {
    "contractVersion": 1,
    "operation": "ACTIVATE",
    "applicationId": "019f0000-0000-7000-8000-000000000005",
    "applicationKey": "hr",
    "lifecycleStatus": "ACTIVE",
    "runtimeTarget": "hr-app",
    "publicationStatus": "PUBLISHED",
    "publicationRevision": "2",
    "catalogueRevision": "4",
    "policyRevision": "1",
    "deleted": false
  },
  "correlationId": "019f0000-0000-7000-8000-000000009001",
  "timestamp": "2026-08-02T12:00:00.000Z"
}
```

Allowed transitions are `DRAFT -> ACTIVE` and `DEPRECATED -> ACTIVE`.
Activation additionally requires attributable `PUBLISHED` state and technical
`activationAllowed=true`; publication alone is insufficient.

### 10. Deprecate an Application

Request:

```http
POST /api/admin/core/v1/applications/crm/deprecate HTTP/1.1
Cookie: __Host-mutakamel-admin-access=<redacted>; __Host-mutakamel-admin-session=<redacted>; __Host-mutakamel-admin-csrf=<csrf-proof>
X-CSRF-Token: <csrf-proof>
x-idempotency-key: 019f0000-0000-7000-8000-00000000a007
Content-Type: application/json

{
  "expectedCatalogueRevision": "2",
  "reason": "Replacement application is available."
}
```

Response — HTTP `201`:

```json
{
  "success": true,
  "data": {
    "contractVersion": 1,
    "operation": "DEPRECATE",
    "applicationId": "019f0000-0000-7000-8000-000000000002",
    "applicationKey": "crm",
    "lifecycleStatus": "DEPRECATED",
    "runtimeTarget": "crm-app",
    "publicationStatus": "PUBLISHED",
    "publicationRevision": "2",
    "catalogueRevision": "3",
    "policyRevision": "2",
    "deleted": false
  },
  "correlationId": "019f0000-0000-7000-8000-000000009001",
  "timestamp": "2026-08-02T12:00:00.000Z"
}
```

Allowed transition: `ACTIVE -> DEPRECATED`. Deprecation does not silently
rewrite the Application's deployment profile or clear `enableOnNewServers`;
the existing installed fleet remains governed by the explicit profile/policy.

### 11. Disable an Application

Request:

```http
POST /api/admin/core/v1/applications/crm/disable HTTP/1.1
Cookie: __Host-mutakamel-admin-access=<redacted>; __Host-mutakamel-admin-session=<redacted>; __Host-mutakamel-admin-csrf=<csrf-proof>
X-CSRF-Token: <csrf-proof>
x-idempotency-key: 019f0000-0000-7000-8000-00000000a008
Content-Type: application/json

{
  "expectedCatalogueRevision": "3",
  "reason": "Emergency suspension pending security review."
}
```

Response — HTTP `201`:

```json
{
  "success": true,
  "data": {
    "contractVersion": 1,
    "operation": "DISABLE",
    "applicationId": "019f0000-0000-7000-8000-000000000002",
    "applicationKey": "crm",
    "lifecycleStatus": "DISABLED",
    "runtimeTarget": "crm-app",
    "publicationStatus": "PUBLISHED",
    "publicationRevision": "2",
    "catalogueRevision": "4",
    "policyRevision": "2",
    "deleted": false
  },
  "correlationId": "019f0000-0000-7000-8000-000000009001",
  "timestamp": "2026-08-02T12:00:00.000Z"
}
```

Allowed transitions are `ACTIVE -> DISABLED` and
`DEPRECATED -> DISABLED`. DISABLED has no reactivation transition in V1. Core
turns off credential rotation for the disabled Application but does not erase
its deployment profile or fleet-membership evidence.

### 12. List global catalogue audit

Request:

```http
GET /api/admin/core/v1/catalog/audit?page=1&limit=20&entityType=PRICE_LADDER&from=2026-08-01T00:00:00.000Z HTTP/1.1
Body: none
```

Response — HTTP `200`:

```json
{
  "success": true,
  "data": {
    "items": [{
      "id": "019f0000-0000-7000-8000-000000000701",
      "schemaVersion": 1,
      "entityType": "PRICE_LADDER",
      "action": "PRICE_LADDER_REPLACED",
      "entityId": "019f0000-0000-7000-8000-000000000101",
      "moduleId": "019f0000-0000-7000-8000-000000000002",
      "tierId": "019f0000-0000-7000-8000-000000000101",
      "actorAdminId": "019f0000-0000-7000-8000-000000000601",
      "actorLabel": "Platform Admin",
      "operationId": "019f0000-0000-7000-8000-000000000801",
      "idempotencyKey": "019f0000-0000-7000-8000-00000000a011",
      "sourceType": "PRICE_LADDER_COMMAND",
      "sourceId": "019f0000-0000-7000-8000-000000000901",
      "before": null,
      "after": {"billingCycle": "MONTHLY", "brackets": []},
      "diff": [{"field": "billingCycle", "after": "MONTHLY"}],
      "correlationId": "019f0000-0000-7000-8000-000000009001",
      "metadata": null,
      "occurredAt": "2026-08-02T11:30:00.000Z"
    }],
    "total": 1,
    "page": 1,
    "limit": 20,
    "totalPages": 1
  },
  "correlationId": "019f0000-0000-7000-8000-000000009001",
  "timestamp": "2026-08-02T12:00:00.000Z"
}
```

Filters: `entityType`, `action`, UUIDv7 `actorAdminId`, ISO `from`, and ISO
`to`. `to` is exclusive. Audit sorting is newest first.

### 13. List Application-scoped audit

Request:

```http
GET /api/admin/core/v1/applications/019f0000-0000-7000-8000-000000000002/audit?page=1&limit=20 HTTP/1.1
Body: none
```

Response — HTTP `200`:

```json
{
  "success": true,
  "data": {
    "items": [{
      "id": "019f0000-0000-7000-8000-000000000702",
      "schemaVersion": 1,
      "entityType": "APPLICATION",
      "action": "APPLICATION_UPDATED",
      "entityId": "019f0000-0000-7000-8000-000000000002",
      "moduleId": "019f0000-0000-7000-8000-000000000002",
      "tierId": null,
      "actorAdminId": "019f0000-0000-7000-8000-000000000601",
      "actorLabel": "Platform Admin",
      "operationId": "019f0000-0000-7000-8000-000000000802",
      "idempotencyKey": "019f0000-0000-7000-8000-00000000a002",
      "sourceType": "APPLICATION_COMMAND",
      "sourceId": "019f0000-0000-7000-8000-000000000902",
      "before": {"name": "CRM"},
      "after": {"name": "Customer CRM"},
      "diff": [{"field": "name", "before": "CRM", "after": "Customer CRM"}],
      "correlationId": "019f0000-0000-7000-8000-000000009001",
      "metadata": null,
      "occurredAt": "2026-08-02T11:00:00.000Z"
    }],
    "total": 1,
    "page": 1,
    "limit": 20,
    "totalPages": 1
  },
  "correlationId": "019f0000-0000-7000-8000-000000009001",
  "timestamp": "2026-08-02T12:00:00.000Z"
}
```

The path parameter is Application UUIDv7, not `applicationKey`. The response
retains `moduleId` as the current legacy wire field.

### 14. Create a tier

Request:

```http
POST /api/admin/core/v1/applications/019f0000-0000-7000-8000-000000000002/tiers HTTP/1.1
Cookie: __Host-mutakamel-admin-access=<redacted>; __Host-mutakamel-admin-session=<redacted>; __Host-mutakamel-admin-csrf=<csrf-proof>
X-CSRF-Token: <csrf-proof>
Content-Type: application/json

{
  "key": "professional",
  "name": "Professional",
  "color": "#7c3aed",
  "isActive": true
}
```

Response — HTTP `201`:

```json
{
  "success": true,
  "data": {
    "id": "019f0000-0000-7000-8000-000000000101",
    "moduleId": "019f0000-0000-7000-8000-000000000002",
    "key": "professional",
    "name": "Professional",
    "rank": 1,
    "color": "#7c3aed",
    "isActive": true,
    "createdAt": "2026-08-02T12:00:00.000Z",
    "updatedAt": "2026-08-02T12:00:00.000Z",
    "deletedAt": null
  },
  "correlationId": "019f0000-0000-7000-8000-000000009001",
  "timestamp": "2026-08-02T12:00:00.000Z"
}
```

No idempotency header is accepted as a contract requirement for this
non-idempotent create. Rank is assigned after the current maximum.

### 15. List Application tiers

Request:

```http
GET /api/admin/core/v1/applications/019f0000-0000-7000-8000-000000000002/tiers HTTP/1.1
Body: none
```

Response — HTTP `200`:

```json
{
  "success": true,
  "data": [{
    "id": "019f0000-0000-7000-8000-000000000101",
    "moduleId": "019f0000-0000-7000-8000-000000000002",
    "key": "professional",
    "name": "Professional",
    "rank": 1,
    "color": "#7c3aed",
    "isActive": true,
    "createdAt": "2026-08-02T12:00:00.000Z",
    "updatedAt": "2026-08-02T12:00:00.000Z",
    "deletedAt": null
  }],
  "correlationId": "019f0000-0000-7000-8000-000000009001",
  "timestamp": "2026-08-02T12:00:00.000Z"
}
```

Complete bounded list, maximum 100, sorted by rank. A valid unknown
Application UUID currently produces `data: []`.

### 16. Update a tier

Request:

```http
PATCH /api/admin/core/v1/tiers/019f0000-0000-7000-8000-000000000101 HTTP/1.1
Cookie: __Host-mutakamel-admin-access=<redacted>; __Host-mutakamel-admin-session=<redacted>; __Host-mutakamel-admin-csrf=<csrf-proof>
X-CSRF-Token: <csrf-proof>
x-idempotency-key: 019f0000-0000-7000-8000-00000000a008
Content-Type: application/json

{
  "name": "Professional Plus",
  "rank": 2,
  "color": "#6d28d9",
  "isActive": true
}
```

Response — HTTP `200`:

```json
{
  "success": true,
  "data": {
    "id": "019f0000-0000-7000-8000-000000000101",
    "moduleId": "019f0000-0000-7000-8000-000000000002",
    "key": "professional",
    "name": "Professional Plus",
    "rank": 2,
    "color": "#6d28d9",
    "isActive": true,
    "createdAt": "2026-08-02T12:00:00.000Z",
    "updatedAt": "2026-08-02T12:05:00.000Z",
    "deletedAt": null
  },
  "correlationId": "019f0000-0000-7000-8000-000000009001",
  "timestamp": "2026-08-02T12:05:00.000Z"
}
```

`(moduleId, rank)` is unique. There is no atomic tier reorder endpoint; do not
implement a multi-request swap that may partially succeed.

### 17. Delete a tier

Request:

```http
DELETE /api/admin/core/v1/tiers/019f0000-0000-7000-8000-000000000101 HTTP/1.1
Cookie: __Host-mutakamel-admin-access=<redacted>; __Host-mutakamel-admin-session=<redacted>; __Host-mutakamel-admin-csrf=<csrf-proof>
X-CSRF-Token: <csrf-proof>
x-idempotency-key: 019f0000-0000-7000-8000-00000000a009
Body: none
```

Response — HTTP `204`: **no response body**.

A tier referenced by a subscription returns `TIER_IN_USE`; deactivate it
instead.

### 18. Create a feature

Request:

```http
POST /api/admin/core/v1/applications/019f0000-0000-7000-8000-000000000002/features HTTP/1.1
Cookie: __Host-mutakamel-admin-access=<redacted>; __Host-mutakamel-admin-session=<redacted>; __Host-mutakamel-admin-csrf=<csrf-proof>
X-CSRF-Token: <csrf-proof>
Content-Type: application/json

{
  "key": "crm.forecasting",
  "name": "Forecasting",
  "description": "Pipeline revenue forecasts.",
  "rank": 14,
  "isActive": true
}
```

Response — HTTP `201`:

```json
{
  "success": true,
  "data": {
    "id": "019f0000-0000-7000-8000-000000000201",
    "moduleId": "019f0000-0000-7000-8000-000000000002",
    "key": "crm.forecasting",
    "name": "Forecasting",
    "description": "Pipeline revenue forecasts.",
    "rank": 14,
    "isActive": true,
    "createdAt": "2026-08-02T12:00:00.000Z",
    "updatedAt": "2026-08-02T12:00:00.000Z",
    "deletedAt": null
  },
  "correlationId": "019f0000-0000-7000-8000-000000009001",
  "timestamp": "2026-08-02T12:00:00.000Z"
}
```

No idempotency header is required. The service does not enforce that the
feature key prefix matches the parent Application key; the UI should enforce
that product convention.

### 19. List Application features

Request:

```http
GET /api/admin/core/v1/applications/019f0000-0000-7000-8000-000000000002/features HTTP/1.1
Body: none
```

Response — HTTP `200`:

```json
{
  "success": true,
  "data": [{
    "id": "019f0000-0000-7000-8000-000000000201",
    "moduleId": "019f0000-0000-7000-8000-000000000002",
    "key": "crm.forecasting",
    "name": "Forecasting",
    "description": "Pipeline revenue forecasts.",
    "rank": 14,
    "isActive": true,
    "createdAt": "2026-08-02T12:00:00.000Z",
    "updatedAt": "2026-08-02T12:00:00.000Z",
    "deletedAt": null
  }],
  "correlationId": "019f0000-0000-7000-8000-000000009001",
  "timestamp": "2026-08-02T12:00:00.000Z"
}
```

Complete bounded list, maximum 200, sorted by rank then key. A valid unknown
Application UUID currently produces `data: []`.

### 20. Update a feature

Request:

```http
PATCH /api/admin/core/v1/features/019f0000-0000-7000-8000-000000000201 HTTP/1.1
Cookie: __Host-mutakamel-admin-access=<redacted>; __Host-mutakamel-admin-session=<redacted>; __Host-mutakamel-admin-csrf=<csrf-proof>
X-CSRF-Token: <csrf-proof>
x-idempotency-key: 019f0000-0000-7000-8000-00000000a010
Content-Type: application/json

{
  "name": "Revenue Forecasting",
  "description": "Governed pipeline revenue forecasting.",
  "rank": 14,
  "isActive": true
}
```

Response — HTTP `200`:

```json
{
  "success": true,
  "data": {
    "id": "019f0000-0000-7000-8000-000000000201",
    "moduleId": "019f0000-0000-7000-8000-000000000002",
    "key": "crm.forecasting",
    "name": "Revenue Forecasting",
    "description": "Governed pipeline revenue forecasting.",
    "rank": 14,
    "isActive": true,
    "createdAt": "2026-08-02T12:00:00.000Z",
    "updatedAt": "2026-08-02T12:10:00.000Z",
    "deletedAt": null
  },
  "correlationId": "019f0000-0000-7000-8000-000000009001",
  "timestamp": "2026-08-02T12:10:00.000Z"
}
```

### 21. Delete a feature

Request:

```http
DELETE /api/admin/core/v1/features/019f0000-0000-7000-8000-000000000201 HTTP/1.1
Cookie: __Host-mutakamel-admin-access=<redacted>; __Host-mutakamel-admin-session=<redacted>; __Host-mutakamel-admin-csrf=<csrf-proof>
X-CSRF-Token: <csrf-proof>
x-idempotency-key: 019f0000-0000-7000-8000-00000000a012
Body: none
```

Response — HTTP `204`: **no response body**.

The frontend must refetch feature and grant state after deletion. Existing
grant rows are not an alternative authorization authority.

### 22. List a tier's feature grants

Request:

```http
GET /api/admin/core/v1/tiers/019f0000-0000-7000-8000-000000000101/features HTTP/1.1
Body: none
```

Response — HTTP `200`:

```json
{
  "success": true,
  "data": [{
    "id": "019f0000-0000-7000-8000-000000000301",
    "tierId": "019f0000-0000-7000-8000-000000000101",
    "featureId": "019f0000-0000-7000-8000-000000000201",
    "config": null,
    "configRevision": 1,
    "createdAt": "2026-08-02T12:00:00.000Z",
    "updatedAt": "2026-08-02T12:00:00.000Z"
  }],
  "correlationId": "019f0000-0000-7000-8000-000000009001",
  "timestamp": "2026-08-02T12:00:00.000Z"
}
```

The response does not join feature names or keys. Join it to the parent
Application feature list by `featureId`.

### 23. Replace a tier's complete feature grants

Request:

```http
PATCH /api/admin/core/v1/tiers/019f0000-0000-7000-8000-000000000101/features HTTP/1.1
Cookie: __Host-mutakamel-admin-access=<redacted>; __Host-mutakamel-admin-session=<redacted>; __Host-mutakamel-admin-csrf=<csrf-proof>
X-CSRF-Token: <csrf-proof>
x-idempotency-key: 019f0000-0000-7000-8000-00000000a013
Content-Type: application/json

{
  "features": [
    {
      "featureId": "019f0000-0000-7000-8000-000000000201",
      "config": null
    }
  ]
}
```

Response — HTTP `200`:

```json
{
  "success": true,
  "data": [{
    "id": "019f0000-0000-7000-8000-000000000301",
    "tierId": "019f0000-0000-7000-8000-000000000101",
    "featureId": "019f0000-0000-7000-8000-000000000201",
    "config": null,
    "configRevision": 1,
    "createdAt": "2026-08-02T12:00:00.000Z",
    "updatedAt": "2026-08-02T12:00:00.000Z"
  }],
  "correlationId": "019f0000-0000-7000-8000-000000009001",
  "timestamp": "2026-08-02T12:00:00.000Z"
}
```

This is a complete replacement; `features: []` revokes all grants. Send one
independent command and idempotency key per changed tier.

### 24. List price ladders

Request:

```http
GET /api/admin/core/v1/tiers/019f0000-0000-7000-8000-000000000101/price-tiers?billingCycle=MONTHLY HTTP/1.1
Body: none
```

Response — HTTP `200`:

```json
{
  "success": true,
  "data": [{
    "id": "019f0000-0000-7000-8000-000000000401",
    "tierId": "019f0000-0000-7000-8000-000000000101",
    "billingCycle": "MONTHLY",
    "minUsers": 1,
    "maxUsers": null,
    "unitPrice": "15.0000",
    "createdAt": "2026-08-02T12:00:00.000Z",
    "updatedAt": "2026-08-02T12:00:00.000Z"
  }],
  "correlationId": "019f0000-0000-7000-8000-000000009001",
  "timestamp": "2026-08-02T12:00:00.000Z"
}
```

Omit `billingCycle` to receive both ladders. The current controller does not
runtime-validate this query parameter; constrain the UI to `MONTHLY|ANNUAL`.

### 25. Replace one complete price ladder

Request:

```http
PATCH /api/admin/core/v1/tiers/019f0000-0000-7000-8000-000000000101/price-tiers HTTP/1.1
Cookie: __Host-mutakamel-admin-access=<redacted>; __Host-mutakamel-admin-session=<redacted>; __Host-mutakamel-admin-csrf=<csrf-proof>
X-CSRF-Token: <csrf-proof>
x-idempotency-key: 019f0000-0000-7000-8000-00000000a014
Content-Type: application/json

{
  "billingCycle": "MONTHLY",
  "brackets": [
    {"minUsers": 1, "maxUsers": 10, "unitPrice": "15.00"},
    {"minUsers": 11, "maxUsers": null, "unitPrice": "12.5000"}
  ]
}
```

Response — HTTP `200`:

```json
{
  "success": true,
  "data": [
    {
      "id": "019f0000-0000-7000-8000-000000000401",
      "tierId": "019f0000-0000-7000-8000-000000000101",
      "billingCycle": "MONTHLY",
      "minUsers": 1,
      "maxUsers": 10,
      "unitPrice": "15.0000",
      "createdAt": "2026-08-02T12:00:00.000Z",
      "updatedAt": "2026-08-02T12:00:00.000Z"
    },
    {
      "id": "019f0000-0000-7000-8000-000000000402",
      "tierId": "019f0000-0000-7000-8000-000000000101",
      "billingCycle": "MONTHLY",
      "minUsers": 11,
      "maxUsers": null,
      "unitPrice": "12.5000",
      "createdAt": "2026-08-02T12:00:00.000Z",
      "updatedAt": "2026-08-02T12:00:00.000Z"
    }
  ],
  "correlationId": "019f0000-0000-7000-8000-000000009001",
  "timestamp": "2026-08-02T12:00:00.000Z"
}
```

An identical canonical ladder preserves IDs and timestamps. A changed ladder
soft-deletes the old rows and creates new IDs; replace local state from the
response. Never convert money through JavaScript `number`.

### 26. List managed currency rates

Request:

```http
GET /api/admin/core/v1/billing/currency-rates HTTP/1.1
Body: none
```

Response — HTTP `200`:

```json
{
  "success": true,
  "data": [
    {"currencyCode": "AED", "currencyUnitsPerUsd": "3.670000000000", "isActive": true},
    {"currencyCode": "EGP", "currencyUnitsPerUsd": "48.000000000000", "isActive": true},
    {"currencyCode": "EUR", "currencyUnitsPerUsd": "0.920000000000", "isActive": true},
    {"currencyCode": "SAR", "currencyUnitsPerUsd": "3.750000000000", "isActive": true}
  ],
  "correlationId": "019f0000-0000-7000-8000-000000009001",
  "timestamp": "2026-08-02T12:00:00.000Z"
}
```

The list includes active and inactive non-USD rows, sorted by currency code.

### 27. Batch upsert managed currency rates

Request:

```http
PATCH /api/admin/core/v1/billing/currency-rates HTTP/1.1
Cookie: __Host-mutakamel-admin-access=<redacted>; __Host-mutakamel-admin-session=<redacted>; __Host-mutakamel-admin-csrf=<csrf-proof>
X-CSRF-Token: <csrf-proof>
x-idempotency-key: 019f0000-0000-7000-8000-00000000a015
Content-Type: application/json

{
  "rates": [
    {"currencyCode": "EUR", "currencyUnitsPerUsd": "0.93", "isActive": true},
    {"currencyCode": "GBP", "currencyUnitsPerUsd": "0.79", "isActive": true}
  ]
}
```

Response — HTTP `200`:

```json
{
  "success": true,
  "data": [
    {"currencyCode": "EUR", "currencyUnitsPerUsd": "0.930000000000", "isActive": true},
    {"currencyCode": "GBP", "currencyUnitsPerUsd": "0.790000000000", "isActive": true}
  ],
  "correlationId": "019f0000-0000-7000-8000-000000009001",
  "timestamp": "2026-08-02T12:00:00.000Z"
}
```

This is a transactional batch upsert, not a complete replacement. Omitted
currencies remain unchanged. The response contains only supplied rows; refetch
the list when the screen needs the complete catalogue.

### 28. Upsert one managed currency rate

Request:

```http
PATCH /api/admin/core/v1/billing/currency-rates/EUR HTTP/1.1
Cookie: __Host-mutakamel-admin-access=<redacted>; __Host-mutakamel-admin-session=<redacted>; __Host-mutakamel-admin-csrf=<csrf-proof>
X-CSRF-Token: <csrf-proof>
x-idempotency-key: 019f0000-0000-7000-8000-00000000a016
Content-Type: application/json

{
  "currencyUnitsPerUsd": "0.93",
  "isActive": true
}
```

Response — HTTP `200`:

```json
{
  "success": true,
  "data": {
    "currencyCode": "EUR",
    "currencyUnitsPerUsd": "0.930000000000",
    "isActive": true
  },
  "correlationId": "019f0000-0000-7000-8000-000000009001",
  "timestamp": "2026-08-02T12:00:00.000Z"
}
```

The path code is trimmed and uppercased. USD returns
`BASE_CURRENCY_FIXED`. Every successful upsert appends an internal immutable
rate revision, even if the submitted values are unchanged.

## Lifecycle, security, and commercial invariants

1. Application `key`, stored `runtimeTarget`, and database principal are
   immutable protocol identity; display name is never routing, Worker target,
   or credential identity.
2. `SYSTEM` cannot use `SUBSCRIPTION`. A public SYSTEM Application must use
   `INCLUDED`.
3. A database-enabled Application cannot become ACTIVE without its fixed
   principal and a valid active manifest.
4. `databaseDeployment` is the canonical closed profile. `PREWARM` and
   `REQUIRED` enroll on new servers; only `REQUIRED` makes exact operational
   fleet coverage an Application activation/re-publication gate.
5. Manifest responses expose evidence only, never raw grants, SQL, passwords,
   or secret references.
6. Application updates use `catalogueRevision`; publication uses both
   `catalogueRevision` and `publicationRevision`; policy updates use
   `policyRevision`. Stale writes fail closed.
7. Mutable metadata changes invalidate an existing publication, advance its
   revision, clear attribution, and require explicit re-publication. Neither
   metadata update nor lifecycle transition auto-publishes.
8. Activation requires attributable `PUBLISHED` state plus technical
   readiness. New selection requires `ACTIVE`, `PUBLISHED`, `PUBLIC`,
   commercial eligibility, and technical readiness.
9. Deprecation prevents new selection but preserves an installed
   `PUBLISHED` runtime authority. Installed runtime accepts only `ACTIVE` or
   `DEPRECATED`; `DRAFT`, `DISABLED`, or `UNPUBLISHED` is not valid authority.
10. Tier/feature/grant/price configuration is independent. Admin screens must
   show each active state explicitly and must not infer entitlement merely from
   the presence of a row.
11. Grant replacement and price replacement are whole-resource commands, not
   incremental patches.
12. Prices and currency rates are exact decimal strings. Do not use
   `parseFloat`, locale-formatted numbers, or binary floating-point state to
   build requests.
13. Currency rate means quote-currency units per USD. USD remains fixed.
14. All permission pairs in the matrix use ALL semantics. UI hiding is not an
   authorization boundary.
15. A `403` is not an empty list. Preserve forbidden, validation, conflict,
   in-flight, unavailable, and retry states separately.

## Error catalogue for frontend handling

Application errors:

- `APPLICATION_NOT_FOUND`
- `APPLICATION_KEY_TAKEN`
- `APPLICATION_IDENTITY_TAKEN`
- `APPLICATION_TECHNICAL_IDENTITY_INVALID`
- `TENANT_RUNTIME_ONLY_PROVISIONING_NOT_SUPPORTED`
- `APPLICATION_UPDATE_EMPTY`
- `APPLICATION_PUBLICATION_REVISION_STALE`
- `APPLICATION_ALREADY_PUBLISHED`
- `APPLICATION_PUBLICATION_REQUIRED`
- `APPLICATION_DISABLED`
- `APPLICATION_POLICY_UPDATE_EMPTY`
- `APPLICATION_CATALOGUE_REVISION_STALE`
- `APPLICATION_POLICY_REVISION_STALE`
- `APPLICATION_SYSTEM_SUBSCRIPTION_FORBIDDEN`
- `APPLICATION_SYSTEM_PUBLIC_SHAPE_INVALID`
- `APPLICATION_DELETE_NOT_CATALOGUE_ONLY`
- `APPLICATION_IN_USE`
- `APPLICATION_DATABASE_ENABLEMENT_NOT_READY`
- `APPLICATION_DATABASE_ROTATION_NOT_READY`
- `APPLICATION_REQUIRED_DATABASE_COVERAGE_INCOMPLETE`
- `APPLICATION_POLICY_UNCHANGED`
- `APPLICATION_LIFECYCLE_TRANSITION_INVALID`
- `APPLICATION_RUNTIME_TARGET_REQUIRED`
- `APPLICATION_TECHNICAL_BINDING_REQUIRES_DRAFT`
- `APPLICATION_COMPONENT_BINDING_NOT_REQUIRED`
- `APPLICATION_COMPONENT_ALREADY_BOUND`
- `APPLICATION_COMPONENT_KEY_TAKEN`
- `APPLICATION_TECHNICAL_PROVISIONING_NOT_READY`
- `APPLICATION_SELECTION_NOT_ALLOWED`
- `APPLICATION_MANIFEST_REQUIRED`
- `APPLICATION_MANIFEST_NOT_FOUND`
- `APPLICATION_MANIFEST_SHAPE_INVALID`
- `APPLICATION_MANIFEST_SCHEMA_UNSUPPORTED`
- `APPLICATION_MANIFEST_APPLICATION_MISMATCH`
- `APPLICATION_MANIFEST_PRINCIPAL_MISMATCH`
- `APPLICATION_MANIFEST_COMPONENT_RELEASE_INVALID`
- `APPLICATION_MANIFEST_SCHEMAS_INVALID`
- `APPLICATION_MANIFEST_RELATION_GRANTS_INVALID`
- `APPLICATION_MANIFEST_COLUMN_GRANTS_INVALID`
- `APPLICATION_MANIFEST_SEQUENCE_GRANTS_INVALID`
- `APPLICATION_MANIFEST_FUNCTION_GRANTS_INVALID`
- `APPLICATION_MANIFEST_VERIFICATION_CHECKS_INVALID`
- `INVALID_IDEMPOTENCY_KEY`, `IDEMPOTENCY_KEY_REUSED`,
  `APPLICATION_COMMAND_INCOMPLETE`

Commercial catalogue errors:

- `MODULE_NOT_FOUND` — legacy machine code for a missing Application parent
- `TIER_NOT_FOUND`, `TIER_KEY_TAKEN`, `TIER_RANK_TAKEN`, `TIER_IN_USE`,
  `TIER_CATALOG_INCOMPLETE`
- `FEATURE_NOT_FOUND`, `FEATURE_KEY_TAKEN`, `FEATURE_CATALOG_INCOMPLETE`
- `TIER_FEATURE_CATALOG_INCOMPLETE`, `TIER_FEATURE_LIMIT_EXCEEDED`,
  `DUPLICATE_FEATURE`, `FEATURE_MODULE_MISMATCH`,
  `TIER_FEATURE_COMMAND_INCOMPLETE`
- `CRM_OUTBOUND_EMAIL_POLICY_INVALID`
- `PRICE_LADDER_INVALID`, `PRICE_LADDER_INCOMPLETE`,
  `PRICE_TIER_COMMAND_INCOMPLETE`
- `CURRENCY_CODE_INVALID`, `CURRENCY_RATE_REQUIRED`,
  `CURRENCY_RATE_INVALID`, `DUPLICATE_CURRENCY_RATE`,
  `BASE_CURRENCY_FIXED`, `CURRENCY_RATE_LIMIT_REACHED`,
  `CURRENCY_RATE_CATALOG_INCOMPLETE`, `CURRENCY_RATE_COMMAND_INCOMPLETE`

DTO validation, UUIDv7, unknown fields, array limits, and decimal formats
usually return HTTP `400` with Core `details`. Service invariants commonly
return `409` or `422`. Frontend behavior must branch on the returned HTTP
status and machine code, not on an assumed status derived only from this list.

Gateway failures relevant to every route include `GW.AUTH.*`,
`GW.RATE.LIMIT_EXCEEDED`, `GW.UPSTREAM.UNAVAILABLE`, and
`GW.BODY.TOO_LARGE`. Idempotent routes additionally expose
`GW.IDEM.MISSING`, `GW.IDEM.BAD_VALUE`, `GW.IDEM.IN_FLIGHT`, and
`GW.IDEM.MISMATCH`.

The permission seed still contains `admin.catalog.destroy`, but no current
Application Catalogue controller or Gateway route consumes it. Do not gate a
visible action with this unused legacy permission.

## Current frontend implementation and remaining gates

Implemented in active frontend source:

- the Application list wires create, all documented filters including
  publication and database deployment, independent lifecycle/publication/
  deployment columns, real totals, error retry, and the global audit route;
- the `/applications-catalogue` permission boundary renders a narrow
  registration-only page for create-without-read actors, and that branch mounts
  neither the Application-list hook nor commercial-catalogue reads;
- the create modal uses one `/applications/onboarding` call and one stable
  UUIDv7 intent when the actor has create+update+critical; an actor with only
  create uses the catalogue-only `/applications` fallback and no client-side
  adoption/binding chain;
- Application detail exposes metadata and database-policy revision-fenced
  editing, reasoned lifecycle commands, DRAFT-only deletion, and manifest
  evidence with independent retry state;
- list, detail, and mutation receipts consume the canonical
  `databaseDeployment` profile; detail renders Core's real `serverSummary`
  fleet counts and percentage rather than a local Database Server-list
  approximation;
- Application detail independently loads a technical-readiness projection and
  implements separate stable-intent stale/in-flight recovery for deterministic
  technical adoption and primary-component binding;
- Application detail renders the release-authority rail, publishes with both
  revision fences and a caller-owned UUIDv7 intent, warns that published
  metadata edits invalidate publication, and gates activation on attributable
  publication plus technical readiness;
- readiness uses the exact fields, reasons, checks, and selection blockers;
  the UI previews Core's deterministic identity, adopts it while `DRAFT`, then
  binds the derived primary component only when Core reports
  `COMPONENT_BINDING_REQUIRED`, without submitting a routing target, principal,
  component key, or contract version; unbound `SYSTEM` Applications remain
  component-free;
- the commercial control rail implements tiers, features, complete entitlement
  replacement, contiguous monthly/annual USD ladders, and paginated
  Application-scoped audit;
- Application, catalogue, audit, and selected-tier reads are abortable and
  identity/generation fenced. Each Application detail route instance also owns
  an immutable in-memory token, so a delayed Application A response or mutation
  reconciliation cannot overwrite/abort Application B, and an older A command
  cannot claim a later A route instance after an A-to-B-to-A navigation.
  Route changes close resource and lifecycle dialogs before another command can
  be submitted;
- implemented clients use canonical Gateway paths and exact PATCH/POST/DELETE
  semantics, including non-replayed tier/feature creation with explicit
  ambiguity recovery;
- idempotent writes rotate their command key after a definitive `4xx`, retain
  it for `GW.IDEM.IN_FLIGHT`, network, and `5xx` outcomes, and refetch
  authoritative state before the next operator decision;
- lifecycle and catalogue-resource dialogs own focus, trap Tab, support Escape
  and backdrop dismissal while idle, lock body scroll, and restore the opener;
- managed currencies support single and transactional batch upsert, decimal
  strings, caller-owned UUIDv7 keys, both required permissions, and normalized
  Core/Gateway errors;
- targeted contract, API-client, and readiness-state tests encode the current
  publication and runtime-target source behavior.

Remaining runtime and operational gates:

- authenticated browser E2E still needs to prove permission denial, revision
  conflict, replay/in-flight recovery, and successful mutation refetch against
  a running Gateway/Core stack;
- list, audit, detail, technical-readiness, binding, metadata-policy, lifecycle,
  and commercial controls have Arabic RTL and English LTR source coverage;
- live PostgreSQL privilege, multi-replica convergence, and deployment evidence
  remain backend/operational gates and are not established by frontend source.

## Backend source map

Paths are relative to `C:\mutakamel.ai\frontend`:

- `../backend/mutakamel-apps/api-gateway-app/src/routing-proxy/route-contracts/core.route-contracts.ts`
- `../backend/mutakamel-apps/api-gateway-app/src/idempotency/gateway-idempotency.service.ts`
- `../backend/mutakamel-apps/api-gateway-app/src/common/gateway.types.ts`
- `../backend/mutakamel-apps/api-gateway-app/src/common/gateway-error.catalog.ts`
- `../backend/mutakamel-apps/core-app/src/admin/catalog/applications.controller.ts`
- `../backend/mutakamel-apps/core-app/src/admin/catalog/applications.service.ts`
- `../backend/mutakamel-apps/core-app/src/admin/catalog/catalog.controller.ts`
- `../backend/mutakamel-apps/core-app/src/admin/catalog/catalog.service.ts`
- `../backend/mutakamel-apps/core-app/src/admin/catalog/price-tiers.service.ts`
- `../backend/mutakamel-apps/core-app/src/admin/catalog/currency-rates.service.ts`
- `../backend/mutakamel-apps/core-app/src/admin/catalog/price-ladder.ts`
- `../backend/mutakamel-apps/core-app/src/admin/catalog/dto/`
- `../backend/mutakamel-apps/core-app/src/admin/catalog/audit/`
- `../backend/mutakamel-apps/core-app/packages/contracts/src/application-catalogue/`
- `../backend/mutakamel-apps/core-app/packages/database/src/enums/application-catalogue.enum.ts`
- `../backend/mutakamel-apps/core-app/packages/database/src/entities/control-plane/`
- `../backend/mutakamel-apps/core-app/packages/database/src/seeds/control-plane/catalog.seed.ts`
- `../backend/mutakamel-apps/shared-libs/packages/common/src/interceptors/response-envelope.interceptor.ts`
- `../backend/mutakamel-apps/shared-libs/packages/common/src/filters/all-exceptions.filter.ts`
- `../backend/mutakamel-apps/shared-libs/packages/email/src/feature-policy/crm-outbound-email-feature-policy.ts`
