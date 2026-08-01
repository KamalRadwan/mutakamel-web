# Worker Backup and Restore API

Status: **Backend route family documented; frontend MISSING**

Last source verification: **2026-07-30**

Owner: **Worker**

Canonical browser prefix: `/api/admin/worker/v1`

This secondary Admin domain is outside the 243 Core Admin route count.

## Backup routes

| Method and canonical browser path | Permission |
| --- | --- |
| `GET /api/admin/worker/v1/backups/policies` | `admin.backups.read` |
| `GET /api/admin/worker/v1/backups/policies/:databaseServerId` | `admin.backups.read` |
| `PUT /api/admin/worker/v1/backups/policies/:databaseServerId` | `admin.backups.manage` |
| `GET /api/admin/worker/v1/backups/policies/:databaseServerId/databases` | `admin.backups.read` |
| `PUT /api/admin/worker/v1/backups/policies/:databaseServerId/databases/:tenantId` | `admin.backups.manage` |
| `DELETE /api/admin/worker/v1/backups/policies/:databaseServerId/databases/:tenantId` | `admin.backups.manage` |
| `POST /api/admin/worker/v1/backups/runs` | `admin.backups.manage` |
| `GET /api/admin/worker/v1/backups/runs` | `admin.backups.read` |
| `GET /api/admin/worker/v1/backups/runs/:runId` | `admin.backups.read` |
| `DELETE /api/admin/worker/v1/backups/runs/:runId` | `admin.backups.delete` |
| `GET /api/admin/worker/v1/backups/artifacts` | `admin.backups.read` |
| `DELETE /api/admin/worker/v1/backups/artifacts/:artifactId` | `admin.backups.delete` |

## Restore routes

| Method and canonical browser path | Permission |
| --- | --- |
| `POST /api/admin/worker/v1/restores/runs` | `admin.backups.restore` |
| `GET /api/admin/worker/v1/restores/runs` | `admin.backups.read` |
| `GET /api/admin/worker/v1/restores/runs/:runId` | `admin.backups.read` |
| `POST /api/admin/worker/v1/restores/runs/:runId/promote` | `admin.backups.restore` |

## Frontend rules

- Use the shared authenticated client and Worker canonical prefix.
- Keep backup/restore job state asynchronous and authoritative.
- Never expose storage credentials or artifact secrets.
- Apply exact Worker route idempotency/permissions after rechecking the current
  Worker Gateway contract.

## Current frontend status

No backup/restore route exists in Admin Portal source.

## Source map

- `../backend/mutakamel-apps/api-gateway-app/src/routing-proxy/route-contracts/worker.route-contracts.ts`
- `../backend/mutakamel-apps/worker-app/src/`
