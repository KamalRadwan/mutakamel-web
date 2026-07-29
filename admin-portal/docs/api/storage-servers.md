# Storage Servers Frontend Contract

Verified against the current API Gateway route contracts, Core controllers,
DTOs, services, database enums, and the active Admin Portal source on
**2026-07-29**.

This is the implementation contract for the planned Storage Servers module:

- `/storage-servers` — bounded catalogue, status/capacity overview, and the
  **Add Storage Server** modal;
- `/storage-servers/[id]` — one server's details, history, verification, and
  lifecycle actions;
- `/storage-servers/[id]?mode=edit` — the same detail route used as the safe
  edit-mode foundation. A separate edit page is not required.

No Storage Servers page exists in the current Admin Portal source. The module
must remain documented as **not integrated** until the routes, loading and
error states, permission gates, and real API mutations are implemented.

## Ownership and browser rules

| Concern | Contract |
|:---|:---|
| Backend owner | `core-app` |
| Browser API prefix | `/api/admin/core/v1` |
| Guard | `AdminGuard` |
| IDs | UUIDv7 |
| Provider | `GARAGE` only |
| Current frontend implementation | None |
| Shared HTTP client | Required; do not use raw `fetch` |

Every protected request uses the shared authenticated client so
`x-auth-cookie-mode: 1`, `credentials: "include"`, and the coordinated refresh
retry remain intact. Do not read, persist, or attach a legacy browser access
token in this module.
Controller-relative `/admin/storage-servers` and upstream
`/api/v1/admin/storage-servers` are not browser URLs.

## Complete endpoint and permission matrix

Every permission shown beside an endpoint is exact. A user must have **all**
permissions in a cell unless the cell explicitly says otherwise. Every
mutation is a Gateway `WRITE_SENSITIVE`, `idempotent: true` route and requires
one UUIDv7 `x-idempotency-key` per user intent.

### Storage Server registry

| Method and canonical browser path | Exact permission | Success | Body |
|:---|:---|:---:|:---|
| `GET /api/admin/core/v1/storage-servers` | `admin.storage_servers.read` | `200` | None |
| `POST /api/admin/core/v1/storage-servers` | `admin.storage_servers.create` + `admin.storage_servers.critical` | `201` | `CreateStorageServerDto` |
| `GET /api/admin/core/v1/storage-servers/:id` | `admin.storage_servers.read` | `200` | None |
| `PATCH /api/admin/core/v1/storage-servers/:id` | `admin.storage_servers.update` + `admin.storage_servers.critical` | `200` | `UpdateStorageServerDto` |
| `GET /api/admin/core/v1/storage-servers/:id/history` | `admin.storage_servers.read` | `200` | None |
| `DELETE /api/admin/core/v1/storage-servers/:id` | `admin.storage_servers.delete` + `admin.storage_servers.critical` | `204` | None |

### Routing, principal rotation, and verification

| Method and canonical browser path | Exact permission | Success | Body |
|:---|:---|:---:|:---|
| `PATCH /api/admin/core/v1/storage-servers/:id/routing-profile` | `admin.storage_servers.update` + `admin.storage_servers.critical` | `200` | `SetStorageRoutingProfileDto` |
| `POST /api/admin/core/v1/storage-servers/:id/principals/:principal/credential-roles/:credentialRole/rotations` | `admin.storage_servers.update` + `admin.storage_servers.critical` | `201` | None |
| `POST /api/admin/core/v1/storage-servers/:id/verification-runs` | `admin.storage_servers.update` + `admin.storage_servers.critical` | `201` | None |
| `GET /api/admin/core/v1/storage-servers/:id/verification-runs/:runId` | `admin.storage_servers.read` | `200` | None |

### Lifecycle

| Method and canonical browser path | Exact permission | Success | Body |
|:---|:---|:---:|:---|
| `POST /api/admin/core/v1/storage-servers/:id/activate` | `admin.storage_servers.update` + `admin.storage_servers.critical` | `201` | None |
| `POST /api/admin/core/v1/storage-servers/:id/drain` | `admin.storage_servers.update` + `admin.storage_servers.critical` | `201` | None |
| `POST /api/admin/core/v1/storage-servers/:id/offline` | `admin.storage_servers.update` + `admin.storage_servers.critical` | `201` | None |

### Ed25519 attestation-key registry

| Method and canonical browser path | Exact permission | Success | Body |
|:---|:---|:---:|:---|
| `GET /api/admin/core/v1/storage-attestation-keys` | `admin.storage_servers.read` | `200` | None |
| `POST /api/admin/core/v1/storage-attestation-keys` | `admin.storage_servers.update` + `admin.storage_servers.critical` | `201` | `RegisterStorageAttestationKeyDto` |
| `POST /api/admin/core/v1/storage-attestation-keys/:id/promote` | `admin.storage_servers.update` + `admin.storage_servers.critical` | `201` | None |
| `POST /api/admin/core/v1/storage-attestation-keys/:id/revoke` | `admin.storage_servers.update` + `admin.storage_servers.critical` | `201` | `RevokeStorageAttestationKeyDto` |

## HTTP envelopes and exact-retry behavior

Core successes are wrapped by the global response interceptor:

```ts
interface SuccessResponse<T> {
  success: true;
  data: T;
  correlationId: string;
  timestamp: string;
}
```

The list and history services return their own bounded `{ items, total }`
objects under `data`; they do not return pagination `meta`. The attestation-key
list returns an array directly under `data`. HTTP `204` has no JSON body.

Core failures expose `errorCode`; Gateway Problem Details expose `code`.
Normalize both and preserve `correlationId`.

For every mutation:

1. create one UUIDv7 key when the admin confirms the intent;
2. retain that key while the request outcome is unknown;
3. reuse it only for an exact transport retry;
4. create a new key after any body, path parameter, or intended action changes;
5. after an ambiguous lifecycle response, refetch the server before enabling a
   second action.

## Transport enums

```ts
type StorageServerProvider = "GARAGE";
type StorageServerPlacementRole = "GENERAL" | "BACKUP_ONLY";
type StorageServerStatus = "DRAFT" | "ACTIVE" | "DRAINING" | "OFFLINE";

type StorageServerAvailabilityClass =
  | "DEGRADED_SINGLE_NODE"
  | "SINGLE_NODE_OPERATIONAL"
  | "BACKUP_TARGET_OPERATIONAL"
  | "HA_PRODUCTION_READY";

type StorageServerHealthStatus = "UNKNOWN" | "HEALTHY" | "UNHEALTHY";

type StoragePrincipal =
  | "CORE"
  | "CRM"
  | "TRADE"
  | "WORKER"
  | "BACKUP"
  | "PROBE";

type StorageCredentialRole = "OPERATION" | "SIGNING";
type StorageVerificationStatus = "PENDING" | "PASS" | "FAIL" | "EXPIRED";

type StorageServerHistoryAction =
  | "BOOTSTRAPPED"
  | "CREATED"
  | "UPDATED"
  | "BINDINGS_CHANGED"
  | "PRINCIPAL_ROTATED"
  | "VERIFIED"
  | "ACTIVATED"
  | "DRAINED"
  | "OFFLINED"
  | "DELETED";

type StorageAttestationKeyStatus =
  | "STAGED"
  | "ACTIVE"
  | "RETIRED"
  | "REVOKED";
```

Do not translate enum values in requests. Translate only their visible labels
and include an unknown-value rendering fallback.

## Safe registry projection

Both the list and detail endpoints return the same projection:

```ts
interface StorageServerAdminView {
  id: string;
  code: string;
  name: string;
  provider: "GARAGE";
  placementRole: StorageServerPlacementRole;
  internalEndpoint: string;
  publicEndpoint: string;
  region: string;
  forcePathStyle: true;
  configRevision: number;
  bindingRevision: number;
  readinessRevision: number;
  status: StorageServerStatus;
  availabilityClass: StorageServerAvailabilityClass;
  healthStatus: StorageServerHealthStatus;
  maxTenants: number;
  currentTenants: number;
  retainedTenants: number;
  reservedTenants: number;
  desiredNodeCount: number;
  desiredZoneCount: number;
  requiredReplicationFactor: number;
  observedNodeCount: number | null;
  observedZoneCount: number | null;
  observedReplicationFactor: number | null;
  usableCapacityBytes: string | null;
  usedCapacityBytes: string | null;
  allocatableCapacityBytes: string | null;
  activeReservedCapacityBytes: string;
  warningPercent: number;
  criticalPercent: number;
  createdAt: string;
  updatedAt: string;
}
```

Byte counters are decimal strings. Use `BigInt`-safe formatting and never
convert them to JavaScript `number`.

The current Admin projection intentionally does **not** return:

- S3 access keys, secret keys, session tokens, secret material, or fingerprints;
- credential references for principal slots;
- bucket names or bucket bindings;
- attestation key IDs selected by the routing profile;
- deployment identity or deployment fingerprint;
- topology-member identities or encrypted-volume evidence;
- recovery-destination or isolated-restore evidence;
- a boolean such as `isProductionReady`.

The projection currently does return the two administrative endpoints. Treat
them as sensitive operational metadata: show them only on a read-permitted
detail screen, never copy them into tenant projections, analytics, logs, or
client storage. If a future safe projection omits either endpoint, the UI must
render it as unavailable; it must not reconstruct it from environment values
or another response.

### Representative detail response

```json
{
  "success": true,
  "data": {
    "id": "019f0000-0000-7000-8000-000000000051",
    "code": "storage-1",
    "name": "Primary Garage Cluster",
    "provider": "GARAGE",
    "placementRole": "GENERAL",
    "internalEndpoint": "http://storage.internal:3900",
    "publicEndpoint": "https://storage.example.com",
    "region": "garage",
    "forcePathStyle": true,
    "configRevision": 1,
    "bindingRevision": 2,
    "readinessRevision": 4,
    "status": "DRAFT",
    "availabilityClass": "DEGRADED_SINGLE_NODE",
    "healthStatus": "UNKNOWN",
    "maxTenants": 100,
    "currentTenants": 0,
    "retainedTenants": 0,
    "reservedTenants": 0,
    "desiredNodeCount": 3,
    "desiredZoneCount": 3,
    "requiredReplicationFactor": 3,
    "observedNodeCount": null,
    "observedZoneCount": null,
    "observedReplicationFactor": null,
    "usableCapacityBytes": null,
    "usedCapacityBytes": null,
    "allocatableCapacityBytes": null,
    "activeReservedCapacityBytes": "0",
    "warningPercent": 70,
    "criticalPercent": 85,
    "createdAt": "2026-07-28T08:00:00.000Z",
    "updatedAt": "2026-07-28T08:00:00.000Z"
  },
  "correlationId": "019f0000-0000-7000-8000-000000000091",
  "timestamp": "2026-07-28T08:00:00.100Z"
}
```

## View-all screen

### Request

`GET /api/admin/core/v1/storage-servers`

Permission: `admin.storage_servers.read`.

The endpoint accepts no list query DTO. It returns at most 500 rows sorted by
`name`, then `id`. Do not send invented pagination, search, status, region, or
sort parameters. Search and filtering can be client-side while the bounded
contract remains unchanged.

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "019f0000-0000-7000-8000-000000000051",
        "code": "storage-1",
        "name": "Primary Garage Cluster",
        "provider": "GARAGE",
        "placementRole": "GENERAL",
        "internalEndpoint": "http://storage.internal:3900",
        "publicEndpoint": "https://storage.example.com",
        "region": "garage",
        "forcePathStyle": true,
        "configRevision": 1,
        "bindingRevision": 2,
        "readinessRevision": 4,
        "status": "DRAFT",
        "availabilityClass": "DEGRADED_SINGLE_NODE",
        "healthStatus": "UNKNOWN",
        "maxTenants": 100,
        "currentTenants": 0,
        "retainedTenants": 0,
        "reservedTenants": 0,
        "desiredNodeCount": 3,
        "desiredZoneCount": 3,
        "requiredReplicationFactor": 3,
        "observedNodeCount": null,
        "observedZoneCount": null,
        "observedReplicationFactor": null,
        "usableCapacityBytes": null,
        "usedCapacityBytes": null,
        "allocatableCapacityBytes": null,
        "activeReservedCapacityBytes": "0",
        "warningPercent": 70,
        "criticalPercent": 85,
        "createdAt": "2026-07-28T08:00:00.000Z",
        "updatedAt": "2026-07-28T08:00:00.000Z"
      }
    ],
    "total": 1
  },
  "correlationId": "019f0000-0000-7000-8000-000000000092",
  "timestamp": "2026-07-28T08:00:00.100Z"
}
```

### View-all behavior

- Wait for `/auth/me` before rendering the module.
- Hide navigation and deny direct page entry without
  `admin.storage_servers.read`.
- A user with read permission but without critical permissions gets a
  read-only catalogue.
- Keep loading, empty, forbidden, request-error, and stale-data/retry states
  distinct.
- Link each row to `/storage-servers/[id]`.
- Show `maxTenants = 0` as no tenant placement, not unlimited.
- Derive tenant slot usage from
  `currentTenants + retainedTenants + reservedTenants`; do not call it live
  tenant count.
- Capacity is unavailable when the required byte fields are `null`.
- Never infer production readiness from the status label alone.

The **Add Storage Server** action requires both
`admin.storage_servers.create` and `admin.storage_servers.critical`.

## Add Storage Server modal

The modal sends:

`POST /api/admin/core/v1/storage-servers`

Permissions:
`admin.storage_servers.create` + `admin.storage_servers.critical`.

```ts
interface CreateStorageServerDto {
  code: string;
  name: string;
  internalEndpoint: string;
  publicEndpoint: string;
  region: string;
  placementRole?: "GENERAL" | "BACKUP_ONLY";
  forcePathStyle?: true;
  desiredNodeCount: number;
  desiredZoneCount: number;
  requiredReplicationFactor: number;
  maxTenants: number;
  warningPercent?: number;
  criticalPercent?: number;
}
```

Validation:

| Field | Rule |
|:---|:---|
| `code` | Trimmed/lowercased; 1–63 DNS-label characters matching `^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$` |
| `name` | Trimmed, 1–120 |
| `internalEndpoint` | Absolute credential-free HTTP or HTTPS URL, max 2048 |
| `publicEndpoint` | Absolute credential-free HTTPS URL, max 2048 |
| `region` | Trimmed, 1–63 |
| `placementRole` | Optional; defaults to `GENERAL` |
| `forcePathStyle` | Optional but, when sent, must be literal `true`; Garage is always path-style |
| desired node/zone/RF fields | Integer 1–64 |
| `maxTenants` | Integer 0–1,000,000 |
| `warningPercent` | Optional integer 1–98; default 70 |
| `criticalPercent` | Optional integer 2–99; default 85 |

Cross-field rules:

- `desiredZoneCount <= desiredNodeCount`;
- `requiredReplicationFactor <= desiredNodeCount`;
- `warningPercent < criticalPercent`;
- `BACKUP_ONLY` requires `maxTenants = 0`;
- endpoint URLs may not contain usernames, passwords, query strings, or
  fragments.

Example request:

```json
{
  "code": "storage-2",
  "name": "Secondary Garage Cluster",
  "internalEndpoint": "http://storage-2.internal:3900",
  "publicEndpoint": "https://storage-2.example.com",
  "region": "garage",
  "placementRole": "GENERAL",
  "forcePathStyle": true,
  "desiredNodeCount": 3,
  "desiredZoneCount": 3,
  "requiredReplicationFactor": 3,
  "maxTenants": 200,
  "warningPercent": 70,
  "criticalPercent": 85
}
```

Creation returns `SuccessResponse<StorageServerAdminView>`. The new entity is
always `DRAFT`, `DEGRADED_SINGLE_NODE`, and `UNKNOWN`. Successful creation
must close the modal, invalidate the bounded list, and navigate to or offer a
link to the new detail screen.

The modal registers only the base entity. It does not create buckets, accept
access keys, configure credential references, verify the provider, or activate
the server. Do not add those fields to this DTO.

## View-one and edit mode

### Load

`GET /api/admin/core/v1/storage-servers/:id`

Permission: `admin.storage_servers.read`.

Use one canonical query result as the source for both view and edit modes.
Opening edit mode copies only writable fields into a form draft; cancel
discards that draft and leaves the query cache unchanged.

### Safe edit request

`PATCH /api/admin/core/v1/storage-servers/:id`

Permissions:
`admin.storage_servers.update` + `admin.storage_servers.critical`.

```ts
interface UpdateStorageServerDto {
  name?: string;
  internalEndpoint?: string;
  publicEndpoint?: string;
  region?: string;
  placementRole?: "GENERAL" | "BACKUP_ONLY";
  desiredNodeCount?: number;
  desiredZoneCount?: number;
  requiredReplicationFactor?: number;
  maxTenants?: number;
  warningPercent?: number;
  criticalPercent?: number;
}
```

The same field validation and cross-field rules used during creation apply.
Send only changed documented fields. `code`, `provider`, `forcePathStyle`,
status, observed topology, health, capacity, counters, and all revision fields
are read-only.

Core accepts configuration updates only when:

- status is `DRAFT` or `OFFLINE`; and
- `currentTenants + retainedTenants === 0`.

The API does not currently accept an `expectedUpdatedAt` or
`expectedConfigRevision` token. Refetch immediately before entering edit mode,
disable duplicate submission, and refetch after success or conflict. Do not
simulate optimistic concurrency with an undocumented field.

Changing configuration increments `configRevision` and `readinessRevision`,
resets health to `UNKNOWN`, and invalidates prior readiness evidence. A
successful edit does not reactivate or re-verify the server.

## Routing profile

`PATCH /api/admin/core/v1/storage-servers/:id/routing-profile`

Permissions:
`admin.storage_servers.update` + `admin.storage_servers.critical`.

```ts
interface SetStorageRoutingProfileDto {
  expectedBindingRevision: number; // integer >= 1
  buckets: {
    PRIVATE: string;
    RESTRICTED: string;
    CONTROL: string;
    BACKUP: string;
    PUBLIC?: string;
  };
  principals: {
    CORE_OPERATION: string;
    CORE_SIGNING: string;
    CRM_OPERATION: string;
    CRM_SIGNING: string;
    TRADE_OPERATION: string;
    TRADE_SIGNING: string;
    WORKER_OPERATION: string;
    BACKUP_OPERATION: string;
    PROBE_OPERATION: string;
  };
  attestationKeys: {
    CORE: string;
    CRM: string;
    TRADE: string;
    WORKER: string;
    BACKUP: string;
    PROBE: string;
  };
}
```

Bucket rules:

- each name is 3–63 characters and matches
  `^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$`;
- every supplied bucket name must be distinct;
- `PRIVATE`, `RESTRICTED`, `CONTROL`, and `BACKUP` are mandatory;
- `PUBLIC` is optional.

Principal values are **references**, not secrets. They must use the exact
shape and exact slot suffix:

```text
env:S3_<PREFIX>_CORE_OPERATION
env:S3_<PREFIX>_CORE_SIGNING
env:S3_<PREFIX>_CRM_OPERATION
env:S3_<PREFIX>_CRM_SIGNING
env:S3_<PREFIX>_TRADE_OPERATION
env:S3_<PREFIX>_TRADE_SIGNING
env:S3_<PREFIX>_WORKER_OPERATION
env:S3_<PREFIX>_BACKUP_OPERATION
env:S3_<PREFIX>_PROBE_OPERATION
```

Each attestation key value is a registered `keyId` for the same principal.
Load valid choices from `GET /storage-attestation-keys` and show only
`STAGED`/`ACTIVE` keys whose validity window extends beyond the immediate
verification window.

This operation is a complete replacement, not a partial patch. It is allowed
only on an empty `DRAFT` or `OFFLINE` server. Core rejects stale
`expectedBindingRevision`, duplicate class buckets, incomplete principal
slots, or invalid attestation keys. Success increments `bindingRevision` and
`readinessRevision`, and all principal slots return to pending verification.

### Important read limitation

There is no browser API that returns the current bucket names, credential
references, or selected attestation key IDs. The detail projection returns
only `bindingRevision`. Therefore:

- do not fabricate a prefilled routing-profile editor;
- do not persist the submitted profile in browser storage;
- present this as an explicit full replacement requiring fresh operator input;
- use the latest detail `bindingRevision` at confirmation time;
- do not show submitted secret references after the request completes;
- treat a future dedicated safe read projection as a separate backend contract
  change, not something the frontend can infer.

Example success is `SuccessResponse<StorageServerAdminView>` with the new
`bindingRevision`.

## Attestation keys

### List

`GET /api/admin/core/v1/storage-attestation-keys`

Permission: `admin.storage_servers.read`.

```ts
interface StorageAttestationKeyView {
  id: string;
  keyId: string;
  principal: StoragePrincipal;
  algorithm: "Ed25519";
  publicKey: string;
  status: StorageAttestationKeyStatus;
  validFrom: string;
  validUntil: string;
  keyRevision: number;
  revokedAt: string | null;
  revocationReason: string | null;
  createdAt: string;
  updatedAt: string;
}
```

The response is `SuccessResponse<StorageAttestationKeyView[]>`. `publicKey` is
public verification material, never a private key.

### Register

`POST /api/admin/core/v1/storage-attestation-keys`

Permissions:
`admin.storage_servers.update` + `admin.storage_servers.critical`.

```ts
interface RegisterStorageAttestationKeyDto {
  keyId: string;       // 1..128, /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/
  principal: StoragePrincipal;
  publicKey: string;   // canonical unpadded base64url, exactly 32 decoded bytes
  validFrom: string;   // canonical UTC ISO timestamp
  validUntil: string;  // canonical UTC ISO timestamp
}
```

The positive validity window may not exceed two years. Success returns the
registered row in `STAGED` status.

### Promote

`POST /api/admin/core/v1/storage-attestation-keys/:id/promote`

Permissions:
`admin.storage_servers.update` + `admin.storage_servers.critical`.

Only a currently valid `STAGED` key can become `ACTIVE`. Promotion retires any
other active key for that principal and returns the promoted row.

### Revoke

`POST /api/admin/core/v1/storage-attestation-keys/:id/revoke`

Permissions:
`admin.storage_servers.update` + `admin.storage_servers.critical`.

```ts
interface RevokeStorageAttestationKeyDto {
  reason: string; // 3..160, /^[A-Z][A-Z0-9._-]{2,159}$/
}
```

Revocation is idempotent for an already revoked key. It invalidates matching
principal verification evidence and increments readiness revisions on affected
servers. Refetch both the key catalogue and any open server detail.

Never accept or display an Ed25519 private key in this module.

## Credential-reference rotation

`POST /api/admin/core/v1/storage-servers/:id/principals/:principal/credential-roles/:credentialRole/rotations`

Permissions:
`admin.storage_servers.update` + `admin.storage_servers.critical`.

Supported slots are exactly:

- `CORE/OPERATION`, `CORE/SIGNING`;
- `CRM/OPERATION`, `CRM/SIGNING`;
- `TRADE/OPERATION`, `TRADE/SIGNING`;
- `WORKER/OPERATION`;
- `BACKUP/OPERATION`;
- `PROBE/OPERATION`.

The route has no body. It does not upload or replace secret material and does
not accept a new credential reference. It records that the externally managed
material at the already configured reference has rotated, increments the
principal and readiness revisions, and sets verification to `PENDING`.

```json
{
  "success": true,
  "data": {
    "principal": "CORE",
    "credentialRole": "OPERATION",
    "principalRevision": 2,
    "readinessRevision": 5,
    "verificationStatus": "PENDING"
  },
  "correlationId": "019f0000-0000-7000-8000-000000000093",
  "timestamp": "2026-07-28T08:10:00.000Z"
}
```

The confirmation must state that the operator is attesting to an out-of-band
secret-store rotation. The portal must never ask for the S3 access key or
secret key.

## Verification workflow

### Start

`POST /api/admin/core/v1/storage-servers/:id/verification-runs`

Permissions:
`admin.storage_servers.update` + `admin.storage_servers.critical`.

Verification can start only from `DRAFT` or `OFFLINE`, requires the exact nine
principal slots, and requires current staged/active attestation keys. It
creates six secret-free principal commands and nine durable challenges.

```json
{
  "success": true,
  "data": {
    "verificationRunId": "019f0000-0000-7000-8000-000000000061",
    "correlationId": "019f0000-0000-7000-8000-000000000062",
    "status": "PENDING",
    "expiresAt": "2026-07-28T08:30:00.000Z"
  },
  "correlationId": "019f0000-0000-7000-8000-000000000063",
  "timestamp": "2026-07-28T08:15:00.000Z"
}
```

Keep `verificationRunId` in in-memory state and, if navigation continuity is
needed, in the URL query string. It is an identifier, not a credential.

### Poll one run

`GET /api/admin/core/v1/storage-servers/:id/verification-runs/:runId`

Permission: `admin.storage_servers.read`.

```ts
interface StorageVerificationRunView {
  id: string;
  status: "PENDING" | "PASS" | "FAIL" | "EXPIRED";
  configRevision: number;
  bindingRevision: number;
  readinessRevision: number;
  probeProfileVersion: number;
  requestedAt: string;
  expiresAt: string;
  completedAt: string | null;
  correlationId: string;
  results: Array<{
    principal: StoragePrincipal;
    credentialRole: StorageCredentialRole;
    status: "PASS" | "FAIL";
    verifiedAt: string;
  }>;
}
```

Poll with bounded backoff only while `PENDING` and before `expiresAt`. Stop on
`PASS`, `FAIL`, `EXPIRED`, page exit, or auth failure. A terminal result must
trigger a server-detail refetch. Do not expose broker payloads, challenges,
fingerprints, object keys, or secret references.

There is no list/latest-run endpoint. After a full page reload, the portal can
load a run only when it still has the exact `runId`; otherwise show current
server health and history without inventing a latest run.

## Lifecycle and delete rules

All lifecycle actions return `SuccessResponse<StorageServerAdminView>`.

| Action | Server-side precondition |
|:---|:---|
| Activate | Full production-readiness query passes |
| Drain | Current status is `ACTIVE` |
| Offline | Current status is `DRAINING` and `currentTenants + retainedTenants === 0` |
| Delete | Status is `DRAFT` or `OFFLINE` and all current, retained, and reserved tenant counters are zero |

Activation is authoritative server-side. It requires current RF3 topology with
at least three nodes and zones, verified encrypted volumes, exact bucket-class
isolation, all nine verified principal slots with active attestation keys,
known capacity, and independent isolated-restore evidence within 180 days.
The safe detail projection does not expose all of that evidence. The UI may
show known topology/capacity facts, but must not calculate or claim a
production-ready boolean.

A single-node server remains non-production. Do not offer tenant placement for
`DRAFT`, `DRAINING`, `OFFLINE`, non-healthy, or non-HA servers.

Every critical action needs a confirmation that names the server and describes
the exact effect. Disable the action while its request is in flight. After any
success or ambiguous error, refetch the detail and list before enabling another
transition.

Delete success is HTTP `204`; remove the query cache entry and return to the
catalogue. Deletion is soft-delete in Core and has no restore endpoint.

## History

`GET /api/admin/core/v1/storage-servers/:id/history`

Permission: `admin.storage_servers.read`.

```ts
interface StorageServerHistoryItem {
  id: string;
  action: StorageServerHistoryAction;
  configRevision: number;
  bindingRevision: number;
  readinessRevision: number;
  changes: Array<{
    field: string;
    previousValue: string | number | boolean | null;
    nextValue: string | number | boolean | null;
  }>;
  actorId: string | null;
  correlationId: string | null;
  createdAt: string;
}
```

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "019f0000-0000-7000-8000-000000000071",
        "action": "UPDATED",
        "configRevision": 2,
        "bindingRevision": 2,
        "readinessRevision": 5,
        "changes": [
          {
            "field": "configRevision",
            "previousValue": 1,
            "nextValue": 2
          }
        ],
        "actorId": "019f0000-0000-7000-8000-000000000001",
        "correlationId": null,
        "createdAt": "2026-07-28T08:20:00.000Z"
      }
    ],
    "total": 1
  },
  "correlationId": "019f0000-0000-7000-8000-000000000094",
  "timestamp": "2026-07-28T08:20:00.100Z"
}
```

History is newest-first and bounded to 500 rows. It contains actor IDs, not
actor profiles. Do not infer names or make extra user lookups without a
separate authorized contract.

## Detail-screen state model

The detail screen is usable with read permission alone. Load critical
subresources independently:

| Resource | Failure isolation |
|:---|:---|
| Server detail | Page-level; `404` is a not-found state |
| History | Section-level retry; detail remains usable |
| Attestation-key catalogue | Required only when opening routing/key flows |
| Exact verification run | Required only while tracking a known `runId` |

Required states:

- initial loading skeleton;
- not found;
- forbidden;
- transport/server error with correlation ID and retry;
- read-only detail;
- edit draft with dirty-state confirmation;
- mutation pending and ambiguous-outcome refetch;
- validation errors mapped to exact fields;
- lifecycle conflict requiring refresh;
- verification pending, passed, failed, and expired;
- history loading, empty, and failed independently.

Do not use permanent mock fallbacks after a real request fails.

## Permission-gated UI

| Capability | Required permissions |
|:---|:---|
| Navigation, list, detail, history, verification result, key list | `admin.storage_servers.read` |
| Add modal | `admin.storage_servers.create` + `admin.storage_servers.critical` |
| Edit base configuration | `admin.storage_servers.update` + `admin.storage_servers.critical` |
| Replace routing profile | `admin.storage_servers.update` + `admin.storage_servers.critical` |
| Rotate principal material reference evidence | `admin.storage_servers.update` + `admin.storage_servers.critical` |
| Start verification | `admin.storage_servers.update` + `admin.storage_servers.critical` |
| Activate, drain, offline | `admin.storage_servers.update` + `admin.storage_servers.critical` |
| Register, promote, revoke attestation key | `admin.storage_servers.update` + `admin.storage_servers.critical` |
| Delete | `admin.storage_servers.delete` + `admin.storage_servers.critical` |

Permission visibility is derived from `/auth/me`, but backend `403` remains
authoritative.

## Error catalogue

### Gateway errors

| Status | Problem Details `code` | UI handling |
|:---:|:---|:---|
| `400` | `GW.IDEM.MISSING` / `GW.IDEM.BAD_VALUE` | Fix the UUIDv7 mutation header |
| `409` | `GW.IDEM.IN_FLIGHT` | Show processing, then refetch |
| `422` | `GW.IDEM.MISMATCH` | Never reuse a key for changed intent |
| `429` | Gateway rate-limit code | Preserve form state and honor retry timing |

### Core errors

| Status | Core `errorCode` | UI handling |
|:---:|:---|:---|
| `400` | Validation error | Map strict DTO/UUID/enum/unknown-field details |
| `404` | `STORAGE_SERVER_NOT_FOUND` | Show not found and return to catalogue |
| `404` | `STORAGE_ATTESTATION_KEY_NOT_FOUND` | Refresh the key catalogue |
| `409` | `STORAGE_SERVER_IDENTITY_CONFLICT` | Highlight duplicate code/name |
| `409` | `STORAGE_SERVER_CATALOGUE_TOO_LARGE` | Operational error; bounded contract exceeded |
| `409` | `STORAGE_SERVER_HISTORY_TOO_LARGE` | Direct admin to archived audit export |
| `409` | `STORAGE_SERVER_UPDATE_REQUIRES_EMPTY_OFFLINE_SERVER` | Refresh status and tenant counters |
| `409` | `STORAGE_SERVER_ROUTING_UPDATE_BLOCKED` | Drain/offline and empty before replacement |
| `409` | `STORAGE_SERVER_BINDING_REVISION_CONFLICT` | Reload before rebuilding the full profile |
| `409` | `STORAGE_SERVER_ROUTING_PROFILE_INCOMPLETE` | Complete all exact principal slots |
| `409` | `STORAGE_SERVER_VERIFICATION_STATE_INVALID` | Verification is limited to DRAFT/OFFLINE |
| `409` | `STORAGE_SERVER_PRODUCTION_READINESS_FAILED` | Show server-authoritative readiness failure |
| `409` | `STORAGE_SERVER_LIFECYCLE_CONFLICT` | Refetch and recompute actions |
| `409` | `STORAGE_SERVER_DELETE_BLOCKED` | Refetch status and all placement counters |
| `409` | `STORAGE_ATTESTATION_KEY_DUPLICATE` | Choose a unique key ID/public key |
| `409` | `STORAGE_ATTESTATION_KEY_PROMOTION_INVALID` | Only staged keys can be promoted |
| `409` | `STORAGE_ATTESTATION_KEY_NOT_CURRENT` | Use a key inside its validity window |
| `422` | `STORAGE_SERVER_ENDPOINT_INVALID` | Correct credential-free URL and HTTPS public endpoint |
| `422` | `STORAGE_SERVER_TOPOLOGY_INVALID` | Correct node/zone/RF/backup-only fields |
| `422` | `STORAGE_SERVER_CAPACITY_THRESHOLDS_INVALID` | Make warning lower than critical |
| `422` | `STORAGE_SERVER_BUCKET_CLASS_ISOLATION_REQUIRED` | Use distinct class buckets |
| `422` | `STORAGE_SERVER_PRINCIPAL_ROLE_UNSUPPORTED` | Use one of the nine supported slots |
| `422` | `STORAGE_ATTESTATION_KEY_PROFILE_INVALID` | Select a current staged/active key for every principal |
| `422` | `STORAGE_ATTESTATION_PUBLIC_KEY_INVALID` | Supply canonical 32-byte Ed25519 public material |
| `422` | `STORAGE_ATTESTATION_KEY_TIMESTAMP_INVALID` | Supply canonical UTC timestamps |
| `422` | `STORAGE_ATTESTATION_KEY_WINDOW_INVALID` | Correct the positive, <=2-year window |
| `503` | `STORAGE_VERIFICATION_TRANSPORT_UNAVAILABLE` | Verification transport is unavailable; keep DRAFT/OFFLINE |
| `503` | `STORAGE_SERVER_CHANGE_TRANSPORT_UNAVAILABLE` | Durable cache-invalidation transport is unavailable; preserve the draft and refetch before retrying |

## Security requirements

- Never collect, return, log, persist, or display S3 access keys, secret keys,
  session tokens, fingerprint keys, or Ed25519 private keys.
- Credential-reference strings are configuration locators, not credentials.
  Even so, do not store them in `localStorage`, `sessionStorage`, analytics,
  errors, or support logs.
- Never include endpoint credentials in URLs. Reject username/password,
  query-string, and fragment input client-side, while keeping Core validation
  authoritative.
- Never expose Storage Server endpoints or routing information through tenant
  create options. Tenant placement uses the separate safe projection in
  [Tenants](tenants.md).
- Do not infer omitted bucket, principal, topology-member, encryption, or
  recovery evidence.
- Do not provide a frontend “force activate” path.
- Do not silently select a Storage Server for tenant creation.
- Do not treat RF1 or a single node as production-ready.

## Implementation boundaries and sequence

1. Add exact transport types, Core/Gateway error normalization, query keys, and
   permission helpers.
2. Add `/storage-servers` and wire the bounded read-only catalogue.
3. Add the create modal and invalidate/refetch after success.
4. Add `/storage-servers/[id]` as the single view/edit route.
5. Add safe base-configuration edit mode.
6. Add independently loaded history.
7. Add attestation-key list/register/promote/revoke flows.
8. Add explicit full routing-profile replacement.
9. Add credential-rotation confirmations and verification polling.
10. Add lifecycle and delete confirmations with authoritative refetch.
11. Add unit tests for adapters, permission/state matrices, byte formatting,
    DTO construction, exact-retry keys, and error normalization.
12. Add integration tests for loading, empty, forbidden, not found,
    validation, conflict, ambiguous retry, and every lifecycle terminal state.

## Backend source map

Paths are relative to `C:\mutakamel.ai\frontend`:

- `../backend/mutakamel-apps/api-gateway-app/src/routing-proxy/route-contracts/core.route-contracts.ts`
- `../backend/mutakamel-apps/core-app/src/admin/storage-servers/storage-servers.controller.ts`
- `../backend/mutakamel-apps/core-app/src/admin/storage-servers/storage-servers.service.ts`
- `../backend/mutakamel-apps/core-app/src/admin/storage-servers/storage-attestation-keys.controller.ts`
- `../backend/mutakamel-apps/core-app/src/admin/storage-servers/storage-attestation-keys.service.ts`
- `../backend/mutakamel-apps/core-app/src/admin/storage-servers/dto/storage-server.dto.ts`
- `../backend/mutakamel-apps/core-app/src/admin/storage-servers/dto/storage-attestation-key.dto.ts`
- `../backend/mutakamel-apps/core-app/packages/database/src/enums/storage-server.enum.ts`
