# Tenant Operations and Provisioning Frontend Contract

Status: **[Verified]**

Last source verification: **2026-10-08** (stall signal, operator exits,
confirmed cancel/re-provision/repair, polling backoff)

Verified against the current Gateway contracts, Core controllers, DTOs,
operation/read-model services, provisioning command services, database enums,
`core-app/src/admin/tenants/provisioning/tenant-operation-exits.ts`, and the
Admin Portal tenant-detail source.

This document covers the 15 tenant-prefixed operation/provisioning routes used
to observe and manage a single tenant. Fleet rollout and release-publishing
routes under `/api/admin/core/v1/provisioning/...` are a separate platform
governance surface.

## Endpoint summary

All paths below are canonical browser paths.

### Operation history

| Method and path | Permission | Success | UUIDv7 key | Purpose |
|:---|:---|:---:|:---:|:---|
| `GET /api/admin/core/v1/tenants/:tenantId/operations` | `admin.tenants.read` | `200` | No | Paginated operation history |
| `GET /api/admin/core/v1/tenants/:tenantId/operations/:operationId` | `admin.tenants.read` | `200` | No | Operation, progress, and step DAG |
| `GET /api/admin/core/v1/tenants/:tenantId/operations/:operationId/timeline` | `admin.tenants.read` | `200` | No | Paginated safe event timeline |
| `POST /api/admin/core/v1/tenants/:tenantId/operations/:operationId/retry` | `admin.tenants.read` + `admin.tenants.reprovision` + `admin.tenants.critical` | `202` | Yes | Retry the latest eligible operation |
| `POST /api/admin/core/v1/tenants/:tenantId/operations/:operationId/cancel` | `admin.tenants.read` + `admin.tenants.reprovision` + `admin.tenants.critical` | `202` | Yes | Request cancellation |

The two command endpoints require **both** permissions.

### Updates and prerequisites

| Method and path | Permission | Success | UUIDv7 key | Purpose |
|:---|:---|:---:|:---:|:---|
| `GET /api/admin/core/v1/tenants/:tenantId/provisioning/updates` | `admin.tenants.read` | `200` | No | Paginated server-computed update choices |
| `POST /api/admin/core/v1/tenants/:tenantId/provisioning/updates/apply` | `admin.tenants.reprovision` + `admin.tenants.critical` + `admin.provisioning.critical` | `202` | Yes | Apply an exact update selection |
| `POST /api/admin/core/v1/tenants/:tenantId/provisioning/prerequisite-requests` | `admin.provisioning.prerequisites.request` + `admin.provisioning.critical` | `202` | Yes | Request backup/maintenance evidence |
| `GET /api/admin/core/v1/tenants/:tenantId/provisioning/prerequisite-evidence` | `admin.provisioning.prerequisites.read` | `200` | No | Read bounded prerequisite evidence |

### Managed provisioning and state

| Method and path | Permission | Success | UUIDv7 key | Purpose |
|:---|:---|:---:|:---:|:---|
| `POST /api/admin/core/v1/tenants/:tenantId/provisioning/operations/add-application` | `admin.provisioning.add-application` + `admin.provisioning.critical` | `202` | Yes | Materialize an already-entitled Application |
| `POST /api/admin/core/v1/tenants/:tenantId/provisioning/operations/repair` | `admin.provisioning.repair` + `admin.provisioning.critical` | `202` | Yes | Repair one component closure |
| `POST /api/admin/core/v1/tenants/:tenantId/provisioning/operations/decommission` | `admin.provisioning.decommission` + `admin.provisioning.critical` | `202` | Yes | Disable/retain a component |
| `POST /api/admin/core/v1/tenants/:tenantId/provisioning/seed-conflicts/:seedStateId/resolve` | `admin.provisioning.conflicts.resolve` + `admin.provisioning.critical` | `200` | Yes | Resolve an eligible seed conflict |
| `GET /api/admin/core/v1/tenants/:tenantId/provisioning-state/components` | `admin.tenants.read` | `200` | No | Paginated installation evidence |
| `GET /api/admin/core/v1/tenants/:tenantId/provisioning-state/seeds` | `admin.tenants.read` | `200` | No | Paginated seed-state evidence |

The seed-conflict command is source-integrated in the tenant provisioning
workspace and requires both permissions shown.

## Shared envelopes and idempotency

Paginated responses put rows in `data` and page information in `meta`:

```ts
interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}
```

Every command in the tables is `WRITE_SENSITIVE` and requires
`x-idempotency-key: <UUIDv7>`. One key represents one exact intent. Reuse it
only for the exact retry and never generate a second command automatically
while `GW.IDEM.IN_FLIGHT` is returned.

Core commands persist their own request fingerprints. Successful exact retries
return `replayed: true`; changed bodies, operation ids, or actor scope with the
same key return an idempotency conflict.

## Operation enums

```ts
enum TenantOperationTypeEnum {
  INITIAL_PROVISION = "INITIAL_PROVISION",
  RETRY = "RETRY",
  UPDATE = "UPDATE",
  ADD_APPLICATION = "ADD_APPLICATION",
  ADDON_INSTALL = "ADDON_INSTALL",
  REPAIR = "REPAIR",
  DECOMMISSION = "DECOMMISSION",
}

enum TenantOperationStatusEnum {
  REQUESTED = "REQUESTED",
  PLANNING = "PLANNING",
  QUEUED = "QUEUED",
  RUNNING = "RUNNING",
  WAITING_RETRY = "WAITING_RETRY",
  CANCEL_REQUESTED = "CANCEL_REQUESTED",
  SUCCEEDED = "SUCCEEDED",
  FAILED_RETRYABLE = "FAILED_RETRYABLE",
  MANUAL_RECOVERY_REQUIRED = "MANUAL_RECOVERY_REQUIRED",
  CANCELLED = "CANCELLED",
}

enum TenantOperationStepStatusEnum {
  PENDING = "PENDING",
  RUNNING = "RUNNING",
  SUCCEEDED = "SUCCEEDED",
  FAILED = "FAILED",
  SKIPPED = "SKIPPED",
  CONFLICT = "CONFLICT",
  CANCELLED = "CANCELLED",
}
```

There is no `COMPLETED` operation status.

## Operation response models

```ts
interface SafeOperationError {
  code: string | null;
  message: string | null;
}

interface TenantOperationSummaryView {
  id: string;
  tenantId: string;
  generation: number;
  type: TenantOperationTypeEnum;
  status: TenantOperationStatusEnum;
  currentPhase: string;
  planDigest: string;
  accessPolicyRevision: number;
  actor: {
    type: "ADMIN" | "TENANT_USER" | "SYSTEM";
    id: string | null;
  };
  reason: string | null;
  requestedAt: string;
  startedAt: string | null;
  heartbeatAt: string | null;
  cancellationRequestedAt: string | null;
  completedAt: string | null;
  safeError: SafeOperationError | null;
  createdAt: string;
  updatedAt: string;
}

interface TenantOperationStepView {
  id: string;
  componentId: string | null;
  componentKey: string | null;
  stepKey: string;
  kind: TenantOperationStepKindEnum;
  status: TenantOperationStepStatusEnum;
  required: boolean;
  activationRequired: boolean;
  weight: number;
  attemptCount: number;
  retryable: boolean;
  dependsOnStepKeys: string[];
  fromVersion: string | null;
  targetVersion: string | null;
  appliedVersion: string | null;
  targetChecksum: string | null;
  appliedChecksum: string | null;
  producer: string | null;
  startedAt: string | null;
  heartbeatAt: string | null;
  finishedAt: string | null;
  safeError: SafeOperationError | null;
  createdAt: string;
  updatedAt: string;
}

interface TenantOperationDetailView extends TenantOperationSummaryView {
  prerequisiteCount: number;
  progress: {
    totalSteps: number;
    completedSteps: number;
    failedSteps: number;
    totalWeight: number;
    completedWeight: number;
    percent: number;
  };
  timelineEventCount: number;
  steps: TenantOperationStepView[];
  stall: TenantOperationStall | null; // admin routes only
  exits: TenantOperationExits;        // admin routes only
}

interface TenantOperationStall {
  stepKey: string | null; // step the stall is attributed to; null when none is running
  since: string;          // last progress (or cancellation request) it is measured from
  ageSeconds: number;     // measured by Core when the response was built
  reason: "NO_PROGRESS" | "DISPATCH_LEASE_EXPIRED" | "CANCEL_PENDING";
}

type TenantOperationExitReasonCode =
  | "OPERATION_SUPERSEDED"      // a newer generation exists
  | "ADDON_INSTALLATION_OWNED"  // add-on installs stop/recover through their commercial flow
  | "CANCELLATION_PENDING"      // the Worker has not confirmed a requested stop
  | "OPERATION_OPEN"            // an operation still owns the tenant
  | "OPERATION_SUCCEEDED"       // nothing to retry
  | "OPERATION_TERMINAL";       // nothing to cancel

type TenantOperationExit =
  | { allowed: true; reasonCode: null }
  | { allowed: false; reasonCode: TenantOperationExitReasonCode };

interface TenantOperationExits {
  cancel: TenantOperationExit; // POST .../operations/:operationId/cancel
  retry: TenantOperationExit;  // POST .../operations/:operationId/retry ("Re-provision")
  repair: TenantOperationExit; // POST .../provisioning/operations/repair
}

interface TenantOperationTimelineEventView {
  id: string;
  eventId: string;
  sequence: string;
  componentId: string | null;
  componentKey: string | null;
  stepId: string | null;
  eventType: string;
  phase: string | null;
  status: string | null;
  actor: {
    type: "ADMIN" | "TENANT_USER" | "SYSTEM";
    id: string | null;
  };
  message: string | null;
  occurredAt: string;
}
```

`planDigest` is the safe manifest checksum alias. Raw plan snapshots,
idempotency values, stack traces, raw worker payloads, and unsafe metadata are
never returned.

Progress counts `SUCCEEDED` and `SKIPPED` as completed. `FAILED` and
`CONFLICT` count as failed. Percentage is weighted, floored, and capped at 100.

### Stall signal

`heartbeatAt` is the time of the last *accepted transition*, not a liveness
ping: the Worker never reports a step dispatched to Core, CRM or Trade while
its owner works. `stall` is Core's statement that an open operation has stopped
moving. It is null unless the operation is open and nothing was reported for
more than 10 minutes — twice the Worker's five-minute step lease, so a healthy
re-dispatch (a fresh `STEP_STARTED`) always lands inside it.

| `reason` | When | `stepKey` |
| --- | --- | --- |
| `CANCEL_PENDING` | `CANCEL_REQUESTED` for 10+ minutes since the request | oldest running step, else `null` |
| `DISPATCH_LEASE_EXPIRED` | a running step owned by Core/CRM/Trade (`producer` not `worker`, kind not `DATABASE`) has no progress for 10+ minutes: its lease expired without a result or a re-dispatch | that step |
| `NO_PROGRESS` | a running step the Worker executes itself, or no running step and no change for 10+ minutes (plus the two-hour prerequisite window while `AWAITING_PREREQUISITES`) | the step, or `null` |

`WAITING_RETRY` is never reported as a stall: an owner may schedule a retry up
to a day out and the due time is not projected. `ageSeconds` is measured when
the response is built, so it is excluded from the portal's change detection.

### Operator exits

`exits` states, per operator command, whether the operation's current state
leaves it open and, when not, why. Core mirrors the commands' own
operation-level checks in their order; the commands still revalidate tenant
lifecycle, access-policy revision, Application authority and component
evidence and remain the authority (an allowed exit can still be refused).

| Exit | Closed by, in order |
| --- | --- |
| `cancel` | `OPERATION_SUPERSEDED`, `ADDON_INSTALLATION_OWNED`, `CANCELLATION_PENDING`, `OPERATION_TERMINAL` |
| `retry` | `OPERATION_SUPERSEDED`, `ADDON_INSTALLATION_OWNED`, `CANCELLATION_PENDING`, `OPERATION_OPEN`, `OPERATION_SUCCEEDED` |
| `repair` | the tenant's latest generation is `CANCEL_REQUESTED` (`CANCELLATION_PENDING`) or otherwise open (`OPERATION_OPEN`) |

`exits` is computed against the tenant's latest generation, so it is correct
even when the loaded history has not caught up. Both fields are admin-only:
the tenant-facing `GET /tenant/provisioning/operations/:operationId` and the
self-service `POST /tenant/provisioning/updates/apply` result return the
tenant-scoped projection, which carries neither (nor actor identity or
reason). The reader rejects a detail without `exits`; deploy Core before the
portal.

## List operations

`GET /api/admin/core/v1/tenants/:tenantId/operations`

```ts
interface TenantOperationQueryDto {
  page?: number;  // default 1
  limit?: number; // default 20, max 100
  sortBy?: "requestedAt" | "generation" | "status" | "completedAt";
  sortDir?: "ASC" | "DESC"; // default DESC
  search?: string;          // max 200
  type?: TenantOperationTypeEnum;
  status?: TenantOperationStatusEnum;
}
```

Search spans `currentPhase`, safe error code, and safe error message. Results
are tenant-scoped and ordered by the requested field plus id in the same
direction. A soft-deleted tenant still counts as existing for this history.

### Reaching past the first page

The portal loads the newest 100 and then appends further pages on demand:
`loadMoreOperations()` for the history and `loadMoreTimeline()` for the selected
operation's events, each labelled *Showing N of M* from `meta.total` so the list
states when it is not the whole record.

Both were previously pinned to page 1 with no control to go further, so on a
tenant provisioned, repaired and updated enough times the earlier operations
could not be selected at all, and the timeline heading reported the operation's
true event count beside a list that stopped at a hundred.

Two rules the appends keep:

- each is guarded on the page it is extending, so a second click while the first
  request is in flight re-asks for the same page rather than skipping one, and
  an append lands nowhere if the list was reloaded underneath it;
- the timeline append is additionally fenced on the selected operation id, so
  selecting another operation mid-request cannot append its events to this
  one's - the same identity check the selected detail already makes.

The other collections on this screen (updates, components, seeds) are bounded by
the tenant's installed application set rather than by history, and are still
single-page.

## Get detail and timeline

Both ids must be UUIDv7 and the operation must belong to the path tenant.
Cross-tenant lookups return `TENANT_OPERATION_NOT_FOUND`.

Timeline query:

```ts
interface TenantOperationTimelineQueryDto {
  page?: number;
  limit?: number;
  sortBy?: "sequence" | "occurredAt";
  sortDir?: "ASC" | "DESC"; // default DESC
  search?: string;
}
```

Timeline search spans event type, phase, status, and safe message. Sequence is
a decimal string; do not parse it into a JavaScript `number` when values may
exceed the safe integer range.

## Retry and cancel

Destruction amendment, source verified **2026-09-12**: an accepted tenant
destruction request uses the existing authenticated cancellation protocol
even for its soft-deleted tenant. This exception is bound to the retained
destruction intent and requesting actor. Ordinary cancellation continues to
reject deleted tenants. Worker waits for real stop evidence before database
teardown; accepting cancellation never authorizes an immediate drop.

Both return:

```ts
interface TenantProvisioningCommandResult {
  replayed: boolean;
  operation: TenantOperationDetailView;
}
```

Retry preconditions:

- the specified operation must be the tenant’s latest operation;
- source status must be `FAILED_RETRYABLE`,
  `MANUAL_RECOVERY_REQUIRED`, or `CANCELLED`;
- its access-policy revision must still be compatible;
- initial activation retries require a tenant in `PROVISIONING`,
  `PROVISIONING_FAILED`, or a narrowly supported already-active replay case;
- update retries require `ACTIVE` or `SUSPENDED`.

An initial retry can transition the tenant from `PROVISIONING_FAILED` back to
`PROVISIONING`. The retry is a new operation with the next generation; it does
not mutate the failed history row.

Cancel preconditions:

- the specified operation must be latest;
- status must be `REQUESTED`, `PLANNING`, `QUEUED`, `RUNNING`, or
  `WAITING_RETRY`.

Success changes the operation to `CANCEL_REQUESTED`. Continue polling until a
terminal state; `202` does not mean cancellation is complete.

Both results embed the admin detail, including `stall` and `exits`. The
portal drives both buttons from `exits` rather than recomputing these
preconditions locally.

## Available updates and exact apply

### List available updates

`GET /api/admin/core/v1/tenants/:tenantId/provisioning/updates`

```ts
interface TenantAvailableUpdateQueryDto {
  page?: number;
  limit?: number;
  search?: string;
  componentKey?: string; // max 96, component-key pattern
  riskLevel?: "LOW" | "MEDIUM" | "HIGH";
  requiresBackup?: boolean;
  requiresMaintenance?: boolean;
  sortBy?: "componentKey" | "publishedAt" | "riskLevel";
  sortDir?: "ASC" | "DESC"; // default ASC
}

interface TenantAvailableUpdateView {
  componentId: string;
  componentKey: string;
  ownerApp: string;
  installationState: TenantComponentInstallationStateEnum;
  current: {
    releaseId: string;
    releaseVersion: string;
    schemaVersion: string | null;
    manifestChecksum: string | null;
  };
  desiredReleaseId: string | null;
  updateAlreadyPlanned: boolean;
  availableRelease: {
    id: string;
    releaseVersion: string;
    manifestVersion: number;
    schemaTarget: string;
    schemaChecksum: string | null;
    manifestChecksum: string;
    riskLevel: "LOW" | "MEDIUM" | "HIGH";
    selfServiceAllowed: boolean;
    requiresBackup: boolean;
    requiresMaintenance: boolean;
    publishedAt: string;
    compatibilityContractVersion: 1;
  };
}
```

The service computes a `checkedAt` value, but the current global response
interceptor recognizes the result as pagination and emits only `data` plus
standard `meta`; `checkedAt` is not present in the browser response. Treat the
selection evidence fields themselves as authoritative and refetch immediately
before applying.

### Apply selected updates

`POST /api/admin/core/v1/tenants/:tenantId/provisioning/updates/apply`

```ts
interface ApplyTenantProvisioningUpdatesDto {
  selections: Array<{
    componentKey: string;
    targetReleaseId: string;
    targetReleaseVersion: string;
    targetManifestChecksum: string;
    currentAppliedReleaseId: string;
    currentAppliedManifestChecksum: string;
  }>;
}
```

Rules:

- 1–100 selections, unique by `componentKey`;
- component key:
  `^[a-z][a-z0-9]*(?:\.[a-z][a-z0-9_-]*)*$`;
- release ids are UUIDv7;
- release version length is 1–120;
- checksums are exactly 64 lowercase hex characters.

Copy all evidence from the no-store update response; never synthesize release
ids, versions, or checksums. Core rejects stale/changed evidence and
incompatible release combinations. Success returns
`TenantProvisioningCommandResult`.

## Provisioning state

### Component installations

`GET /api/admin/core/v1/tenants/:tenantId/provisioning-state/components`

```ts
interface TenantComponentInstallationQueryDto {
  page?: number;
  limit?: number;
  search?: string;
  componentKey?: string;
  state?: TenantComponentInstallationStateEnum;
  selectionSource?: "FOUNDATION" | "ENTITLEMENT" | "DEPENDENCY";
  sortBy?: "state" | "createdAt" | "updatedAt";
  sortDir?: "ASC" | "DESC"; // default ASC
}

interface TenantComponentInstallationView {
  id: string;
  tenantId: string;
  componentId: string;
  componentKey: string;
  ownerApp: string;
  generation: number;
  selectionSource: TenantComponentSelectionSourceEnum;
  activationRequired: boolean;
  evidenceOrigin: TenantComponentEvidenceOriginEnum;
  state: TenantComponentInstallationStateEnum;
  desired: ReleaseStateView;
  applied: ReleaseStateView;
  latestPublishedRelease: SafeReleaseEvidence | null;
  updateAvailable: boolean;
  updateAlreadyPlanned: boolean;
  lastOperationId: string | null;
  installedAt: string | null;
  readyAt: string | null;
  disabledAt: string | null;
  lastVerifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
```

### Seed states

`GET /api/admin/core/v1/tenants/:tenantId/provisioning-state/seeds`

```ts
interface TenantSeedStateQueryDto {
  page?: number;
  limit?: number;
  search?: string;
  componentKey?: string;
  seedKey?: string; // max 128, ^[a-z][a-z0-9_.-]{1,127}$
  policy?: TenantSeedPolicyEnum;
  status?: TenantSeedStateStatusEnum;
  sortBy?: "seedKey" | "status" | "createdAt" | "updatedAt";
  sortDir?: "ASC" | "DESC"; // default ASC
}

interface TenantSeedStateView {
  id: string;
  revision: number; // exact optimistic-concurrency input for conflict resolve
  tenantId: string;
  componentId: string;
  componentKey: string;
  seedKey: string;
  policy: TenantSeedPolicyEnum;
  status: TenantSeedStateStatusEnum;
  desiredVersion: string | null;
  appliedVersion: string | null;
  desiredChecksum: string | null;
  appliedChecksum: string | null;
  updateAvailable: boolean;
  customizedAt: string | null;
  conflictCode: string | null;
  lastOperationId: string | null;
  createdAt: string;
  updatedAt: string;
}
```

Installation and seed endpoints return paginated envelopes and no-store cache
headers.

## Prerequisites

Request body:

```ts
interface RequestTenantProvisioningPrerequisiteDto {
  operationId: string;       // UUIDv7
  expectedPlanDigest: string; // 64 lowercase hex
  reasonCode: string;         // ^[A-Z][A-Z0-9._-]{2,95}$
}
```

The operation must belong to the tenant, its plan digest must still match, and
the plan must actually require backup or maintenance evidence. The response
contains a request id, operation/generation, plan/request digests, status,
release pins, safe code, and lifecycle timestamps.

The evidence list is a bounded newest-request-first array under `data` with no
pagination `meta` (maximum 200 requests). Each row contains the safe request,
optional maintenance-fence evidence, and safe backup/maintenance evidence.
Raw credentials, worker payloads, and unsafe errors are not returned.

## Managed commands

Managed commands return:

```ts
interface ManagedProvisioningOperationView {
  operationId: string;
  tenantId: string;
  type: TenantOperationTypeEnum;
  status: TenantOperationStatusEnum;
  generation: number;
  planDigest: string;
  replayed: boolean;
}
```

### Add module

```ts
interface CreateAddModuleProvisioningOperationDto {
  moduleKey: string; // ^[a-z][a-z0-9_-]{0,63}$
  expectedAccessPolicyRevision: number; // integer 1..2147483647
  targetSelection: FleetTargetSelectionDto[]; // 1..100
  reasonCode: string;
}

interface FleetTargetSelectionDto {
  componentKey: string;
  componentId: string;
  targetReleaseId: string;
  targetReleaseVersion: string;
  targetManifestChecksum: string;
  expectedCurrentReleaseId?: string;
  expectedCurrentManifestChecksum?: string;
}
```

The module must already be entitled in the current access policy. The revision
and every target release/checksum must match current server evidence, and the
latest operation must be terminal-successful.

### Repair

```ts
interface CreateRepairProvisioningOperationDto {
  componentKey: string;
  currentDesiredReleaseId: string;
  currentDesiredManifestChecksum: string;
  currentAppliedReleaseId?: string;
  currentAppliedManifestChecksum?: string;
  targetReleaseId: string;
  targetManifestChecksum: string;
  reasonCode: string;
  conflictResolutionIds?: string[]; // max 100 UUIDv7 values
}
```

### Decommission

```ts
interface CreateDecommissionProvisioningOperationDto {
  componentKey: string;
  currentDesiredReleaseId: string;
  currentDesiredManifestChecksum: string;
  currentAppliedReleaseId: string;
  currentAppliedManifestChecksum: string;
  retentionAcknowledged: boolean;
  reasonCode: string;
}
```

All release ids are UUIDv7, checksums are 64 lowercase hex, component keys use
the component-key pattern, and reason codes use the safe-code pattern.
Decommission requires an explicit boolean acknowledgment; a truthy string is
not a substitute for UI consent.

## Errors and UI behavior

| Status | Code | UI behavior |
|:---:|:---|:---|
| `400` | DTO/UUID/enum validation | Map fields; do not retry unchanged |
| `400` | `INVALID_IDEMPOTENCY_KEY` | Fix UUIDv7 generation |
| `404` | `TENANT_NOT_FOUND` | Close tenant workspace |
| `404` | `TENANT_OPERATION_NOT_FOUND` | Refetch history |
| `404` | `PROVISIONING_COMPONENT_NOT_FOUND` | Refresh state/catalogue |
| `409` | `IDEMPOTENCY_KEY_REUSED` / `PROVISIONING_IDEMPOTENCY_CONFLICT` | Key was reused for another intent |
| `409` | `TENANT_PROVISIONING_OPERATION_SUPERSEDED` | Selected row is no longer latest |
| `409` | `TENANT_PROVISIONING_RETRY_NOT_ALLOWED` | Recompute retry visibility from latest status |
| `409` | `TENANT_PROVISIONING_CANCEL_NOT_ALLOWED` | Operation is already terminal/not cancellable |
| `409` | `TENANT_PROVISIONING_OPERATION_STATE_INVALID` | Resolve latest operation or lifecycle first |
| `409` | `TENANT_PROVISIONING_PLAN_STALE` | Refresh operation/access-policy evidence |
| `409` | `TENANT_PROVISIONING_UPDATE_SELECTION_STALE` | Reload update choices |
| `409` | `TENANT_PROVISIONING_PREREQUISITE_PLAN_STALE` | Reload operation |
| `409` | `TENANT_PROVISIONING_PREREQUISITE_NOT_REQUIRED` | Hide prerequisite action |
| `422` | `TENANT_PROVISIONING_UPDATE_SELECTION_INVALID` | Correct duplicate/incomplete selection |
| `422` | `TENANT_PROVISIONING_UPDATE_INCOMPATIBLE` | Present compatibility conflict |
| `422` | `TENANT_PROVISIONING_NO_ADMIN_MANAGED_UPDATES` | Empty state, not generic failure |
| `503` | `TENANT_PROVISIONING_CATALOG_INVALID` | Operational catalogue failure |

Gateway idempotency errors use Problem Details `code`:
`GW.IDEM.MISSING`, `GW.IDEM.BAD_VALUE`, `GW.IDEM.IN_FLIGHT`, and
`GW.IDEM.MISMATCH`.

## Current frontend integration

The tenant workspace implements all 15 routes in this document with strict
response readers, independent permission states, bounded live polling, and
caller-owned UUIDv7 command identities. Operation selection exposes weighted
progress, the complete step DAG, safe errors, generation/current phase, and the
bounded event timeline. Retry and cancel visibility follows Core's `exits`.

Operation detail, as rendered:

- `RUNNING` (operation and step) is the informational tone with a spinner,
  distinct from the neutral `PENDING`/queued states; a stalled operation or
  step keeps its status but drops the spinner.
- Each step shows its start, finish, elapsed time (start to finish, or to the
  last read while running; `startedAt` is the first start, so a re-dispatched
  step keeps counting) and its safe error, if any.
- A set `stall` adds an amber "Stalled · no progress for …" badge to the
  operation and to the step it names, and a notice explaining the reason and
  the exit that is left (request cancellation, or wait for the Worker to
  confirm a pending stop).
- **Request cancel**, **Re-provision** and **Create repair** each open the
  design-system `ConfirmActionModal`, naming the operation generation or
  component and the command's consequence; nothing is sent until confirmed and
  the dialog cannot be dismissed while the command is in flight. An exit Core
  holds closed renders the control disabled with its reason beside it, except
  where the control is meaningless (cancelling a finished, superseded or
  already-cancelling operation; re-provisioning a superseded or successful one).

Polling (`useTenantProvisioning`) runs while any operation is open or a
prerequisite is unsettled. It reads every 3 s, slows to 15 s after 15 quiet
seconds and to 60 s after a further quiet minute, and returns to 3 s on any
observed change, command, selection, manual refresh, or return to the tab.
"Quiet" compares the operations, the selected detail's statuses, steps and
stall reason, and prerequisite states — never `ageSeconds`. It pauses while the
page is hidden or a confirmation dialog is open (the badge reads "Auto-refresh
paused"), and a refresh merges page one into the operations and timeline pages
already loaded instead of discarding "Load older".

Updates copy the current and target release evidence returned by Core. The
state workspace exposes component installations and seed state, including the
exact `revision` required for a conflict decision. Prerequisite requests and
evidence, add-Application, repair, retained decommission, and conflict resolve
are separately permission-gated. Raw Worker logs, secrets, and unbounded
provider payloads are intentionally not browser APIs; the safe timeline is the
operator-facing log surface.

## Backend source map

Paths are relative to `C:\mutakamel.ai\frontend`:

- `../backend/mutakamel-apps/api-gateway-app/src/routing-proxy/route-contracts/core.route-contracts.ts`
- `../backend/mutakamel-apps/core-app/src/admin/tenants/tenant-operations.controller.ts`
- `../backend/mutakamel-apps/core-app/src/admin/tenants/tenant-operations.service.ts`
- `../backend/mutakamel-apps/core-app/src/admin/tenants/dto/tenant-operation-query.dto.ts`
- `../backend/mutakamel-apps/core-app/src/admin/tenants/provisioning/admin-tenant-provisioning-commands.controller.ts`
- `../backend/mutakamel-apps/core-app/src/admin/tenants/provisioning/admin-tenant-provisioning-updates.controller.ts`
- `../backend/mutakamel-apps/core-app/src/admin/tenants/provisioning/admin-tenant-provisioning-prerequisite.controller.ts`
- `../backend/mutakamel-apps/core-app/src/admin/tenants/provisioning/admin-tenant-provisioning-managed-operations.controller.ts`
- `../backend/mutakamel-apps/core-app/src/admin/tenants/provisioning/admin-tenant-provisioning-state.controller.ts`
- `../backend/mutakamel-apps/core-app/src/admin/tenants/provisioning/dto/`
- `../backend/mutakamel-apps/core-app/src/admin/tenants/provisioning/tenant-provisioning-command.service.ts`
- `../backend/mutakamel-apps/core-app/src/admin/tenants/provisioning/tenant-provisioning-managed-operations.service.ts`
- `../backend/mutakamel-apps/core-app/src/admin/tenants/provisioning/tenant-operation-exits.ts`
- `../backend/mutakamel-apps/core-app/src/admin/tenants/provisioning/tenant-provisioning-prerequisite.service.ts`
- `../backend/mutakamel-apps/core-app/src/admin/tenants/provisioning/tenant-provisioning-read-models.service.ts`
- `../backend/mutakamel-apps/core-app/packages/database/src/enums/tenant-provisioning.enum.ts`
- `../backend/mutakamel-apps/shared-libs/packages/common/src/interceptors/response-envelope.interceptor.ts`

## Cancellation and re-provision recovery

`CANCEL_REQUESTED` remains an open operation until the Worker commits stop evidence. The Operations tab keeps **Re-provision** visible but disabled during cancellation (`exits.retry.reasonCode = CANCELLATION_PENDING`) and continues polling; if the Worker has not confirmed the stop after 10 minutes the operation is marked stalled (`CANCEL_PENDING`) and the notice says no operator action can move it on until the Worker confirms. Once cancelled, that button submits the existing operation-specific retry command after confirmation. Failed retryable operations offer the same **Re-provision** action through the existing retry endpoint. Repair follows `exits.repair` (falling back to the history's latest status while no detail is loaded) and is disabled with its reason while an operation is open; add-Application and decommission stay disabled while an operation is open, with **View current operation** navigation. A raced `TENANT_PROVISIONING_OPERATION_ALREADY_OPEN` response explains how to recover instead of displaying only the raw code. Failed requests clear the busy state while retaining the same idempotency key where the outcome is uncertain.
