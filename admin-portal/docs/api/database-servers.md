# Database Servers Frontend Contract

Status: **[Verified]**

Last source verification: **2026-08-06**

This is the browser-facing Database Servers V1 contract. API Gateway is the
browser authority; Core owns registration, PostgreSQL role administration,
credential encryption, activation readiness, reconciliation, and audit.
Worker is the only automatic-rotation scheduler.

Registration supports **PostgreSQL major version 16 only**
(`server_version_num >= 160000 && < 170000`). PostgreSQL 15 and 17+ fail the
connectivity/posture check because the current backup/restore client is pinned
to PostgreSQL 16. The Admin Portal states this exact requirement before the
operator submits credentials; it must not describe the contract as “16+”.

## Security model

The administrator submits only the PostgreSQL security-administrator username
and password. Core generates and encrypts all other passwords:

| Purpose | Fixed principal | Authority |
| --- | --- | --- |
| Tenant database creation and migrations | `mutakamel_provisioner` | Core generates with `CREATEDB`; Worker resolves per operation |
| Backup and restore reads | `mutakamel_backup` | Core generates; Worker resolves per operation |
| Application runtime access | Application Catalogue `databasePrincipal` | Core generates one per Application |

The submitted PostgreSQL security administrator must have `LOGIN`, `CREATEDB`,
and `CREATEROLE`. Connectivity/posture validation rejects `SUPERUSER`,
`REPLICATION`, and `BYPASSRLS`. No unexpected membership may provide effective
`INHERIT` or `SET` access; `ADMIN`-only membership edges to roles Core
already generated are expected when the server is checked again. Core creates
`mutakamel_provisioner` with `CREATEDB`, `mutakamel_backup`, and the eligible
Application roles. This model does not grant `pg_read_all_data`.

The submitted username is trimmed and must match
`^(?!pg_)[a-z_][a-z0-9_]{0,62}$`: 1–63 lowercase letters, digits, or
underscores, beginning with a lowercase letter or underscore and never with
the PostgreSQL-reserved `pg_` prefix.

Passwords never appear in an HTTP response, broker command, audit value,
download, browser storage, UI fixture, analytics event, or log. The portal may
show only the fixed principal, purpose, lifecycle state, credential revision,
rotation schedule, and safe failure code.

## Canonical transport and envelopes

Browser prefix:

```text
/api/admin/core/v1/database-servers
```

Use the shared cookie-mode client. Every Gateway `WRITE_SENSITIVE` route below
requires a caller-owned UUIDv7 `x-idempotency-key`. Reuse a key only for an
exact retry of the same intent.

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

Core successes do not contain a second `status` or `code` field outside
`data`. Normalize Core `errorCode` and Gateway `code` while retaining the
`correlationId`.

## Endpoints and permissions

Permission arrays use ALL semantics.

| Method and browser path | Permissions | Success | Body |
| --- | --- | ---: | --- |
| `POST /database-servers` | `admin.database_servers.create` | 201 | `CreateDatabaseServerDto` |
| `POST /database-servers/check-connectivity` | create | 200 | `CheckDatabaseServerConnectivityDto` |
| `POST /database-servers/:id/credential-bootstrap/retry` | create + critical | 200 | `{ reason }` |
| `GET /database-servers/:id/system-principals` | read | 200 | none |
| `PATCH /database-servers/:id/system-principals/:purpose/rotation-policy` | update + critical | 200 | system rotation policy DTO |
| `POST /database-servers/:id/system-principals/:purpose/credential/regenerate` | credentials.rotate + critical | 200 | credential command |
| `POST /database-servers/:id/system-principals/:purpose/credential/reconcile` | credentials.rotate + critical | 200 | credential command |
| `POST /database-servers/:id/applications/:applicationKey/bootstrap` | update + critical | 200 | single-Application bootstrap DTO |
| `POST /database-servers/:id/applications/:applicationKey/credential/regenerate` | credentials.rotate + critical | 200 | credential command |
| `POST /database-servers/:id/applications/:applicationKey/credential/reconcile` | credentials.rotate + critical | 200 | credential command |
| `GET /database-servers/:id/applications` | read | 200 | none |
| `GET /database-servers` | read | 200 | query |
| `GET /database-servers/:id/history` | read | 200 | query |
| `GET /database-servers/:id` | read | 200 | none |
| `PATCH /database-servers/:id` | update + critical | 200 | `UpdateDatabaseServerDto` |
| `POST /database-servers/:id/drain` | update + critical | 201 | none |
| `POST /database-servers/:id/activate` | update + critical | 201 | none |
| `POST /database-servers/:id/offline` | update + critical | 201 | none |
| `DELETE /database-servers/:id` | delete + critical | 204 | none |
| `DELETE /database-servers/:id/destroy` | delete.hard + critical | 204 | none |

The ordinary `DELETE` route is soft delete only. It accepts an empty
`DRAINING` or `OFFLINE` server and removes it from ordinary reads. To review
those records, call `GET /database-servers?deleted=true`; this returns only
soft-deleted rows and includes an authoritative non-null `deletedAt` value.
Destroy is a separate permanent command and is rendered only for those rows.
The browser never sends `hard=true` or overloads the soft-delete route.

Complete permission keys:

- `admin.database_servers.read`
- `admin.database_servers.create`
- `admin.database_servers.update`
- `admin.database_servers.delete`
- `admin.database_servers.delete.hard`
- `admin.database_servers.critical`
- `admin.database_servers.credentials.rotate`

Credential routes are `no-store`. Mutation and reconciliation routes have no
transport retry; the UI retains the exact intent key and refreshes the binding
before deciding whether to retry or reconcile.

## Enums and DTOs

Local development can use `sslMode: "disable"`. In production, Core rejects a
security-administrator connectivity attempt before opening a PostgreSQL socket
unless the request resolves to `verify-full`, certificate verification remains
enabled, and an explicit trusted CA is present.

```ts
type DatabaseServerStatus = "DRAFT" | "ACTIVE" | "DRAINING" | "OFFLINE";
type DatabaseServerSslMode = "disable" | "require" | "verify-ca" | "verify-full";
type BindingStatus =
  | "PENDING" | "PROVISIONING" | "READY" | "ROTATING"
  | "DEFERRED" | "RECONCILING" | "DEGRADED" | "DISABLED";
type CredentialBootstrapStatus =
  | "PENDING" | "PROVISIONING" | "READY" | "RECONCILING" | "DEGRADED";
type SystemPrincipalPurpose = "PROVISIONING" | "BACKUP";

interface DatabaseServerCredentialsDto {
  username: string; // trimmed, /^(?!pg_)[a-z_][a-z0-9_]{0,62}$/
  password: string; // 1..1024; never trim
}

interface DatabaseServerSslConfigDto {
  ca?: string;
  cert?: string;
  key?: string;
  passphrase?: string;
}

interface CreateDatabaseServerDto {
  name: string;
  host: string;
  port?: number;
  securityAdminCredentials: DatabaseServerCredentialsDto;
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

interface CheckDatabaseServerConnectivityDto {
  host: string;
  port?: number;
  securityAdminCredentials: DatabaseServerCredentialsDto;
  sslMode?: DatabaseServerSslMode;
  sslRejectUnauthorized?: boolean;
  sslConfig?: DatabaseServerSslConfigDto;
  maintenanceDatabase?: string;
  connectTimeoutMs?: number;
  statementTimeoutMs?: number;
  idleTimeoutMs?: number;
}

interface UpdateDatabaseServerDto {
  name?: string;
  host?: string;
  port?: number;
  securityAdminCredentials?: DatabaseServerCredentialsDto;
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
  maxTenants?: number;
  countryName?: string;
  countryIsoCode?: string;
}

interface CredentialCommandDto {
  expectedCredentialRevision: string; // positive integer string
  reason: string; // trimmed, 8..500
}

interface UpdateSystemPrincipalRotationDto extends CredentialCommandDto {
  rotationEnabled?: boolean;
  rotationIntervalHours?: number; // 24..8760
  maintenanceWindowStartUtc?: number; // 0..23
  maintenanceWindowHours?: number; // 1..24
}
```

Core rejects unknown fields. `provisioningCredentials`, `backupCredentials`,
their remove flags, and password fallbacks are not valid V1 DTO fields.

Route params:

- `id`: UUIDv7.
- `applicationKey`: canonical lowercase key matching `^[a-z][a-z0-9_]{0,63}$`.
- `purpose`: browser path value `provisioning` or `backup`.

## Safe projections

```ts
interface SystemPrincipalBindingView {
  purpose: "PROVISIONING" | "BACKUP";
  databasePrincipal: "mutakamel_provisioner" | "mutakamel_backup";
  status: BindingStatus;
  credentialRevision: string;
  rotationEnabled: boolean;
  rotationIntervalHours: number;
  maintenanceWindowStartUtc: number;
  maintenanceWindowHours: number;
  rotationDueAt: string | null;
  lastRotationAttemptAt: string | null;
  lastRotationSucceededAt: string | null;
  retryAt: string | null;
  safeFailureCode: string | null;
  operationGeneration: string;
  hasStagedCandidate: boolean;
}

interface DatabaseServerView {
  id: string;
  deletedAt: string | null;
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
  hasSecurityAdminCredentials: boolean;
  hasProvisioningCredentials: boolean;
  hasBackupCredentials: boolean;
  credentialBootstrap: {
    status: CredentialBootstrapStatus;
    totalPrincipals: number;
    readyPrincipals: number;
  };
  systemPrincipals: SystemPrincipalBindingView[];
  maxTenants: number;
  currentTenants: number;
  status: DatabaseServerStatus;
  countryName?: string;
  countryIsoCode?: string;
  createdAt: string;
  updatedAt: string;
}
```

The compatibility booleans are safe readiness projections; they are not secret
references. Core's wire projection contains both fixed system principals. The
Database Servers adapter retains only `PROVISIONING`; `/backup` owns the
`BACKUP` principal detail and commands. Database activation still consumes the
aggregate `credentialBootstrap` and `hasBackupCredentials` dependency evidence
without duplicating Backup lifecycle controls.

## Registration example

Preflight request:

```http
POST /api/admin/core/v1/database-servers/check-connectivity
x-idempotency-key: 019fc7e0-bcef-727f-90cb-ff6028ed3306
Content-Type: application/json

{
  "host": "db-primary.internal",
  "port": 5432,
  "securityAdminCredentials": {
    "username": "database_security_admin",
    "password": "<write-only>"
  },
  "sslMode": "verify-full",
  "sslRejectUnauthorized": true,
  "sslConfig": { "ca": "<trusted-ca-pem>" },
  "maintenanceDatabase": "postgres"
}
```

Success:

```json
{
  "success": true,
  "data": {
    "connected": true,
    "message": "connected",
    "checks": [
      { "principal": "securityAdmin", "connected": true, "message": "connected" }
    ]
  },
  "correlationId": "019fc7e0-bcef-727f-90cb-ff6028ed3306",
  "timestamp": "2026-08-03T18:00:00.000Z"
}
```

Create request uses the same connection fields plus `name`, `maxTenants`, and
optional location/pool values. Core first validates the supplied security-admin
connection and exact PostgreSQL role posture above, then persists the DRAFT with two pending system bindings and all
eligible Application bindings before attempting generated-role bootstrap. The
201 response is always secret-free. If a generated bootstrap operation fails,
the server remains DRAFT and its binding states identify the safe
retry/reconciliation path.

Only `ACTIVE`, database-backed Applications whose policy enables new-server
binding are eligible. If no Application is active yet, registration still
returns the durable DRAFT after completing the two system principals. The
detail screen explains that blocker and links authorized operators to
Application Catalogue. After the Applications are activated, the generic
bootstrap retry idempotently backfills the missing bindings before generating
their credentials; it never weakens the lifecycle eligibility rule.

## System principal commands

Retry all incomplete initial bindings:

```http
POST /api/admin/core/v1/database-servers/:id/credential-bootstrap/retry
x-idempotency-key: <uuidv7>
Content-Type: application/json

{ "reason": "Retry interrupted initial credential assembly" }
```

Manual system rotation:

```http
POST /api/admin/core/v1/database-servers/:id/system-principals/provisioning/credential/regenerate
x-idempotency-key: <uuidv7>
Content-Type: application/json

{
  "expectedCredentialRevision": "4",
  "reason": "Scheduled security rotation"
}
```

Secret-free success data:

```json
{
  "databaseServerId": "019fc7e0-bcef-727f-90cb-ff6028ed3306",
  "purpose": "PROVISIONING",
  "databasePrincipal": "mutakamel_provisioner",
  "credentialRevision": "5",
  "status": "READY"
}
```

Policy update:

```json
{
  "expectedCredentialRevision": "5",
  "rotationEnabled": true,
  "rotationIntervalHours": 720,
  "maintenanceWindowStartUtc": 1,
  "maintenanceWindowHours": 2,
  "reason": "Use the monthly maintenance window"
}
```

Worker scans due Application and system bindings every five minutes. It defers
outside the configured UTC window and while migration, backup, restore, tenant
provisioning, or a provisioning maintenance lease is active. Its Rabbit
command contains only IDs, purpose/key, expected revision, observed operation
generation, action, and timestamp. Core performs the password mutation.

## Lifecycle and recovery

```text
create DRAFT
  -> generate system + Application principals
  -> READY credentialBootstrap
  -> activate ACTIVE

READY/DEFERRED -> ROTATING -> READY
                         -> RECONCILING -> READY
                         -> DEGRADED
```

Activation fails closed unless both system principals and every required
Application binding are `READY`. Metadata, connection, and lifecycle changes
are blocked during mutating credential states. A non-ambiguous pre-mutation
rotation failure keeps the verified old credential and becomes `DEFERRED`; an
ambiguous PostgreSQL mutation retains the exact candidate and becomes
`RECONCILING`.

## Error examples and UI behavior

Validation failure:

```json
{
  "success": false,
  "statusCode": 400,
  "errorCode": "COMMON.GENERIC.VALIDATION_FAILED",
  "errorCategory": "VALIDATION",
  "message": "Validation failed",
  "details": {
    "securityAdminCredentials.password": ["password must be longer than or equal to 1 characters"]
  },
  "correlationId": "019fc7e0-bcef-727f-90cb-ff6028ed3306",
  "timestamp": "2026-08-03T18:01:00.000Z",
  "path": "/api/v1/admin/database-servers"
}
```

Gateway in-flight response:

```json
{
  "type": "https://errors.mutakamel.ai/gw/idem/in/flight",
  "title": "Request is already processing",
  "status": 409,
  "code": "GW.IDEM.IN.FLIGHT",
  "instance": "/api/admin/core/v1/database-servers/:id/credential-bootstrap/retry",
  "correlationId": "019fc7e0-bcef-727f-90cb-ff6028ed3306"
}
```

Required behavior:

- `400`: keep the form open and bind `details` paths to fields.
- `401`: use the coordinated shared refresh path.
- `403`: show a persistent forbidden state, not an empty state.
- `409` stale revision/state: refetch before creating a new intent.
- `409 GW.IDEM.IN.FLIGHT`: preserve the exact key and show processing.
- `422` connectivity/TLS/posture failure: keep write-only values in active
  component memory and display the safe message/correlation ID.
- `RECONCILING`: offer reconcile; do not generate a new candidate.
- `5xx`: preserve the correlation ID and allow a bounded retry.
- A definitive Database Server write `4xx` completes that failed intent at
  Gateway; rotate the key before a later create, soft-delete, or destroy
  submission so a cached conflict is not replayed.
  `GW.IDEM.IN_FLIGHT` is not definitive and retains the exact key. Network and
  `5xx` outcomes also retain the original key because acceptance is unknown.

## Admin Portal implementation

The active source:

- accepts only security-administrator credentials during registration;
- explains and enforces the exact `LOGIN + CREATEDB + CREATEROLE` posture,
  forbidden elevated attributes, `ADMIN`-only generated-role membership
  boundary, generated principals, and absence of `pg_read_all_data`;
- supports all four TLS modes and active-memory certificate upload fields;
- warns before registration that only already-`ACTIVE` eligible Applications
  receive bindings while preserving the safe empty-DRAFT recovery path;
- redirects the successful create response to the DRAFT detail screen;
- renders a unified credential-assembly rail and activation blocker;
- identifies the zero-active-Application blocker, disables a futile retry, and
  links authorized operators to Application Catalogue before retry backfills
  the newly eligible bindings;
- renders only the fixed provisioning principal with its revision,
  state/failure evidence, maintenance-aware hour policy, manual rotation, and
  reconciliation; Backup owns the equivalent `mutakamel_backup` UI;
- retains per-Application add, rotation, and reconciliation controls;
- exposes list-row soft delete only to administrators holding delete plus
  critical permissions and only for empty `DRAINING`/`OFFLINE` rows;
- exposes a `deleted=true` registry filter and shows permanent Destroy only for
  rows with non-null `deletedAt` and administrators holding delete.hard plus
  critical permissions;
- binds list rows and delete/destroy confirmations to the exact server-side
  filter/query generation that loaded them. Switching between current and
  deleted views clears dialogs immediately, aborts the previous request, and
  prevents a delayed row from exposing or executing Destroy;
- binds detail, Application bindings, history, lifecycle commands, and
  credential-dialog revision snapshots to the loaded route `id`. An A response
  or dialog cannot be committed or submitted after navigation to server B;
  a late mutation callback owned by A cannot start reconciliation that aborts
  or replaces B's current detail load;
- rotates command keys after definitive `4xx` rejections, retains exact keys
  for Gateway in-flight/network/`5xx` outcomes, and reconciles through a fresh
  server read before another lifecycle decision;
- contains no password reveal or one-time-file workflow.

Source integration and focused tests are not authenticated browser, live
PostgreSQL privilege, multi-replica convergence, deployment, or release proof.

## Source map

Backend authority:

- `mutakamel-apps/api-gateway-app/src/routing-proxy/route-contracts/core.route-contracts.ts`
- `mutakamel-apps/core-app/src/admin/database-servers/`
- `mutakamel-apps/core-app/packages/database/src/entities/control-plane/`
- `mutakamel-apps/worker-app/src/modules/cron-jobs/database-application-credential-rotation.scheduler.ts`

Frontend integration:

- `src/features/admin/database-servers/types/index.ts`
- `src/features/admin/database-servers/api/database-servers.api.ts`
- `src/features/admin/database-servers/hooks/useDatabaseServers.ts`
- `src/features/admin/database-servers/hooks/useDatabaseServerDetail.ts`
- `src/features/admin/database-servers/components/CreateDatabaseServerWizard.tsx`
- `src/features/admin/database-servers/components/SystemPrincipalRotationPolicy.tsx`
- `src/app/database-servers/[id]/page.tsx`


## DTOs (Migrated from dtos.md)

```typescript
interface DatabaseServerCredentialsDto {
  username: string;
  password: string;
}

interface DatabaseServerSslConfigDto {
  ca?: string;
  cert?: string;
  key?: string;
  passphrase?: string;
}

interface CreateDatabaseServerDto {
  name: string;
  host: string;
  port?: number;
  securityAdminCredentials: DatabaseServerCredentialsDto;
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

type CheckDatabaseServerConnectivityDto = Omit<
  CreateDatabaseServerDto,
  'name' | 'poolMin' | 'poolMax' | 'maxTenants' | 'countryName' | 'countryIsoCode'
>;

interface UpdateDatabaseServerDto {
  name?: string;
  host?: string;
  port?: number;
  securityAdminCredentials?: DatabaseServerCredentialsDto;
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
  maxTenants?: number;
  countryName?: string;
  countryIsoCode?: string;
}

interface RetryDatabaseServerCredentialBootstrapDto {
  reason: string;
}

interface UpdateDatabaseServerSystemPrincipalRotationDto {
  expectedCredentialRevision: string;
  rotationEnabled?: boolean;
  rotationIntervalHours?: number;
  maintenanceWindowStartUtc?: number;
  maintenanceWindowHours?: number;
  reason: string;
}

interface BootstrapDatabaseServerApplicationDto {
  expectedCatalogueRevision: string;
  expectedPolicyRevision: string;
  reason: string;
}

interface ApplicationDatabaseCredentialCommandDto {
  expectedCredentialRevision: string;
  reason: string;
}

interface DatabaseServerQueryDto {
  page?: number;
  limit?: number;
  sortBy?: 'name' | 'host' | 'currentTenants' | 'createdAt';
  sortDir?: 'ASC' | 'DESC';
  search?: string;
  status?: DatabaseServerStatus;
  countryIsoCode?: string;
  deleted?: boolean; // true returns only soft-deleted servers
}

interface DatabaseServerHistoryQueryDto {
  action?: DatabaseServerHistoryAction;
  limit?: number;
}
```

Credential and SSL values are write-only. Optional credential objects must be
omitted unless both username and password are present. Application passwords
are generated inside Core and are never accepted or returned by these DTOs.
Use the verified [Database Servers Frontend Contract](../api/database-servers.md)
for exact bounds, cross-field rules, receipts, and lifecycle preconditions.

---
