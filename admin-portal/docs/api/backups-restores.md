# Backup and Restore API

Status: **[Verified]**

Last source verification: **2026-08-05**

Operational owner: **Worker**

Database-principal owner: **Core**

Canonical browser prefixes:

```text
/api/admin/worker/v1
/api/admin/core/v1
```

The Admin Portal UI route is singular `/backup`. Worker API resources remain
plural `/backups` and `/restores`; frontend route naming must not be copied into
API requests.

## UI module boundary

Database infrastructure and backup operations are separate top-level modules.

| UI module | Responsibilities |
| --- | --- |
| `/database-servers` | Database Server registry, connection/TLS, lifecycle, the fixed `mutakamel_provisioner` principal, and per-Application principals. It may read Core's aggregate backup-readiness flag to block activation and link to `/backup/access?databaseServerId=:id`, but it does not render or mutate the Backup principal. |
| `/backup` | Backup database access, Worker policies, database overrides, backup runs, retained artifacts, isolated restore verification, and verified-restore promotion. Its Core adapter owns the `mutakamel_backup` rotation policy, regeneration, and reconciliation UI. |

Core remains the credential authority. Generated passwords are never returned
to the browser, and Worker operations do not require the portal to handle a
database password.

## Frontend routes

The `/backup` layout and top-level navigation item require
`admin.backups.read`.

| Frontend route | Purpose | Additional frontend permission boundary |
| --- | --- | --- |
| `/backup` | Protection-chain overview for access, policy, latest backup evidence, and restore verification | Core access evidence additionally requires `admin.database_servers.read` |
| `/backup/access` | Fixed `mutakamel_backup` status, rotation policy, regeneration, and reconciliation | See the exact Core permission pairs below |
| `/backup/policies` | Server policy and per-database overrides | Server selection requires `admin.database_servers.read`; mutations require `admin.backups.manage` + `admin.backups.critical` |
| `/backup/runs` | Bounded backup-run history and manual start/delete actions | Start requires `admin.backups.manage`; delete requires `admin.backups.delete` + `admin.backups.critical` |
| `/backup/artifacts` | Bounded artifact evidence, delete, and restore hand-off | Delete requires `admin.backups.delete` + `admin.backups.critical`; restore actions require `admin.backups.restore` + `admin.backups.critical` |
| `/backup/restores` | Isolated restore tests, verification state, and promotion | Start and promotion require `admin.backups.restore` + `admin.backups.critical` |

The database-access and policy screens fail closed when the administrator can
read backup operations but cannot read the Database Server registry. A `403` is
permission evidence, not an empty result.

Backup retention is always a positive day count. The clean V1 backend and UI
default it to `30`; blank or `null` does not mean unlimited retention.

## Worker backup routes

Permissions in one row use **ALL** semantics.

| Method and canonical browser path | Required permission(s) | Mutation idempotency |
| --- | --- | --- |
| `GET /api/admin/worker/v1/backups/policies` | `admin.backups.read` | Read-only |
| `GET /api/admin/worker/v1/backups/policies/:databaseServerId` | `admin.backups.read` | Read-only |
| `PATCH /api/admin/worker/v1/backups/policies/:databaseServerId` | `admin.backups.manage` + `admin.backups.critical` | Stable caller-owned UUIDv7 key |
| `GET /api/admin/worker/v1/backups/policies/:databaseServerId/databases` | `admin.backups.read` | Read-only |
| `PATCH /api/admin/worker/v1/backups/policies/:databaseServerId/databases/:tenantId` | `admin.backups.manage` + `admin.backups.critical` | Stable caller-owned UUIDv7 key |
| `DELETE /api/admin/worker/v1/backups/policies/:databaseServerId/databases/:tenantId` | `admin.backups.manage` + `admin.backups.critical` | Stable caller-owned UUIDv7 key |
| `POST /api/admin/worker/v1/backups/runs` | `admin.backups.manage` | Stable caller-owned UUIDv7 command key |
| `GET /api/admin/worker/v1/backups/runs` | `admin.backups.read` | Read-only |
| `GET /api/admin/worker/v1/backups/runs/:runId` | `admin.backups.read` | Read-only |
| `DELETE /api/admin/worker/v1/backups/runs/:runId` | `admin.backups.delete` + `admin.backups.critical` | Stable caller-owned UUIDv7 key |
| `GET /api/admin/worker/v1/backups/artifacts` | `admin.backups.read` | Read-only |
| `DELETE /api/admin/worker/v1/backups/artifacts/:artifactId` | `admin.backups.delete` + `admin.backups.critical` | Stable caller-owned UUIDv7 key |

## Worker restore routes

| Method and canonical browser path | Required permission(s) | Mutation idempotency |
| --- | --- | --- |
| `POST /api/admin/worker/v1/restores/runs` | `admin.backups.restore` + `admin.backups.critical` | Stable caller-owned UUIDv7 command key |
| `GET /api/admin/worker/v1/restores/runs` | `admin.backups.read` | Read-only |
| `GET /api/admin/worker/v1/restores/runs/:runId` | `admin.backups.read` | Read-only |
| `POST /api/admin/worker/v1/restores/runs/:runId/promote` | `admin.backups.restore` + `admin.backups.critical` | Stable caller-owned UUIDv7 command key |

Manual backup start, restore start, and restore promotion are Gateway
`WRITE_SENSITIVE` commands. Each exact intent owns one UUIDv7
`x-idempotency-key`. Gateway does not retry their upstream transport, while an
authentication refresh or operator retry reuses the same key and exact body.
The browser clears the key only after a definitive outcome. Network/unknown
responses, final `401`, `5xx`, and `GW.IDEM.IN_FLIGHT` retain it. While such an
outcome is unresolved, an intent change is blocked rather than sent under the
retained key.

For manual backup start, restore start, and restore promotion, the browser
writes one route-specific recovery marker to tab-scoped `sessionStorage`
before sending the command. The marker contains only the UUIDv7 key, canonical
route, SHA-256 intent digest, an allowlisted resource kind/id, and save time.
It never contains the command body, audit reason, target database name, or
promotion confirmation text. An exact re-entry produces the same digest and
reuses the key; a different body fails closed. If the marker cannot be stored,
the command is not sent. After reload, the operator must inspect authoritative
run/restore history and re-enter the exact original values when a retry is
required. An authoritative `PROMOTED` restore row clears its matching promotion
marker; successful exact retries clear all three marker types.

Worker durably binds the command key to the verified Gateway actor, operation,
SHA-256 intent fingerprint, accepted resource ID, and acceptance time before
dispatching the effect. Only the transaction winner starts work. An exact retry
returns the original run, changed actor/body reuse is a conflict, and only one
promotion command may ever be accepted for a restore run. Promotion identity is
stored before the control-plane mutation, so an exact retry can finish an
interrupted promotion without creating a second command.

## Core Backup-principal adapter

The Backup module uses a dedicated Core adapter for the fixed
`mutakamel_backup` principal. The adapter accepts only the `BACKUP` purpose plus
that exact principal and fails closed on a mismatched projection.

| Method and canonical browser path | Required permission(s) | Mutation idempotency |
| --- | --- | --- |
| `GET /api/admin/core/v1/database-servers?page=:page&limit=100` | `admin.database_servers.read` | Read-only; the selector follows Core pagination until `hasNext=false` |
| `GET /api/admin/core/v1/database-servers/:id/system-principals` | `admin.database_servers.read` | Read-only; the adapter selects only `BACKUP` |
| `PATCH /api/admin/core/v1/database-servers/:id/system-principals/backup/rotation-policy` | `admin.database_servers.update` + `admin.database_servers.critical` | Stable caller-owned UUIDv7 key |
| `POST /api/admin/core/v1/database-servers/:id/system-principals/backup/credential/regenerate` | `admin.database_servers.credentials.rotate` + `admin.database_servers.critical` | Stable caller-owned UUIDv7 key |
| `POST /api/admin/core/v1/database-servers/:id/system-principals/backup/credential/reconcile` | `admin.database_servers.credentials.rotate` + `admin.database_servers.critical` | Stable caller-owned UUIDv7 key |

These Core commands retain one key for the exact intent through pending,
in-flight, and exact replay handling. Their responses contain only safe status
and credential-revision evidence.

## Rendering and state rules

- Use the shared authenticated client with the canonical Core or Worker browser
  prefix; never call controller-relative internal paths.
- Treat backup and restore state as asynchronous and Worker-authoritative.
- Treat the browser recovery marker as duplicate-prevention evidence, not as
  proof that Worker accepted or completed a command.
- Keep bounded Worker list responses bounded. Do not invent totals or
  pagination metadata that the API does not return.
- Administrator artifact reads remain capped at 500 rows. Destructive internal
  run cleanup uses a separate exhaustive lookup so Database Server hard destroy
  cannot leave artifact rows beyond that public read cap.
- Never render or log passwords, `storageKey`, `storagePrefix`, `manifestKey`,
  raw artifact `metadata`, or raw restore `verification` payloads.
- Worker maps persistence entities to explicit admin response projections
  before they leave the service. The public views contain boolean failure and
  verification evidence plus an allowlisted `failureCode`; they never contain
  raw errors, storage coordinates, arbitrary JSON, or credential material.
- The restore table may show that verification evidence exists, but not the
  evidence payload. Promotion remains a separate critical action and requires
  the exact target database name as confirmation.
- Preserve normalized error code, HTTP status, and `correlationId`; do not turn
  forbidden or unavailable states into empty tables.

## Remaining release evidence

The source-level safe-response and durable command-identity gates are closed.
Production claims still require publishing and adopting the amended Worker
database package, executing the clean V1 schema in the target Worker database,
and authenticated Gateway/Worker/browser verification. Source tests and builds
are not deployment evidence.

## Source map

Backend authority:

- `mutakamel-apps/api-gateway-app/src/routing-proxy/route-contracts/worker.route-contracts.ts`
- `mutakamel-apps/api-gateway-app/src/routing-proxy/route-contracts/core.route-contracts.ts`
- `mutakamel-apps/worker-app/src/modules/backup-restore/`
- `mutakamel-apps/core-app/src/admin/database-servers/`

Frontend integration:

- `src/app/backup/`
- `src/features/admin/backup/api/backup.api.ts`
- `src/features/admin/backup/api/backup-database-access.api.ts`
- `src/features/admin/backup/hooks/`
- `src/features/admin/backup/screens/`
- `src/features/admin/backup/components/BackupModuleNav.tsx`
- `src/app/database-servers/[id]/page.tsx`
