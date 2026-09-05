# Storage Servers Frontend Contract

Status: **SOURCE-INTEGRATED**

Last source verification: **2026-08-25**

Core owns the Storage Server registry, encrypted Garage/S3 credentials,
lifecycle, connection evidence, placement eligibility, and durable probe
commands. Worker is the sole recurring scheduler. The Admin Portal uses only
the Gateway prefix below; it never calls Core directly.

## Security and transport

```text
/api/admin/core/v1/storage-servers
```

All writes are Gateway `WRITE_SENSITIVE` routes. Every write requires a
caller-owned UUIDv7 `x-idempotency-key`. Registration is safe for Gateway retry
on a transport failure because Core durably binds and replays the domain
command; Gateway transport retry remains disabled for every other Storage
write. Keep the same key only for an unchanged intent whose outcome is unknown,
including a network/5xx response, coordinated `401`,
`GW.IDEM.IN_FLIGHT`, or `STORAGE_SERVER_PROBE_IN_PROGRESS`. Rotate the key
after success or a definitive client rejection.

Credentials are write-only. A browser response must never contain an access
key, secret, ciphertext, IV, tag, master key, provider body, presigned URL, or
internal credential reference. The UI does not persist form values in local or
session storage.

Core success envelope:

```ts
interface SuccessResponse<T> {
  success: true;
  data: T;
  correlationId: string;
  timestamp: string;
}
```

Core error envelope:

```ts
interface CoreErrorResponse {
  success: false;
  statusCode: number;
  errorCode: string;
  errorCategory:
    | "VALIDATION" | "AUTH" | "AUTHORIZATION" | "NOT_FOUND"
    | "CONFLICT" | "RATE_LIMIT" | "SERVER_ERROR";
  message: string;
  details?: Record<string, string[]>;
  correlationId: string;
  timestamp: string;
  path: string;
}
```

Gateway errors use Problem Details with `status`, `code`, `title`, optional
`detail`/`errors`, and `correlationId`. Normalize Gateway `code` and Core
`errorCode` without discarding the correlation ID.

## Routes and permissions

Permission arrays use ALL semantics.

| Method and route | Permissions | Success | Body |
| --- | --- | ---: | --- |
| `POST /storage-servers` | `admin.storage_servers.create` + `admin.storage_servers.critical` | 201 | `CreateStorageServerDto` |
| `GET /storage-servers` | `admin.storage_servers.read` | 200 | query |
| `GET /storage-servers/:id` | `admin.storage_servers.read` | 200 | none |
| `PATCH /storage-servers/:id` | `admin.storage_servers.update` + `admin.storage_servers.critical` | 200 | `UpdateStorageServerDto` |
| `POST /storage-servers/:id/activate` | update + critical | 200 | `{}` |
| `POST /storage-servers/:id/probe` | update + critical | 200 | `ProbeStorageServerDto` |
| `POST /storage-servers/:id/offline` | update + critical | 200 | `{}` |
| `DELETE /storage-servers/:id` | `admin.storage_servers.delete` + critical | 204 | none |

`id` is UUIDv7. There is no public hard-destroy, credential-read, topology,
routing-profile, attestation, or migration control in this module.

## DTOs

```ts
type StorageServerStatus = "DRAFT" | "ACTIVE" | "DRAINING" | "OFFLINE";
type StorageConnectionTestStatus = "NOT_TESTED" | "PASSED" | "FAILED";

interface StorageCredentialsDto {
  accessKeyId: string;       // 3..128, allowed identifier characters
  secretAccessKey: string;   // 16..256, no control characters; never trim
}

interface CreateStorageServerDto {
  code: string;              // lowercase DNS-label shape, immutable
  name: string;              // trimmed, 1..120
  endpoint: string;          // credential-free HTTPS root origin
  region: string;            // lowercase DNS-label shape
  bucketName: string;        // lowercase S3 bucket shape, 3..63
  credentials: StorageCredentialsDto;
  maxTenants?: number | null; // 1..1,000,000; null means unlimited
}

interface UpdateStorageServerDto {
  name?: string;
  endpoint?: string;
  region?: string;
  bucketName?: string;
  credentials?: StorageCredentialsDto;
  maxTenants?: number | null;
  isPlatformDefault?: boolean;
}

interface ProbeStorageServerDto {
  expectedConfigRevision: number; // positive int32
}
```

Core rejects unknown fields. Endpoint validation accepts only an HTTPS root
origin with no username, password, path other than `/`, query, or fragment.
Current Garage access uses path-style requests inside the backend; the browser
does not choose that behavior.

Create example:

```http
POST /api/admin/core/v1/storage-servers
Cookie: __Host-mutakamel-admin-access=<redacted>; __Host-mutakamel-admin-session=<redacted>; __Host-mutakamel-admin-csrf=<csrf-proof>
X-CSRF-Token: <csrf-proof>
x-idempotency-key: 019f0000-0000-7000-8000-000000000020
Content-Type: application/json

{
  "code": "garage-primary",
  "name": "Garage Primary",
  "endpoint": "https://garage.example.com",
  "region": "garage",
  "bucketName": "mutakamel-files-dev",
  "credentials": {
    "accessKeyId": "GK000000000000000000",
    "secretAccessKey": "<write-only-secret>"
  },
  "maxTenants": 500
}
```

Create returns a non-default `DRAFT`; it does not claim connectivity. Core
binds the key and authenticated actor to a keyed HMAC of the canonical intent,
preallocates the returned `id`, and persists only the safe completed projection.
The create body and write-only credentials are never stored in the registration
command. An exact retry after an unknown response returns the original result
or recovers that same DRAFT identity even after Gateway replay state is lost.

## Admin Portal setup intent

The create screen presents one operator setup action without pretending the two
backend effects are atomic:

1. `POST /storage-servers` durably creates the DRAFT with the create intent's
   UUIDv7 key.
2. When the actor also has `admin.storage_servers.update` plus
   `admin.storage_servers.critical`, the screen immediately calls
   `POST /storage-servers/:id/activate` with a separate UUIDv7 key. Activation
   performs the authoritative bounded connection check.

The create screen does not run a pre-probe. `probe` requires an existing server
and remains an independent diagnostic that never changes lifecycle state. An
actor with create+critical but without update+critical stops after the durable
DRAFT and is redirected according to read permission.

If activation receives a definitive client rejection, the activation key is
retired and the already-created server remains a reviewable DRAFT; the portal
never reports full setup success. Activation is also domain-idempotent: an
exact retry after a lost response returns the current `ACTIVE` projection, and
if another activation completes against the same `configRevision` while the
connection check is running, Core returns that `ACTIVE` result instead of a
state-change conflict. A changed configuration still fails its revision fence.

If activation is in flight or returns a network/`5xx`/otherwise ambiguous
outcome, the screen retains the exact created server ID and activation key. The
retry button repeats only activation and cannot recreate the Storage Server or
resubmit its credentials. The domain-idempotent success rule therefore
prevents a lost successful response from being presented as a DRAFT failure.

## Safe projection and list contract

```ts
interface StorageServerView {
  id: string;
  code: string;
  name: string;
  endpoint: string;
  region: string;
  bucketName: string;
  status: StorageServerStatus;
  maxTenants: number | null;
  isPlatformDefault: boolean;
  assignedTenants: number;
  credentialsConfigured: boolean;
  configRevision: number;
  lastConnectionTestStatus: StorageConnectionTestStatus;
  lastConnectionTestedAt: string | null;
  lastConnectionTestErrorCode: string | null;
  connectionEvidenceFresh: boolean;
  connectionEvidenceExpiresAt: string | null;
  nextAutomaticProbeDueAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface StorageServerList {
  items: StorageServerView[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
```

List query:

```ts
interface StorageServerListQuery {
  page?: number; // default 1
  limit?: number; // default 20, max 100
  search?: string; // trimmed; name/code/endpoint
  status?: StorageServerStatus;
  sortBy?: "name" | "createdAt" | "updatedAt" | "lastConnectionTestedAt";
  sortDir?: "ASC" | "DESC";
}
```

Search, filtering, sorting, totals, and pagination are server-authoritative.
Summary values derived from `items` must be labelled “on this page”; do not
present page counts as global metrics.

## Connection evidence and lifecycle

Activation and a safe probe are different commands:

- `activate` transitions only `DRAFT` or `OFFLINE`, performs the bounded
  connection test, and writes `ACTIVE` only if the same configuration revision
  still exists; an already-`ACTIVE` exact retry and a concurrent same-revision
  completion both return the current `ACTIVE` projection;
- `probe` can test the current server without changing lifecycle state;
- `probe` is diagnostic and is not required before create or activate;
- a failed manual or scheduled probe records only a safe code and timestamp;
  an existing `ACTIVE` server stays `ACTIVE` and assigned runtime is not
  interrupted;
- new tenant placement and selecting a new platform default require `ACTIVE`
  plus successful evidence no older than 24 hours;
- Worker scans hourly and schedules an `ACTIVE` server once its last test is
  absent or 12 hours old. Worker publishes only command/server/revision/time;
  Core alone resolves credentials and performs network I/O.

`DRAINING` is a real lifecycle projection while existing tenant storage is
evacuated: it remains list/filter-visible and usable for existing routes, but
is excluded from new placement.

`DRAINING` is a stage, not a terminal state, and `OFFLINE` is its only exit:
`drain` accepts `ACTIVE` alone, and both `activate` and delete accept
`DRAFT`/`OFFLINE` alone. `offline` restricts no source status — it refuses the
platform default, and refuses a server that still holds tenants, reserved or
committed bytes, or an open storage operation, with
`STORAGE_SERVER_OFFLINE_BLOCKED`. The detail screen therefore offers Take
offline for `ACTIVE` and `DRAINING` alike and leaves the emptiness decision to
Core; a screen that offered it for `ACTIVE` only would strand every drained
server, since nothing else could move it and only a `DRAFT`/`OFFLINE` server
can be deleted.

Probe request and secret-free result:

```http
POST /api/admin/core/v1/storage-servers/019f0000-0000-7000-8000-000000000010/probe
Cookie: __Host-mutakamel-admin-access=<redacted>; __Host-mutakamel-admin-session=<redacted>; __Host-mutakamel-admin-csrf=<csrf-proof>
X-CSRF-Token: <csrf-proof>
x-idempotency-key: 019f0000-0000-7000-8000-000000000021
Content-Type: application/json

{ "expectedConfigRevision": 4 }
```

```ts
interface StorageServerProbeResult {
  contractVersion: 1;
  commandId: string;
  storageServerId: string;
  configRevision: number;
  lifecycleStatus: StorageServerStatus;
  outcome: "PASSED" | "FAILED" | "SKIPPED";
  testedAt: string | null;
  errorCode: string | null;
}
```

Exact completed retries return the same durable result. `SKIPPED` means the
expected revision or scheduled lifecycle fence no longer matched; it is not a
successful connection test.

Changing endpoint, region, bucket, or credentials increments
`configRevision`, clears evidence, and returns the server to `DRAFT`. An
assigned server must be `OFFLINE` before those connection fields change. Name
and capacity may still be edited subject to Core's locked invariants.

The current platform default cannot be reconfigured, taken offline, or deleted.
A replacement default must be `ACTIVE` with fresh successful evidence. Delete
is allowed only for a non-default, unassigned `DRAFT` or `OFFLINE` server.

## Tenant-create placement projection

`GET /api/admin/core/v1/tenants/storage-placement-options` is a separate,
bounded placement contract. Each option contains only:

```ts
interface TenantStoragePlacementOption {
  id: string;
  code: string;
  name: string;
  region: string;
  status: "ACTIVE";
  maxTenants: number | null;
  assignedTenants: number;
}
```

It deliberately omits endpoint, bucket, and credentials. The create wizard
uses abortable, generation-fenced reads so a late response cannot overwrite a
newer permission/session/request state.

## Error handling

Important safe codes include:

- `STORAGE_SERVER_ENDPOINT_INVALID`
- `STORAGE_SERVER_BUCKET_INVALID`
- `STORAGE_SERVER_IDENTITY_CONFLICT`
- `STORAGE_SERVER_TENANT_LIMIT_CONFLICT`
- `STORAGE_SERVER_CONNECTION_TEST_FAILED`
- `STORAGE_SERVER_CREDENTIAL_CONFIGURATION_INVALID`
- `STORAGE_SERVER_STATE_CHANGED`
- `STORAGE_SERVER_LIFECYCLE_CONFLICT`
- `STORAGE_SERVER_PLATFORM_DEFAULT_CONFLICT`
- `STORAGE_SERVER_MAINTENANCE_REQUIRED`
- `STORAGE_SERVER_DELETE_BLOCKED`
- `STORAGE_SERVER_PROBE_IN_PROGRESS`
- `STORAGE_SERVER_PROBE_COMMAND_REUSED`
- `STORAGE_SERVER_PROBE_LEASE_LOST`
- `STORAGE_SERVER_REGISTRATION_IN_PROGRESS`
- `STORAGE_SERVER_REGISTRATION_COMMAND_REUSED`
- `STORAGE_SERVER_REGISTRATION_LEASE_LOST`
- `STORAGE_SERVER_REGISTRATION_COMMAND_UNAVAILABLE`
- `STORAGE_SERVER_REGISTRATION_RESULT_UNSAFE`

UI rules:

- `400/422`: keep the form open and show safe field/message evidence;
- `401`: use coordinated refresh and retain the command identity;
- `403`: render a forbidden state, not an empty list;
- revision/lifecycle `409`: refetch before creating a changed intent;
- in-flight registration/probe/idempotency `409`: retain the exact key;
- network/5xx: retain the exact key and correlation ID because acceptance is
  unknown;
- never translate an `ACTIVE` badge into “healthy” when evidence is failed or
  stale. Lifecycle and connection evidence are separate UI concepts.

## Current frontend implementation

The create screen owns registration directly and does not mount the registry
list query. With the complete create and activation permission pairs it offers
one setup submit, then preserves the durable partial-success boundary described
above. Create-only actors retain the DRAFT workflow. The two commands never
share an idempotency key, and ambiguous activation retries never replay create.
Core's domain-idempotent activation returns `ACTIVE` for exact replay or a
same-revision concurrent completion, so the UI can reconcile a lost success
without recreating the server, resending credentials, or misreporting DRAFT.

The active detail hook clears the prior server, probe result, credential
editor, and confirmation state as soon as the route `id` changes. Reads are
abortable and generation/identity fenced; every write verifies that its loaded
server identity still matches the route before and after the request. A late
Storage Server A response therefore cannot render or submit against server B.

The configuration/credential editor is keyboard-modal: it owns and traps
focus, closes on Escape or idle backdrop interaction, locks body scrolling,
and restores the opener. Credential values remain component-memory-only and
are cleared when the editor unmounts or route identity changes.

These are source-level request-ownership and accessibility guarantees. They do
not establish authenticated Garage, deployment, or production-readiness proof.

## Frontend source map

- `src/features/admin/storage-servers/types.ts`
- `src/features/admin/storage-servers/api/storage-servers.api.ts`
- `src/features/admin/storage-servers/hooks/useStorageServers.ts`
- `src/features/admin/storage-servers/hooks/useStorageServerDetail.ts`
- `src/features/admin/storage-servers/lib/storage-server-contract.ts`
- `src/features/admin/storage-servers/screens/`
- `src/app/storage-servers/`

Focused source tests cover URL validation, idempotency retention, API query and
header serialization, probe secrecy, route-identity response ordering, modal
focus ownership, and tenant placement projection parsing.
These are source-integration checks, not authenticated browser, live Garage,
deployment, or production-readiness evidence.
