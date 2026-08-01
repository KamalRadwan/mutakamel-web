# Tenant Storage Server Migrations

Last source verification: **2026-07-30**.

This document defines the Admin Portal contract for moving an existing tenant
between Storage Servers. It is separate from tenant profile editing and from
Storage Server registry administration.

The backend migration authority and all eight Gateway routes exist in source.
The feature remains **default-off and not frontend-ready for production**.
Do not expose a tenant “Change storage” action until the release and read-model
gates in this document are closed.

## Non-negotiable boundary

- Tenant creation requires `storageServerId`.
- Tenant detail displays the current safe Storage Server projection.
- `PATCH /api/admin/core/v1/tenants/:id` never accepts `storageServerId`.
- Existing-tenant placement changes use only the fenced migration API below.
- A Storage Server registry update never moves tenants.
- There is no automatic target, silent failover, or direct assignment patch.

## Browser routes and permissions

All browser calls use the Core Gateway prefix
`/api/admin/core/v1`. Every mutation requires one UUIDv7
`x-idempotency-key` for that exact user intent.

| Method and canonical browser path | Exact permissions | Success | Body |
|:---|:---|:---:|:---|
| `POST /tenants/:tenantId/storage-migrations` | `admin.storage_migrations.create` + `admin.storage_migrations.critical` | `202` | `CreateTenantStorageMigrationDto` |
| `GET /tenants/:tenantId/storage-migrations/:migrationId` | `admin.storage_migrations.read` | `200` | None |
| `POST /tenants/:tenantId/storage-migrations/:migrationId/retry` | `admin.storage_migrations.manage` + `admin.storage_migrations.critical` | `202` | None |
| `POST /tenants/:tenantId/storage-migrations/:migrationId/cancel` | `admin.storage_migrations.manage` + `admin.storage_migrations.critical` | `200` | None |
| `POST /tenants/:tenantId/storage-migrations/:migrationId/rollback` | `admin.storage_migrations.rollback` + `admin.storage_migrations.critical` | `202` | `RollbackTenantStorageMigrationDto` |
| `POST /tenants/:tenantId/storage-migrations/:migrationId/finalize` | `admin.storage_migrations.finalize` + `admin.storage_migrations.critical` | `202` | `FinalizeTenantStorageMigrationDto` |
| `POST /tenants/:tenantId/storage-migrations/:migrationId/post-cutover/:operationId/retry` | `admin.storage_migrations.post_cutover.retry` + `admin.storage_migrations.critical` | `202` | None |
| `POST /tenants/:tenantId/storage-migrations/:migrationId/post-cutover/:operationId/cancel` | `admin.storage_migrations.post_cutover.cancel` + `admin.storage_migrations.critical` | `200` | None |

The paths in the table are relative to `/api/admin/core/v1`.

## Request contracts

```ts
interface CreateTenantStorageMigrationDto {
  targetStorageServerId: string;               // UUIDv7
  expectedSourcePlacementRevision: number;    // integer >= 1
  expectedSourceStorageFenceRevision: number; // integer >= 1
  rollbackRetentionDays?: number;              // integer 1..90, default 7
}

interface RollbackTenantStorageMigrationDto {
  expectedPlacementRevision: number;    // integer >= 1
  expectedStorageFenceRevision: number; // integer >= 1
}

interface FinalizeTenantStorageMigrationDto {
  expectedRetainedUntil: string; // strict ISO-8601 timestamp
}
```

Unknown fields are rejected. The target must differ from the current Storage
Server. Core transactionally rechecks the source assignment, source and target
server revisions, capacity reservation, tenant fence state, and the absence of
concurrent migration work.

## Response contracts

Core wraps each view in the normal success envelope:

```ts
interface TenantStorageMigrationView {
  migrationId: string;
  tenantId: string;
  sourceStorageServerId: string;
  targetStorageServerId: string;
  status: TenantStorageMigrationStatus;
  lastDurableStage: TenantStorageMigrationDurableStage;
  sourcePlacementRevision: number;
  storageFenceRevision: number;
  attemptNumber: number;
  stageRevision: number;
  inventoryChecksum: string | null;
  inventoryCount: number | null;
  inventoryBytes: string | null;
  safeErrorCode: string | null;
  rollbackRetainUntil: string;
  replayed: boolean;
}

interface TenantStoragePostCutoverOperationView {
  operationId: string;
  migrationId: string;
  tenantId: string;
  operation: "ROLLBACK" | "FINALIZE";
  status: TenantStoragePostCutoverStatus;
  replayed: boolean;
}
```

`inventoryBytes` is a decimal string and must not be converted through a
JavaScript `number`. `safeErrorCode` is safe to map to operator-facing copy;
do not expose internal broker, credential, bucket, or object-key details.

## Transport states

```ts
type TenantStorageMigrationStatus =
  | "REQUESTED"
  | "FENCING"
  | "FENCED"
  | "COPYING"
  | "VERIFYING"
  | "CUTOVER"
  | "ROLLBACK_WINDOW"
  | "ROLLBACK_FENCING"
  | "ROLLBACK_FENCED"
  | "ROLLBACK_COPYING"
  | "ROLLBACK_VERIFYING"
  | "ROLLBACK_CUTOVER"
  | "FINALIZING"
  | "SUCCEEDED"
  | "FAILED"
  | "CANCELLED";

type TenantStorageMigrationDurableStage =
  Exclude<TenantStorageMigrationStatus, "FAILED" | "CANCELLED">;

type TenantStoragePostCutoverOperation = "ROLLBACK" | "FINALIZE";

type TenantStoragePostCutoverStatus =
  | "FENCING"
  | "FENCED"
  | "QUEUED"
  | "RUNNING"
  | "VERIFYING"
  | "PURGING"
  | "SUCCEEDED"
  | "FAILED"
  | "CANCELLED";
```

Render unknown future values safely. Never infer completion from HTTP `202`.

## Authoritative workflow

1. Core locks the database server before Storage Servers and validates the
   exact source placement/fence revisions.
2. Core reserves capacity on the target and creates a durable migration.
3. Core requests a write fence from Core, CRM, Trade, and Worker.
4. Work advances only after exact acknowledgements prove zero active write
   leases and the drain barrier has passed.
5. Worker copies the immutable inventory to new object generations and
   verifies count, bytes, metadata, and checksums.
6. Core verifies the signed result and performs the atomic assignment cutover.
7. The old assignment remains retained through `rollbackRetainUntil`.
8. During that window an authorized admin may start a separately fenced
   reverse-copy rollback.
9. At or after the retention deadline an authorized admin may finalize,
   purge the retained source, and release retained capacity.

Retry resumes only a `FAILED` migration from `lastDurableStage`. Cancel is
allowed only during the initial queued fencing phase before inventory evidence
exists. Rollback and finalize are distinct post-cutover operations with their
own retry/cancel controls.

## Target selection

The target selector may show only the safe options returned by:

```http
GET /api/admin/core/v1/tenants/storage-placement-options
```

Permission: `admin.tenants.create`.

Core remains authoritative and accepts only a different `GENERAL` Storage
Server that is `ACTIVE`, `HA_PRODUCTION_READY`, healthy, production-ready,
and has sufficient tenant and byte capacity. Do not use the broader
`GET /storage-servers` registry response as an eligibility decision.

The placement-options permission is currently tied to tenant creation. Before
shipping migration UI, the backend should expose a migration-specific safe
target projection under an `admin.storage_migrations.*` read permission so an
admin does not need unrelated tenant-create authority.

## Frontend readiness blockers

The current public Admin contract cannot safely originate or recover the whole
workflow:

1. `TenantView` does not expose the current `storagePlacementRevision`,
   `storageFenceRevision`, or `storageMutationStatus` required to construct a
   valid create request.
2. There is no list/current endpoint that lets the browser discover an
   existing migration after refresh or recover its `migrationId`.
3. `TenantStorageMigrationView` does not expose `pendingOperationId`.
4. There is no GET endpoint for a post-cutover operation, so its status and
   `operationId` cannot be recovered after refresh.
5. Runtime activation defaults to off and still requires live migrations,
   broker topology, all four owner-app fence consumers, Worker execution,
   Garage evidence, monitoring, and operational approval.

Until these are resolved, keep tenant placement read-only and describe the
migration API as backend source capability, not a usable frontend feature.
Do not work around missing revisions with constants, hidden database reads,
local storage, or values inferred from timestamps.

## Feature-gate behavior

Core requires:

```text
CORE_TENANT_STORAGE_MIGRATION_ENABLED=true
CORE_TENANT_STORAGE_POST_CUTOVER_ENABLED=true
```

Worker execution is independently gated by:

```text
WORKER_TENANT_STORAGE_MIGRATION_ENABLED=true
WORKER_TENANT_STORAGE_POST_CUTOVER_ENABLED=true
```

The frontend must never set or read these server-side flags. If the Core
feature is disabled, Core returns:

| HTTP | Code | Frontend behavior |
|:---:|:---|:---|
| `503` | `TENANT_STORAGE_MIGRATION_DISABLED` | Show “Storage migration is not enabled”; do not retry-loop |
| `503` | `TENANT_STORAGE_POST_CUTOVER_DISABLED` | Keep the authoritative migration view and show that rollback/finalize control is unavailable |

Feature flags are deployment controls, not browser capabilities. The portal
must not guess them from environment variables; use an explicit safe backend
capability/read model when one is added.

## Idempotency and polling

- Generate a UUIDv7 only after the admin confirms an exact mutation.
- Retain that key in memory while the outcome is ambiguous.
- Reuse it only for a byte-equivalent retry by the same actor.
- A changed target, revision, retention period, or operation needs a new key.
- `replayed: true` means Core returned the durable result of the same command.
- Poll only the exact migration GET route and stop on `SUCCEEDED`,
  `CANCELLED`, or a `FAILED` state awaiting an explicit admin decision.
- Refetch tenant detail after cutover, rollback completion, or finalization.

Gateway `GW.IDEM.MISMATCH` or Core
`TENANT_STORAGE_MIGRATION_IDEMPOTENCY_CONFLICT` means the key was reused for a
different intent. Never auto-generate a replacement and resubmit without a new
admin confirmation.

## Required UI states when released

The tenant detail screen should host a separate **Storage migration** panel,
not a field inside profile edit. It must represent:

- feature unavailable;
- loading current placement and migration control state;
- no active migration;
- target selection;
- confirmation with source/target, capacity, revisions, and rollback deadline;
- fencing and writer drain;
- copy and verification progress;
- cutover;
- rollback window with exact deadline;
- failed with safe code and explicit retry eligibility;
- rollback/finalize operation progress;
- terminal success or cancellation;
- forbidden, stale, conflict, and service-unavailable states.

Critical actions require typed confirmation and must be disabled from stale
cached views. Never optimistically replace the tenant’s `storageServerId`.

## Backend source map

Paths are relative to `C:\mutakamel.ai\frontend`:

- `../backend/mutakamel-apps/api-gateway-app/src/routing-proxy/route-contracts/core.route-contracts.ts`
- `../backend/mutakamel-apps/core-app/src/admin/tenants/tenant-storage-migrations.controller.ts`
- `../backend/mutakamel-apps/core-app/src/admin/tenants/tenant-storage-migrations.service.ts`
- `../backend/mutakamel-apps/core-app/src/admin/tenants/dto/tenant-storage-migration.dto.ts`
- `../backend/mutakamel-apps/core-app/src/admin/tenants/tenant-storage-migration.contract.ts`
- `../backend/mutakamel-apps/core-app/packages/database/src/migrations/control-plane/1800000000450-tenant-storage-migrations.ts`
- `../backend/mutakamel-apps/core-app/packages/database/src/migrations/control-plane/1800000000460-tenant-storage-fence-acks.ts`
- `../backend/mutakamel-apps/worker-app/src/modules/storage-v2/tenant-storage-migration-executor.service.ts`
- `../backend/mutakamel-apps/worker-app/src/modules/storage-v2/tenant-storage-post-cutover-executor.service.ts`
