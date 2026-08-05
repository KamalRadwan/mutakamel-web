# Backup and Restore API

Status: **[Verified]**

Last source verification: **2026-08-04**

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

## Worker backup routes

Permissions in one row use **ALL** semantics.

| Method and canonical browser path | Required permission(s) | Mutation idempotency |
| --- | --- | --- |
| `GET /api/admin/worker/v1/backups/policies` | `admin.backups.read` | Read-only |
| `GET /api/admin/worker/v1/backups/policies/:databaseServerId` | `admin.backups.read` | Read-only |
| `PUT /api/admin/worker/v1/backups/policies/:databaseServerId` | `admin.backups.manage` + `admin.backups.critical` | Stable caller-owned UUIDv7 key |
| `GET /api/admin/worker/v1/backups/policies/:databaseServerId/databases` | `admin.backups.read` | Read-only |
| `PUT /api/admin/worker/v1/backups/policies/:databaseServerId/databases/:tenantId` | `admin.backups.manage` + `admin.backups.critical` | Stable caller-owned UUIDv7 key |
| `DELETE /api/admin/worker/v1/backups/policies/:databaseServerId/databases/:tenantId` | `admin.backups.manage` + `admin.backups.critical` | Stable caller-owned UUIDv7 key |
| `POST /api/admin/worker/v1/backups/runs` | `admin.backups.manage` | **No idempotency key** |
| `GET /api/admin/worker/v1/backups/runs` | `admin.backups.read` | Read-only |
| `GET /api/admin/worker/v1/backups/runs/:runId` | `admin.backups.read` | Read-only |
| `DELETE /api/admin/worker/v1/backups/runs/:runId` | `admin.backups.delete` + `admin.backups.critical` | Stable caller-owned UUIDv7 key |
| `GET /api/admin/worker/v1/backups/artifacts` | `admin.backups.read` | Read-only |
| `DELETE /api/admin/worker/v1/backups/artifacts/:artifactId` | `admin.backups.delete` + `admin.backups.critical` | Stable caller-owned UUIDv7 key |

## Worker restore routes

| Method and canonical browser path | Required permission(s) | Mutation idempotency |
| --- | --- | --- |
| `POST /api/admin/worker/v1/restores/runs` | `admin.backups.restore` + `admin.backups.critical` | **No idempotency key** |
| `GET /api/admin/worker/v1/restores/runs` | `admin.backups.read` | Read-only |
| `GET /api/admin/worker/v1/restores/runs/:runId` | `admin.backups.read` | Read-only |
| `POST /api/admin/worker/v1/restores/runs/:runId/promote` | `admin.backups.restore` + `admin.backups.critical` | **No idempotency key** |

The client explicitly suppresses both automatic idempotency-key injection and
automatic authentication refresh/replay for manual backup start, restore start,
and restore promotion. It persists minimal non-secret attempt evidence before
submission and keeps ambiguous outcomes locked across reloads while the
operator reviews target-scoped Worker evidence. Do not add an automatic
transport retry or a UUIDv7 key to these three commands.

Worker does not yet expose a durable client-command identity for backup/restore
starts. A target-scoped read can provide operator evidence, but cannot prove the
identity of an accepted start command. Exact server-side command recovery is a
release gate; the browser must never infer success and automatically resubmit.

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
- Keep bounded Worker list responses bounded. Do not invent totals or
  pagination metadata that the API does not return.
- Never render or log passwords, `storageKey`, `storagePrefix`, `manifestKey`,
  raw artifact `metadata`, or raw restore `verification` payloads.
- The frontend Worker adapter immediately maps entity-shaped responses into an
  allowlisted view and replaces raw error/verification content with boolean
  evidence. This limits in-memory/UI exposure but does not secure the browser
  network response.
- The restore table may show that verification evidence exists, but not the
  evidence payload. Promotion remains a separate critical action and requires
  the exact target database name as confirmation.
- Preserve normalized error code, HTTP status, and `correlationId`; do not turn
  forbidden or unavailable states into empty tables.

## Open backend release gates

These are source-confirmed backend gaps and are intentionally not hidden by the
frontend implementation:

1. Worker controllers currently return persistence entities. Safe response
   DTOs/projections must omit storage prefixes/keys, manifest keys, arbitrary
   summary/metadata/verification JSON, internal process errors, and other
   non-public fields before the response reaches Gateway or a browser.
2. Backup start and restore start require a durable server-side client command
   identity and recovery projection so an ambiguous response can be reconciled
   exactly without creating a duplicate operation.

Until both gates are closed with backend contract tests, source-integrated UI
must not be described as production-ready or authenticated-runtime verified.

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
