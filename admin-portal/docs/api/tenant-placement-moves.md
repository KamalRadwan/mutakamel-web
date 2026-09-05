# Tenant Placement Moves

Status: **[Verified against current backend source]**

Last source verification: **2026-09-03**

Owner: **Admin Portal**

Moving **one** tenant to a different Database Server or a different Storage
Server. Two independent flows that share one preflight service, one blocker
vocabulary, and one screen shape.

Both keep the old copy by default and delete it only when an operator
explicitly confirms. That deletion is the single step of either move with no
rollback behind it, so in both flows it is a separate command with its own
typed tenant-id confirmation — never part of the move itself.

Both were unbuildable until the preflight routes existed. Each move is fenced on
a placement revision the caller has to submit or match exactly, and **no admin
route exposed either number** — which is why `POST
/tenants/:tenantId/storage-migrations`, fully implemented on the backend, had
never been callable from the Admin Portal.

Source: `core-app/src/admin/tenants/tenant-placement-preflight.controller.ts`,
`core-app/src/admin/tenants/tenant-placement-preflight.service.ts`,
`core-app/src/admin/storage-servers/tenant-storage-migration.controller.ts`,
`worker-app/src/modules/backup-restore/relocation.controller.ts`,
`worker-app/src/modules/backup-restore/relocation.plan.ts`, and the Gateway
route contracts in
`api-gateway-app/src/routing-proxy/route-contracts/{core,worker}.route-contracts.ts`.

## Frontend routes

| Route | Screen | Read gate |
| --- | --- | --- |
| `/tenants/[id]/move-database` | `features/admin/tenant-workspace/database-relocation` | `admin.tenant_relocations.read` |
| `/tenants/[id]/move-storage` | `features/admin/tenant-workspace/storage-migration` | `admin.storage_migrations.read` |

Both pages are gated on the **read** permission, not the execute pair: every
phase is driven by reads, and an operator who may watch a move but not start one
gets the ledger rather than a blank page. Execute plus critical is checked again
on the submit, and the Gateway enforces both regardless.

Entry points live on `/tenants/[id]`, each wrapped in `PermissionGate` with
`fallback={null}` so a missing permission leaves the workspace unchanged instead
of stamping a forbidden block into the middle of it.

## Shared preflight vocabulary

Both preflights return the same closed `blockers` union from one Core service:

| Code | Meaning |
| --- | --- |
| `TENANT_NOT_RELOCATABLE` | Tenant status is not `ACTIVE` or `SUSPENDED`. |
| `RELOCATION_IN_PROGRESS` | An open `tenant_database_relocation_commands` row exists. |
| `PLACEMENT_CUTOVER_IN_PROGRESS` | A database placement cutover is mid-flight. |
| `MAINTENANCE_FENCE_OPEN` | Provisioning holds an unreleased maintenance fence. |
| `STORAGE_MIGRATION_IN_PROGRESS` | An open storage migration exists. |

Blockers are **reported, not thrown**. The UI renders every blocker with a
bilingual explanation and disables the submit; it never hides the page, and an
unrecognized code still renders (Core owns this union and may extend it).

## Move database — browser contract

All paths are canonical browser paths. Worker responses are **not** enveloped:
the JSON body is the payload. The Core preflight **is** enveloped and goes
through `extractCoreData`.

| Method and path | Permissions | Success | Body |
| --- | --- | :---: | --- |
| `GET /api/admin/core/v1/tenants/:tenantId/database-relocation-preflight` | `admin.tenant_relocations.read` | `200` | None |
| `POST /api/admin/worker/v1/relocations/tenants/:tenantId` | `admin.tenant_relocations.execute` + `admin.tenant_relocations.critical` | `202` | `RelocateTenantBody` |
| `GET /api/admin/worker/v1/relocations/tenants/:tenantId` | `admin.tenant_relocations.read` | `200` | None |
| `GET /api/admin/worker/v1/relocations/:runId` | `admin.tenant_relocations.read` | `200` | None |
| `POST /api/admin/worker/v1/relocations/:runId/destroy-source` | `admin.tenant_relocations.execute` + `admin.tenant_relocations.critical` | `200` | `{ confirmTenantId }` |

### Preflight projection

```ts
interface TenantDatabaseRelocationPreflight {
  tenant: { id: string; name: string; status: string };
  current: {
    databaseServerId: string;
    databaseServerName: string | null;
    databaseName: string;
    /** The fence. Numeric string; defaults to 1 and only ever increases. */
    databasePlacementRevision: string;
  };
  targets: Array<{
    id: string;
    name: string;
    status: string;
    countryName?: string;
    countryIsoCode?: string;
    currentTenants: number;
    maxTenants: number;
  }>;
  blockers: TenantPlacementBlockerCode[];
  retention: { minDays: 1; maxDays: 30; defaultDays: 7 };
}
```

`targets` already excludes the server the tenant is on, every non-`ACTIVE`
server, every server at its tenant ceiling, and every server not ready for all
applications the tenant runs. The UI must not re-derive that set from a
paginated Database Server list.

### Start body

```ts
interface RelocateTenantBody {
  targetDatabaseServerId: string;   // UUIDv7
  reason: string;                   // 1..500, audited on the ledger
  confirmTenantId: string;          // must equal :tenantId
  sourceRetentionDays?: number;     // integer 1..30, default 7
}
```

Returns `{ relocationId, runId, record }`. Poll `GET /relocations/:runId`.

### `RelocationRecord`

```ts
type RelocationStep =
  | 'CLAIM' | 'QUIESCE' | 'BACKUP' | 'PROVISION' | 'RESTORE'
  | 'VERIFY' | 'REPOINT' | 'LIFT' | 'RETAIN' | 'DESTROY';

interface RelocationRecord {
  relocationId: string; tenantId: string;
  sourceDatabaseServerId: string; sourceDatabaseName: string;
  targetDatabaseServerId: string; targetDatabaseName: string;
  actorId: string; reason: string; startedAt: string;
  steps: Array<{ step: RelocationStep; state: 'DONE' | 'FAILED'; at: string; detail?: string }>;
  retainUntil?: string; sourceDestroyedAt?: string;
  outcome: 'RUNNING' | 'RELOCATED' | 'ABANDONED';
  failedStep?: RelocationStep;
  rollback?: 'SOURCE_AUTHORITATIVE' | 'REPOINT_TO_RETAINED_SOURCE' | 'NONE';
}
```

The ledger records **settled steps only**. A step absent from `steps[]` has not
run. While `outcome === 'RUNNING'` the first absent step is the one in flight;
once the outcome settles, an absent step is simply pending — an abandoned
relocation must never show a step spinning forever. Terminal when
`outcome !== 'RUNNING'`.

`rollback` is decided by *where* the move stopped, and is what the operator
needs to know:

| Value | What it means |
| --- | --- |
| `SOURCE_AUTHORITATIVE` | Failed at steps 1–6. The source never stopped being authoritative; the target copy was abandoned. |
| `REPOINT_TO_RETAINED_SOURCE` | Failed after step 7. Placement had moved; recovery is repointing at the retained source. Do not release it. |
| `NONE` | The source is already gone. No rollback remains. |

### Idempotency and replay

Both writes are Gateway `WRITE_SENSITIVE` with `idempotent: false`, so Gateway
idempotency replay is off. Worker still **requires** a UUIDv7
`x-idempotency-key` as its command id (`WORKER.BACKUP.COMMAND_ID_REQUIRED`), so
the browser sends a caller-owned key with `skipAutoIdempotency: true` and
`nonReplayable: true`.

`nonReplayable` matters: relocation is **not** replay-idempotent. A second
accepted call starts a second move; what actually stops one is the tenant claim,
which refuses a concurrent request with `WORKER.TENANT_CLAIM.HELD`. An
automatic post-refresh replay is therefore forbidden.

An ambiguous outcome (`401`, network failure, `5xx`, `GW.IDEM.IN_FLIGHT`)
retains the key and offers **status-only recovery** — `GET
/relocations/tenants/:tenantId`, newest first — exactly as tenant create does.
The screen does not offer "retry exact" for the start. A definitive `4xx` ends
the intent and retires the key.

The release command does offer retry-exact alongside reconcile: it is refused
once the source is gone (`WORKER.RELOCATION.SOURCE_ALREADY_DESTROYED`), so both
paths are informative.

Only the tab-scoped key, route, SHA-256 intent digest, resource identity and
timestamp are persisted. The reason, target and confirmation text are not.

### Reload recovery

`GET /relocations/tenants/:tenantId` returns `Array<{ runId, record }>`, newest
first. The page adopts the newest `RUNNING` run. Failing that, it adopts the
newest `RELOCATED` run that still has `retainUntil` and no `sourceDestroyedAt`,
because the retention window is measured in days — far longer than a tab stays
open — and step 10 would otherwise be unreachable in practice. Settled history
is not adopted, so the wizard stays ready for a new move.

### Step 10 — releasing the retained source

Irreversible, its own command, and gated on **both** the retention window having
closed and a typed tenant id. The UI keeps the control visible and disabled
until `retainUntil` has passed, states why, and requires the tenant id in a
`variant="danger"` `ConfirmActionModal`. Worker re-checks every condition:
`WORKER.RELOCATION.NOT_COMPLETED`, `SOURCE_ALREADY_DESTROYED`,
`CONFIRMATION_MISMATCH`, `RETENTION_UNKNOWN`, `RETENTION_ACTIVE`.

### Other error codes

`WORKER.RELOCATION.TARGET_INVALID` (destination equals the current server),
`TENANT_INELIGIBLE`, `VERIFICATION_FAILED`, `SOURCE_STILL_PLACED`,
`CORE_PLACEMENT_UNAVAILABLE`, `CORE_PLACEMENT_TIMEOUT`,
`WORKER.TENANT_CLAIM.HELD`, `WORKER.BACKUP.COMMAND_ACTOR_REQUIRED`.

## Move storage — browser contract

| Method and path | Permissions | Success | Body |
| --- | --- | :---: | --- |
| `GET /api/admin/core/v1/tenants/:tenantId/storage-migration-preflight` | `admin.storage_migrations.read` | `200` | None |
| `POST /api/admin/core/v1/tenants/:tenantId/storage-migrations` | `admin.storage_migrations.execute` + `admin.storage_migrations.critical` | `200` | `StartTenantStorageMigrationDto` |
| `POST /api/admin/core/v1/storage-migrations/:id/release-source` | `admin.storage_migrations.execute` + `admin.storage_migrations.critical` | `200` | `{ confirmTenantId }` |
| `GET /api/admin/core/v1/storage-migrations/:id` | `admin.storage_migrations.read` | `200` | None |

All three are Core routes and use the Core success envelope.

### Preflight projection

```ts
interface TenantStorageMigrationPreflight {
  tenant: { id: string; name: string; status: string };
  current: {
    storageServerId: string;
    storageServerName: string | null;
    /** The fence, submitted verbatim as `expectedStoragePlacementRevision`. */
    storagePlacementRevision: string;
  };
  targets: Array<{
    id: string; code: string; name: string; region: string; status: string;
    assignedTenants: number;
    maxTenants: number | null;          // null = no declared ceiling
    maxBytes: string | null;            // numeric strings; never parseFloat
    reservedBytes: string;
    committedBytes: string;
    lastConnectionTestStatus: string;
    lastConnectionTestedAt: string | null;
  }>;
  blockers: TenantPlacementBlockerCode[];
  /** A migration not yet COMPLETED or ROLLED_BACK, if one exists. */
  openMigrationId: string | null;
}
```

`targets` is limited to `ACTIVE` servers with free tenant capacity, excluding
the tenant's current one, ordered by name, capped at 200.

Byte quotas stay strings end to end. Unreserved headroom is computed with
`BigInt` — these values can exceed `Number.MAX_SAFE_INTEGER`, which is why the
contract keeps them as strings in the first place.

### Start body

```ts
interface StartTenantStorageMigrationDto {
  targetStorageServerId: string;            // UUIDv7
  expectedStoragePlacementRevision: string; // /^[1-9][0-9]{0,18}$/ — from the preflight
  backupArtifactId: string;                 // UUIDv7
  restoreRunId: string;                     // UUIDv7
  maxBytes: string;                         // /^[1-9][0-9]{0,15}$/
  retainSource?: boolean;                   // default false; the wizard sends true
}
```

`backupArtifactId` and `restoreRunId` bind the migration to current Worker
recovery evidence. The operator chooses both from the existing Backup module
reads — `GET /api/admin/worker/v1/backups/artifacts?tenantId=` and `GET
/api/admin/worker/v1/restores/runs?tenantId=`, both under `admin.backups.read`.
That is an **independent** permission: an operator with migration read/execute
but without it still gets the placement, the blockers and any open migration,
and the wizard says exactly which permission is missing rather than showing two
empty selects.

`maxBytes` is reserved on the destination before any write. The UI validates it
against Core's pattern and against the destination's unreserved headroom, so an
over-reservation is caught before it becomes
`STORAGE_MIGRATION_TARGET_CAPACITY_EXCEEDED`.

### Keeping the old copy

`retainSource` defaults to `false` — the historic behaviour, which deletes the
source namespace inside the same call. **The wizard sends `true` by default**,
because the safe order is to move the tenant, watch it work, and only then throw
the old copy away.

With `retainSource: true` the command stops at `PLACEMENT_COMMITTED` with the
source namespace intact. That is a **resting state, not a stalled one**:
placement is on the target, the runtime resolves there, and Core's storage route
fence treats a retaining committed migration as normal rather than fencing the
tenant — otherwise the retention window would have been an outage. The tenant is
unaffected; only the deletion is outstanding.

Nothing advances that state on its own, so the browser must stop polling there.
`isStorageMigrationSettled()` in
`features/admin/tenant-workspace/storage/types.ts` is the single predicate for
"has stopped changing", covering both a terminal status and a retained resting
migration; the timeline renders the committed step as done rather than leaving
one spinning forever.

### Releasing the retained source

`POST /storage-migrations/:id/release-source` deletes the retained namespace.
Body is `{ confirmTenantId }` — a UUIDv7 that must equal the migrated tenant.
It returns the same `TenantStorageMigrationView`.

Deliberately **not** time-gated, unlike the database relocation's retention
window: Core leaves the timing to the operator, so the UI offers the action as
soon as the migration is resting and gates it only on the typed tenant id
through a `variant="danger"` `ConfirmActionModal`.

Forward-only. A failure leaves the migration at `PLACEMENT_COMMITTED` with
`STORAGE_MIGRATION_FORWARD_REPAIR_REQUIRED` (`503`) for an exact retry with the
same key, and **never** restores source placement — so the recovery affordance is
retry-exact plus a re-read, never a rollback. Releasing an already-`COMPLETED`
migration is a safe no-op returning the completed projection.

Other refusals: `STORAGE_MIGRATION_SOURCE_NOT_RETAINED` (the migration never
retained a source, or already released it) and
`STORAGE_MIGRATION_CONFIRMATION_MISMATCH` (typed id is wrong).

### Status projection

`TenantStorageMigrationView.status` is
`ACCEPTED | COPYING | COPIED | PLACEMENT_COMMITTED | COMPLETED | ROLLING_BACK |
ROLLED_BACK`. Terminal: `COMPLETED`, `ROLLED_BACK`
(`TERMINAL_MIGRATION_STATUSES`). The view also carries `retainSource: boolean`
and `sourceReleaseRequestedAt: string | null`; a committed migration with
`retainSource` set and no `sourceReleaseRequestedAt` is the resting state
described above, and `openMigrationId` still reports it, so a reload finds it
and no second migration can start while it is open.

Core reports one status rather than a step ledger, so the timeline derives the
ladder: everything before the current status is done, the current status is
active, everything after is pending. The two rollback statuses replace the
ladder with a single explained entry rather than pretending progress continued.

### Idempotency

Unlike relocation, this route is Gateway `idempotent: true` /
`idempotencyMode: WRITE_SENSITIVE`, so it requires a caller-owned UUIDv7
`x-idempotency-key` and an exact retry returns the original outcome. The
ambiguous-outcome panel therefore offers both retry-exact and reconcile;
reconcile re-reads the preflight, whose `openMigrationId` is the authoritative
answer to "did my migration actually start".

Error codes: `STORAGE_MIGRATION_FENCED`, `STORAGE_MIGRATION_INTENT_INVALID`,
`STORAGE_MIGRATION_IDEMPOTENCY_MISMATCH`,
`STORAGE_MIGRATION_TARGET_CAPACITY_EXCEEDED`, `STORAGE_MIGRATION_ROLLED_BACK`,
`STORAGE_MIGRATION_FORWARD_REPAIR_REQUIRED`,
`STORAGE_MIGRATION_ACCOUNTING_REPAIR_REQUIRED`.

## Screen contract (both flows)

Three phases derived from state, not from a wizard step counter:

1. **Select** — current placement card including the placement revision,
   destination `Select` from `targets` (an empty list renders an explained empty
   state, never an empty combobox), the flow's own fields, and a typed tenant-id
   confirmation through `ConfirmActionModal`'s `requiredConfirmationText`.
2. **Monitor** — `OperationTimeline` polled at 5s through `usePollWhile`
   composed with `useOperatorRefreshGuard`, so a poll never interrupts an
   operator mid-edit and never fires on a hidden tab. Data stays mounted across
   refreshes; a poll failure does not replace the ledger already on screen.
3. **Finish** — outcome, plus the separately confirmed deletion of the old
   copy in both flows. The database move gates that on `retainUntil` having
   passed as well as the typed id; the storage move gates it on the typed id
   alone, because Core does not time-box it.

Reload recovery: the database move re-reads the tenant's relocation history; the
storage move uses the preflight's `openMigrationId`.

## Verification

A green `npx tsc --noEmit`, `pnpm lint`, `pnpm design:rtl`, `pnpm docs:check`
and `pnpm test` proves source integration only. Authenticated runtime and
deployment evidence for both flows remains open.
