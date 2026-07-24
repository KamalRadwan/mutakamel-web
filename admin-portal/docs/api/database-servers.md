# Database Servers Frontend Contract

Verified against the current API Gateway route contracts, Core controller,
DTOs, service projections, repositories, entities, and active Admin Portal
screens on **2026-07-24**.

## Ownership and route prefix

| Concern | Contract |
|:---|:---|
| Backend owner | `core-app` |
| Browser prefix | `/api/admin/core/v1/database-servers` |
| Core upstream prefix | `/api/v1/admin/database-servers` |
| Guard | `AdminGuard` |
| Resource IDs | UUIDv7 |
| API response envelope | Canonical Core success envelope; paginated lists also include `meta` |
| Frontend routes | `/database-servers`, `/database-servers/new`, `/database-servers/[id]` |
| Current frontend status | Mock data and simulated mutations; no database-server API call is implemented yet |

The unversioned `/admin/database-servers` form is the Nest controller-relative
path. Browser code must use the canonical API Gateway prefix above.

## Endpoint summary

| Method and browser path | Permission | Success | Purpose |
|:---|:---|:---:|:---|
| `POST /api/admin/core/v1/database-servers` | `admin.database_servers.create` | `201` | Register and preflight a server |
| `POST /api/admin/core/v1/database-servers/check-connectivity` | `admin.database_servers.create` | `200` | Test one primary PostgreSQL connection |
| `GET /api/admin/core/v1/database-servers` | `admin.database_servers.read` | `200` | Paginated list |
| `GET /api/admin/core/v1/database-servers/:id` | `admin.database_servers.read` | `200` | Safe detail view |
| `GET /api/admin/core/v1/database-servers/:id/history` | `admin.database_servers.read` | `200` | Audit history |
| `PATCH /api/admin/core/v1/database-servers/:id` | `admin.database_servers.update` | `200` | Update mutable configuration |
| `POST /api/admin/core/v1/database-servers/:id/drain` | `admin.database_servers.update` | `201` | Stop new placements, keep hosted tenants |
| `POST /api/admin/core/v1/database-servers/:id/activate` | `admin.database_servers.update` | `201` | Make eligible for placement when credentials are ready |
| `POST /api/admin/core/v1/database-servers/:id/offline` | `admin.database_servers.update` | `201` | Mark unavailable |
| `DELETE /api/admin/core/v1/database-servers/:id` | `admin.database_servers.delete` | `204` | Soft-delete an empty drained/offline server |

All protected requests use the shared Admin Portal client with the access-token
Bearer header, included credentials, and coordinated refresh behavior.

Every database-server mutation in the table—including connectivity checks and
lifecycle commands—has a `WRITE_SENSITIVE`, `idempotent: true` Gateway
contract. Send `x-idempotency-key: <UUIDv7>` on every `POST`, `PATCH`, and
`DELETE`. Generate one key per user intent and reuse it only for an exact retry.
The `GET` routes do not use this header.

## HTTP envelopes

Core applies its global response interceptor before the API Gateway streams the
response to the browser:

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

interface ErrorResponse {
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

For object-returning endpoints, read the object from `response.data`. For the
list endpoint, `response.data` is `DatabaseServerView[]` and pagination is in
`response.meta`. History is a non-paginated array under `response.data`.
HTTP `204` responses have no body.

Core DTO/domain failures use `errorCode`. Gateway-originated rejections use
Problem Details `code`. Normalize both shapes and retain `correlationId`.

## Transport enums

```ts
type DatabaseServerStatus = "ACTIVE" | "DRAINING" | "OFFLINE";

type DatabaseServerSslMode =
  | "disable"
  | "require"
  | "verify-ca"
  | "verify-full";

type DatabaseServerHistoryAction =
  | "CREATE"
  | "UPDATE"
  | "ACTIVATE"
  | "DRAIN"
  | "OFFLINE"
  | "DELETE";
```

Important:

- `DELETED` is not a `DatabaseServerStatusEnum` value. Delete is a soft-delete,
  and normal list/detail queries do not return deleted servers.
- Audit history does not use a generic `LIFECYCLE` action. Each transition has
  its own action.
- SSL values are lowercase and case-sensitive after transport normalization.

## Safe response model

The `data` property from create, detail, update, and lifecycle responses is
this projection:

```ts
interface DatabaseServerView {
  id: string;
  name: string;
  host: string;
  port: number;

  sslMode: DatabaseServerSslMode;
  sslRejectUnauthorized: boolean;
  hasSslConfig: boolean;
  maintenanceDatabase: string;

  poolMin: number;
  poolMax: number;
  connectTimeoutMs: number;
  statementTimeoutMs: number;
  idleTimeoutMs: number;

  hasBackupCredentials: boolean;
  backupCredentialsUsesPrimary: boolean;
  hasProvisioningCredentials: boolean;
  runtimeCredentialsConfigured: {
    coreApp: boolean;
    crmApp: boolean;
    tradeApp: boolean;
    workerApp: boolean;
  };
  runtimePrincipalsReady: boolean;

  maxTenants: number;
  currentTenants: number;
  status: DatabaseServerStatus;

  countryName?: string;
  countryIsoCode?: string;
  region?: string; // compatibility alias equal to countryIsoCode

  createdAt: string; // serialized ISO timestamp
  updatedAt: string; // serialized ISO timestamp
}
```

The response deliberately does **not** contain:

- `driver` — the resource is PostgreSQL-only;
- primary, runtime, provisioning, or backup usernames/passwords;
- encrypted credential references;
- CA, certificate, private key, or SSL passphrase;
- `utilization`;
- `isPlacementTarget`;
- audit actor columns such as `createdBy` and `updatedBy`.

Never fabricate secret values from configuration flags. Secret inputs on an
edit screen must start blank and mean “replace only if the operator enters a
new value.”

### Derived UI fields

```ts
function toDatabaseServerRow(server: DatabaseServerView) {
  const utilizationRatio =
    server.maxTenants > 0
      ? server.currentTenants / server.maxTenants
      : 0;

  const isPlacementTarget =
    server.status === "ACTIVE" &&
    server.currentTenants < server.maxTenants &&
    server.runtimePrincipalsReady &&
    server.hasProvisioningCredentials;

  return {
    ...server,
    driver: "postgres" as const,
    utilizationRatio,
    isPlacementTarget,
  };
}
```

Format `utilizationRatio` as a percentage only in the view. Platform
utilization must be weighted:

```ts
const platformUtilization =
  sumMaxTenants > 0 ? sumCurrentTenants / sumMaxTenants : 0;
```

Do not average per-server percentages; that produces the wrong result when
servers have different capacities.

`runtimePrincipalsReady` means all four runtime credentials exist.
Provisioning eligibility additionally requires `hasProvisioningCredentials`.
An `ACTIVE` server can therefore still be ineligible for new placement.

`backupCredentialsUsesPrimary` is the display authority for backup fallback.
When a dedicated backup reference is absent, jobs fall back to primary
credentials and this flag is still `true`.

## Shared nested input types

```ts
interface DatabaseServerCredentialsDto {
  username: string; // trim, length 1..128
  password: string; // length 1..1024; not trimmed
}

interface DatabaseServerRuntimeCredentialsDto {
  coreApp: DatabaseServerCredentialsDto;
  crmApp: DatabaseServerCredentialsDto;
  tradeApp: DatabaseServerCredentialsDto;
  workerApp: DatabaseServerCredentialsDto;
}

interface DatabaseServerSslConfigDto {
  ca?: string; // max 20,000
  cert?: string; // max 20,000
  key?: string; // max 20,000
  passphrase?: string; // max 1,024
}
```

If `runtimeCredentials` is sent, all four nested app credential objects are
required. Updating it replaces the four runtime logins atomically; there is no
single-runtime-principal patch DTO.

Do not send an empty nested credential object. Omit the entire optional object
when it should remain unchanged.

## Register a server

### `POST /api/admin/core/v1/database-servers`

```ts
interface CreateDatabaseServerDto {
  name: string;
  driver?: "postgres";
  host: string;
  port?: number;

  credentials?: DatabaseServerCredentialsDto;
  runtimeCredentials?: DatabaseServerRuntimeCredentialsDto;
  backupCredentials?: DatabaseServerCredentialsDto;
  provisioningCredentials?: DatabaseServerCredentialsDto;

  sslMode?: DatabaseServerSslMode;
  sslRejectUnauthorized?: boolean;
  sslConfig?: DatabaseServerSslConfigDto;
  maintenanceDatabase?: string;

  poolMin?: number;
  poolMax?: number;
  connectTimeoutMs?: number;
  statementTimeoutMs?: number;
  idleTimeoutMs?: number;

  maxTenants: number;
  countryName?: string;
  countryIsoCode?: string;
}
```

Validation and normalization:

| Field | Rule |
|:---|:---|
| `name` | Required, trimmed, length `1..120`; unique even against soft-deleted rows |
| `driver` | Optional compatibility field; trimmed/lowercased and must equal `postgres` |
| `host` | Required, trimmed, non-empty, max `255` |
| `port` | Optional integer `1..65535`; default `5432` |
| `credentials` | DTO-optional for compatibility, but service-required; omission returns `DB_SERVER_CREDENTIALS_REQUIRED` |
| `runtimeCredentials` | Optional; if present, all Core/CRM/Trade/Worker credentials are required and connectivity-checked |
| `backupCredentials` | Optional; when omitted, the stored backup credential reference initially uses primary credentials |
| `provisioningCredentials` | Optional dedicated elevated role; connectivity and security posture are checked |
| `sslMode` | Optional; default `disable` |
| `sslRejectUnauthorized` | Strict boolean; default `true` |
| `maintenanceDatabase` | Trimmed, length `1..120`; default `postgres` |
| `poolMin` | Integer `0..100`; default `0` |
| `poolMax` | Integer `1..500`; default `10`; must be `>= poolMin` |
| `connectTimeoutMs` | Integer `1000..60000`; default `10000` |
| `statementTimeoutMs` | Integer `1000..300000`; default `30000` |
| `idleTimeoutMs` | Integer `1000..300000`; default `30000` |
| `maxTenants` | Required integer `1..100000` |
| `countryName` | Optional, trimmed, max `120` |
| `countryIsoCode` | Optional, trimmed/uppercased, exactly two ASCII letters |

Strict booleans accept `true`, `false`, `"true"`, `"false"`, `"1"`, and
`"0"`.

Example:

```json
{
  "name": "DB-PRIMARY-EG-01",
  "driver": "postgres",
  "host": "db-primary-eg-01.internal",
  "port": 5432,
  "credentials": {
    "username": "control_plane_connection",
    "password": "<operator-entered-secret>"
  },
  "runtimeCredentials": {
    "coreApp": {
      "username": "mutakamel_core_runtime",
      "password": "<operator-entered-secret>"
    },
    "crmApp": {
      "username": "mutakamel_crm_runtime",
      "password": "<operator-entered-secret>"
    },
    "tradeApp": {
      "username": "mutakamel_trade_runtime",
      "password": "<operator-entered-secret>"
    },
    "workerApp": {
      "username": "mutakamel_worker_runtime",
      "password": "<operator-entered-secret>"
    }
  },
  "provisioningCredentials": {
    "username": "mutakamel_provisioner",
    "password": "<operator-entered-secret>"
  },
  "sslMode": "require",
  "sslRejectUnauthorized": true,
  "maintenanceDatabase": "postgres",
  "poolMin": 0,
  "poolMax": 10,
  "connectTimeoutMs": 10000,
  "statementTimeoutMs": 30000,
  "idleTimeoutMs": 30000,
  "maxTenants": 50,
  "countryName": "Egypt",
  "countryIsoCode": "EG"
}
```

Creation behavior:

1. Checks name uniqueness.
2. Encrypts secret inputs for persistence.
3. Validates SSL and pool cross-field rules.
4. Tests the primary connection.
5. Tests a distinct backup connection when supplied.
6. Tests provisioning connectivity and its PostgreSQL role posture when
   supplied.
7. Tests every supplied runtime principal and verifies the expected database
   username.
8. Saves with `status: "ACTIVE"` and `currentTenants: 0`.
9. Records a redacted `CREATE` history row.

The standalone connectivity button tests only the primary connection. A green
result does not prove runtime principals or provisioning posture are valid;
the create request remains the authoritative full preflight.

### Provisioning credential posture

The dedicated provisioning login must be:

- `LOGIN`;
- `NOINHERIT`;
- `NOSUPERUSER`;
- `CREATEDB`;
- `NOCREATEROLE`;
- `NOREPLICATION`;
- `NOBYPASSRLS`;
- without role memberships;
- different from every reserved runtime principal name.

Show the backend failure message next to the provisioning credential section.

## Check connectivity

### `POST /api/admin/core/v1/database-servers/check-connectivity`

```ts
interface CheckDatabaseServerConnectivityDto {
  driver?: "postgres";
  host: string;
  port?: number;

  credentials?: DatabaseServerCredentialsDto;
  username?: string;
  password?: string;

  sslMode?: DatabaseServerSslMode;
  sslRejectUnauthorized?: boolean;
  sslConfig?: DatabaseServerSslConfigDto;
  maintenanceDatabase?: string;

  connectTimeoutMs?: number;
  statementTimeoutMs?: number;
  idleTimeoutMs?: number;
}

interface DatabaseServerConnectivityResult {
  connected: boolean;
  message: string;
}
```

Use nested `credentials`. The top-level `username`/`password` pair is a compact
compatibility form. Nested credentials take precedence if both forms are sent.

For a DTO-valid request, connection failure still returns HTTP `200`:

```json
{
  "success": true,
  "data": {
    "connected": false,
    "message": "Database connection failed."
  },
  "correlationId": "request-correlation-id",
  "timestamp": "2026-07-24T12:00:00.000Z"
}
```

The service normalizes whitespace and caps the message at 320 characters.
Malformed DTOs still return HTTP `400`.

Do not persist connectivity passwords, include them in telemetry, or retain
them after the create/edit form closes.

## List servers

### `GET /api/admin/core/v1/database-servers`

```ts
interface DatabaseServerQueryDto {
  page?: number; // integer >= 1; default 1
  limit?: number; // integer 1..100; default 20
  sortBy?: "name" | "host" | "currentTenants" | "createdAt";
  sortDir?: "ASC" | "DESC"; // default ASC
  search?: string; // max 200
  status?: DatabaseServerStatus;
  countryIsoCode?: string; // trimmed, uppercased, max length 2
  region?: string; // legacy alias; uppercased and truncated to 2
}

type DatabaseServerListResponse = SuccessResponse<DatabaseServerView[]> & {
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
};
```

Search covers `name`, `host`, `countryName`, and `countryIsoCode`.

If `sortBy` is absent, the service uses `createdAt`; the inherited default
direction is `ASC`. Unsupported sort fields return HTTP `400` with code
`INVALID_FIELD` and an allowed-field list.

Use `countryIsoCode` in new UI code. Do not send both it and `region`; both
become filters and conflicting values produce an empty result.

Pagination and filters are server-side. Debounce search, reset `page` to `1`
when filters change, and use `response.meta.total` and
`response.meta.totalPages`, not the displayed array length.

## Get one server

### `GET /api/admin/core/v1/database-servers/:id`

Returns `SuccessResponse<DatabaseServerView>`. Missing or soft-deleted IDs
return an error envelope such as:

```json
{
  "success": false,
  "statusCode": 404,
  "errorCode": "DB_SERVER_NOT_FOUND",
  "errorCategory": "NOT_FOUND",
  "message": "Database server not found.",
  "correlationId": "request-correlation-id",
  "timestamp": "2026-07-24T12:00:00.000Z",
  "path": "/api/v1/admin/database-servers/019f0000-0000-7000-8000-000000000001"
}
```

The `id` path parameter must be UUIDv7; an invalid ID is rejected before the
service lookup.

## Audit history

### `GET /api/admin/core/v1/database-servers/:id/history`

```ts
interface DatabaseServerHistoryQueryDto {
  action?: DatabaseServerHistoryAction;
  limit?: number; // integer 1..100; default 25
}

type DatabaseServerHistoryValue = string | number | boolean | null;

interface DatabaseServerHistoryChange {
  field: string;
  label: string;
  previousValue: DatabaseServerHistoryValue;
  newValue: DatabaseServerHistoryValue;
}

interface DatabaseServerHistoryView {
  id: string;
  databaseServerId: string;
  action: DatabaseServerHistoryAction;
  serverName: string;
  changes: DatabaseServerHistoryChange[];
  actorId: string | null;
  createdAt: string;
  updatedAt: string;
}
```

The HTTP response is `SuccessResponse<DatabaseServerHistoryView[]>`.
`response.data` is ordered newest first. There is no pagination `meta`; the
query is limit-based.

History rows redact credential and certificate material. They contain labels
such as “Credentials Source,” “Configured,” or pool/timeout summaries rather
than secrets.

The endpoint returns only `actorId`; it does not return actor name or email.
Do not model a `user` object unless the frontend performs a separate authorized
lookup.

The server must still exist in the normal repository lookup. After a successful
soft-delete, this endpoint returns `DB_SERVER_NOT_FOUND`.

## Update a server

### `PATCH /api/admin/core/v1/database-servers/:id`

```ts
interface UpdateDatabaseServerDto {
  name?: string;
  host?: string;
  port?: number;

  credentials?: DatabaseServerCredentialsDto;
  runtimeCredentials?: DatabaseServerRuntimeCredentialsDto;
  backupCredentials?: DatabaseServerCredentialsDto;
  removeBackupCredentials?: boolean;

  sslMode?: DatabaseServerSslMode;
  sslRejectUnauthorized?: boolean;
  sslConfig?: DatabaseServerSslConfigDto;
  removeSslConfig?: boolean;
  maintenanceDatabase?: string;

  poolMin?: number;
  poolMax?: number;
  connectTimeoutMs?: number;
  statementTimeoutMs?: number;
  idleTimeoutMs?: number;

  provisioningCredentials?: DatabaseServerCredentialsDto;
  removeProvisioningCredentials?: boolean;

  maxTenants?: number;
  countryName?: string;
  countryIsoCode?: string;
}
```

Validation limits are the same as create except that the current update DTO
checks `host` only as a string of at most 255 characters. The UI must still
require a non-empty trimmed host; an empty host otherwise reaches connection
preflight and fails there instead of as a field-level DTO error.

Additional update rules:

- `maxTenants` cannot be lower than `currentTenants`.
- Status is read-only here; use lifecycle endpoints.
- `currentTenants`, `driver`, `region`, response flags, and derived utilization
  are not writable DTO fields.
- Send only dirty fields.
- Connection-affecting changes are tested before the locked write.
- If the connection basis changes concurrently between preflight and save, the
  server returns `DB_SERVER_CONNECTION_CHANGED_RETRY`; reload and rebuild the
  patch.
- Successful connection changes invalidate cached server pools.
- Rotating primary credentials also rotates backup credentials when backup was
  using primary, unless this request explicitly supplies or removes backup
  credentials.

Do not send a replacement object and its remove flag together. Use exactly one
intent:

```ts
backupCredentials       XOR removeBackupCredentials
sslConfig               XOR removeSslConfig
provisioningCredentials XOR removeProvisioningCredentials
```

The DTO does not enforce XOR, but an explicit payload builder prevents
ambiguous forms.

Example metadata/capacity update:

```json
{
  "name": "DB-PRIMARY-EG-01",
  "maxTenants": 75,
  "countryName": "Egypt",
  "countryIsoCode": "EG",
  "poolMax": 20
}
```

Example secret rotation:

```json
{
  "credentials": {
    "username": "control_plane_connection",
    "password": "<new-operator-entered-secret>"
  }
}
```

The edit form must never send masked placeholders such as `"••••••••"`.

## Lifecycle commands

These endpoints do not require a request body and return
`SuccessResponse<DatabaseServerView>`.

### Drain

`POST /api/admin/core/v1/database-servers/:id/drain`

- Sets `status` to `DRAINING`.
- Excludes the server from new tenant placement.
- Existing tenants remain hosted.
- Invalidates cached server pools.

### Activate

`POST /api/admin/core/v1/database-servers/:id/activate`

- Sets `status` to `ACTIVE`.
- Requires all four runtime credential references and dedicated provisioning
  credentials.
- Missing readiness returns HTTP `422` with
  `DB_SERVER_RUNTIME_CREDENTIALS_REQUIRED`.
- This command checks configuration presence; use connectivity testing before
  activation after infrastructure maintenance.

### Offline

`POST /api/admin/core/v1/database-servers/:id/offline`

- Sets `status` to `OFFLINE`.
- Excludes the server from placement and marks it operationally unavailable.
- Existing tenant records remain associated with it.

The state-setting commands are service-level idempotent: requesting the current
state again leaves the state unchanged.

## Delete

### `DELETE /api/admin/core/v1/database-servers/:id`

Returns HTTP `204` with no response body.

Deletion is allowed only when:

```ts
(status === "DRAINING" || status === "OFFLINE") &&
currentTenants === 0
```

Use a destructive confirmation that names the server. Disable the action from
the current view when the preconditions are false, but still handle backend
conflicts because tenant placement/count state can change concurrently.

Deletion is soft-delete. Do not add a `DELETED` row or status badge to the
normal list after success; remove the row or refetch the page.

## Companion API for the “Hosted tenants” tab

There is no nested database-server tenants endpoint. Use:

```text
GET /api/admin/core/v1/tenants?databaseServerId=<database-server-uuid-v7>
```

Permission: `admin.tenants.read`.

The response is the canonical paginated envelope: the tenant rows are in
`data`, and counts/navigation flags are in `meta`. The query parameter is
UUIDv7-validated. Use the tenant response’s safe `databaseServer` summary if it
needs to be displayed.

The tab needs an independent permission state: an admin may have
`admin.database_servers.read` without `admin.tenants.read`.

## Error catalogue

### Gateway errors

| Status | Problem Details `code` | UI behavior |
|:---:|:---|:---|
| `400` | `GW.IDEM.MISSING` | Generate and attach a UUIDv7 key |
| `400` | `GW.IDEM.BAD_VALUE` | Fix the key generator; do not retry unchanged |
| `409` | `GW.IDEM.IN_FLIGHT` | Show processing state, then refetch |
| `422` | `GW.IDEM.MISMATCH` | Never reuse a key after request intent changes |

### Core database-server errors

| Status | `errorCode` | Typical trigger | UI behavior |
|:---:|:---|:---|:---|
| `400` | Validation error code; inspect `details` | Invalid DTO, enum, UUID, bounds, or unknown field | Map field errors; do not retry unchanged input |
| `400` | `INVALID_FIELD` | Unsupported list `sortBy` | Reset to a documented sort |
| `401` | Auth failure | Missing/expired session | Let the shared client refresh once |
| `403` | Permission denied | Missing endpoint permission | Hide action and show forbidden state on direct access |
| `404` | `DB_SERVER_NOT_FOUND` | Missing or soft-deleted server | Return to list or show not-found |
| `409` | `DB_SERVER_NAME_TAKEN` | Duplicate create/update name, including a concurrent race | Mark `name` conflict |
| `409` | `DB_SERVER_NOT_DRAINED` | Delete while active | Require drain/offline first |
| `409` | `DB_SERVER_HAS_TENANTS` | Delete with `currentTenants > 0` | Keep dialog open and refresh detail |
| `409` | `DB_SERVER_CONNECTION_CHANGED_RETRY` | Concurrent connection edit during preflight | Reload, re-enter secrets if needed, retry |
| `422` | `DB_SERVER_MAX_BELOW_CURRENT` | Capacity below hosted count | Set minimum to current count |
| `422` | `DB_SERVER_RUNTIME_CREDENTIALS_REQUIRED` | Activate without provisioning and all runtime credentials | Link to credential sections |
| `422` | `DB_SERVER_CONNECTIVITY_FAILED` | Create/update connection preflight failed | Show returned message beside relevant connection section |
| `422` | `DB_SERVER_CREDENTIALS_REQUIRED` | Create without primary credentials | Focus primary credentials |
| `422` | `DB_SERVER_CREDENTIALS_ENCRYPTION_KEY_MISSING` | Backend secret-encryption configuration missing | Non-field operational error; contact platform operator |
| `422` | `DB_SERVER_SSL_CONFIG_INVALID` | SSL cross-field rule failed | Mark SSL section |
| `422` | `DB_SERVER_POOL_CONFIG_INVALID` | `poolMax < poolMin` | Mark both pool fields |

Stable validation messages also include:

```text
DB_SERVER_NAME_INVALID
DB_SERVER_DRIVER_INVALID
DB_SERVER_SSL_MODE_INVALID
DB_SERVER_COUNTRY_ISO_INVALID
```

## SSL cross-field rules

- `disable` rejects non-empty certificate configuration.
- `verify-ca` and `verify-full` require a CA certificate, either already stored
  or supplied in the request.
- `cert` requires `key`.
- `key` requires `cert`.
- `passphrase` is valid only when `key` is present.
- Changing `sslMode` to `disable` clears the stored SSL config.
- An empty replacement SSL config is normalized to no config.

Expose a passphrase field when the UI supports encrypted client keys; the
current frontend form has CA/cert/key only.

## Permission-gated UI actions

| UI capability | Permission |
|:---|:---|
| View list/detail/history | `admin.database_servers.read` |
| Register and check connectivity | `admin.database_servers.create` |
| Edit, drain, activate, offline | `admin.database_servers.update` |
| Delete | `admin.database_servers.delete` |
| View hosted tenants | `admin.tenants.read` |

Permissions control visibility and affordances; backend authorization remains
authoritative.

## Current frontend gaps

The active hooks and views under `src/app/database-servers/` are prototypes:

1. No hook calls any database-server endpoint.
2. List filtering and pagination are client-side over three mock rows.
3. `DatabaseServerRow.status` incorrectly includes `DELETED`.
4. The row expects `driver`, `utilization`, `region`, and
   `isPlacementTarget`, which must be constant/derived rather than read from
   the response.
5. Summary utilization averages row percentages rather than weighting total
   tenants by total capacity.
6. The list has activate/drain/delete actions but no offline action.
7. The create drawer does not submit its form data; its “save” button only
   closes the drawer.
8. `/database-servers/new` simulates connectivity and submission.
9. Detail state pre-fills usernames, masked passwords, and certificate content
   that the API never returns. These must become blank replacement controls.
10. Detail history uses `LIFECYCLE`, `user`, `timestamp`, and `oldValue`; the
    API uses specific actions, `actorId`, `createdAt`, and `previousValue`.
11. Hosted tenants are hard-coded and use invalid placeholder IDs.
12. Loading, empty, validation, forbidden, conflict, stale-data, and retry
    states are not implemented.
13. Duplicate code under `src/app/admin/database-servers/` has no page route.
    Keep the active implementation under `src/app/database-servers/`.

Choose one create experience (`/database-servers/new` or the drawer) and share
one form schema/payload builder so the two prototypes do not drift further.

## Recommended frontend implementation sequence

1. Add exact TypeScript API models and an adapter for derived row fields.
2. Implement server-side list query/pagination and permission states.
3. Implement safe detail hydration with blank secret replacement inputs.
4. Implement history using the exact action/change model.
5. Implement the hosted-tenants tab through the tenant list filter.
6. Implement connectivity testing without persisting secrets.
7. Implement create and update payload builders with cross-field validation.
8. Implement lifecycle actions and backend-code-specific conflict handling.
9. Implement guarded deletion and refetch/remove behavior.
10. Remove mock datasets and duplicate inactive components only after all
    routes have production loading/error states.

## Backend source map

Paths are relative to `C:\mutakamel.ai\frontend`:

- `../backend/mutakamel-apps/api-gateway-app/src/routing-proxy/route-contracts/core.route-contracts.ts`
- `../backend/mutakamel-apps/core-app/src/admin/database-servers/database-servers.controller.ts`
- `../backend/mutakamel-apps/core-app/src/admin/database-servers/database-servers.service.ts`
- `../backend/mutakamel-apps/core-app/src/admin/database-servers/dto/`
- `../backend/mutakamel-apps/core-app/src/admin/database-servers/repo/`
- `../backend/mutakamel-apps/core-app/packages/database/src/entities/control-plane/database-server.entity.ts`
- `../backend/mutakamel-apps/core-app/packages/database/src/entities/control-plane/database-server-history.entity.ts`
- `../backend/mutakamel-apps/shared-libs/packages/database/src/dtos/pagination-query.dto.ts`
- `../backend/mutakamel-apps/shared-libs/packages/database/src/interfaces/paginated-result.interface.ts`
- `../backend/mutakamel-apps/shared-libs/packages/common/src/interceptors/response-envelope.interceptor.ts`
- `../backend/mutakamel-apps/shared-libs/packages/common/src/filters/all-exceptions.filter.ts`
